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

  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState(false);
  const [showMessageEditor, setShowMessageEditor] = useState(false);
  const [customMessage, setCustomMessage] = useState(
    `Hi there,

This is a friendly reminder that you have unpaid lessons. Please send your payment via Venmo, Zelle, or your preferred method.

Thank you for your music lessons with me!

- Rosie`
  );

  const handleSendReminders = async () => {
    setIsSendingReminders(true);
    setReminderError(null);
    setReminderSuccess(false);

    try {
      // Group selected lessons by student
      const lessonsByStudent = new Map<string, Set<string>>();

      lessons.forEach(lesson => {
        if (selectedLessons.has(lesson.id) && lesson.student) {
          const studentId = lesson.student.id;
          if (!lessonsByStudent.has(studentId)) {
            lessonsByStudent.set(studentId, new Set());
          }
          lessonsByStudent.get(studentId)!.add(lesson.id);
        }
      });

      // Send reminders for each student
      const results = await Promise.allSettled(
        Array.from(lessonsByStudent.keys()).map(studentId =>
          fetch(`/api/students/${studentId}/send-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customMessage: customMessage.trim(),
            }),
          })
        )
      );

      const failedCount = results.filter(r => r.status === 'rejected').length;
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      if (failedCount > 0) {
        setReminderError(`Sent ${successCount} reminder(s), but ${failedCount} failed`);
      } else {
        setReminderSuccess(true);
        setSelectedLessons(new Set()); // Clear selection

        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      setReminderError('Failed to send reminders. Please try again.');
    } finally {
      setIsSendingReminders(false);
    }
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
            <div className="mb-4 pb-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {lessons.length} unpaid lesson{lessons.length !== 1 ? 's' : ''}
                  </span>
                  <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Total: {formatRate(totalAmount)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMessageEditor(!showMessageEditor)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    ✏️ {showMessageEditor ? 'Hide' : 'Edit'} Message
                  </button>
                  <button
                    onClick={handleSendReminders}
                    disabled={selectedLessons.size === 0 || isSendingReminders}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSendingReminders ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        📧 Send ({selectedLessons.size})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showMessageEditor && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Personal Message (will be sent to all selected students)
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="Enter your personal message..."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The email will also include each student's unpaid lessons list and total amount.
                  </p>
                </div>
              )}

              {reminderSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-300">
                  ✓ Reminders sent successfully!
                </div>
              )}

              {reminderError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                  {reminderError}
                </div>
              )}
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
