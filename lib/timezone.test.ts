import { describe, it, expect } from 'vitest';
import { getBusinessTimeParts } from './timezone';

// The app treats all wall-clock times as America/Los_Angeles (see the hardcoded
// timeZone in emails, Google Calendar, Zoom). The server runs in UTC, so it must
// convert an absolute instant back to Pacific wall-clock before comparing it to a
// teacher's availability (which is stored as Pacific date + Pacific HH:mm).
describe('getBusinessTimeParts', () => {
  it('converts a summer (PDT, UTC-7) instant to Pacific parts', () => {
    // michaela Wilson's Aug 13 occurrence: 2026-08-13 22:00Z === 3:00 PM PDT Thu.
    expect(getBusinessTimeParts(new Date('2026-08-13T22:00:00.000Z'))).toEqual({
      dateStr: '2026-08-13',
      dayOfWeek: 4, // Thursday
      minutes: 15 * 60, // 3:00 PM
    });
  });

  it('rolls back to the previous Pacific day when UTC has already ticked over', () => {
    // Daniel Rodriguez's Aug 14 occurrence: 2026-08-15 00:00Z === 5:00 PM PDT Fri Aug 14.
    expect(getBusinessTimeParts(new Date('2026-08-15T00:00:00.000Z'))).toEqual({
      dateStr: '2026-08-14',
      dayOfWeek: 5, // Friday
      minutes: 17 * 60, // 5:00 PM
    });
  });

  it('handles winter (PST, UTC-8) offset', () => {
    // 2026-01-15 02:00Z === 6:00 PM PST Wed Jan 14.
    expect(getBusinessTimeParts(new Date('2026-01-15T02:00:00.000Z'))).toEqual({
      dateStr: '2026-01-14',
      dayOfWeek: 3, // Wednesday
      minutes: 18 * 60,
    });
  });
});
