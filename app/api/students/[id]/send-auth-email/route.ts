import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resend, EMAIL_CONFIG } from '@/lib/resend';
import { buildAuthEmail, buildPasswordLink } from '@/lib/auth-email';

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

  // Generate a one-time recovery token (same mechanism for setup and reset)
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: student.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('Error generating auth link:', linkError);
    return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
  }

  const { subject, html: htmlBody, text: textBody } = buildAuthEmail({
    kind: type === 'setup' ? 'setup' : 'reset',
    fullName: student.full_name,
    link: buildPasswordLink(EMAIL_CONFIG.appUrl, linkData.properties.hashed_token),
    appUrl: EMAIL_CONFIG.appUrl,
  });

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
