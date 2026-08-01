import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/availability/busy - imported Google-Calendar busy intervals for the
// student slot grid. Intervals only — the table stores no event titles.
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let query = supabase.from('google_busy_blocks').select('start_time, end_time');
  // Interval overlap with [startDate, endDate], not containment — a multi-day
  // block straddling the range boundary must still be returned.
  if (endDate) query = query.lt('start_time', endDate);
  if (startDate) query = query.gt('end_time', startDate);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
