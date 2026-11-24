import type { Lesson } from '@/types';

/**
 * How the admin UI groups a student's lessons. Every lesson lands in exactly
 * one bucket.
 *
 * Nothing in the app ever writes status = 'completed': a lesson stays
 * 'scheduled' after it happens. So a 'scheduled' lesson that has started
 * counts as completed, the same rule the student details view uses.
 */
export type LessonBucket = 'upcoming' | 'completed' | 'cancelled';

export type BucketableLesson = Pick<Lesson, 'status' | 'start_time' | 'is_paid'>;

export function lessonBucket(lesson: BucketableLesson, now: Date = new Date()): LessonBucket {
  if (lesson.status === 'cancelled') return 'cancelled';
  if (lesson.status === 'completed') return 'completed';
  return new Date(lesson.start_time) > now ? 'upcoming' : 'completed';
}

export function countLessonBuckets(
  lessons: BucketableLesson[],
  now: Date = new Date()
): Record<LessonBucket, number> {
  const counts: Record<LessonBucket, number> = { upcoming: 0, completed: 0, cancelled: 0 };
  for (const lesson of lessons) counts[lessonBucket(lesson, now)]++;
  return counts;
}

/** Lessons that have happened but haven't been paid for. */
export function countUnpaidPastLessons(lessons: BucketableLesson[], now: Date = new Date()): number {
  return lessons.filter(
    (l) => !l.is_paid && l.status === 'scheduled' && new Date(l.start_time) < now
  ).length;
}

/** The soonest upcoming lesson, independent of the array's order. */
export function getNextLesson<T extends BucketableLesson>(lessons: T[], now: Date = new Date()): T | undefined {
  let next: T | undefined;
  for (const lesson of lessons) {
    if (lessonBucket(lesson, now) !== 'upcoming') continue;
    if (!next || new Date(lesson.start_time) < new Date(next.start_time)) next = lesson;
  }
  return next;
}
