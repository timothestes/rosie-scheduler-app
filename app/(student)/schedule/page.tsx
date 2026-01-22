'use client';

import { useState, useEffect, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import TimeSlotPicker from '@/components/TimeSlotPicker';
import BookingForm, { BookingData } from '@/components/BookingForm';
import Modal from '@/components/Modal';
import { formatDate, formatTime24to12, parseTimeToDate, generateTimeSlots } from '@/lib/utils';
import { getLessonDuration } from '@/config/lessonTypes';
import type { Lesson, Availability, AvailabilityOverride, TimeSlot } from '@/types';

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedLessonType, setSelectedLessonType] = useState('standard');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);

    try {
      const [lessonsRes, availabilityRes, overridesRes] = await Promise.all([
        fetch(`/api/lessons?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        fetch('/api/availability'),
        fetch(`/api/availability/overrides?startDate=${formatDate(start, 'iso')}&endDate=${formatDate(end, 'iso')}`),
      ]);

      if (lessonsRes.ok) setLessons(await lessonsRes.json());
      if (availabilityRes.ok) setAvailability(await availabilityRes.json());
      if (overridesRes.ok) setOverrides(await overridesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAvailableDates = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Look 3 months ahead
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const dateStr = formatDate(date, 'iso');
      
      // Check for override
      const override = overrides.find((o) => o.override_date === dateStr);
      if (override) {
        if (override.is_available) {
          dates.push(dateStr);
        }
        continue;
      }
      
      // Check regular availability
      const hasAvailability = availability.some(
        (a) => a.day_of_week === dayOfWeek && a.is_recurring
      );
      if (hasAvailability) {
        dates.push(dateStr);
      }
    }

    return dates;
  };

  const getTimeSlotsForDate = (date: Date): TimeSlot[] => {
    const dayOfWeek = date.getDay();
    const dateStr = formatDate(date, 'iso');
    const today = new Date();
    const isToday = dateStr === formatDate(today, 'iso');
    
    // Check for override first
    const override = overrides.find((o) => o.override_date === dateStr);
    
    let availabilitySlots: { start: string; end: string }[] = [];
    
    if (override) {
      if (!override.is_available) {
        return []; // Day is blocked
      }
      if (override.start_time && override.end_time) {
        availabilitySlots = [{
          start: override.start_time.substring(0, 5),
          end: override.end_time.substring(0, 5),
        }];
      }
    } else {
      // Get regular availability
      const dayAvailability = availability.filter(
        (a) => a.day_of_week === dayOfWeek && a.is_recurring
      );
      availabilitySlots = dayAvailability.map((a) => ({
        start: a.start_time.substring(0, 5),
        end: a.end_time.substring(0, 5),
      }));
    }

    if (availabilitySlots.length === 0) {
      return [];
    }

    // Generate time slots for each availability window
    const slots: TimeSlot[] = [];
    const lessonDuration = getLessonDuration(selectedLessonType);

    for (const window of availabilitySlots) {
      const [startHour, startMin] = window.start.split(':').map(Number);
      const [endHour, endMin] = window.end.split(':').map(Number);
      
      const windowStart = startHour * 60 + startMin;
      const windowEnd = endHour * 60 + endMin;

      for (let time = windowStart; time + lessonDuration <= windowEnd; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Skip past times for today
        if (isToday) {
          const slotTime = parseTimeToDate(timeStr, date);
          if (slotTime <= today) {
            continue;
          }
        }

        slots.push({
          start: timeStr,
          end: `${Math.floor((time + lessonDuration) / 60).toString().padStart(2, '0')}:${((time + lessonDuration) % 60).toString().padStart(2, '0')}`,
          isAvailable: true,
        });
      }
    }

    return slots;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = async (data: BookingData) => {
    if (!selectedTime) return;

    setIsSubmitting(true);
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_type: data.lesson_type,
          location_type: data.location_type,
          start_time: startTime.toISOString(),
          notes: data.notes,
        }),
      });

      if (res.ok) {
        setBookingSuccess(true);
        setShowBookingForm(false);
        setSelectedTime(null);
        await fetchData();
        
        // Reset success message after delay
        setTimeout(() => setBookingSuccess(false), 5000);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to book lesson');
      }
    } catch (error) {
      console.error('Error booking lesson:', error);
      alert('Failed to book lesson');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDateStr = formatDate(selectedDate, 'iso');
  const isPastDate = new Date(selectedDateStr) < new Date(formatDate(new Date(), 'iso'));
  const timeSlots = getTimeSlotsForDate(selectedDate);
  const dayLessons = lessons.filter((l) => {
    const lessonDate = formatDate(new Date(l.start_time), 'iso');
    return lessonDate === selectedDateStr && l.status !== 'cancelled';
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Schedule a Lesson</h1>

      {bookingSuccess && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-medium">✓ Lesson booked successfully!</p>
          <p className="text-green-600 dark:text-green-400 text-sm">Check your email for confirmation details.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            lessons={lessons}
            availableDates={getAvailableDates()}
          />
          
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
              Available
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900 mr-2" />
              Your Booking
            </div>
          </div>
        </div>

        {/* Time Slot Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 border border-transparent dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {formatDate(selectedDate, 'long')}
          </h2>
          
          {isPastDate ? (
            <p className="text-gray-500 dark:text-gray-400">Cannot book lessons in the past</p>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No available times on this day</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Please select another date with availability
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select a time slot to book your lesson
              </p>
              <TimeSlotPicker
                slots={timeSlots}
                selectedSlot={selectedTime}
                onSlotSelect={handleTimeSelect}
                lessons={dayLessons}
                selectedLessonType={selectedLessonType}
              />
            </>
          )}
        </div>
      </div>

      {/* Booking Form Modal */}
      <Modal
        isOpen={showBookingForm}
        onClose={() => {
          setShowBookingForm(false);
          setSelectedTime(null);
        }}
        title="Book Your Lesson"
        size="lg"
      >
        {selectedTime && (
          <BookingForm
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSubmit={handleBookingSubmit}
            onCancel={() => {
              setShowBookingForm(false);
              setSelectedTime(null);
            }}
            isLoading={isSubmitting}
          />
        )}
      </Modal>
    </div>
  );
}
