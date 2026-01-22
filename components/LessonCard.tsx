'use client';

import { formatDate, formatTimeRange, generateGoogleCalendarUrl } from '@/lib/utils';
import { getLessonType, formatRate } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

interface LessonCardProps {
  lesson: Lesson;
  isAdmin?: boolean;
  onCancel?: (lessonId: string) => void;
  onTogglePaid?: (lessonId: string, isPaid: boolean) => void;
  showStudent?: boolean;
}

export default function LessonCard({
  lesson,
  isAdmin = false,
  onCancel,
  onTogglePaid,
  showStudent = false,
}: LessonCardProps) {
  const lessonType = getLessonType(lesson.lesson_type);
  const startTime = new Date(lesson.start_time);
  const endTime = new Date(lesson.end_time);
  const isPast = startTime < new Date();
  const isCancelled = lesson.status === 'cancelled';

  const statusColors = {
    scheduled: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };

  const googleCalendarUrl = generateGoogleCalendarUrl(
    `${lessonType?.name || 'Lesson'} - Schedule a Lesson with Rosie`,
    `Lesson Type: ${lessonType?.name}\nLocation: ${lesson.location_type === 'zoom' ? 'Zoom' : 'In-Person'}${lesson.notes ? `\nNotes: ${lesson.notes}` : ''}`,
    startTime,
    endTime,
    lesson.location_type === 'zoom' ? process.env.NEXT_PUBLIC_ZOOM_MEETING_URL : undefined
  );

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 border border-transparent dark:border-gray-700 ${isCancelled ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {lessonType?.name || lesson.lesson_type}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(startTime, 'long')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {formatTimeRange(startTime, endTime)}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[lesson.status]}`}>
          {lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
        </span>
      </div>

      {showStudent && lesson.student && (
        <div className="mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Student:</span> {lesson.student.full_name || lesson.student.email}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`px-2 py-1 text-xs rounded-full ${
          lesson.location_type === 'zoom' 
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
        }`}>
          {lesson.location_type === 'zoom' ? '📹 Zoom' : '📍 In-Person'}
        </span>
        
        {lessonType && (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {formatRate(lessonType.rate)}
          </span>
        )}
        
        {isAdmin && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            lesson.is_paid 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
          }`}>
            {lesson.is_paid ? '✓ Paid' : '⏳ Unpaid'}
          </span>
        )}
      </div>

      {lesson.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 italic">
          &ldquo;{lesson.notes}&rdquo;
        </p>
      )}

      {lesson.location_type === 'zoom' && !isCancelled && !isPast && (
        <a
          href={process.env.NEXT_PUBLIC_ZOOM_MEETING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-3"
        >
          Join Zoom Meeting →
        </a>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        {!isCancelled && !isPast && (
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Add to Google Calendar
          </a>
        )}

        {isAdmin && !isCancelled && onTogglePaid && (
          <button
            onClick={() => onTogglePaid(lesson.id, !lesson.is_paid)}
            className={`text-sm ${
              lesson.is_paid 
                ? 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300' 
                : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'
            }`}
          >
            Mark as {lesson.is_paid ? 'Unpaid' : 'Paid'}
          </button>
        )}

        {!isCancelled && !isPast && onCancel && (
          <button
            onClick={() => onCancel(lesson.id)}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-auto"
          >
            Cancel Lesson
          </button>
        )}
      </div>
    </div>
  );
}
