import { describe, it, expect } from 'vitest';
import { evaluateConflict, maxAvailableDuration, overlapsBusyBlock, type ExistingLesson } from './conflicts-core';

const BUF = 30 * 60 * 1000; // 30 min
const occStart = new Date('2026-07-03T16:00:00.000Z');
const occEnd = new Date('2026-07-03T16:30:00.000Z'); // 30-min lesson
const ME = 'student-me';

function lesson(partial: Partial<ExistingLesson>): ExistingLesson {
  return {
    id: 'other-lesson',
    start_time: '2026-07-03T16:00:00.000Z',
    end_time: '2026-07-03T16:30:00.000Z',
    location_type: 'zoom',
    student_id: 'someone-else',
    status: 'scheduled',
    ...partial,
  };
}

describe('evaluateConflict', () => {
  it('returns available when there are no existing lessons', () => {
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [], BUF)).toEqual({
      status: 'available',
      reason: null,
      conflictIsOwnLesson: false,
    });
  });

  it('flags an exact overlap with another student (own=false)', () => {
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({})], BUF);
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('overlap');
    expect(r.conflictIsOwnLesson).toBe(false);
  });

  it('flags an exact overlap with the student\'s own lesson (own=true)', () => {
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({ student_id: ME })], BUF);
    expect(r.status).toBe('conflict');
    expect(r.conflictIsOwnLesson).toBe(true);
  });

  it('treats an adjacent (touching, non-overlapping) lesson as available', () => {
    const adjacent = lesson({ start_time: '2026-07-03T16:30:00.000Z', end_time: '2026-07-03T17:00:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [adjacent], BUF).status).toBe('available');
  });

  it('applies the commute buffer vs another student\'s in-person lesson', () => {
    // Other student's in-person lesson ends 15 min before occ start -> within 30-min buffer
    const near = lesson({ location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    const r = evaluateConflict(occStart, occEnd, 'in-person', ME, [near], BUF);
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('commute_buffer');
  });

  it('does NOT apply the buffer against the student\'s own in-person lesson', () => {
    const ownNear = lesson({ student_id: ME, location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'in-person', ME, [ownNear], BUF).status).toBe('available');
  });

  it('does NOT apply the buffer when the new lesson is zoom', () => {
    const near = lesson({ location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [near], BUF).status).toBe('available');
  });

  it('ignores cancelled lessons', () => {
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({ status: 'cancelled' })], BUF).status).toBe('available');
  });
});

describe('evaluateConflict with excludeLessonId', () => {
  it('ignores the excluded lesson (a lesson never conflicts with itself)', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME });
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [self], BUF, 'lesson-1');
    expect(r.status).toBe('available');
  });

  it('still flags a different overlapping lesson while excluding self', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME });
    const other = lesson({ id: 'lesson-2', student_id: 'someone-else' });
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [self, other], BUF, 'lesson-1');
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('overlap');
  });

  it('excludes self from the commute-buffer check too', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME, location_type: 'in-person' });
    const r = evaluateConflict(occStart, occEnd, 'in-person', ME, [self], BUF, 'lesson-1');
    expect(r.status).toBe('available');
  });
});

describe('maxAvailableDuration', () => {
  // Rosie's availability window on this day runs 3:00 PM (start) to 6:00 PM.
  const start = new Date('2026-07-03T15:00:00.000Z'); // a slot the student picked
  const windowEnd = new Date('2026-07-03T18:00:00.000Z');

  it('returns the full window when nothing is booked', () => {
    expect(maxAvailableDuration(start, windowEnd, ME, [], BUF)).toBe(180);
  });

  it('caps duration at the next booking (the 3:00 PM / 3:30 PM bug)', () => {
    // Something is booked at 3:30 PM. A lesson starting at 3:00 PM can only be 30 min.
    const at330 = lesson({ start_time: '2026-07-03T15:30:00.000Z', end_time: '2026-07-03T16:00:00.000Z' });
    expect(maxAvailableDuration(start, windowEnd, ME, [at330], BUF)).toBe(30);
  });

  it('reserves the commute buffer before another student\'s in-person lesson', () => {
    // Other student's in-person lesson at 4:00 PM -> 30-min buffer means we must end by 3:30 PM.
    const at4pm = lesson({ location_type: 'in-person', start_time: '2026-07-03T16:00:00.000Z', end_time: '2026-07-03T16:30:00.000Z' });
    expect(maxAvailableDuration(start, windowEnd, ME, [at4pm], BUF)).toBe(30);
  });

  it('does not reserve a buffer before the student\'s own lesson', () => {
    const ownAt4pm = lesson({ student_id: ME, location_type: 'in-person', start_time: '2026-07-03T16:00:00.000Z', end_time: '2026-07-03T16:30:00.000Z' });
    expect(maxAvailableDuration(start, windowEnd, ME, [ownAt4pm], BUF)).toBe(60);
  });

  it('takes the earliest constraining booking when several exist', () => {
    const at5pm = lesson({ start_time: '2026-07-03T17:00:00.000Z', end_time: '2026-07-03T17:30:00.000Z' });
    const at4pm = lesson({ start_time: '2026-07-03T16:00:00.000Z', end_time: '2026-07-03T16:30:00.000Z' });
    expect(maxAvailableDuration(start, windowEnd, ME, [at5pm, at4pm], BUF)).toBe(60);
  });

  it('ignores cancelled lessons and lessons entirely before the start', () => {
    const cancelled = lesson({ start_time: '2026-07-03T15:30:00.000Z', end_time: '2026-07-03T16:00:00.000Z', status: 'cancelled' });
    const past = lesson({ start_time: '2026-07-03T14:00:00.000Z', end_time: '2026-07-03T14:30:00.000Z' });
    expect(maxAvailableDuration(start, windowEnd, ME, [cancelled, past], BUF)).toBe(180);
  });
});

describe('overlapsBusyBlock', () => {
  const blocks = [
    { start_time: '2026-08-03T21:00:00.000Z', end_time: '2026-08-03T22:00:00.000Z' },
    // 2-day all-day trip
    { start_time: '2026-08-10T07:00:00.000Z', end_time: '2026-08-12T07:00:00.000Z' },
  ];
  const ms = (iso: string) => new Date(iso).getTime();

  it('flags an occurrence inside a block', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T21:15:00Z'), ms('2026-08-03T21:45:00Z'), blocks)).toBe(true);
  });
  it('flags an occurrence spanning a multi-day block', () => {
    expect(overlapsBusyBlock(ms('2026-08-11T17:00:00Z'), ms('2026-08-11T18:00:00Z'), blocks)).toBe(true);
  });
  it('allows back-to-back (occurrence starts exactly when the block ends)', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T22:00:00Z'), ms('2026-08-03T23:00:00Z'), blocks)).toBe(false);
  });
  it('allows an occurrence ending exactly when the block starts', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T20:00:00Z'), ms('2026-08-03T21:00:00Z'), blocks)).toBe(false);
  });
  it('is false with no blocks', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T21:00:00Z'), ms('2026-08-03T22:00:00Z'), [])).toBe(false);
  });
});
