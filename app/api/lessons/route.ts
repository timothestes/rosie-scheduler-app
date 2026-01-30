import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration, getLessonType } from '@/config/lessonTypes';
import { createZoomMeeting, getZoomAccessToken } from '@/lib/zoom';
import { createGoogleCalendarEvent } from '@/lib/google-calendar';
import { getPrimaryAdminEmail } from '@/lib/utils';

// GET /api/lessons - Get lessons
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const studentId = searchParams.get('studentId');
  const status = searchParams.get('status');
  const forScheduling = searchParams.get('forScheduling') === 'true';
  const paidStartDate = searchParams.get('paidStartDate');
  const paidEndDate = searchParams.get('paidEndDate');

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  // For scheduling purposes, use the database function to get booked slots (bypasses RLS securely)
  if (forScheduling && !admin) {
    const { data, error } = await supabase.rpc('get_booked_slots', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      console.error('Lessons GET (scheduling) error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  let query = supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .order('start_time', { ascending: true });

  // If not admin, only show user's own lessons
  if (!admin) {
    query = query.eq('student_id', user.id);
  } else if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (startDate) {
    query = query.gte('start_time', startDate);
  }

  if (endDate) {
    query = query.lte('start_time', endDate);
  }

  // Filter by paid_at date range (for payment reports)
  if (paidStartDate) {
    query = query.gte('paid_at', paidStartDate);
  }

  if (paidEndDate) {
    const endDateTime = new Date(paidEndDate);
    endDateTime.setHours(23, 59, 59, 999);
    query = query.lte('paid_at', endDateTime.toISOString());
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Lessons GET error:', error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/lessons - Create a new lesson
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { lesson_type, location_type, start_time, notes, is_recurring, recurring_frequency, recurring_months } = body;

  // Calculate end time based on lesson type duration
  const duration = getLessonDuration(lesson_type);
  const startDate = new Date(start_time);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  // Get an admin to assign the lesson to
  // Use PRIMARY_ADMIN_EMAIL env var if set, otherwise fall back to first admin
  const primaryAdminEmail = getPrimaryAdminEmail();
  
  let adminId = null;
  if (primaryAdminEmail) {
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', primaryAdminEmail)
      .single();
    adminId = adminUser?.id;
  }
  
  // Fallback to first admin in database if env var not set or user not found
  if (!adminId) {
    const { data: admins } = await supabase
      .from('admins')
      .select('email')
      .limit(1);

    if (admins && admins.length > 0) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', admins[0].email)
        .single();
      adminId = adminUser?.id;
    }
  }

  // Generate all lesson dates (single or recurring)
  let lessonDates: Date[];
  if (is_recurring && recurring_months) {
    if (recurring_frequency === 'weekly') {
      // Weekly lessons: 4 lessons per month
      const totalWeeks = recurring_months * 4;
      lessonDates = generateWeeklyRecurringDates(startDate, totalWeeks);
    } else {
      // Monthly lessons (legacy): 1 lesson per month
      lessonDates = generateMonthlyRecurringDates(startDate, recurring_months);
    }
  } else {
    lessonDates = [startDate];
  }

  // Check for conflicts on all dates
  for (const date of lessonDates) {
    const lessonEnd = new Date(date.getTime() + duration * 60 * 1000);
    const { data: conflicts } = await supabase
      .from('lessons')
      .select('id')
      .neq('status', 'cancelled')
      .lt('start_time', lessonEnd.toISOString())
      .gt('end_time', date.toISOString());

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: `Time slot conflict on ${date.toLocaleDateString()}` },
        { status: 409 }
      );
    }
  }

  // Get student info for calendar events
  const { data: studentInfo } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const lessonTypeInfo = getLessonType(lesson_type);
  const studentName = studentInfo?.full_name || studentInfo?.email || 'Student';

  // Generate a recurring series ID if this is a recurring booking
  const recurringSeriesId = is_recurring ? crypto.randomUUID() : null;

  // Pre-fetch Zoom access token once for batch operations (instead of per-lesson)
  let zoomAccessToken: string | null = null;
  if (location_type === 'zoom' && adminId) {
    zoomAccessToken = await getZoomAccessToken(adminId);
  }

  // Create all lessons
  const createdLessons = [];
  
  for (let i = 0; i < lessonDates.length; i++) {
    const lessonStart = lessonDates[i];
    const lessonEnd = new Date(lessonStart.getTime() + duration * 60 * 1000);

    // Create Zoom meeting if lesson is virtual
    let zoomMeetingId: string | null = null;
    let zoomJoinUrl: string | null = null;

    if (location_type === 'zoom' && adminId && zoomAccessToken) {
      const topic = `${lessonTypeInfo?.name || 'Lesson'} - Rosie Scheduler`;
      
      const zoomMeeting = await createZoomMeeting(
        adminId,
        topic,
        lessonStart,
        duration,
        notes || undefined,
        zoomAccessToken // Pass pre-fetched token
      );

      if (zoomMeeting) {
        zoomMeetingId = String(zoomMeeting.id);
        zoomJoinUrl = zoomMeeting.join_url;
      }
    }

    // Create Google Calendar event for admin
    let googleCalendarEventId: string | null = null;

    if (adminId) {
      const recurringLabel = recurring_frequency === 'weekly' ? 'Weekly' : 'Monthly';
      const eventTitle = is_recurring
        ? `${recurringLabel}: ${lessonTypeInfo?.name || 'Lesson'} with ${studentName}`
        : `${lessonTypeInfo?.name || 'Lesson'} with ${studentName}`;
      
      const calendarEvent = await createGoogleCalendarEvent(
        adminId,
        eventTitle,
        `Lesson Type: ${lessonTypeInfo?.name}\nStudent: ${studentName}${notes ? `\nNotes: ${notes}` : ''}${zoomJoinUrl ? `\nZoom: ${zoomJoinUrl}` : ''}${is_recurring ? `\nRecurring: ${i + 1} of ${lessonDates.length}` : ''}`,
        lessonStart,
        lessonEnd,
        location_type === 'zoom' ? zoomJoinUrl || 'Zoom' : 'In-Person'
      );

      if (calendarEvent) {
        googleCalendarEventId = calendarEvent.id;
      }
    }

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        student_id: user.id,
        admin_id: adminId,
        lesson_type,
        location_type,
        start_time: lessonStart.toISOString(),
        end_time: lessonEnd.toISOString(),
        notes,
        status: 'scheduled',
        is_paid: false,
        zoom_meeting_id: zoomMeetingId,
        zoom_join_url: zoomJoinUrl,
        google_calendar_event_id: googleCalendarEventId,
        is_recurring: is_recurring || false,
        recurring_series_id: recurringSeriesId,
      })
      .select('*, student:users!lessons_student_id_fkey(*)')
      .single();

    if (error) {
      console.error('Error creating lesson:', error);
      // Continue creating other lessons even if one fails
      continue;
    }

    createdLessons.push(data);
  }

  if (createdLessons.length === 0) {
    return NextResponse.json({ error: 'Failed to create lessons' }, { status: 500 });
  }

  // Return first lesson for single booking, or all for recurring
  return NextResponse.json(
    is_recurring ? { lessons: createdLessons, count: createdLessons.length } : createdLessons[0], 
    { status: 201 }
  );
}

// Helper to get the Nth weekday of a month
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  const firstDay = new Date(year, month, 1);
  let count = 0;
  
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break; // Went to next month
    
    if (date.getDay() === weekday) {
      count++;
      if (count === n) {
        return date;
      }
    }
  }
  
  return null; // Requested week doesn't exist in this month
}

// Generate weekly recurring lesson dates (same day each week)
function generateWeeklyRecurringDates(startDate: Date, weeks: number): Date[] {
  const dates: Date[] = [];
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();

  for (let i = 0; i < weeks; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i * 7));
    date.setHours(hours, minutes, 0, 0);
    dates.push(date);
  }

  return dates;
}

// Generate monthly recurring lesson dates (same relative weekday each month)
function generateMonthlyRecurringDates(startDate: Date, months: number): Date[] {
  const dates: Date[] = [];
  const weekday = startDate.getDay();
  const weekOfMonth = Math.ceil(startDate.getDate() / 7);
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();

  for (let i = 0; i < months; i++) {
    const targetMonth = startDate.getMonth() + i;
    const targetYear = startDate.getFullYear() + Math.floor(targetMonth / 12);
    const adjustedMonth = targetMonth % 12;

    const date = getNthWeekdayOfMonth(targetYear, adjustedMonth, weekday, weekOfMonth);
    
    if (date) {
      date.setHours(hours, minutes, 0, 0);
      dates.push(date);
    }
  }

  return dates;
}
