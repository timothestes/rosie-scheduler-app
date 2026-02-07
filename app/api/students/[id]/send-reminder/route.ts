import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { resend, EMAIL_CONFIG } from '@/lib/resend';
import { getLessonType, formatRate } from '@/config/lessonTypes';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const studentId = params.id;

    console.log('Received request for student ID:', studentId);

    const body = await request.json();
    const customMessage = body.customMessage || '';

    const supabase = await createClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('email', user.email)
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check for service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({
        error: 'Server configuration error - service role key not configured'
      }, { status: 500 });
    }

    // Use service role client to bypass RLS for admin operations
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get student info
    const { data: student, error: studentError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student fetch error:', {
        error: studentError,
        studentId: studentId,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return NextResponse.json({
        error: 'Student not found',
        details: studentError?.message
      }, { status: 404 });
    }

    // Get unpaid lessons for this student
    const { data: unpaidLessons, error: lessonsError } = await serviceSupabase
      .from('lessons')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_paid', false)
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    if (lessonsError) {
      console.error('Lessons fetch error:', lessonsError);
      return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 });
    }

    if (!unpaidLessons || unpaidLessons.length === 0) {
      return NextResponse.json({ error: 'No unpaid lessons found' }, { status: 400 });
    }

    // Calculate total amount owed
    let totalAmount = 0;
    const lessonDetails = unpaidLessons.map(lesson => {
      const lessonType = getLessonType(lesson.lesson_type);
      const rate = lessonType?.rate ?? 0;

      // Apply discount if student has one and round up to nearest dollar
      const discountedRate = student.discount_percent
        ? Math.ceil(rate * (1 - student.discount_percent / 100))
        : rate;

      totalAmount += discountedRate;

      return {
        date: new Date(lesson.start_time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Los_Angeles'
        }),
        type: lessonType?.name || lesson.lesson_type,
        amount: formatRate(discountedRate),
      };
    });

    // Send email
    const studentName = student.full_name?.split(' ')[0] || 'there';
    const subject = `Payment Reminder - ${unpaidLessons.length} Unpaid Lesson${unpaidLessons.length !== 1 ? 's' : ''}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Reminder</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Payment Reminder</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            ${customMessage ? `
              <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
                <p style="font-size: 16px; margin: 0; white-space: pre-line;">${customMessage}</p>
              </div>
            ` : `
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${studentName},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                This is a friendly reminder that you have <strong>${unpaidLessons.length} unpaid lesson${unpaidLessons.length !== 1 ? 's' : ''}</strong>.
              </p>
            `}

            ${student.discount_percent ? `
              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; color: #155724; font-weight: 600;">
                  ✨ Your ${student.discount_percent}% discount has been applied to these lessons!
                </p>
              </div>
            ` : ''}

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
              <h2 style="font-size: 18px; margin-top: 0; color: #667eea;">Unpaid Lessons</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #e0e0e0;">
                    <th style="text-align: left; padding: 10px 0; font-size: 14px; color: #666;">Date</th>
                    <th style="text-align: left; padding: 10px 0; font-size: 14px; color: #666;">Lesson</th>
                    <th style="text-align: right; padding: 10px 0; font-size: 14px; color: #666;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lessonDetails.map(lesson => `
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                      <td style="padding: 12px 0; font-size: 14px;">${lesson.date}</td>
                      <td style="padding: 12px 0; font-size: 14px;">${lesson.type}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; font-weight: 600;">${lesson.amount}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #667eea;">
                    <td colspan="2" style="padding: 15px 0; font-size: 16px; font-weight: 600;">Total Amount Due</td>
                    <td style="padding: 15px 0; font-size: 18px; text-align: right; font-weight: 700; color: #667eea;">${formatRate(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${EMAIL_CONFIG.appUrl}/lessons" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                View My Lessons
              </a>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Questions?</strong> Reply to this email to get in touch.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textBody = `
${customMessage || `Hi ${studentName},\n\nThis is a friendly reminder that you have ${unpaidLessons.length} unpaid lesson${unpaidLessons.length !== 1 ? 's' : ''}.`}

${student.discount_percent ? `✨ Your ${student.discount_percent}% discount has been applied to these lessons!\n` : ''}
UNPAID LESSONS:
${lessonDetails.map(lesson => `• ${lesson.date} - ${lesson.type}: ${lesson.amount}`).join('\n')}

TOTAL AMOUNT DUE: ${formatRate(totalAmount)}

View your lessons: ${EMAIL_CONFIG.appUrl}/lessons

Questions? Reply to this email to get in touch.
    `.trim();

    const { error } = await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: student.email,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (error) {
      console.error('Error sending reminder email:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Payment reminder sent to ${student.email}`,
      unpaidCount: unpaidLessons.length,
      totalAmount: formatRate(totalAmount),
    });

  } catch (error) {
    console.error('Error in send-reminder route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
