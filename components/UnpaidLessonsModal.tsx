'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { formatDate, formatTime } from '@/lib/utils';
import { getLessonType, formatRate } from '@/config/lessonTypes';

interface Lesson {
  id: string;
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  start_time: string;
  student: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

interface UnpaidLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnpaidLessonsModal({ isOpen, onClose }: UnpaidLessonsModalProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchUnpaidLessons();
    }
  }, [isOpen]);

  const fetchUnpaidLessons = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lessons/unpaid');
      if (response.ok) {
        const data = await response.json();
        setLessons(data.lessons || []);
      }
    } catch (error) {
      console.error('Error fetching unpaid lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLesson = (id: string) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLessons(newSelected);
  };

  const toggleAll = () => {
    if (selectedLessons.size === lessons.length) {
      setSelectedLessons(new Set());
    } else {
      setSelectedLessons(new Set(lessons.map((l) => l.id)));
    }
  };

  const handleSendReminders = () => {
    // TODO: Implement email reminder functionality
    alert(`Reminder emails will be sent for ${selectedLessons.size} lesson(s). (Feature coming soon)`);
  };

  const totalAmount = lessons.reduce((sum, lesson) => {
    const lessonType = getLessonType(lesson.lesson_type);
    return sum + (lessonType?.rate ?? 0);
  }, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unpaid Lessons" size="3xl">
      <div className="max-h-[70vh] overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No unpaid lessons found
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b dark:border-gray-700">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {lessons.length} unpaid lesson{lessons.length !== 1 ? 's' : ''}
                </span>
                <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Total: {formatRate(totalAmount)}
                </span>
              </div>
              <button
                onClick={handleSendReminders}
                disabled={selectedLessons.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send Reminder{selectedLessons.size !== 1 ? 's' : ''} ({selectedLessons.size})
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLessons.size === lessons.length && lessons.length > 0}
                        onChange={toggleAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Lesson
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {lessons.map((lesson) => {
                    const lessonType = getLessonType(lesson.lesson_type);
                    const lessonDate = new Date(lesson.start_time);
                    const isPast = lessonDate < new Date();

                    return (
                      <tr
                        key={lesson.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                          isPast ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedLessons.has(lesson.id)}
                            onChange={() => toggleLesson(lesson.id)}
                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {lesson.student?.full_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {lesson.student?.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {lessonType?.name || lesson.lesson_type}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {lesson.location_type === 'zoom' ? '📹 Zoom' : '📍 In-Person'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDate(lessonDate)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(lessonDate)}
                            {isPast && (
                              <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                                (Past due)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatRate(lessonType?.rate ?? 0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
