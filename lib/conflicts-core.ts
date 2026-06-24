// Pure conflict predicate shared by the booking POST and the preflight API.
// Kept free of `@/` imports so it is trivially unit-testable.

export interface ExistingLesson {
  start_time: string;
  end_time: string;
  location_type: string;
  student_id: string;
  status: string;
}

export interface ConflictResult {
  status: 'available' | 'conflict';
  reason: 'overlap' | 'commute_buffer' | null;
  conflictIsOwnLesson: boolean;
}

export function evaluateConflict(
  occStart: Date,
  occEnd: Date,
  locationType: string,
  bookingStudentId: string,
  existing: ExistingLesson[],
  bufferMs: number
): ConflictResult {
  const occStartMs = occStart.getTime();
  const occEndMs = occEnd.getTime();

  // 1. Exact overlap with ANY non-cancelled lesson (including the student's own).
  for (const lesson of existing) {
    if (lesson.status === 'cancelled') continue;
    const ls = new Date(lesson.start_time).getTime();
    const le = new Date(lesson.end_time).getTime();
    if (ls < occEndMs && le > occStartMs) {
      return {
        status: 'conflict',
        reason: 'overlap',
        conflictIsOwnLesson: lesson.student_id === bookingStudentId,
      };
    }
  }

  // 2. Commute buffer vs OTHER students' in-person lessons (only if the new lesson is in-person).
  if (locationType === 'in-person') {
    const bufStart = occStartMs - bufferMs;
    const bufEnd = occEndMs + bufferMs;
    for (const lesson of existing) {
      if (lesson.status === 'cancelled') continue;
      if (lesson.location_type !== 'in-person') continue;
      if (lesson.student_id === bookingStudentId) continue;
      const ls = new Date(lesson.start_time).getTime();
      const le = new Date(lesson.end_time).getTime();
      if (ls < bufEnd && le > bufStart) {
        return { status: 'conflict', reason: 'commute_buffer', conflictIsOwnLesson: false };
      }
    }
  }

  return { status: 'available', reason: null, conflictIsOwnLesson: false };
}
