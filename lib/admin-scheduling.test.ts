import { describe, it, expect } from 'vitest';
import {
  defaultsForStudent,
  localInstant,
  suggestStartTime,
  slotWarnings,
  type DayContext,
  type HistoryLesson,
} from './admin-scheduling';
import type { AvailabilityWindow } from './availability-core';

const BUFFER_MS = 30 * 60 * 1000;

// 2026-12-03 is a Thursday (day 4). Rosie is available Thursdays 3:00-6:00 PM.
const THURSDAY = '2026-12-03';
const weekly: AvailabilityWindow[] = [
  { day_of_week: 4, start_time: '15:00:00', end_time: '18:00:00', is_recurring: true },
];

// "Now" well before the test day, so nothing is filtered out as past.
const EARLIER = localInstant('2026-11-01', 9 * 60);

const lessonAt = (
  dateStr: string,
  startMinutes: number,
  durationMinutes: number,
  extra: Partial<{ location_type: string; student_id: string; status: string }> = {}
) => ({
  start_time: localInstant(dateStr, startMinutes).toISOString(),
  end_time: localInstant(dateStr, startMinutes + durationMinutes).toISOString(),
  location_type: extra.location_type ?? 'zoom',
  student_id: extra.student_id ?? 'other-student',
  status: extra.status ?? 'scheduled',
});

const ctx = (overrides: Partial<DayContext> = {}): DayContext => ({
  dateStr: THURSDAY,
  availability: weekly,
  overrides: [],
  lessons: [],
  busyBlocks: [],
  ...overrides,
});

const query = (overrides: Partial<Parameters<typeof suggestStartTime>[1]> = {}) => ({
  studentId: 'me',
  durationMinutes: 30,
  locationType: 'zoom',
  bufferMs: BUFFER_MS,
  stepMinutes: 15,
  now: EARLIER,
  ...overrides,
});

describe('localInstant', () => {
  it('builds the local wall-clock instant for a date and minutes past midnight', () => {
    const d = localInstant(THURSDAY, 15 * 60 + 45);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(3);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(45);
  });
});

describe('defaultsForStudent', () => {
  const student = { address: '12 Main St', is_returning_student: true };
  const h = (
    start_time: string,
    lesson_type: string,
    location_type = 'zoom',
    status = 'completed',
    location_address: string | null = null
  ): HistoryLesson => ({ start_time, lesson_type, location_type, status, location_address });

  it("copies type and location from the student's most recent lesson", () => {
    const history = [
      h('2026-10-01T22:00:00Z', 'voice_thirty', 'zoom'),
      h('2026-11-01T22:00:00Z', 'voice_sixty', 'in-person', 'completed', '99 Oak Ave'),
    ];
    expect(defaultsForStudent(student, history)).toEqual({
      lessonType: 'voice_sixty',
      locationType: 'in-person',
      locationAddress: '99 Oak Ave',
    });
  });

  it('ignores cancelled lessons when a non-cancelled one exists', () => {
    const history = [
      h('2026-10-01T22:00:00Z', 'voice_sixty', 'in-person'),
      h('2026-11-01T22:00:00Z', 'voice_thirty', 'zoom', 'cancelled'),
    ];
    expect(defaultsForStudent(student, history).lessonType).toBe('voice_sixty');
  });

  it('falls back to the most recent cancelled lesson when that is all there is', () => {
    const history = [h('2026-11-01T22:00:00Z', 'voice_sixty', 'zoom', 'cancelled')];
    expect(defaultsForStudent(student, history).lessonType).toBe('voice_sixty');
  });

  it('maps a past first lesson to the regular lesson of the same length', () => {
    expect(defaultsForStudent(student, [h('2026-11-01T22:00:00Z', 'first_lesson_sixty')]).lessonType).toBe(
      'voice_sixty'
    );
    expect(defaultsForStudent(student, [h('2026-11-01T22:00:00Z', 'first_lesson_thirty')]).lessonType).toBe(
      'voice_thirty'
    );
  });

  it("uses the student's saved address for in-person when the lesson has none", () => {
    const d = defaultsForStudent(student, [h('2026-11-01T22:00:00Z', 'voice_thirty', 'in-person')]);
    expect(d.locationAddress).toBe('12 Main St');
  });

  it('offers the 30-min first lesson to a brand-new student with no lessons', () => {
    expect(defaultsForStudent({ address: null, is_returning_student: false }, [])).toEqual({
      lessonType: 'first_lesson_thirty',
      locationType: 'zoom',
      locationAddress: '',
    });
  });

  it('defaults to a regular 30-min Zoom lesson for a returning or unknown student with no lessons', () => {
    expect(defaultsForStudent({ address: '12 Main St', is_returning_student: null }, [])).toEqual({
      lessonType: 'voice_thirty',
      locationType: 'zoom',
      locationAddress: '12 Main St',
    });
    expect(defaultsForStudent({ address: null, is_returning_student: true }, []).lessonType).toBe('voice_thirty');
  });
});

describe('suggestStartTime', () => {
  it('suggests the start of availability on an empty day', () => {
    expect(suggestStartTime(ctx(), query())).toBe('15:00');
  });

  it('skips past an existing lesson', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 60)];
    expect(suggestStartTime(ctx({ lessons }), query())).toBe('16:00');
  });

  it('ignores cancelled lessons', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 60, { status: 'cancelled' })];
    expect(suggestStartTime(ctx({ lessons }), query())).toBe('15:00');
  });

  it('needs room for the whole lesson length', () => {
    // Lesson at 3:30; a 60-min lesson can't fit at 3:00, earliest is 4:00.
    const lessons = [lessonAt(THURSDAY, 15 * 60 + 30, 30)];
    expect(suggestStartTime(ctx({ lessons }), query({ durationMinutes: 60 }))).toBe('16:00');
  });

  it('keeps the commute buffer around another student\'s in-person lesson when booking in-person', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 30, { location_type: 'in-person' })];
    // In-person: 3:30 is too tight (30-min buffer), first open is 4:00.
    expect(suggestStartTime(ctx({ lessons }), query({ locationType: 'in-person' }))).toBe('16:00');
    // Zoom doesn't need the buffer.
    expect(suggestStartTime(ctx({ lessons }), query({ locationType: 'zoom' }))).toBe('15:30');
  });

  it('avoids imported Google busy time', () => {
    const busyBlocks = [
      {
        start_time: localInstant(THURSDAY, 15 * 60).toISOString(),
        end_time: localInstant(THURSDAY, 16 * 60 + 15).toISOString(),
      },
    ];
    expect(suggestStartTime(ctx({ busyBlocks }), query())).toBe('16:15');
  });

  it('never suggests a time that has already passed today', () => {
    const now = localInstant(THURSDAY, 16 * 60 + 5);
    expect(suggestStartTime(ctx(), query({ now }))).toBe('16:15');
  });

  it('uses a custom-hours override instead of the weekly schedule', () => {
    const overrides = [{ override_date: THURSDAY, is_available: true, start_time: '10:00:00', end_time: '12:00:00' }];
    expect(suggestStartTime(ctx({ overrides }), query())).toBe('10:00');
  });

  it('returns null on a blocked day', () => {
    const overrides = [{ override_date: THURSDAY, is_available: false, start_time: null, end_time: null }];
    expect(suggestStartTime(ctx({ overrides }), query())).toBeNull();
  });

  it('returns null when the day is fully booked', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 180)];
    expect(suggestStartTime(ctx({ lessons }), query())).toBeNull();
  });

  it('aligns suggestions to the picker step even when availability starts off-step', () => {
    const availability: AvailabilityWindow[] = [
      { day_of_week: 4, start_time: '15:10:00', end_time: '18:00:00', is_recurring: true },
    ];
    expect(suggestStartTime(ctx({ availability }), query())).toBe('15:15');
  });

  it('tries later windows when an earlier one is full', () => {
    const availability: AvailabilityWindow[] = [
      { day_of_week: 4, start_time: '17:00:00', end_time: '19:00:00', is_recurring: true },
      { day_of_week: 4, start_time: '09:00:00', end_time: '10:00:00', is_recurring: true },
    ];
    const lessons = [lessonAt(THURSDAY, 9 * 60, 60)];
    expect(suggestStartTime(ctx({ availability, lessons }), query())).toBe('17:00');
  });
});

describe('slotWarnings', () => {
  const at = (startMinutes: number, overrides: Partial<Parameters<typeof slotWarnings>[1]> = {}) => ({
    studentId: 'me',
    durationMinutes: 30,
    locationType: 'zoom',
    bufferMs: BUFFER_MS,
    startMinutes,
    ...overrides,
  });

  it('has no warnings for an open slot within hours', () => {
    expect(slotWarnings(ctx(), at(15 * 60))).toEqual([]);
  });

  it('flags a blocked day with its reason', () => {
    const overrides = [
      { override_date: THURSDAY, is_available: false, start_time: null, end_time: null, reason: 'Thanksgiving' },
    ];
    expect(slotWarnings(ctx({ overrides }), at(15 * 60))).toEqual([{ kind: 'blocked', reason: 'Thanksgiving' }]);
  });

  it('flags a time outside her hours', () => {
    expect(slotWarnings(ctx(), at(10 * 60))).toEqual([{ kind: 'outside_hours' }]);
    // Starts inside but runs past the end of the window.
    expect(slotWarnings(ctx(), at(17 * 60 + 45))).toEqual([{ kind: 'outside_hours' }]);
  });

  it('flags Google busy time', () => {
    const busyBlocks = [
      {
        start_time: localInstant(THURSDAY, 15 * 60).toISOString(),
        end_time: localInstant(THURSDAY, 16 * 60).toISOString(),
      },
    ];
    expect(slotWarnings(ctx({ busyBlocks }), at(15 * 60 + 15))).toEqual([{ kind: 'busy' }]);
  });

  it('flags an overlap with another lesson', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 60)];
    expect(slotWarnings(ctx({ lessons }), at(15 * 60 + 30))).toEqual([{ kind: 'overlap', ownLesson: false }]);
  });

  it("notes when the overlap is the same student's own lesson", () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 60, { student_id: 'me' })];
    expect(slotWarnings(ctx({ lessons }), at(15 * 60))).toEqual([{ kind: 'overlap', ownLesson: true }]);
  });

  it('flags the commute buffer for back-to-back in-person lessons', () => {
    const lessons = [lessonAt(THURSDAY, 15 * 60, 30, { location_type: 'in-person' })];
    expect(slotWarnings(ctx({ lessons }), at(15 * 60 + 30, { locationType: 'in-person' }))).toEqual([
      { kind: 'commute_buffer' },
    ]);
  });

  it('can report several problems at once', () => {
    const lessons = [lessonAt(THURSDAY, 10 * 60, 60)];
    expect(slotWarnings(ctx({ lessons }), at(10 * 60))).toEqual([
      { kind: 'outside_hours' },
      { kind: 'overlap', ownLesson: false },
    ]);
  });
});
