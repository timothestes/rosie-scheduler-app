import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resend, EMAIL_CONFIG } from '@/lib/resend';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await context.params;
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { type } = body; // 'setup' | 'reset'

  const adminClient = createAdminClient();

  // Fetch student profile
  const { data: student, error: studentError } = await adminClient
    .from('users')
    .select('full_name, email')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Generate a recovery link (works for both setup and reset — same mechanism)
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: student.email,
    options: {
      redirectTo: `${EMAIL_CONFIG.appUrl}/lessons`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Error generating auth link:', linkError);
    return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
  }

  const actionLink = linkData.properties.action_link;
  const studentName = student.full_name?.split(' ')[0] || 'there';
  const isSetup = type === 'setup';

  const subject = isSetup
    ? 'Set Up Your Rosie Lessons Account'
    : 'Reset Your Rosie Lessons Password';

  const headline = isSetup ? 'Welcome to Rosie Lessons!' : 'Password Reset Request';
  const headlineEmoji = isSetup ? '🎵' : '🔑';
  const bodyText = isSetup
    ? `Your teacher has set up a Rosie Lessons account for you. Click the button below to set your password and access your lessons.`
    : `A password reset was requested for your Rosie Lessons account. Click the button below to choose a new password.`;
  const buttonText = isSetup ? 'Set Up My Account' : 'Reset My Password';
  const footerText = isSetup
    ? `If you weren't expecting this, you can safely ignore it.`
    : `If you didn't request a password reset, you can safely ignore this email.`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${headlineEmoji} ${headline}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${studentName},</p>
          <p style="font-size: 16px; margin-bottom: 30px;">${bodyText}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
              ${buttonText}
            </a>
          </div>

          <p style="font-size: 13px; color: #888; margin-top: 30px; text-align: center;">
            This link expires in 24 hours. ${footerText}
          </p>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>Questions?</strong> Reply to this email to get in touch with Rosie.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textBody = `
Hi ${studentName},

${bodyText}

Click the link below to ${isSetup ? 'set up your account' : 'reset your password'}:
${actionLink}

This link expires in 24 hours. ${footerText}

Questions? Reply to this email to get in touch with Rosie.
  `.trim();

  const { error: emailError } = await resend.emails.send({
    from: EMAIL_CONFIG.fromEmail,
    to: student.email,
    subject,
    html: htmlBody,
    text: textBody,
  });

  if (emailError) {
    console.error('Error sending auth email:', emailError);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, sentTo: student.email });
}
