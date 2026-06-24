import { createAdminClient } from '@/lib/supabase/admin';
import { commuteConfig } from '@/config/commute';
import { evaluateConflict, type ExistingLesson } from '@/lib/conflicts-core';
import type { OccurrenceStatus } from '@/types';

// Check every occurrence against existing lessons. Uses the service-role client
// so it reliably sees ALL students' lessons (conflict detection must not be
// limited by the booking user's RLS scope). Both POST /api/lessons and the
// preflight endpoint call this, guaranteeing the preview matches booking.
export async function checkOccurrenceConflicts(
  occurrences: Date[],
  opts: { duration: number; locationType: string; bookingStudentId: string }
): Promise<OccurrenceStatus[]> {
  if (occurrences.length === 0) return [];

  const { duration, locationType, bookingStudentId } = opts;
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
    .select('start_time, end_time, location_type, student_id, status')
    .neq('status', 'cancelled')
    .lte('start_time', windowEnd.toISOString())
    .gte('end_time', windowStart.toISOString());

  if (error) {
    throw new Error(`Conflict check failed: ${error.message}`);
  }

  const existing = (data ?? []) as ExistingLesson[];

  return occurrences.map((start, index) => {
    const end = new Date(start.getTime() + durationMs);
    const result = evaluateConflict(start, end, locationType, bookingStudentId, existing, bufferMs);
    return { date: start.toISOString(), index, ...result };
  });
}
