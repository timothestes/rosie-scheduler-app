import { resend, EMAIL_CONFIG } from '@/lib/resend';

export interface BuildCancellationEmailInput {
  studentName: string;
  start: string; // ISO
  lessonTypeName: string;
  reason?: string | null;
}

export interface CancellationNotificationInput extends BuildCancellationEmailInput {
  studentEmail: string;
}

// User-controlled values are interpolated into raw HTML, so escape them at each
// HTML interpolation point. (Plain-text body and subject are not HTML.)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPacific(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles',
    }),
  };
}

export function buildCancellationEmail(
  input: BuildCancellationEmailInput
): { subject: string; html: string; text: string } {
  const { studentName, start, lessonTypeName, reason } = input;
  const firstName = studentName.split(' ')[0] || 'there';
  const f = formatPacific(start);
  const reasonText = reason?.trim() || null;

  const subject = `Your ${lessonTypeName} lesson on ${f.date} has been cancelled`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 26px;">📅 Lesson Cancelled</h1>
    </div>
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px; margin: 0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size: 16px; margin: 0 0 20px 0;">
        Your <strong>${escapeHtml(lessonTypeName)}</strong> lesson on the following date has been cancelled:
      </p>
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
        <p style="margin: 0 0 8px 0; text-decoration: line-through; color: #999;">${f.date} at ${f.time}</p>
        <p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(reasonText || 'This date is no longer available.')}</p>
      </div>
      <p style="font-size: 14px; color: #666; margin: 0;">
        No charge was made for this lesson. If you have any questions, just reply to this email.
      </p>
    </div>
  </body>
</html>`;

  const text = `Hi ${firstName},

Your ${lessonTypeName} lesson on ${f.date} at ${f.time} has been cancelled.

Reason: ${reasonText || 'This date is no longer available.'}

No charge was made for this lesson. If you have any questions, just reply to this email.`.trim();

  return { subject, html, text };
}

/**
 * Sends the cancellation notification. Self-guards: a failure here is logged
 * and swallowed so it can never break the caller's cancellation flow.
 */
export async function sendCancellationNotification(
  input: CancellationNotificationInput
): Promise<void> {
  try {
    const { subject, html, text } = buildCancellationEmail(input);
    await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: input.studentEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Error sending cancellation notification:', err);
  }
}
