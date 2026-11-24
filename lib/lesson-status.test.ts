import { describe, it, expect } from 'vitest';
import {
  lessonBucket,
  countLessonBuckets,
  countUnpaidPastLessons,
  getNextLesson,
  type BucketableLesson,
} from './lesson-status';

const NOW = new Date('2026-11-23T18:00:00Z');

function lesson(overrides: Partial<BucketableLesson> & { id?: string } = {}): BucketableLesson & { id: string } {
  return {
    id: overrides.id ?? 'l1',
    status: 'scheduled',
    start_time: '2026-11-30T18:00:00Z',
    is_paid: false,
    ...overrides,
  };
}

describe('lessonBucket', () => {
  it('treats a future scheduled lesson as upcoming', () => {
    expect(lessonBucket(lesson({ start_time: '2026-11-30T18:00:00Z' }), NOW)).toBe('upcoming');
  });

  it('treats a past scheduled lesson as completed (nothing ever writes status=completed)', () => {
    expect(lessonBucket(lesson({ start_time: '2026-11-01T18:00:00Z' }), NOW)).toBe('completed');
  });

  it('treats a lesson that has started but not ended as completed, matching the details view', () => {
    expect(lessonBucket(lesson({ start_time: '2026-11-23T17:30:00Z' }), NOW)).toBe('completed');
  });

  it('treats an explicit completed status as completed', () => {
    expect(lessonBucket(lesson({ status: 'completed', start_time: '2026-11-30T18:00:00Z' }), NOW)).toBe('completed');
  });

  it('treats a cancelled lesson as cancelled whether past or future', () => {
    expect(lessonBucket(lesson({ status: 'cancelled', start_time: '2026-11-01T18:00:00Z' }), NOW)).toBe('cancelled');
    expect(lessonBucket(lesson({ status: 'cancelled', start_time: '2026-11-30T18:00:00Z' }), NOW)).toBe('cancelled');
  });
});

describe('countLessonBuckets', () => {
  it('counts each lesson in exactly one bucket', () => {
    const lessons = [
      lesson({ id: 'a', start_time: '2026-12-01T18:00:00Z' }),
      lesson({ id: 'b', start_time: '2026-12-08T18:00:00Z' }),
      lesson({ id: 'c', start_time: '2026-11-01T18:00:00Z' }),
      lesson({ id: 'd', start_time: '2026-11-08T18:00:00Z' }),
      lesson({ id: 'e', start_time: '2026-11-15T18:00:00Z' }),
      lesson({ id: 'f', status: 'cancelled', start_time: '2026-11-10T18:00:00Z' }),
      lesson({ id: 'g', status: 'cancelled', start_time: '2026-12-15T18:00:00Z' }),
    ];
    expect(countLessonBuckets(lessons, NOW)).toEqual({ upcoming: 2, completed: 3, cancelled: 2 });
  });

  it('returns zeros for a student with no lessons', () => {
    expect(countLessonBuckets([], NOW)).toEqual({ upcoming: 0, completed: 0, cancelled: 0 });
  });
});

describe('countUnpaidPastLessons', () => {
  it('counts only past, scheduled, unpaid lessons', () => {
    const lessons = [
      lesson({ id: 'past-unpaid', start_time: '2026-11-01T18:00:00Z' }),
      lesson({ id: 'past-paid', start_time: '2026-11-02T18:00:00Z', is_paid: true }),
      lesson({ id: 'future-unpaid', start_time: '2026-12-01T18:00:00Z' }),
      lesson({ id: 'past-cancelled', status: 'cancelled', start_time: '2026-11-03T18:00:00Z' }),
    ];
    expect(countUnpaidPastLessons(lessons, NOW)).toBe(1);
  });
});

describe('getNextLesson', () => {
  it('returns the earliest upcoming lesson regardless of array order', () => {
    const lessons = [
      lesson({ id: 'later', start_time: '2026-12-15T18:00:00Z' }),
      lesson({ id: 'past', start_time: '2026-11-01T18:00:00Z' }),
      lesson({ id: 'soonest', start_time: '2026-11-25T18:00:00Z' }),
      lesson({ id: 'cancelled-sooner', status: 'cancelled', start_time: '2026-11-24T18:00:00Z' }),
    ];
    expect(getNextLesson(lessons, NOW)?.id).toBe('soonest');
  });

  it('returns undefined when nothing is upcoming', () => {
    expect(getNextLesson([lesson({ start_time: '2026-11-01T18:00:00Z' })], NOW)).toBeUndefined();
  });
});
