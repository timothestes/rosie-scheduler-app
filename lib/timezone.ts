// The whole app treats wall-clock times as a single business timezone (Pacific).
// See the hardcoded `timeZone: 'America/Los_Angeles'` used in emails, Google
// Calendar, and Zoom. Availability and day-blocks are stored as Pacific calendar
// dates + Pacific HH:mm, but the server runs in UTC and lesson times are absolute
// instants — so we must convert an instant back to Pacific wall-clock before
// comparing it to availability. Kept free of `@/` imports so it is unit-testable.

export const BUSINESS_TIMEZONE = 'America/Los_Angeles';

export interface LocalTimeParts {
  dateStr: string; // 'YYYY-MM-DD' in the business timezone
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday, in the business timezone
  minutes: number; // minutes past local midnight (0..1439)
}

// Convert an absolute instant to its wall-clock parts in the business timezone.
// Uses Intl so DST (PST/PDT) is handled correctly for any date.
export function getBusinessTimeParts(
  date: Date,
  timeZone: string = BUSINESS_TIMEZONE
): LocalTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  // Some runtimes emit hour '24' for midnight; normalize to 0.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  // Derive the weekday from the local calendar date (not the UTC instant) by
  // reading getUTCDay of a date built from those Y/M/D values — avoids tz drift.
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { dateStr, dayOfWeek, minutes: hour * 60 + minute };
}

// The UTC instant at which the given business-timezone calendar date begins
// (local midnight). Needed for all-day Google events, which carry only a
// 'YYYY-MM-DD' date. Never use `new Date('YYYY-MM-DD')` for this — that parses
// as UTC midnight and shifts the day. Two correction passes make the result
// stable across DST transitions.
export function businessDateToUtc(dateStr: string, timeZone: string = BUSINESS_TIMEZONE): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetWallMs = Date.UTC(y, m - 1, d);
  let ts = targetWallMs;
  for (let i = 0; i < 2; i++) {
    const parts = getBusinessTimeParts(new Date(ts), timeZone);
    const wallMs =
      Date.UTC(
        Number(parts.dateStr.slice(0, 4)),
        Number(parts.dateStr.slice(5, 7)) - 1,
        Number(parts.dateStr.slice(8, 10))
      ) + parts.minutes * 60000;
    ts += targetWallMs - wallMs;
  }
  return new Date(ts);
}
