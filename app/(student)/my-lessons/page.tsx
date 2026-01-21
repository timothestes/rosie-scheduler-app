'use client';

import { useState, useEffect } from 'react';
import LessonCard from '@/components/LessonCard';
import { canCancelWithoutFee, getCancellationFee } from '@/config/cancellationPolicy';
import { getLessonRate } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

export default function MyLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

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

  const handleCancelLesson = async (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    const startTime = new Date(lesson.start_time);
    const rate = getLessonRate(lesson.lesson_type);
    const fee = getCancellationFee(rate, startTime);
    const canCancelFree = canCancelWithoutFee(startTime);

    const message = canCancelFree
      ? 'Are you sure you want to cancel this lesson? You will receive a full refund.'
      : `Are you sure you want to cancel this lesson? A cancellation fee of $${fee} may apply.`;

    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
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
            l.id === lessonId ? { ...l, status: 'cancelled' } : l
          )
        );
      }
    } catch (error) {
      console.error('Error cancelling lesson:', error);
    }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">My Lessons</h1>

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-md">
        <button
          onClick={() => setFilter('upcoming')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'upcoming'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'past'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Past ({pastCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({lessons.length})
        </button>
      </div>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">
            {filter === 'upcoming'
              ? "You don't have any upcoming lessons"
              : filter === 'past'
                ? "You don't have any past lessons"
                : "You haven't booked any lessons yet"}
          </p>
          {filter === 'upcoming' && (
            <a
              href="/schedule"
              className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
                  ? handleCancelLesson
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
