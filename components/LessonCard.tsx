'use client';

import { formatDate, formatTimeRange, generateGoogleCalendarUrl } from '@/lib/utils';
import { getLessonType, formatRate, getWeeklyPerLessonRate } from '@/config/lessonTypes';
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
    lesson.zoom_join_url || undefined
  );

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 border border-transparent dark:border-gray-700 ${isCancelled ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {lessonType?.name || lesson.lesson_type}
            {lesson.is_recurring && (
              <span className="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-400">
                🔄 Monthly
              </span>
            )}
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
        
        {lessonType && !lesson.is_recurring && (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {formatRate(lessonType.rate)}
          </span>
        )}
        
        {lessonType && lesson.is_recurring && (
          <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
            Billed monthly
          </span>
        )}
        
        {isAdmin && onTogglePaid && !isCancelled && (
          <button
            onClick={() => onTogglePaid(lesson.id, !lesson.is_paid)}
            className="flex items-center gap-2 ml-auto"
            title={`Click to mark as ${lesson.is_paid ? 'not paid' : 'paid'}`}
          >
            <span className={`text-xs ${lesson.is_paid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {lesson.is_paid ? 'Paid' : 'Not paid yet'}
            </span>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              lesson.is_paid ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                lesson.is_paid ? 'translate-x-[18px]' : 'translate-x-1'
              }`} />
            </div>
          </button>
        )}
        
        {isAdmin && !onTogglePaid && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            lesson.is_paid 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
          }`}>
            {lesson.is_paid ? '✓ Paid' : '⏳ Not paid yet'}
          </span>
        )}
        
        {isAdmin && isCancelled && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            lesson.is_paid 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
          }`}>
            {lesson.is_paid ? '✓ Paid' : '⏳ Not paid yet'}
          </span>
        )}
      </div>

      {lesson.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 italic">
          &ldquo;{lesson.notes}&rdquo;
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        {lesson.location_type === 'zoom' && !isCancelled && !isPast && lesson.zoom_join_url && (
          <a
            href={lesson.zoom_join_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Join Zoom Meeting →
          </a>
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
