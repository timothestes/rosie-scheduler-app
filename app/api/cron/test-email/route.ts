import { NextRequest, NextResponse } from 'next/server';
import { resend, EMAIL_CONFIG } from '@/lib/resend';
import { LessonReminderEmail, getLessonReminderText } from '@/lib/email-templates';

// Test endpoint - only available in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ 
      error: 'Missing email parameter',
      usage: '/api/cron/test-email?email=you@example.com'
    }, { status: 400 });
  }

  const emailProps = {
    studentName: 'Test Student',
    lessonType: '30 Minute Voice Lesson',
    lessonDate: 'Wednesday, February 5, 2026',
    lessonTime: '2:00 PM',
    locationType: 'zoom' as const,
    locationAddress: null,
    zoomJoinUrl: 'https://zoom.us/j/1234567890',
    hoursUntil: 24,
    appUrl: EMAIL_CONFIG.appUrl,
  };

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: email,
      subject: '🧪 TEST: Lesson reminder for tomorrow',
      react: LessonReminderEmail(emailProps),
      text: getLessonReminderText(emailProps),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Test email sent to ${email}`,
      emailId: data?.id 
    });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
}
