import { describe, it, expect } from 'vitest';
import { shouldBlockEvent, eventToInterval, SYNC_WINDOW_DAYS } from './google-busy-core';
import type { GoogleCalendarEvent } from '@/types';

const timed = (over: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent => ({
  id: 'evt1',
  summary: 'Dentist',
  start: { dateTime: '2026-08-03T14:00:00-07:00' },
  end: { dateTime: '2026-08-03T15:00:00-07:00' },
  status: 'confirmed',
  ...over,
});
const none = new Set<string>();

describe('shouldBlockEvent', () => {
  it('blocks a plain confirmed timed event (transparency omitted = opaque)', () => {
    expect(shouldBlockEvent(timed(), none)).toBe(true);
  });
  it('blocks a tentative event', () => {
    expect(shouldBlockEvent(timed({ status: 'tentative' }), none)).toBe(true);
  });
  it('does not block a transparent (Free) event', () => {
    expect(shouldBlockEvent(timed({ transparency: 'transparent' }), none)).toBe(false);
  });
  it('does not block a cancelled event', () => {
    expect(shouldBlockEvent(timed({ status: 'cancelled' }), none)).toBe(false);
  });
  it('does not block a self-declined invite', () => {
    expect(shouldBlockEvent(timed({ attendees: [{ self: true, responseStatus: 'declined' }] }), none)).toBe(false);
  });
  it('blocks an organizer-only event with no attendees array', () => {
    expect(shouldBlockEvent(timed({ attendees: undefined }), none)).toBe(true);
  });
  it('does not block workingLocation or birthday event types', () => {
    expect(shouldBlockEvent(timed({ eventType: 'workingLocation' }), none)).toBe(false);
    expect(shouldBlockEvent(timed({ eventType: 'birthday' }), none)).toBe(false);
  });
  it('does not block an event carrying the app marker (creation race)', () => {
    expect(shouldBlockEvent(timed({ extendedProperties: { private: { rosieApp: 'lesson' } } }), none)).toBe(false);
  });
  it('does not block an event whose id is a known lesson event (historical)', () => {
    expect(shouldBlockEvent(timed(), new Set(['evt1']))).toBe(false);
  });
});

describe('eventToInterval', () => {
  it('maps a timed event to its exact interval', () => {
    const b = eventToInterval(timed());
    expect(b).toEqual({
      google_event_id: 'evt1',
      start_time: '2026-08-03T21:00:00.000Z',
      end_time: '2026-08-03T22:00:00.000Z',
      is_all_day: false,
    });
  });
  it('maps an all-day event at LA midnights with exclusive end date', () => {
    const b = eventToInterval(timed({
      start: { date: '2026-08-03' },
      end: { date: '2026-08-05' }, // 2-day event Aug 3-4; end date exclusive
    }));
    expect(b).toEqual({
      google_event_id: 'evt1',
      start_time: '2026-08-03T07:00:00.000Z',
      end_time: '2026-08-05T07:00:00.000Z',
      is_all_day: true,
    });
  });
  it('returns null for an event with no usable times', () => {
    expect(eventToInterval(timed({ start: {}, end: {} }))).toBeNull();
  });
});

describe('SYNC_WINDOW_DAYS', () => {
  it('is 180 (covers 90-day picker + 3-month recurrence fan-out)', () => {
    expect(SYNC_WINDOW_DAYS).toBe(180);
  });
});
