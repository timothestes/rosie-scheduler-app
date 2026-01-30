'use client';

import { useState, useEffect, useRef } from 'react';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import { getLessonType } from '@/config/lessonTypes';
import { formatDate } from '@/lib/utils';
import type { Lesson } from '@/types';

type ViewMode = 'timeline' | 'list';
type FilterType = 'all' | 'upcoming' | 'past' | 'cancelled' | 'unpaid';

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);
  const [isTodayVisible, setIsTodayVisible] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLessons();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.isAdmin || false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/lessons');
      if (res.ok) {
        const data = await res.json();
        setLessons(data);
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

  const handleCancelLesson = async (cancelSeries?: boolean) => {
    if (!lessonToCancel) return;

    const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'cancelled',
        cancellation_reason: isAdmin ? 'Cancelled by admin' : 'Cancelled by student',
        cancel_series: cancelSeries,
      }),
    });

    if (res.ok) {
      if (cancelSeries && lessonToCancel.recurring_series_id) {
        setLessons((prev) =>
          prev.map((l) => {
            if (l.id === lessonToCancel.id) {
              return { ...l, status: 'cancelled' };
            }
            if (
              l.recurring_series_id === lessonToCancel.recurring_series_id &&
              new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
              l.status === 'scheduled'
            ) {
              return { ...l, status: 'cancelled' };
            }
            return l;
          })
        );
      } else {
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lessonToCancel.id ? { ...l, status: 'cancelled' } : l
          )
        );
      }
    }

    setLessonToCancel(null);
  };

  const handleTogglePaid = async (lessonId: string, isPaid: boolean) => {
    const res = await fetch(`/api/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: isPaid }),
    });

    if (res.ok) {
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, is_paid: isPaid } : l))
      );
    }
  };

  const getFutureLessonsCount = () => {
    if (!lessonToCancel?.recurring_series_id) return 0;
    return lessons.filter(
      (l) =>
        l.recurring_series_id === lessonToCancel.recurring_series_id &&
        l.id !== lessonToCancel.id &&
        new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
        l.status === 'scheduled'
    ).length;
  };

  const now = new Date();
  
  const filteredLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(lesson.start_time);
    
    if (filter === 'upcoming') {
      return lessonDate >= now && lesson.status !== 'cancelled';
    } else if (filter === 'past') {
      return lessonDate < now && lesson.status !== 'cancelled';
    } else if (filter === 'cancelled') {
      return lesson.status === 'cancelled';
    } else if (filter === 'unpaid') {
      return !lesson.is_paid && lesson.status !== 'cancelled';
    }
    return lesson.status !== 'cancelled'; // 'all' excludes cancelled
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Group lessons by date for timeline view
  const groupedLessons = filteredLessons.reduce((acc, lesson) => {
    const dateKey = formatDate(new Date(lesson.start_time), 'iso');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(lesson);
    return acc;
  }, {} as Record<string, Lesson[]>);

  const sortedDates = Object.keys(groupedLessons).sort();

  // Check if there are lessons today
  const todayKey = formatDate(new Date(), 'iso');
  const hasTodayLessons = sortedDates.includes(todayKey);

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      // Find the first day column to get its width (288px width + 24px gap = 312px, but we'll measure dynamically)
      const dayColumn = timelineRef.current.querySelector('[data-day-column]') as HTMLElement;
      const gap = 24; // gap-6 = 24px
      const scrollAmount = dayColumn ? dayColumn.offsetWidth + gap : 312;
      
      timelineRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const scrollToToday = () => {
    if (timelineRef.current) {
      const todayColumn = timelineRef.current.querySelector('[data-today="true"]') as HTMLElement;
      if (todayColumn) {
        const container = timelineRef.current;
        const containerWidth = container.offsetWidth;
        const columnLeft = todayColumn.offsetLeft;
        const columnWidth = todayColumn.offsetWidth;
        // Center the today column in the container
        const scrollPosition = columnLeft - (containerWidth / 2) + (columnWidth / 2);
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  // Check if today column is visible in the viewport
  const checkTodayVisible = () => {
    if (!timelineRef.current) return;
    const todayColumn = timelineRef.current.querySelector('[data-today="true"]') as HTMLElement;
    if (!todayColumn) {
      setIsTodayVisible(false);
      return;
    }
    const container = timelineRef.current;
    const containerRect = container.getBoundingClientRect();
    const todayRect = todayColumn.getBoundingClientRect();
    // Check if today column is mostly visible (center is within container)
    const todayCenter = todayRect.left + todayRect.width / 2;
    const isVisible = todayCenter >= containerRect.left + 60 && todayCenter <= containerRect.right - 60;
    setIsTodayVisible(isVisible);
  };

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    
    checkTodayVisible();
    container.addEventListener('scroll', checkTodayVisible);
    window.addEventListener('resize', checkTodayVisible);
    
    return () => {
      container.removeEventListener('scroll', checkTodayVisible);
      window.removeEventListener('resize', checkTodayVisible);
    };
  }, [filteredLessons, viewMode]);

  // Stats
  const upcomingCount = lessons.filter(
    (l) => new Date(l.start_time) >= now && l.status !== 'cancelled'
  ).length;
  
  const pastCount = lessons.filter(
    (l) => new Date(l.start_time) < now && l.status !== 'cancelled'
  ).length;

  const cancelledCount = lessons.filter(
    (l) => l.status === 'cancelled'
  ).length;

  const totalCount = lessons.filter((l) => l.status !== 'cancelled').length;

  const unpaidCount = lessons.filter(
    (l) => !l.is_paid && l.status !== 'cancelled'
  ).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAdmin ? 'All Lessons' : 'My Lessons'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isAdmin 
              ? `Managing ${totalCount} lesson${totalCount !== 1 ? 's' : ''} across all students`
              : `You have ${upcomingCount} upcoming lesson${upcomingCount !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <span className="text-sm text-gray-500 dark:text-gray-400">View:</span>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Timeline
              </span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs - horizontally scrollable on mobile */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === 'upcoming'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === 'past'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Past ({pastCount})
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === 'cancelled'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
          <button
            onClick={() => setFilter('unpaid')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === 'unpaid'
                ? 'bg-orange-600 dark:bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Unpaid ({unpaidCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === 'all'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All ({totalCount})
          </button>
        </div>
        {/* Jump to Today - inline on desktop, hidden here on mobile (shown separately) */}
        {viewMode === 'timeline' && hasTodayLessons && (
          <button
            onClick={scrollToToday}
            disabled={isTodayVisible}
            className={`hidden sm:flex px-3 py-2 text-sm font-medium rounded-full transition-colors shadow flex-shrink-0 items-center gap-1.5 ${
              isTodayVisible
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default'
                : 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Today
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredLessons.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-12 text-center border border-transparent dark:border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No lessons found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {filter === 'upcoming'
              ? "There are no upcoming lessons scheduled."
              : filter === 'past'
                ? "There are no past lessons to show."
                : filter === 'cancelled'
                  ? "There are no cancelled lessons."
                  : "No lessons have been scheduled yet."}
          </p>
          {!isAdmin && filter === 'upcoming' && (
            <a
              href="/schedule"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Schedule a Lesson
            </a>
          )}
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="relative">
          {/* Jump to Today Button - mobile only (desktop shows inline with filters) */}
          {hasTodayLessons && (
            <div className="flex sm:hidden justify-center mb-4">
              <button
                onClick={scrollToToday}
                disabled={isTodayVisible}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors shadow-lg flex items-center gap-1.5 ${
                  isTodayVisible
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default'
                    : 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Jump to Today
              </button>
            </div>
          )}
          {/* Gradient Fade - Left (hidden on mobile) */}
          <div className="hidden sm:block absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50 dark:from-gray-950 to-transparent z-[5] pointer-events-none" />
          {/* Gradient Fade - Right (hidden on mobile) */}
          <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50 dark:from-gray-950 to-transparent z-[5] pointer-events-none" />
          
          {/* Scroll Buttons - hidden on mobile (use swipe instead) */}
          <button
            onClick={() => scrollTimeline('left')}
            className="hidden sm:block absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg rounded-full p-3 hover:bg-white dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => scrollTimeline('right')}
            className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg rounded-full p-3 hover:bg-white dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Timeline Container - less padding on mobile */}
          <div
            ref={timelineRef}
            className="overflow-x-auto scrollbar-hide px-4 sm:px-16 pb-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex gap-4 sm:gap-6 min-w-max py-2">
              {sortedDates.map((dateKey) => {
                const date = new Date(dateKey + 'T00:00:00');
                const isToday = formatDate(new Date(), 'iso') === dateKey;
                const dayLessons = groupedLessons[dateKey];
                
                return (
                  <div key={dateKey} data-day-column data-today={isToday ? "true" : undefined} className="flex flex-col items-center snap-center w-72 flex-shrink-0">
                    {/* Date Header */}
                    <div className={`text-center mb-4 pb-3 border-b-2 ${isToday ? 'border-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
                      <div className={`text-xs uppercase tracking-wide font-semibold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-2xl font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                        {date.getDate()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    
                    {/* Lessons for this date */}
                    <div className="flex flex-col gap-3 w-full">
                      {dayLessons.map((lesson) => (
                        <LessonCard
                          key={lesson.id}
                          lesson={lesson}
                          isAdmin={isAdmin}
                          showStudent={isAdmin}
                          onCancel={
                            new Date(lesson.start_time) > now && lesson.status === 'scheduled'
                              ? openCancelModal
                              : undefined
                          }
                          onTogglePaid={isAdmin ? handleTogglePaid : undefined}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Grid/List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isAdmin={isAdmin}
              showStudent={isAdmin}
              onCancel={
                new Date(lesson.start_time) > now && lesson.status === 'scheduled'
                  ? openCancelModal
                  : undefined
              }
              onTogglePaid={isAdmin ? handleTogglePaid : undefined}
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
        isRecurring={lessonToCancel?.is_recurring || false}
        futureLessonsCount={getFutureLessonsCount()}
      />
    </div>
  );
}
