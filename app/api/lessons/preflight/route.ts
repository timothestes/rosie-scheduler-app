import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration } from '@/config/lessonTypes';
import { generateRecurringDates } from '@/lib/recurring-dates';
import { checkOccurrenceConflicts } from '@/lib/conflicts';

// POST /api/lessons/preflight - read-only availability check for a (possibly
// recurring) booking. Returns per-occurrence conflict status. Advisory only:
// POST /api/lessons re-checks at write time using the same helper.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { lesson_type, location_type, start_time, is_recurring, recurring_frequency, recurring_months } = body;

  if (!lesson_type || !start_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const duration = getLessonDuration(lesson_type);
  const startDate = new Date(start_time);

  const occurrences = is_recurring && recurring_months
    ? generateRecurringDates(startDate, recurring_frequency ?? 'monthly', recurring_months)
    : [startDate];

  try {
    const statuses = await checkOccurrenceConflicts(occurrences, {
      duration,
      locationType: location_type ?? 'zoom',
      bookingStudentId: user.id,
    });
    const availableCount = statuses.filter((s) => s.status === 'available').length;
    return NextResponse.json({ occurrences: statuses, availableCount, totalCount: statuses.length });
  } catch (err) {
    console.error('Preflight conflict check error:', err);
    return NextResponse.json({ error: 'Could not check availability' }, { status: 500 });
  }
}
