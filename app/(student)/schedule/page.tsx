'use client';

import { useState, useEffect, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import TimeSlotPicker from '@/components/TimeSlotPicker';
import BookingForm, { BookingData } from '@/components/BookingForm';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import Modal from '@/components/Modal';
import { formatDate, formatTime24to12, parseTimeToDate } from '@/lib/utils';
import type { Lesson, Availability, AvailabilityOverride, TimeSlot } from '@/types';

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [allLessonsForScheduling, setAllLessonsForScheduling] = useState<Lesson[]>([]);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);

    try {
      const [lessonsRes, allLessonsRes, availabilityRes, overridesRes, profileRes] = await Promise.all([
        fetch(`/api/lessons?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        fetch(`/api/lessons?startDate=${start.toISOString()}&endDate=${end.toISOString()}&forScheduling=true`),
        fetch('/api/availability'),
        fetch(`/api/availability/overrides?startDate=${formatDate(start, 'iso')}&endDate=${formatDate(end, 'iso')}`),
        fetch('/api/profile'),
      ]);

      if (lessonsRes.ok) setLessons(await lessonsRes.json());
      if (allLessonsRes.ok) setAllLessonsForScheduling(await allLessonsRes.json());
      if (availabilityRes.ok) setAvailability(await availabilityRes.json());
      if (overridesRes.ok) setOverrides(await overridesRes.json());
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setDiscountPercent(profile.discount_percent || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBlockedDates = (): string[] => {
    return overrides
      .filter((o) => !o.is_available)
      .map((o) => o.override_date);
  };

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
    // Use 30-minute increments - the TimeSlotPicker will handle duration-based filtering
    const slots: TimeSlot[] = [];
    const slotIncrement = 30; // minutes

    for (const window of availabilitySlots) {
      const [startHour, startMin] = window.start.split(':').map(Number);
      const [endHour, endMin] = window.end.split(':').map(Number);
      
      const windowStart = startHour * 60 + startMin;
      const windowEnd = endHour * 60 + endMin;
      const windowEndStr = window.end;

      // Generate slots starting every 30 minutes, as long as at least 30 mins fits
      for (let time = windowStart; time + slotIncrement <= windowEnd; time += 30) {
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

        // End time is tentatively 30 minutes after start (minimum slot)
        const endTime = time + slotIncrement;
        slots.push({
          start: timeStr,
          end: `${Math.floor(endTime / 60).toString().padStart(2, '0')}:${(endTime % 60).toString().padStart(2, '0')}`,
          windowEnd: windowEndStr,
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
          is_recurring: data.is_recurring,
          recurring_frequency: data.recurring_frequency,
          recurring_months: data.recurring_months,
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
  
  // Filter out cancelled lessons
  const activeLessons = lessons.filter((l) => l.status !== 'cancelled');
  
  // User's own lessons for the selected day
  const myDayLessons = activeLessons.filter((l) => {
    const lessonDate = formatDate(new Date(l.start_time), 'iso');
    return lessonDate === selectedDateStr;
  });
  
  // Use all lessons (including other students') for conflict detection in TimeSlotPicker
  const allDayLessons = allLessonsForScheduling.filter((l) => {
    const lessonDate = formatDate(new Date(l.start_time), 'iso');
    return lessonDate === selectedDateStr;
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
            lessons={activeLessons}
            availableDates={getAvailableDates()}
            blockedDates={getBlockedDates()}
          />
          
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
              Available
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
              Unavailable
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
                Select a time slot to book your lesson!
              </p>
              <TimeSlotPicker
                slots={timeSlots}
                selectedSlot={selectedTime}
                onSlotSelect={handleTimeSelect}
                lessons={allDayLessons}
                selectedDate={selectedDate}
              />
            </>
          )}
          
          {/* Show user's booked lessons for this day */}
          {myDayLessons.length > 0 && (
            <div className={timeSlots.length > 0 && !isPastDate ? "mt-6 pt-6 border-t border-gray-200 dark:border-gray-700" : ""}>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Your {myDayLessons.length === 1 ? 'Lesson' : 'Lessons'} on this Day
              </h3>
              <div className="space-y-3">
                {myDayLessons.map((lesson) => (
                  <LessonCard 
                    key={lesson.id} 
                    lesson={lesson} 
                    onCancel={(lessonId) => {
                      const lesson = lessons.find(l => l.id === lessonId);
                      if (lesson) setLessonToCancel(lesson);
                    }}
                    discountPercent={discountPercent}
                  />
                ))}
              </div>
            </div>
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
            isFirstLesson={lessons.length === 0}
            maxDuration={(() => {
              const slot = timeSlots.find(s => s.start === selectedTime);
              if (!slot?.windowEnd) return undefined;
              const [startH, startM] = selectedTime.split(':').map(Number);
              const [endH, endM] = slot.windowEnd.split(':').map(Number);
              return (endH * 60 + endM) - (startH * 60 + startM);
            })()}
            discountPercent={discountPercent}
          />
        )}
      </Modal>

      {/* Cancel Lesson Modal */}
      <CancelLessonModal
        isOpen={!!lessonToCancel}
        onClose={() => setLessonToCancel(null)}
        onConfirm={async (cancelSeries) => {
          if (!lessonToCancel) return;
          
          const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'cancelled',
              cancel_series: cancelSeries,
            }),
          });
          
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to cancel lesson');
          }
          
          setLessonToCancel(null);
          await fetchData();
        }}
        lessonDate={lessonToCancel ? new Date(lessonToCancel.start_time) : undefined}
        lessonType={lessonToCancel?.lesson_type}
        isRecurring={lessonToCancel?.is_recurring}
        futureLessonsCount={
          lessonToCancel?.recurring_series_id
            ? lessons.filter(
                l => l.recurring_series_id === lessonToCancel.recurring_series_id &&
                     new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
                     l.status !== 'cancelled'
              ).length
            : 0
        }
      />
    </div>
  );
}
