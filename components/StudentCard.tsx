'use client';

import { formatDate } from '@/lib/utils';
import type { User, Lesson } from '@/types';

interface StudentCardProps {
  student: User;
  lessons: Lesson[];
  unpaidCount: number;
  onViewDetails: () => void;
  onSendReminder?: () => void;
}

export default function StudentCard({
  student,
  lessons,
  unpaidCount,
  onViewDetails,
  onSendReminder,
}: StudentCardProps) {
  const upcomingLessons = lessons.filter(
    (l) => new Date(l.start_time) > new Date() && l.status === 'scheduled'
  );
  const completedLessons = lessons.filter(
    (l) => l.status === 'completed' || new Date(l.start_time) < new Date()
  );

  const nextLesson = upcomingLessons[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow border border-transparent dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={student.full_name || 'Student'}
              className="w-12 h-12 rounded-full mr-3"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mr-3">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-lg">
                {(student.full_name || student.email)[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {student.full_name || 'No name'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{student.email}</p>
          </div>
        </div>
        
        {unpaidCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
            {unpaidCount} unpaid
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Upcoming</p>
          <p className="font-medium text-gray-900 dark:text-white">{upcomingLessons.length} lessons</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Completed</p>
          <p className="font-medium text-gray-900 dark:text-white">{completedLessons.length} lessons</p>
        </div>
      </div>

      {nextLesson && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Next Lesson</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(new Date(nextLesson.start_time), 'short')}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {new Date(nextLesson.start_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
            {' - '}
            {nextLesson.location_type === 'zoom' ? '📹 Zoom' : '📍 In-Person'}
          </p>
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={onViewDetails}
          className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        >
          View Details
        </button>
        {unpaidCount > 0 && onSendReminder && (
          <button
            onClick={onSendReminder}
            className="px-3 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
            title="Send payment reminder"
          >
            📧
          </button>
        )}
      </div>
    </div>
  );
}
