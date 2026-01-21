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
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={student.full_name || 'Student'}
              className="w-12 h-12 rounded-full mr-3"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
              <span className="text-indigo-600 font-semibold text-lg">
                {(student.full_name || student.email)[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {student.full_name || 'No name'}
            </h3>
            <p className="text-sm text-gray-500">{student.email}</p>
          </div>
        </div>
        
        {unpaidCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            {unpaidCount} unpaid
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-500">Upcoming</p>
          <p className="font-medium text-gray-900">{upcomingLessons.length} lessons</p>
        </div>
        <div>
          <p className="text-gray-500">Completed</p>
          <p className="font-medium text-gray-900">{completedLessons.length} lessons</p>
        </div>
      </div>

      {nextLesson && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">Next Lesson</p>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(new Date(nextLesson.start_time), 'short')}
          </p>
          <p className="text-xs text-gray-600">
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
          className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          View Details
        </button>
        {unpaidCount > 0 && onSendReminder && (
          <button
            onClick={onSendReminder}
            className="px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            title="Send payment reminder"
          >
            📧
          </button>
        )}
      </div>
    </div>
  );
}
