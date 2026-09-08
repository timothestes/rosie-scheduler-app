// Pure availability predicate shared by the server booking/preflight/reschedule
// paths. Answers: does a lesson occupying [startMinutes, endMinutes] (minutes
// past local midnight) on a given local date fall within the teacher's bookable
// availability? This mirrors the client's getTimeSlotsForDate so the server
// enforces exactly what the scheduling UI shows. Kept free of `@/` imports and
// timezone math (callers pass already-localized parts) so it is unit-testable.

export interface AvailabilityWindow {
  day_of_week: number; // 0 = Sunday
  start_time: string; // 'HH:mm' or 'HH:mm:ss' (business-timezone wall clock)
  end_time: string;
  is_recurring: boolean;
}

export interface DayOverride {
  override_date: string; // 'YYYY-MM-DD' (business-timezone calendar date)
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason?: string | null; // Optional note shown to students when is_available is false
}

export interface Window {
  start: number; // minutes past midnight
  end: number;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Bookable windows for a specific local date. An override for the date wins over
// the weekly schedule: a blocked override yields no windows; an "available"
// override yields only its custom hours. Otherwise the recurring weekly windows
// for that weekday apply. Mirrors schedule/page.tsx getTimeSlotsForDate.
export function availabilityWindowsForDate(
  localDateStr: string,
  dayOfWeek: number,
  availability: AvailabilityWindow[],
  overrides: DayOverride[]
): Window[] {
  const override = overrides.find((o) => o.override_date === localDateStr);
  if (override) {
    if (!override.is_available) return []; // entire day blocked
    if (override.start_time && override.end_time) {
      return [{ start: timeToMinutes(override.start_time), end: timeToMinutes(override.end_time) }];
    }
    return []; // "available" but no hours set -> nothing bookable (matches UI)
  }

  return availability
    .filter((a) => a.is_recurring && a.day_of_week === dayOfWeek)
    .map((a) => ({ start: timeToMinutes(a.start_time), end: timeToMinutes(a.end_time) }));
}

// The teacher's reason for blocking this date, when one was given. Null for an
// unblocked date, a date with no override, or a blocked override left blank.
// Never derived from Google Calendar — only admin-authored day-blocks carry one.
export function blockedReasonForDate(localDateStr: string, overrides: DayOverride[]): string | null {
  const override = overrides.find((o) => o.override_date === localDateStr);
  if (!override || override.is_available) return null;
  const reason = override.reason?.trim();
  return reason ? reason : null;
}

// True when the lesson [startMinutes, endMinutes] fits entirely within one of the
// bookable windows for the date.
export function isWithinAvailability(
  localDateStr: string,
  dayOfWeek: number,
  startMinutes: number,
  endMinutes: number,
  availability: AvailabilityWindow[],
  overrides: DayOverride[]
): boolean {
  const windows = availabilityWindowsForDate(localDateStr, dayOfWeek, availability, overrides);
  return windows.some((w) => startMinutes >= w.start && endMinutes <= w.end);
}
