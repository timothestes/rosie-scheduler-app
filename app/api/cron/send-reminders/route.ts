import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resend, EMAIL_CONFIG } from '@/lib/resend';
import { LessonReminderEmail, getLessonReminderText } from '@/lib/email-templates';
import { getLessonType } from '@/config/lessonTypes';

// Use service role for cron job (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify the request is from Vercel Cron
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  // Also allow in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  return false;
}

// Format date for email
function formatEmailDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format time for email
function formatEmailTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface LessonWithStudent {
  id: string;
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  location_address: string | null;
  start_time: string;
  zoom_join_url: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  student: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = {
    processed: 0,
    sent24h: 0,
    sent1h: 0,
    errors: [] as string[],
  };

  try {
    // Calculate time windows
    // 24h reminder: lessons starting between 23-25 hours from now
    const hours24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const hours24End = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    
    // 1h reminder: lessons starting between 45min-75min from now  
    const hours1Start = new Date(now.getTime() + 45 * 60 * 1000);
    const hours1End = new Date(now.getTime() + 75 * 60 * 1000);

    // Fetch lessons needing 24h reminder
    const { data: lessons24h, error: error24h } = await supabase
      .from('lessons')
      .select(`
        id,
        lesson_type,
        location_type,
        location_address,
        start_time,
        zoom_join_url,
        reminder_24h_sent_at,
        reminder_1h_sent_at,
        student:users!lessons_student_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('status', 'scheduled')
      .is('reminder_24h_sent_at', null)
      .gte('start_time', hours24Start.toISOString())
      .lte('start_time', hours24End.toISOString());

    if (error24h) {
      console.error('Error fetching 24h lessons:', error24h);
      results.errors.push(`24h fetch error: ${error24h.message}`);
    }

    // Fetch lessons needing 1h reminder
    const { data: lessons1h, error: error1h } = await supabase
      .from('lessons')
      .select(`
        id,
        lesson_type,
        location_type,
        location_address,
        start_time,
        zoom_join_url,
        reminder_24h_sent_at,
        reminder_1h_sent_at,
        student:users!lessons_student_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('status', 'scheduled')
      .is('reminder_1h_sent_at', null)
      .gte('start_time', hours1Start.toISOString())
      .lte('start_time', hours1End.toISOString());

    if (error1h) {
      console.error('Error fetching 1h lessons:', error1h);
      results.errors.push(`1h fetch error: ${error1h.message}`);
    }

    // Helper to normalize student from Supabase join (may be array or object)
    const normalizeLesson = (lesson: unknown): LessonWithStudent | null => {
      const l = lesson as Record<string, unknown>;
      const studentData = l.student;
      const student = Array.isArray(studentData) ? studentData[0] : studentData;
      if (!student) return null;
      return { ...l, student } as LessonWithStudent;
    };

    // Send 24h reminders
    for (const rawLesson of lessons24h || []) {
      const lesson = normalizeLesson(rawLesson);
      if (!lesson) continue;
      
      results.processed++;
      try {
        await sendReminder(lesson, 24);
        
        // Mark as sent
        await supabase
          .from('lessons')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', lesson.id);
        
        results.sent24h++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error sending 24h reminder for lesson ${lesson.id}:`, err);
        results.errors.push(`24h lesson ${lesson.id}: ${errorMsg}`);
      }
    }

    // Send 1h reminders
    for (const rawLesson of lessons1h || []) {
      const lesson = normalizeLesson(rawLesson);
      if (!lesson) continue;
      
      results.processed++;
      try {
        await sendReminder(lesson, 1);
        
        // Mark as sent
        await supabase
          .from('lessons')
          .update({ reminder_1h_sent_at: new Date().toISOString() })
          .eq('id', lesson.id);
        
        results.sent1h++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error sending 1h reminder for lesson ${lesson.id}:`, err);
        results.errors.push(`1h lesson ${lesson.id}: ${errorMsg}`);
      }
    }

    console.log('Reminder cron completed:', results);
    return NextResponse.json(results);

  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function sendReminder(lesson: LessonWithStudent, hoursUntil: number) {
  const student = lesson.student;
  if (!student?.email) {
    throw new Error('No student email found');
  }

  const lessonDate = new Date(lesson.start_time);
  const lessonType = getLessonType(lesson.lesson_type);
  const studentName = student.full_name?.split(' ')[0] || 'there';

  const emailProps = {
    studentName,
    lessonType: lessonType?.name || lesson.lesson_type,
    lessonDate: formatEmailDate(lessonDate),
    lessonTime: formatEmailTime(lessonDate),
    locationType: lesson.location_type,
    locationAddress: lesson.location_address,
    zoomJoinUrl: lesson.zoom_join_url,
    hoursUntil,
    appUrl: EMAIL_CONFIG.appUrl,
  };

  const subject = hoursUntil === 1
    ? `⏰ Your lesson starts in 1 hour!`
    : `📅 Lesson reminder for tomorrow`;

  const { error } = await resend.emails.send({
    from: EMAIL_CONFIG.fromEmail,
    to: student.email,
    subject,
    react: LessonReminderEmail(emailProps),
    text: getLessonReminderText(emailProps),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
