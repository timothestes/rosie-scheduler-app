import { describe, it, expect } from 'vitest';
import {
  isWithinAvailability,
  availabilityWindowsForDate,
  type AvailabilityWindow,
  type DayOverride,
} from './availability-core';
import { getBusinessTimeParts } from './timezone';

// Rosie is normally available Thursdays (day 4) 3:00 PM - 6:00 PM.
const weekly: AvailabilityWindow[] = [
  { day_of_week: 4, start_time: '15:00:00', end_time: '18:00:00', is_recurring: true },
];

// A 3:00 PM, 60-minute lesson in minutes-past-midnight.
const THREE_PM = 15 * 60;
const FOUR_PM = 16 * 60;

describe('availabilityWindowsForDate', () => {
  it('returns the recurring weekly windows for a matching weekday with no override', () => {
    expect(availabilityWindowsForDate('2026-08-06', 4, weekly, [])).toEqual([
      { start: 15 * 60, end: 18 * 60 },
    ]);
  });

  it('returns no windows for a weekday with no recurring availability', () => {
    expect(availabilityWindowsForDate('2026-08-07', 5, weekly, [])).toEqual([]);
  });

  it('ignores non-recurring availability rows', () => {
    const oneOff: AvailabilityWindow[] = [
      { day_of_week: 4, start_time: '15:00:00', end_time: '18:00:00', is_recurring: false },
    ];
    expect(availabilityWindowsForDate('2026-08-06', 4, oneOff, [])).toEqual([]);
  });

  it('returns NO windows when the day is blocked by an override (the bug)', () => {
    const overrides: DayOverride[] = [
      { override_date: '2026-08-13', is_available: false, start_time: null, end_time: null },
    ];
    expect(availabilityWindowsForDate('2026-08-13', 4, weekly, overrides)).toEqual([]);
  });

  it('uses the override custom hours instead of the weekly schedule when available', () => {
    const overrides: DayOverride[] = [
      { override_date: '2026-08-13', is_available: true, start_time: '09:00:00', end_time: '12:00:00' },
    ];
    expect(availabilityWindowsForDate('2026-08-13', 4, weekly, overrides)).toEqual([
      { start: 9 * 60, end: 12 * 60 },
    ]);
  });

  it('returns no windows for an "available" override that has no hours set', () => {
    const overrides: DayOverride[] = [
      { override_date: '2026-08-13', is_available: true, start_time: null, end_time: null },
    ];
    expect(availabilityWindowsForDate('2026-08-13', 4, weekly, overrides)).toEqual([]);
  });
});

describe('isWithinAvailability', () => {
  it('accepts a lesson that fits inside a weekly window', () => {
    expect(isWithinAvailability('2026-08-06', 4, THREE_PM, THREE_PM + 60, weekly, [])).toBe(true);
  });

  it('rejects a lesson whose end runs past the window end', () => {
    // 5:30 PM start, 60 min -> ends 6:30 PM, past the 6:00 PM window end.
    const fiveThirty = 17 * 60 + 30;
    expect(isWithinAvailability('2026-08-06', 4, fiveThirty, fiveThirty + 60, weekly, [])).toBe(false);
  });

  it('rejects a lesson before the window starts', () => {
    const noon = 12 * 60;
    expect(isWithinAvailability('2026-08-06', 4, noon, noon + 60, weekly, [])).toBe(false);
  });

  it('rejects any lesson on a fully blocked day', () => {
    const overrides: DayOverride[] = [
      { override_date: '2026-08-13', is_available: false, start_time: null, end_time: null },
    ];
    expect(isWithinAvailability('2026-08-13', 4, THREE_PM, FOUR_PM, weekly, overrides)).toBe(false);
  });
});

// End-to-end regression for the reported incident: a weekly booking silently
// dropped its Aug 13 occurrence onto a day Rosie had blocked, because the server
// never checked availability. This composes the timezone conversion with the
// availability predicate exactly as the server will.
describe('regression: recurring occurrence on a blocked day', () => {
  it('flags michaela Wilson\'s 2026-08-13 15:00 PDT occurrence as unavailable', () => {
    const occurrence = new Date('2026-08-13T22:00:00.000Z'); // 3:00 PM PDT
    const overrides: DayOverride[] = [
      { override_date: '2026-08-12', is_available: false, start_time: null, end_time: null },
      { override_date: '2026-08-13', is_available: false, start_time: null, end_time: null },
      { override_date: '2026-08-14', is_available: false, start_time: null, end_time: null },
      { override_date: '2026-08-15', is_available: false, start_time: null, end_time: null },
    ];
    const { dateStr, dayOfWeek, minutes } = getBusinessTimeParts(occurrence);
    const end = minutes + 60;
    expect(isWithinAvailability(dateStr, dayOfWeek, minutes, end, weekly, overrides)).toBe(false);
  });

  it('still accepts the Aug 6 occurrence on the same weekly series (not blocked)', () => {
    const occurrence = new Date('2026-08-06T22:00:00.000Z'); // 3:00 PM PDT, Thursday
    const { dateStr, dayOfWeek, minutes } = getBusinessTimeParts(occurrence);
    expect(isWithinAvailability(dateStr, dayOfWeek, minutes, minutes + 60, weekly, [])).toBe(true);
  });
});
