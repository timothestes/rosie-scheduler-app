'use client';

import { useState, useEffect, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import AvailabilityEditor from '@/components/AvailabilityEditor';
import DayOverrideEditor from '@/components/DayOverrideEditor';
import Modal from '@/components/Modal';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import { formatDate, formatTime, dayNames, startOfMonth, endOfMonth, addMonths } from '@/lib/utils';
import { getLessonType } from '@/config/lessonTypes';
import type { Lesson, Availability, GoogleCalendarEvent, AvailabilityOverride } from '@/types';

// Convert 24-hour time string (HH:MM:SS or HH:MM) to 12-hour format
const formatTime12Hour = (time: string | null | undefined): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

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
  const [showDayOverrideEditor, setShowDayOverrideEditor] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);
  const [showCancelledLessons, setShowCancelledLessons] = useState(false);
  const [blockOutMode, setBlockOutMode] = useState(false);
  const [selectedBlockOutDates, setSelectedBlockOutDates] = useState<Set<string>>(new Set());
  const [cancelLessonsOnBlockOut, setCancelLessonsOnBlockOut] = useState(false);

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
    // Optimistic update - update UI immediately
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, is_paid: isPaid } : l))
    );

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid }),
      });

      if (!res.ok) {
        // Revert on failure
        setLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, is_paid: !isPaid } : l))
        );
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      // Revert on error
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, is_paid: !isPaid } : l))
      );
    }
  };

  const openCancelModal = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setLessonToCancel(lesson);
      setCancelModalOpen(true);
    }
  };

  const handleCancelLesson = async (cancelSeries?: boolean) => {
    if (!lessonToCancel) return;

    const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancel_series: cancelSeries }),
    });

    if (res.ok) {
      if (cancelSeries && lessonToCancel.recurring_series_id) {
        // Update all future lessons in the series locally
        setLessons((prev) =>
          prev.map((l) => {
            if (l.id === lessonToCancel.id) {
              return { ...l, status: 'cancelled' };
            }
            if (
              l.recurring_series_id === lessonToCancel.recurring_series_id &&
              new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
              l.status === 'scheduled'
            ) {
              return { ...l, status: 'cancelled' };
            }
            return l;
          })
        );
      } else {
        setLessons((prev) =>
          prev.map((l) => (l.id === lessonToCancel.id ? { ...l, status: 'cancelled' } : l))
        );
      }
    }
    
    setLessonToCancel(null);
  };

  // Handle saving a date-specific override
  const handleSaveOverride = async (data: { is_available: boolean; start_time?: string; end_time?: string }) => {
    const dateStr = formatDate(selectedDate, 'iso');
    
    try {
      const res = await fetch('/api/availability/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          override_date: dateStr,
          is_available: data.is_available,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
        }),
      });

      if (res.ok) {
        const newOverride = await res.json();
        setOverrides((prev) => {
          // Replace existing override for this date or add new one
          const existing = prev.findIndex((o) => o.override_date === dateStr);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newOverride;
            return updated;
          }
          return [...prev, newOverride];
        });
        setShowDayOverrideEditor(false);
      }
    } catch (error) {
      console.error('Error saving override:', error);
    }
  };

  // Handle removing a date-specific override
  const handleRemoveOverride = async () => {
    const dateStr = formatDate(selectedDate, 'iso');
    
    try {
      const res = await fetch(`/api/availability/overrides?date=${dateStr}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.override_date !== dateStr));
      }
    } catch (error) {
      console.error('Error removing override:', error);
    }
  };

  // Handle saving multiple block out days
  const handleSaveBlockOutDays = async () => {
    const dates = Array.from(selectedBlockOutDates);
    
    try {
      // Save all block out dates
      const results = await Promise.all(
        dates.map((dateStr) =>
          fetch('/api/availability/overrides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              override_date: dateStr,
              is_available: false,
              start_time: null,
              end_time: null,
            }),
          }).then((res) => res.ok ? res.json() : null)
        )
      );

      // Add successful overrides to state
      const newOverrides = results.filter(Boolean);
      setOverrides((prev) => {
        const updated = [...prev];
        for (const override of newOverrides) {
          const existingIdx = updated.findIndex((o) => o.override_date === override.override_date);
          if (existingIdx >= 0) {
            updated[existingIdx] = override;
          } else {
            updated.push(override);
          }
        }
        return updated;
      });

      // Cancel lessons if user opted in
      if (cancelLessonsOnBlockOut && lessonsOnBlockOutDates.length > 0) {
        const cancelResults = await Promise.all(
          lessonsOnBlockOutDates.map((lesson) =>
            fetch(`/api/lessons/${lesson.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'cancelled' }),
            })
          )
        );

        // Update local state for cancelled lessons
        const cancelledIds = lessonsOnBlockOutDates.map((l) => l.id);
        setLessons((prev) =>
          prev.map((l) =>
            cancelledIds.includes(l.id) ? { ...l, status: 'cancelled' } : l
          )
        );
      }

      // Exit block out mode
      setBlockOutMode(false);
      setSelectedBlockOutDates(new Set());
      setCancelLessonsOnBlockOut(false);
    } catch (error) {
      console.error('Error saving block out days:', error);
    }
  };

  // Toggle a date in block out selection
  const toggleBlockOutDate = (date: Date) => {
    const dateStr = formatDate(date, 'iso');
    setSelectedBlockOutDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  // Get lessons on selected block out dates
  const getLessonsOnBlockOutDates = () => {
    return lessons.filter((lesson) => {
      if (lesson.status !== 'scheduled') return false;
      const lessonDateStr = formatDate(new Date(lesson.start_time), 'iso');
      return selectedBlockOutDates.has(lessonDateStr);
    });
  };

  const lessonsOnBlockOutDates = getLessonsOnBlockOutDates();

  // Count future lessons in the same series for the cancel modal
  const getFutureLessonsCount = () => {
    if (!lessonToCancel?.recurring_series_id) return 0;
    return lessons.filter(
      (l) =>
        l.recurring_series_id === lessonToCancel.recurring_series_id &&
        l.id !== lessonToCancel.id &&
        new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
        l.status === 'scheduled'
    ).length;
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
    const isOnSelectedDate = 
      lessonDate.getFullYear() === selectedDate.getFullYear() &&
      lessonDate.getMonth() === selectedDate.getMonth() &&
      lessonDate.getDate() === selectedDate.getDate();
    
    // Hide cancelled lessons unless toggle is on
    if (!showCancelledLessons && l.status === 'cancelled') {
      return false;
    }
    
    return isOnSelectedDate;
  });

  // Get set of Google Calendar event IDs that were created by lessons
  const lessonGoogleEventIds = new Set(
    lessons
      .filter((l) => l.google_calendar_event_id)
      .map((l) => l.google_calendar_event_id)
  );

  const selectedDateEvents = googleEvents.filter((e) => {
    // Filter out events that were created by this app (lessons)
    if (lessonGoogleEventIds.has(e.id)) {
      return false;
    }
    
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
            Edit Weekly Availability
          </button>
          <button
            onClick={() => {
              setBlockOutMode(true);
              setSelectedBlockOutDates(new Set());
            }}
            className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            Block Out Days
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

      {/* Block Out Mode Banner */}
      {blockOutMode && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-800 dark:text-red-200 font-medium">
                Block Out Mode
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Click on calendar days to select them. Selected days will be marked as unavailable.
                {selectedBlockOutDates.size > 0 && (
                  <span className="font-medium"> ({selectedBlockOutDates.size} day{selectedBlockOutDates.size !== 1 ? 's' : ''} selected)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBlockOutMode(false);
                  setSelectedBlockOutDates(new Set());
                  setCancelLessonsOnBlockOut(false);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBlockOutDays}
                disabled={selectedBlockOutDates.size === 0}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Block {selectedBlockOutDates.size} Day{selectedBlockOutDates.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>

          {/* Warning about lessons on selected dates */}
          {lessonsOnBlockOutDates.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {lessonsOnBlockOutDates.length} lesson{lessonsOnBlockOutDates.length !== 1 ? 's' : ''} scheduled on selected days
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {lessonsOnBlockOutDates.slice(0, 3).map((l) => l.student?.full_name || l.student?.email || 'Student').join(', ')}
                    {lessonsOnBlockOutDates.length > 3 && ` and ${lessonsOnBlockOutDates.length - 3} more`}
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cancelLessonsOnBlockOut}
                      onChange={(e) => setCancelLessonsOnBlockOut(e.target.checked)}
                      className="rounded border-amber-400 dark:border-amber-600 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      Also cancel these lessons
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show cancelled toggle */}
      <div className="mb-4 flex items-center gap-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showCancelledLessons}
            onChange={(e) => setShowCancelledLessons(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
        </label>
        <span className="text-sm text-gray-600 dark:text-gray-400">Show cancelled lessons</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              if (blockOutMode) {
                toggleBlockOutDate(date);
              } else {
                setSelectedDate(date);
                setShowDayDetails(true);
              }
            }}
            lessons={showCancelledLessons ? lessons : lessons.filter(l => l.status !== 'cancelled')}
            googleEvents={googleEvents.filter((e) => !lessonGoogleEventIds.has(e.id))}
            availableDates={getAvailableDates()}
            blockedDates={overrides.filter((o) => !o.is_available).map((o) => o.override_date)}
            blockOutMode={blockOutMode}
            selectedBlockOutDates={selectedBlockOutDates}
          />
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
              Available
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
              Blocked Out
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Availability</h3>
              {!dayOverride && (
                <button
                  onClick={() => setShowDayOverrideEditor(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  title="Customize this day"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add override</span>
                </button>
              )}
            </div>
            {dayOverride ? (
              <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm">
                      {dayOverride.is_available ? (
                        <span className="text-green-600 dark:text-green-400">
                          Custom: {formatTime12Hour(dayOverride.start_time)} - {formatTime12Hour(dayOverride.end_time)}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Blocked for this day</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">One-time override</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowDayOverrideEditor(true)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Edit override"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleRemoveOverride}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Reset to weekly schedule"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : dayAvailability.length > 0 ? (
              <div className="space-y-1">
                {dayAvailability.map((a) => (
                  <div key={a.id} className="text-sm text-green-600 dark:text-green-400">
                    {formatTime12Hour(a.start_time)} - {formatTime12Hour(a.end_time)}
                  </div>
                ))}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">From weekly schedule</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Not available (no weekly schedule)</p>
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Google Calendar ({selectedDateEvents.length})
              </h3>
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600">
                    <p className="font-medium text-gray-900 dark:text-white">{event.summary}</p>
                    {event.start.dateTime && (
                      <p className="text-gray-500 dark:text-gray-400">
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
        isRecurring={lessonToCancel?.is_recurring || false}
        futureLessonsCount={getFutureLessonsCount()}
      />

      {/* Day Override Editor Modal */}
      <Modal
        isOpen={showDayOverrideEditor}
        onClose={() => setShowDayOverrideEditor(false)}
        title="Customize Day Availability"
        size="md"
      >
        <DayOverrideEditor
          date={selectedDate}
          currentOverride={dayOverride}
          weeklyAvailability={dayAvailability.map(a => ({ start_time: a.start_time, end_time: a.end_time }))}
          onSave={handleSaveOverride}
          onReset={async () => {
            await handleRemoveOverride();
            setShowDayOverrideEditor(false);
          }}
          onCancel={() => setShowDayOverrideEditor(false)}
        />
      </Modal>
    </div>
  );
}
