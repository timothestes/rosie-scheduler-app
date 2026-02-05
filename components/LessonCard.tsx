'use client';

import { useState } from 'react';
import { formatDate, formatTimeRange, generateGoogleCalendarUrl } from '@/lib/utils';
import { getLessonType, formatRate, getWeeklyPerLessonRate } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

interface LessonCardProps {
  lesson: Lesson;
  isAdmin?: boolean;
  onCancel?: (lessonId: string) => void;
  onTogglePaid?: (lessonId: string, isPaid: boolean) => void;
  showStudent?: boolean;
  discountPercent?: number; // Student's discount percentage (0-100)
}

export default function LessonCard({
  lesson,
  isAdmin = false,
  onCancel,
  onTogglePaid,
  showStudent = false,
  discountPercent = 0,
}: LessonCardProps) {
  const lessonType = getLessonType(lesson.lesson_type);
  const startTime = new Date(lesson.start_time);
  const endTime = new Date(lesson.end_time);
  const isPast = startTime < new Date();
  const isCancelled = lesson.status === 'cancelled';
  const [addressCopied, setAddressCopied] = useState(false);
  
  const copyAddress = async () => {
    if (lesson.location_address) {
      await navigator.clipboard.writeText(lesson.location_address);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };
  
  // Calculate discounted rate (rounds up to nearest dollar)
  const originalRate = lessonType?.rate ?? 0;
  const originalMonthlyRate = lessonType?.weeklyMonthlyRate ?? 0;
  const discountedRate = discountPercent > 0 
    ? Math.ceil(originalRate * (1 - discountPercent / 100))
    : originalRate;
  const discountedMonthlyRate = discountPercent > 0
    ? Math.ceil(originalMonthlyRate * (1 - discountPercent / 100))
    : originalMonthlyRate;
  const hasDiscount = discountPercent > 0 && !isPast;

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
            {hasDiscount ? (
              <>
                <span className="line-through text-gray-400 dark:text-gray-500 mr-1">{formatRate(originalRate)}</span>
                <span className="text-green-600 dark:text-green-400">{formatRate(discountedRate)}</span>
                <span className="ml-1 text-green-600 dark:text-green-400">({discountPercent}% off)</span>
              </>
            ) : (
              formatRate(lessonType.rate)
            )}
          </span>
        )}
        
        {lessonType && lesson.is_recurring && (
          <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
            {hasDiscount ? (
              <>
                <span className="line-through text-indigo-400 dark:text-indigo-500 mr-1">{formatRate(originalMonthlyRate)}</span>
                <span className="text-green-600 dark:text-green-400">{formatRate(discountedMonthlyRate)}/mo</span>
              </>
            ) : (
              <>{formatRate(originalMonthlyRate)}/mo</>
            )}
          </span>
        )}
      </div>

      {/* Address section for in-person lessons */}
      {lesson.location_type === 'in-person' && lesson.location_address && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <p 
              className="text-sm text-gray-700 dark:text-gray-300 flex-1 line-clamp-2"
              title={lesson.location_address}
            >
              {lesson.location_address}
            </p>
            <button
              onClick={copyAddress}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"
              title="Copy address"
            >
              {addressCopied ? (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Payment toggle - separate row for consistent layout */}
      {isAdmin && onTogglePaid && !isCancelled && (
        <div className="flex items-center justify-end mb-3">
          <button
            onClick={() => onTogglePaid(lesson.id, !lesson.is_paid)}
            className="flex items-center gap-2"
            title={`Click to mark as ${lesson.is_paid ? 'not paid' : 'paid'}`}
          >
            <span className={`text-xs min-w-[52px] text-right ${lesson.is_paid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {lesson.is_paid ? 'Paid' : 'Unpaid'}
            </span>
            <div className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
              lesson.is_paid ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                lesson.is_paid ? 'translate-x-[18px]' : 'translate-x-1'
              }`} />
            </div>
          </button>
        </div>
      )}
      
      {/* Payment status badge (when toggle not available) */}
      {isAdmin && !onTogglePaid && (
        <div className="flex items-center justify-end mb-3">
          <span className={`px-2 py-1 text-xs rounded-full ${
            lesson.is_paid 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
          }`}>
            {lesson.is_paid ? '✓ Paid' : '⏳ Unpaid'}
          </span>
        </div>
      )}
      
      {isAdmin && isCancelled && (
        <div className="flex items-center justify-end mb-3">
          <span className={`px-2 py-1 text-xs rounded-full ${
            lesson.is_paid 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
          }`}>
            {lesson.is_paid ? '✓ Paid' : '⏳ Unpaid'}
          </span>
        </div>
      )}

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
