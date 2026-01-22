'use client';

import { useState, useEffect } from 'react';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import { getLessonType } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

export default function MyLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/lessons');
      if (res.ok) {
        setLessons(await res.json());
      }
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCancelModal = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setLessonToCancel(lesson);
      setCancelModalOpen(true);
    }
  };

  const handleCancelLesson = async () => {
    if (!lessonToCancel) return;

    const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'cancelled',
        cancellation_reason: 'Cancelled by student',
      }),
    });

    if (res.ok) {
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonToCancel.id ? { ...l, status: 'cancelled' } : l
        )
      );
    }
    
    setLessonToCancel(null);
  };

  const now = new Date();
  const filteredLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(lesson.start_time);
    
    if (filter === 'upcoming') {
      return lessonDate >= now && lesson.status !== 'cancelled';
    } else if (filter === 'past') {
      return lessonDate < now || lesson.status === 'cancelled';
    }
    return true;
  });

  const upcomingCount = lessons.filter(
    (l) => new Date(l.start_time) >= now && l.status !== 'cancelled'
  ).length;
  
  const pastCount = lessons.filter(
    (l) => new Date(l.start_time) < now || l.status === 'cancelled'
  ).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">My Lessons</h1>

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 max-w-md">
        <button
          onClick={() => setFilter('upcoming')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'upcoming'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'past'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Past ({pastCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          All ({lessons.length})
        </button>
      </div>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center border border-transparent dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'upcoming'
              ? "You don't have any upcoming lessons"
              : filter === 'past'
                ? "You don't have any past lessons"
                : "You haven't booked any lessons yet"}
          </p>
          {filter === 'upcoming' && (
            <a
              href="/schedule"
              className="inline-block mt-4 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
            >
              Schedule a Lesson
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onCancel={
                new Date(lesson.start_time) > now && lesson.status === 'scheduled'
                  ? openCancelModal
                  : undefined
              }
            />
          ))}
        </div>
      )}

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
      />
    </div>
  );
}
