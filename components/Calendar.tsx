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
  view?: 'month' | 'week';
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  lessons = [],
  googleEvents = [],
  availableDates = [],
  view = 'month',
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

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const inCurrentMonth = isCurrentMonth(day);

          return (
            <button
              key={index}
              onClick={() => onDateSelect(day)}
              className={`
                min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r dark:border-gray-700 text-left
                transition-colors hover:bg-gray-50 dark:hover:bg-gray-700
                ${!inCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600' : 'dark:text-gray-200'}
                ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 ring-inset' : ''}
              `}
            >
              <div className="flex flex-col h-full">
                <span
                  className={`
                    inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-sm rounded-full
                    ${isTodayDate ? 'bg-indigo-600 text-white font-semibold' : ''}
                    ${isSelected && !isTodayDate ? 'bg-indigo-100 text-indigo-700' : ''}
                  `}
                >
                  {day.getDate()}
                </span>
                
                <div className="mt-1 space-y-1 overflow-hidden">
                  {/* Availability indicator */}
                  {hasAvailability && inCurrentMonth && (
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" title="Available" />
                  )}
                  
                  {/* Lessons */}
                  {dayLessons.slice(0, 2).map((lesson) => (
                    <div
                      key={lesson.id}
                      className="text-xs truncate px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                      title={`${lesson.lesson_type} - ${lesson.student?.full_name || 'Student'}`}
                    >
                      <span className="hidden sm:inline">
                        {new Date(lesson.start_time).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </span>
                    </div>
                  ))}
                  
                  {/* Google Calendar events */}
                  {dayGoogleEvents.slice(0, 1).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs truncate px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      title={event.summary}
                    >
                      <span className="hidden sm:inline">{event.summary}</span>
                    </div>
                  ))}
                  
                  {/* More indicator */}
                  {(dayLessons.length > 2 || dayGoogleEvents.length > 1) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{dayLessons.length + dayGoogleEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
