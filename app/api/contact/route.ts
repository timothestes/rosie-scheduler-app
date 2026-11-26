import { NextResponse } from 'next/server';
import { resend, EMAIL_CONFIG } from '@/lib/resend';
import { buildContactEmail, parseContactSubmission } from '@/lib/contact';
import { getPrimaryAdminEmail } from '@/lib/utils';

// Public endpoint behind the portfolio's contact forms. It only ever emails
// Rosie (never an address taken from the request); the visitor's address is
// set as reply-to so she can answer straight from her inbox.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const result = parseContactSubmission(body);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  // Honeypot was filled in: look successful, send nothing.
  if (!result.submission) {
    return NextResponse.json({ ok: true });
  }

  const to = process.env.CONTACT_FORM_TO || getPrimaryAdminEmail();
  if (!to) {
    console.error('Contact form: no recipient. Set CONTACT_FORM_TO or PRIMARY_ADMIN_EMAIL.');
    return NextResponse.json({ error: 'Message could not be sent.' }, { status: 500 });
  }

  const { subject, text, replyTo } = buildContactEmail(result.submission);

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to,
      replyTo,
      subject,
      text,
    });
    if (error) {
      console.error('Contact form: Resend rejected the message:', error);
      return NextResponse.json({ error: 'Message could not be sent.' }, { status: 502 });
    }
  } catch (err) {
    console.error('Contact form: error sending message:', err);
    return NextResponse.json({ error: 'Message could not be sent.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
