'use client';

import { useState, useEffect, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import AvailabilityEditor from '@/components/AvailabilityEditor';
import Modal from '@/components/Modal';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import { formatDate, formatTime, dayNames, startOfMonth, endOfMonth, addMonths } from '@/lib/utils';
import { getLessonType } from '@/config/lessonTypes';
import type { Lesson, Availability, GoogleCalendarEvent, AvailabilityOverride } from '@/types';

export default function AdminCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const start = startOfMonth(addMonths(selectedDate, -1));
    const end = endOfMonth(addMonths(selectedDate, 1));

    try {
      const [lessonsRes, availabilityRes, overridesRes, eventsRes] = await Promise.all([
        fetch(`/api/lessons?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        fetch('/api/availability'),
        fetch(`/api/availability/overrides?startDate=${formatDate(start, 'iso')}&endDate=${formatDate(end, 'iso')}`),
        fetch(`/api/calendar/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
      ]);

      if (lessonsRes.ok) {
        setLessons(await lessonsRes.json());
      }
      if (availabilityRes.ok) {
        setAvailability(await availabilityRes.json());
      }
      if (overridesRes.ok) {
        setOverrides(await overridesRes.json());
      }
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        setGoogleEvents(events);
        // If we got events (even empty array from successful request), calendar is connected
        setGoogleCalendarConnected(true);
      } else {
        // No Google Calendar connected
        setGoogleCalendarConnected(false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setGoogleCalendarConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConnectGoogleCalendar = () => {
    // Redirect to re-auth with calendar scope
    window.location.href = '/api/auth/google-calendar';
  };

  const handleSaveAvailability = async (newAvailability: Partial<Availability>[]) => {
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: newAvailability, replaceAll: true }),
      });

      if (res.ok) {
        await fetchData();
        setShowAvailabilityEditor(false);
      }
    } catch (error) {
      console.error('Error saving availability:', error);
    }
  };

  const handleTogglePaid = async (lessonId: string, isPaid: boolean) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid }),
      });

      if (res.ok) {
        setLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, is_paid: isPaid } : l))
        );
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const openCancelModal = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setLessonToCancel(lesson);
      setCancelModalOpen(true);
    }
  };

  const handleCancelLesson = async () => {
    if (!lessonToCancel) return;

    const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    if (res.ok) {
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonToCancel.id ? { ...l, status: 'cancelled' } : l))
      );
    }
    
    setLessonToCancel(null);
  };

  const getAvailableDates = (): string[] => {
    const dates: string[] = [];
    const start = startOfMonth(addMonths(selectedDate, -1));
    const end = endOfMonth(addMonths(selectedDate, 1));

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = formatDate(d, 'iso');
      
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

  const selectedDateLessons = lessons.filter((l) => {
    const lessonDate = new Date(l.start_time);
    return (
      lessonDate.getFullYear() === selectedDate.getFullYear() &&
      lessonDate.getMonth() === selectedDate.getMonth() &&
      lessonDate.getDate() === selectedDate.getDate()
    );
  });

  const selectedDateEvents = googleEvents.filter((e) => {
    const eventDate = new Date(e.start.dateTime || e.start.date || '');
    return (
      eventDate.getFullYear() === selectedDate.getFullYear() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getDate() === selectedDate.getDate()
    );
  });

  const dayOfWeek = selectedDate.getDay();
  const dateStr = formatDate(selectedDate, 'iso');
  const dayOverride = overrides.find((o) => o.override_date === dateStr);
  const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek && a.is_recurring);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <div className="flex gap-3">
          {googleCalendarConnected === false && (
            <button
              onClick={handleConnectGoogleCalendar}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Calendar
            </button>
          )}
          <button
            onClick={() => setShowAvailabilityEditor(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
          >
            Edit Availability
          </button>
        </div>
      </div>

      {googleCalendarConnected === false && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Tip:</strong> Connect your Google Calendar to see your personal events overlaid on the schedule. This helps avoid double-booking.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setShowDayDetails(true);
            }}
            lessons={lessons}
            googleEvents={googleEvents}
            availableDates={getAvailableDates()}
          />
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
              Available
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900 mr-2" />
              Lesson Booked
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 mr-2" />
              Google Calendar
            </div>
          </div>
        </div>

        {/* Day Details Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {formatDate(selectedDate, 'long')}
          </h2>

          {/* Day Availability */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Availability</h3>
            {dayOverride ? (
              <div className="text-sm">
                {dayOverride.is_available ? (
                  <span className="text-green-600">
                    Custom: {dayOverride.start_time?.substring(0, 5)} - {dayOverride.end_time?.substring(0, 5)}
                  </span>
                ) : (
                  <span className="text-red-600">Blocked (override)</span>
                )}
              </div>
            ) : dayAvailability.length > 0 ? (
              <div className="space-y-1">
                {dayAvailability.map((a) => (
                  <div key={a.id} className="text-sm text-green-600">
                    {a.start_time.substring(0, 5)} - {a.end_time.substring(0, 5)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not available</p>
            )}
          </div>

          {/* Lessons */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Lessons ({selectedDateLessons.length})
            </h3>
            {selectedDateLessons.length > 0 ? (
              <div className="space-y-3">
                {selectedDateLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    isAdmin
                    showStudent
                    onTogglePaid={handleTogglePaid}
                    onCancel={openCancelModal}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No lessons scheduled</p>
            )}
          </div>

          {/* Google Calendar Events */}
          {selectedDateEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Google Calendar ({selectedDateEvents.length})
              </h3>
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="p-2 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium text-gray-900">{event.summary}</p>
                    {event.start.dateTime && (
                      <p className="text-gray-500">
                        {formatTime(new Date(event.start.dateTime))}
                        {event.end.dateTime && ` - ${formatTime(new Date(event.end.dateTime))}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Availability Editor Modal */}
      <Modal
        isOpen={showAvailabilityEditor}
        onClose={() => setShowAvailabilityEditor(false)}
        title="Edit Weekly Availability"
        size="lg"
      >
        <AvailabilityEditor
          availability={availability}
          onSave={handleSaveAvailability}
          isLoading={isLoading}
        />
      </Modal>

      {/* Cancel Lesson Modal */}
      <CancelLessonModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setLessonToCancel(null);
        }}
        onConfirm={handleCancelLesson}
        lessonDate={lessonToCancel ? new Date(lessonToCancel.start_time) : undefined}
        lessonType={lessonToCancel ? getLessonType(lessonToCancel.lesson_type)?.name : undefined}
      />
    </div>
  );
}
