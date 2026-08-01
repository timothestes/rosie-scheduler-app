// Pure filter/normalize logic for the Google Calendar busy-time import.
// See docs/superpowers/specs/2026-07-31-google-calendar-busy-import-design.md.
// Kept side-effect free so it is trivially unit-testable.
import { businessDateToUtc } from './timezone';
import type { GoogleCalendarEvent } from '@/types';

// Sync horizon. Must cover every occurrence the conflict checker can test for a
// student: the date picker offers 90 days (app/(student)/schedule/page.tsx) and
// student recurrence caps at 3 months (components/BookingForm.tsx) → ~166 days
// worst case. checkOccurrenceConflicts rejects student occurrences beyond this
// window, so growing either product cap requires growing this constant with it.
export const SYNC_WINDOW_DAYS = 180;

// extendedProperties.private key stamped on app-created events (echo guard).
export const BUSY_MARKER_KEY = 'rosieApp';

export interface BusyInterval {
  google_event_id: string;
  start_time: string; // ISO instant
  end_time: string; // ISO instant
  is_all_day: boolean;
}

// Busy predicate per spec §4.3. Google omits `transparency` for Busy (opaque)
// events; all-day events default to 'transparent', which automatically gives
// "all-day blocks only if marked Busy". outOfOffice/focusTime are opaque and
// correctly block via the transparency rule.
export function shouldBlockEvent(
  event: GoogleCalendarEvent,
  lessonEventIds: Set<string>
): boolean {
  if (event.status === 'cancelled') return false;
  if (event.transparency === 'transparent') return false;
  if (event.eventType === 'workingLocation' || event.eventType === 'birthday') return false;
  const self = event.attendees?.find((a) => a.self);
  if (self?.responseStatus === 'declined') return false;
  if (event.extendedProperties?.private?.[BUSY_MARKER_KEY]) return false;
  if (lessonEventIds.has(event.id)) return false;
  return true;
}

// Timed events use their exact instants; all-day events (date-only, end
// exclusive) span business-timezone midnights.
export function eventToInterval(event: GoogleCalendarEvent): BusyInterval | null {
  if (event.start.dateTime && event.end.dateTime) {
    return {
      google_event_id: event.id,
      start_time: new Date(event.start.dateTime).toISOString(),
      end_time: new Date(event.end.dateTime).toISOString(),
      is_all_day: false,
    };
  }
  if (event.start.date && event.end.date) {
    return {
      google_event_id: event.id,
      start_time: businessDateToUtc(event.start.date).toISOString(),
      end_time: businessDateToUtc(event.end.date).toISOString(),
      is_all_day: true,
    };
  }
  return null;
}
