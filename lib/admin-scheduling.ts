// Pure helpers behind the teacher's "Schedule Lesson" form: smart defaults from
// a student's lesson history, the first open start time on a day, and soft
// warnings about a chosen time. Admin bookings bypass availability, day-blocks
// and Google busy time on the server, but still fail on lesson overlap and the
// in-person commute buffer (see lib/conflicts.ts) — the warnings mirror that.
//
// Times follow the form's own convention: the chosen date + "HH:MM" is read as
// browser-local wall clock (the teacher's browser is in the business timezone),
// and availability windows are compared in those same minutes past midnight.

import { lessonTypes } from '../config/lessonTypes';
import { evaluateConflict, overlapsBusyBlock, type BusyBlock, type ExistingLesson } from './conflicts-core';
import {
  availabilityWindowsForDate,
  blockedReasonForDate,
  type AvailabilityWindow,
  type DayOverride,
} from './availability-core';

export interface HistoryLesson {
  lesson_type: string;
  location_type: string;
  location_address: string | null;
  start_time: string;
  status: string;
}

export interface StudentDefaults {
  lessonType: string;
  locationType: 'zoom' | 'in-person';
  locationAddress: string;
}

const REGULAR_THIRTY = 'voice_thirty';
const FIRST_LESSON_THIRTY = 'first_lesson_thirty';

// A trial ("First Lesson") type is a one-off; the next booking is the regular
// lesson of the same length.
function regularTypeFor(lessonTypeId: string): string {
  const type = lessonTypes.find((t) => t.id === lessonTypeId);
  if (!type) return REGULAR_THIRTY;
  if (!type.isTrialLesson) return type.id;
  return lessonTypes.find((t) => !t.isTrialLesson && t.duration === type.duration)?.id ?? REGULAR_THIRTY;
}

// Form defaults for a student: repeat whatever they had last time. A student
// with no lessons who is marked as new gets the first-lesson offer, mirroring
// the student booking page (isFirstLesson = no lessons && not returning).
export function defaultsForStudent(
  student: { address: string | null; is_returning_student: boolean | null },
  history: HistoryLesson[]
): StudentDefaults {
  const savedAddress = student.address ?? '';
  const byNewest = [...history].sort((a, b) => b.start_time.localeCompare(a.start_time));
  const last = byNewest.find((l) => l.status !== 'cancelled') ?? byNewest[0];

  if (!last) {
    return {
      lessonType: student.is_returning_student === false ? FIRST_LESSON_THIRTY : REGULAR_THIRTY,
      locationType: 'zoom',
      locationAddress: savedAddress,
    };
  }

  const locationType = last.location_type === 'in-person' ? 'in-person' : 'zoom';
  return {
    lessonType: regularTypeFor(last.lesson_type),
    locationType,
    locationAddress: (locationType === 'in-person' && last.location_address) || savedAddress,
  };
}

// Everything known about one day that affects where a lesson can go.
export interface DayContext {
  dateStr: string; // 'YYYY-MM-DD'
  availability: AvailabilityWindow[];
  overrides: DayOverride[];
  lessons: ExistingLesson[]; // all students' lessons on/around the day
  busyBlocks: BusyBlock[]; // imported Google busy time
}

interface SlotQuery {
  studentId: string | null; // null while no student is picked yet
  durationMinutes: number;
  locationType: string;
  bufferMs: number; // in-person commute buffer
}

// The instant for a date + minutes past midnight, as the form submits it.
export function localInstant(dateStr: string, minutes: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, minutes, 0, 0);
}

export function minutesToHHMM(minutes: number): string {
  const hh = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mm = (minutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function dayOfWeekFor(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Her bookable hours that day (override wins over the weekly schedule), earliest first.
export function availableWindows(ctx: DayContext) {
  return availabilityWindowsForDate(ctx.dateStr, dayOfWeekFor(ctx.dateStr), ctx.availability, ctx.overrides).sort(
    (a, b) => a.start - b.start
  );
}

function lessonConflict(ctx: DayContext, q: SlotQuery, startMinutes: number) {
  const start = localInstant(ctx.dateStr, startMinutes);
  const end = localInstant(ctx.dateStr, startMinutes + q.durationMinutes);
  return {
    conflict: evaluateConflict(start, end, q.locationType, q.studentId ?? '', ctx.lessons, q.bufferMs),
    busy: overlapsBusyBlock(start.getTime(), end.getTime(), ctx.busyBlocks),
  };
}

// The earliest start (on the picker's step grid) inside her hours that day that
// doesn't collide with another lesson, the commute buffer, or Google busy time,
// and hasn't already passed. "HH:MM", or null when nothing fits.
export function suggestStartTime(
  ctx: DayContext,
  q: SlotQuery & { stepMinutes: number; now: Date }
): string | null {
  for (const w of availableWindows(ctx)) {
    const first = Math.ceil(w.start / q.stepMinutes) * q.stepMinutes;
    for (let s = first; s + q.durationMinutes <= w.end; s += q.stepMinutes) {
      if (localInstant(ctx.dateStr, s).getTime() < q.now.getTime()) continue;
      const { conflict, busy } = lessonConflict(ctx, q, s);
      if (conflict.status === 'available' && !busy) return minutesToHHMM(s);
    }
  }
  return null;
}

export type SlotWarning =
  | { kind: 'blocked'; reason: string | null } // day-block; admin can still book
  | { kind: 'outside_hours' } // admin can still book
  | { kind: 'busy' } // Google busy time; admin can still book
  | { kind: 'overlap'; ownLesson: boolean } // server will reject
  | { kind: 'commute_buffer' }; // server will reject

// Everything worth telling her about a specific chosen time, most basic first.
export function slotWarnings(ctx: DayContext, q: SlotQuery & { startMinutes: number }): SlotWarning[] {
  const warnings: SlotWarning[] = [];
  const blockedOverride = ctx.overrides.find((o) => o.override_date === ctx.dateStr && !o.is_available);
  if (blockedOverride) {
    warnings.push({ kind: 'blocked', reason: blockedReasonForDate(ctx.dateStr, ctx.overrides) });
  } else {
    const end = q.startMinutes + q.durationMinutes;
    const fits = availableWindows(ctx).some((w) => q.startMinutes >= w.start && end <= w.end);
    if (!fits) warnings.push({ kind: 'outside_hours' });
  }

  const { conflict, busy } = lessonConflict(ctx, q, q.startMinutes);
  if (busy) warnings.push({ kind: 'busy' });
  if (conflict.reason === 'overlap') warnings.push({ kind: 'overlap', ownLesson: conflict.conflictIsOwnLesson });
  if (conflict.reason === 'commute_buffer') warnings.push({ kind: 'commute_buffer' });
  return warnings;
}
