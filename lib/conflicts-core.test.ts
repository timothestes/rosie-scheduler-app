import { describe, it, expect } from 'vitest';
import { evaluateConflict, type ExistingLesson } from './conflicts-core';

const BUF = 30 * 60 * 1000; // 30 min
const occStart = new Date('2026-07-03T16:00:00.000Z');
const occEnd = new Date('2026-07-03T16:30:00.000Z'); // 30-min lesson
const ME = 'student-me';

function lesson(partial: Partial<ExistingLesson>): ExistingLesson {
  return {
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
