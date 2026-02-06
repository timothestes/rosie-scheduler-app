import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration, getLessonType, formatRate } from '@/config/lessonTypes';
import { createZoomMeeting, getZoomAccessToken } from '@/lib/zoom';
import { createGoogleCalendarEvent } from '@/lib/google-calendar';
import { getPrimaryAdminEmail } from '@/lib/utils';
import { commuteConfig } from '@/config/commute';
import { resend, EMAIL_CONFIG } from '@/lib/resend';

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
  const { lesson_type, location_type, location_address, start_time, notes, is_recurring, recurring_frequency, recurring_months } = body;

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
  // For in-person lessons by OTHER students, add commute buffer time before and after
  // User's own back-to-back in-person lessons are allowed (same location, no commute)
  const bufferMs = commuteConfig.bufferMinutes * 60 * 1000;
  
  for (const date of lessonDates) {
    const lessonEnd = new Date(date.getTime() + duration * 60 * 1000);
    
    // First check for exact overlaps (applies to all lessons)
    const { data: exactConflicts } = await supabase
      .from('lessons')
      .select('id, location_type, student_id')
      .neq('status', 'cancelled')
      .lt('start_time', lessonEnd.toISOString())
      .gt('end_time', date.toISOString());

    if (exactConflicts && exactConflicts.length > 0) {
      return NextResponse.json(
        { error: `Time slot conflict on ${date.toLocaleDateString()}` },
        { status: 409 }
      );
    }

    // Now check for buffer conflicts with OTHER students' in-person lessons
    // Only apply buffer if the new lesson is in-person OR conflicts with someone else's in-person lesson
    if (location_type === 'in-person') {
      const conflictStart = new Date(date.getTime() - bufferMs);
      const conflictEnd = new Date(lessonEnd.getTime() + bufferMs);
      
      const { data: bufferConflicts } = await supabase
        .from('lessons')
        .select('id, location_type, student_id')
        .neq('status', 'cancelled')
        .neq('student_id', user.id) // Exclude user's own lessons - they can book back-to-back
        .eq('location_type', 'in-person') // Only in-person lessons need buffer
        .lt('start_time', conflictEnd.toISOString())
        .gt('end_time', conflictStart.toISOString());

      if (bufferConflicts && bufferConflicts.length > 0) {
        return NextResponse.json(
          { error: `Time slot conflict on ${date.toLocaleDateString()}. A ${commuteConfig.bufferMinutes}-minute buffer is required between in-person lessons with different students for travel time.` },
          { status: 409 }
        );
      }
    }
  }

  // Get student info for calendar events
  const { data: studentInfo } = await supabase
    .from('users')
    .select('full_name, email, address')
    .eq('id', user.id)
    .single();

  // If booking an in-person lesson with an address, save it to the user's profile
  if (location_type === 'in-person' && location_address && location_address.trim()) {
    await supabase
      .from('users')
      .update({ address: location_address.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

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
      
      const locationDisplay = location_type === 'zoom' 
        ? (zoomJoinUrl || 'Zoom')
        : (location_address || 'In-Person');
      
      const calendarEvent = await createGoogleCalendarEvent(
        adminId,
        eventTitle,
        `Lesson Type: ${lessonTypeInfo?.name}\nStudent: ${studentName}${location_type === 'in-person' && location_address ? `\nAddress: ${location_address}` : ''}${notes ? `\nNotes: ${notes}` : ''}${zoomJoinUrl ? `\nZoom: ${zoomJoinUrl}` : ''}${is_recurring ? `\nRecurring: ${i + 1} of ${lessonDates.length}` : ''}`,
        lessonStart,
        lessonEnd,
        locationDisplay
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
        location_address: location_type === 'in-person' ? location_address : null,
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

  // Send booking confirmation email
  try {
    const studentName = studentInfo?.full_name?.split(' ')[0] || 'there';
    const isRecurringBooking = createdLessons.length > 1;

    const subject = isRecurringBooking
      ? `Booking Confirmed - ${createdLessons.length} Lessons Scheduled!`
      : 'Lesson Booked Successfully!';

    // Format lesson details for email
    const lessonDetails = createdLessons.map(lesson => {
      const startTime = new Date(lesson.start_time);
      return {
        date: startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        time: startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        type: lessonTypeInfo?.name || lesson.lesson_type,
        location: location_type === 'zoom' ? 'Zoom (link below)' : (location_address || 'In-Person'),
        zoomUrl: lesson.zoom_join_url,
      };
    });

    const firstLesson = createdLessons[0];
    const rate = lessonTypeInfo?.rate ?? 0;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✓ Booking Confirmed!</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${studentName},</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your ${isRecurringBooking ? `${createdLessons.length} lessons have` : 'lesson has'} been successfully scheduled! 🎉
            </p>

            ${isRecurringBooking ? `
              <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; color: #1565c0; font-weight: 600;">
                  📅 Recurring Lessons: ${createdLessons.length} lessons scheduled
                </p>
              </div>
            ` : ''}

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
              <h2 style="font-size: 18px; margin-top: 0; color: #667eea;">Lesson Details</h2>

              ${lessonDetails.map((lesson, index) => `
                ${isRecurringBooking && index > 0 ? '<div style="border-top: 1px solid #f0f0f0; margin: 15px 0;"></div>' : ''}
                <div style="margin-bottom: ${isRecurringBooking ? '15px' : '10px'};">
                  ${isRecurringBooking ? `<p style="font-weight: 600; color: #667eea; margin: 0 0 8px 0;">Lesson ${index + 1}</p>` : ''}
                  <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${lesson.date}</p>
                  <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${lesson.time}</p>
                  <p style="margin: 5px 0;"><strong>📚 Type:</strong> ${lesson.type}</p>
                  <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${lesson.location}</p>
                  ${lesson.zoomUrl ? `
                    <div style="background: #f0f7ff; padding: 10px; border-radius: 4px; margin-top: 10px;">
                      <p style="margin: 0 0 5px 0; font-weight: 600; color: #0066cc;">Zoom Meeting Link:</p>
                      <a href="${lesson.zoomUrl}" style="color: #0066cc; word-break: break-all;">${lesson.zoomUrl}</a>
                    </div>
                  ` : ''}
                </div>
              `).join('')}

              ${notes ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>Your Notes:</strong> ${notes}
                  </p>
                </div>
              ` : ''}
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
              <h3 style="font-size: 16px; margin-top: 0; color: #667eea;">Payment Information</h3>
              ${isRecurringBooking && recurring_frequency === 'weekly' ? `
                <p style="margin: 5px 0; font-size: 14px;">
                  <strong>Monthly Rate:</strong> ${formatRate(lessonTypeInfo?.weeklyMonthlyRate ?? 0)}/month
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                  <strong>Duration:</strong> ${recurring_months} month${recurring_months > 1 ? 's' : ''}
                </p>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
                  Payment is due on the 1st of each month. You can pay via Venmo, Zelle, or your preferred method.
                </p>
              ` : `
                <p style="margin: 5px 0; font-size: 14px;">
                  <strong>Price per lesson:</strong> ${formatRate(rate)}
                </p>
                ${isRecurringBooking ? `
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Total for ${createdLessons.length} lessons:</strong> ${formatRate(rate * createdLessons.length)}
                  </p>
                ` : ''}
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
                  Payment is due on the day of each lesson. You can pay via Venmo, Zelle, or your preferred method.
                </p>
              `}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://rosielessons.com/lessons" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                View My Lessons
              </a>
            </div>

            <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-top: 20px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                <strong>Questions or need to reschedule?</strong> Reply to this email and I'll get back to you as soon as possible!
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Hi ${studentName},

Your ${isRecurringBooking ? `${createdLessons.length} lessons have` : 'lesson has'} been successfully scheduled! 🎉

${isRecurringBooking ? `RECURRING LESSONS (${createdLessons.length} total):` : 'LESSON DETAILS:'}

${lessonDetails.map((lesson, index) => `
${isRecurringBooking ? `Lesson ${index + 1}:` : ''}
📅 Date: ${lesson.date}
🕐 Time: ${lesson.time}
📚 Type: ${lesson.type}
📍 Location: ${lesson.location}
${lesson.zoomUrl ? `Zoom Link: ${lesson.zoomUrl}` : ''}
`).join('\n')}

${notes ? `Your Notes: ${notes}\n` : ''}
PAYMENT INFORMATION:
${isRecurringBooking && recurring_frequency === 'weekly'
  ? `Monthly Rate: ${formatRate(lessonTypeInfo?.weeklyMonthlyRate ?? 0)}/month
Duration: ${recurring_months} month${recurring_months > 1 ? 's' : ''}
Payment is due on the 1st of each month.`
  : `Price per lesson: ${formatRate(rate)}
${isRecurringBooking ? `Total for ${createdLessons.length} lessons: ${formatRate(rate * createdLessons.length)}` : ''}
Payment is due on the day of each lesson.`}

View your lessons: https://rosielessons.com/lessons

Questions or need to reschedule? Reply to this email!
    `.trim();

    await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: studentInfo?.email || user.email || '',
      subject,
      html: htmlBody,
      text: textBody,
    });
  } catch (emailError) {
    console.error('Error sending booking confirmation email:', emailError);
    // Don't fail the booking if email fails
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
