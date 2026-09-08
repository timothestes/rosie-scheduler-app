import { createAdminClient } from '@/lib/supabase/admin';
import { commuteConfig } from '@/config/commute';
import { evaluateConflict, overlapsBusyBlock, type ExistingLesson, type BusyBlock } from '@/lib/conflicts-core';
import { isWithinAvailability, blockedReasonForDate, type AvailabilityWindow, type DayOverride } from '@/lib/availability-core';
import { getBusinessTimeParts } from '@/lib/timezone';
import { SYNC_WINDOW_DAYS } from '@/lib/google-busy-core';
import type { OccurrenceStatus } from '@/types';

// Check every occurrence against existing lessons. Uses the service-role client
// so it reliably sees ALL students' lessons (conflict detection must not be
// limited by the booking user's RLS scope). Both POST /api/lessons and the
// preflight endpoint call this, guaranteeing the preview matches booking.
//
// When `availabilityAdminId` is set, each occurrence is ALSO checked against that
// teacher's availability + day-blocks and flagged 'unavailable' if it lands on a
// blocked day or outside available hours. This is what stops a recurring series
// from silently booking an occurrence onto a blocked day: the student picks one
// valid start date, the server fans out the rest, and without this check those
// generated dates were only tested against other lessons — never the schedule.
export async function checkOccurrenceConflicts(
  occurrences: Date[],
  opts: { duration: number; locationType: string; bookingStudentId: string; excludeLessonId?: string; availabilityAdminId?: string | null }
): Promise<OccurrenceStatus[]> {
  if (occurrences.length === 0) return [];

  const { duration, locationType, bookingStudentId, excludeLessonId, availabilityAdminId } = opts;
  const bufferMs = commuteConfig.bufferMinutes * 60 * 1000;
  const durationMs = duration * 60 * 1000;

  const starts = occurrences.map((d) => d.getTime());
  const ends = occurrences.map((d) => d.getTime() + durationMs);
  // Widen the window by the buffer plus one hour (max lesson length) so a lesson
  // that starts before the first occurrence but still overlaps is included.
  const windowStart = new Date(Math.min(...starts) - bufferMs - 60 * 60 * 1000);
  const windowEnd = new Date(Math.max(...ends) + bufferMs);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lessons')
    .select('id, start_time, end_time, location_type, student_id, status')
    .neq('status', 'cancelled')
    .lte('start_time', windowEnd.toISOString())
    .gte('end_time', windowStart.toISOString());

  if (error) {
    throw new Error(`Conflict check failed: ${error.message}`);
  }

  const existing = (data ?? []) as ExistingLesson[];

  // Load the teacher's recurring availability + day-block overrides once, scoped
  // to the occurrence date range, only when availability enforcement is requested.
  let availability: AvailabilityWindow[] = [];
  let overrides: DayOverride[] = [];
  let busyBlocks: BusyBlock[] = [];
  if (availabilityAdminId) {
    const localDates = occurrences.map((d) => getBusinessTimeParts(d).dateStr);
    const minDate = localDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = localDates.reduce((a, b) => (a > b ? a : b));
    const [availRes, overrideRes, busyRes] = await Promise.all([
      admin
        .from('availability')
        .select('day_of_week, start_time, end_time, is_recurring')
        .eq('admin_id', availabilityAdminId),
      admin
        .from('availability_overrides')
        .select('override_date, is_available, start_time, end_time, reason')
        .eq('admin_id', availabilityAdminId)
        .gte('override_date', minDate)
        .lte('override_date', maxDate),
      // Imported Google-Calendar busy time (students only, like availability).
      admin
        .from('google_busy_blocks')
        .select('start_time, end_time')
        .eq('admin_id', availabilityAdminId)
        .lt('start_time', windowEnd.toISOString())
        .gt('end_time', windowStart.toISOString()),
    ]);
    if (availRes.error) throw new Error(`Availability check failed: ${availRes.error.message}`);
    if (overrideRes.error) throw new Error(`Override check failed: ${overrideRes.error.message}`);
    if (busyRes.error) throw new Error(`Busy block check failed: ${busyRes.error.message}`);
    availability = (availRes.data ?? []) as AvailabilityWindow[];
    overrides = (overrideRes.data ?? []) as DayOverride[];
    busyBlocks = (busyRes.data ?? []) as BusyBlock[];
  }

  const horizonMs = Date.now() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return occurrences.map((start, index) => {
    const end = new Date(start.getTime() + durationMs);

    // Availability/day-block enforcement takes precedence over lesson overlaps:
    // a time on a blocked day is 'unavailable' regardless of what else is there.
    if (availabilityAdminId) {
      const { dateStr, dayOfWeek, minutes } = getBusinessTimeParts(start);
      if (!isWithinAvailability(dateStr, dayOfWeek, minutes, minutes + duration, availability, overrides)) {
        return {
          date: start.toISOString(),
          index,
          status: 'conflict' as const,
          reason: 'unavailable' as const,
          conflictIsOwnLesson: false,
          blockReason: blockedReasonForDate(dateStr, overrides),
        };
      }
      // The busy-block mirror only extends SYNC_WINDOW_DAYS out, so a student
      // occurrence beyond it can't be checked — reject rather than assume free.
      // (UI caps keep legitimate bookings ~2 weeks inside this horizon.)
      if (end.getTime() > horizonMs) {
        return { date: start.toISOString(), index, status: 'conflict' as const, reason: 'unavailable' as const, conflictIsOwnLesson: false };
      }
      if (overlapsBusyBlock(start.getTime(), end.getTime(), busyBlocks)) {
        return { date: start.toISOString(), index, status: 'conflict' as const, reason: 'unavailable' as const, conflictIsOwnLesson: false };
      }
    }

    const result = evaluateConflict(start, end, locationType, bookingStudentId, existing, bufferMs, excludeLessonId);
    return { date: start.toISOString(), index, ...result };
  });
}
