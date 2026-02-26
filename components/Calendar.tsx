'use client';

import { useState } from 'react';
import {
  getMonthDays,
  addMonths,
  isSameDay,
  isToday,
  monthNames,
  dayNamesShort,
  formatDate,
} from '@/lib/utils';
import type { Lesson, GoogleCalendarEvent } from '@/types';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  lessons?: Lesson[];
  googleEvents?: GoogleCalendarEvent[];
  availableDates?: string[]; // YYYY-MM-DD format
  blockedDates?: string[]; // YYYY-MM-DD format - dates with block overrides
  view?: 'month' | 'week';
  blockOutMode?: boolean;
  selectedBlockOutDates?: Set<string>;
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  lessons = [],
  googleEvents = [],
  availableDates = [],
  blockedDates = [],
  view = 'month',
  blockOutMode = false,
  selectedBlockOutDates = new Set(),
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const days = getMonthDays(currentMonth);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const getLessonsForDay = (date: Date): Lesson[] => {
    return lessons.filter((lesson) => {
      const lessonDate = new Date(lesson.start_time);
      return isSameDay(lessonDate, date);
    });
  };

  const getGoogleEventsForDay = (date: Date): GoogleCalendarEvent[] => {
    return googleEvents.filter((event) => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      return isSameDay(eventDate, date);
    });
  };

  const isDateAvailable = (date: Date): boolean => {
    const dateStr = formatDate(date, 'iso');
    return availableDates.includes(dateStr);
  };

  const isDateBlocked = (date: Date): boolean => {
    const dateStr = formatDate(date, 'iso');
    return blockedDates.includes(dateStr);
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b dark:border-gray-700">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              setCurrentMonth(new Date());
              onDateSelect(new Date());
            }}
            className="px-3 py-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b dark:border-gray-700">
        {dayNamesShort.map((day) => (
          <div key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayLessons = getLessonsForDay(day);
          const dayGoogleEvents = getGoogleEventsForDay(day);
          const hasAvailability = isDateAvailable(day);
          const hasBlockedOverride = isDateBlocked(day);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const inCurrentMonth = isCurrentMonth(day);
          const dateStr = formatDate(day, 'iso');
          const isBlockOutSelected = blockOutMode && selectedBlockOutDates.has(dateStr);

          return (
            <button
              key={index}
              onClick={() => onDateSelect(day)}
              className={`
                min-h-[70px] sm:min-h-[100px] p-0.5 sm:p-2 border-b border-r dark:border-gray-700 text-left
                overflow-hidden transition-colors hover:bg-gray-50 dark:hover:bg-gray-700
                ${!inCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600' : 'dark:text-gray-200'}
                ${isSelected && !blockOutMode ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 ring-inset' : ''}
                ${blockOutMode && inCurrentMonth ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20' : ''}
                ${isBlockOutSelected ? 'bg-red-100 dark:bg-red-900/40 ring-2 ring-red-500 ring-inset' : ''}
              `}
            >
              <div className="flex flex-col h-full w-full items-center sm:items-start">
                <span
                  className={`
                    inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full flex-shrink-0
                    ${isTodayDate ? 'bg-indigo-600 text-white font-semibold' : ''}
                    ${isSelected && !isTodayDate ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200' : ''}
                  `}
                >
                  {day.getDate()}
                </span>

                <div className="mt-1 w-full space-y-0.5 min-w-0">
                  {/* Availability indicator */}
                  {hasAvailability && (
                    <div className={`h-1.5 w-1.5 rounded-full bg-green-500 ${!inCurrentMonth ? 'opacity-50' : ''}`} title="Available" />
                  )}

                  {/* Blocked out indicator */}
                  {hasBlockedOverride && (
                    <div className={`h-1.5 w-1.5 rounded-full bg-red-500 ${!inCurrentMonth ? 'opacity-50' : ''}`} title="Blocked Out" />
                  )}

                  {/* Lessons — show time only, full details on hover */}
                  {dayLessons.slice(0, 2).map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`hidden sm:block text-xs w-full truncate px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 ${!inCurrentMonth ? 'opacity-50' : ''}`}
                      title={`${lesson.student?.full_name || 'Student'} · ${lesson.lesson_type}`}
                    >
                      {new Date(lesson.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </div>
                  ))}
                  {/* Dot indicator on mobile where text chips are hidden */}
                  {dayLessons.length > 0 && (
                    <div className="sm:hidden flex gap-0.5 flex-wrap">
                      {dayLessons.slice(0, 3).map((lesson) => (
                        <div key={lesson.id} className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      ))}
                    </div>
                  )}

                  {/* Google Calendar events — time only, full title on hover */}
                  {dayGoogleEvents.slice(0, 1).map((event) => (
                    <div
                      key={event.id}
                      className={`hidden sm:block text-xs w-full truncate px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 ${!inCurrentMonth ? 'opacity-50' : ''}`}
                      title={event.summary}
                    >
                      {event.start.dateTime
                        ? new Date(event.start.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '·'}
                    </div>
                  ))}

                  {/* Overflow count */}
                  {(() => {
                    const overflow = Math.max(0, dayLessons.length - 2) + Math.max(0, dayGoogleEvents.length - 1);
                    return overflow > 0 ? (
                      <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 leading-tight">
                        +{overflow} more
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
