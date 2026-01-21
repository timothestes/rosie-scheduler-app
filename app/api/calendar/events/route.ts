import { createClient } from '@/lib/supabase/server';
import { fetchGoogleCalendarEvents } from '@/lib/google-calendar';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/calendar/events - Get Google Calendar events for admin
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required' },
      { status: 400 }
    );
  }

  const events = await fetchGoogleCalendarEvents(
    user.id,
    new Date(startDate),
    new Date(endDate)
  );

  return NextResponse.json(events);
}
