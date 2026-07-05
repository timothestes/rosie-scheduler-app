import { resend, EMAIL_CONFIG } from '@/lib/resend';

export interface BuildRescheduleEmailInput {
  studentName: string;
  oldStart: string; // ISO
  newStart: string; // ISO
  lessonTypeName: string;
  locationLabel: string;
  zoomUrl?: string | null;
}

export interface RescheduleNotificationInput extends BuildRescheduleEmailInput {
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

export function buildRescheduleEmail(
  input: BuildRescheduleEmailInput
): { subject: string; html: string; text: string } {
  const { studentName, oldStart, newStart, lessonTypeName, locationLabel, zoomUrl } = input;
  const firstName = studentName.split(' ')[0] || 'there';
  const oldF = formatPacific(oldStart);
  const newF = formatPacific(newStart);

  const subject = `Your ${lessonTypeName} lesson has been moved`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 26px;">📅 Lesson Rescheduled</h1>
    </div>
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px; margin: 0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size: 16px; margin: 0 0 20px 0;">
        Your <strong>${escapeHtml(lessonTypeName)}</strong> lesson has been moved to a new time. Here are the updated details:
      </p>
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
        <p style="margin: 0 0 12px 0; color: #999; text-decoration: line-through;">
          Was: ${oldF.date} at ${oldF.time}
        </p>
        <p style="margin: 5px 0;"><strong>📅 New date:</strong> ${newF.date}</p>
        <p style="margin: 5px 0;"><strong>🕐 New time:</strong> ${newF.time}</p>
        <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${escapeHtml(locationLabel)}</p>
        ${zoomUrl ? `<p style="margin: 5px 0;"><strong>💻 Zoom:</strong> <a href="${escapeHtml(zoomUrl)}" style="color:#0066cc; word-break:break-all;">${escapeHtml(zoomUrl)}</a></p>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin: 0;">
        If this new time doesn't work for you, just reply to this email and we'll sort it out.
      </p>
    </div>
  </body>
</html>`;

  const text = `Hi ${firstName},

Your ${lessonTypeName} lesson has been moved to a new time.

Was: ${oldF.date} at ${oldF.time}
Now: ${newF.date} at ${newF.time}
Location: ${locationLabel}
${zoomUrl ? `Zoom: ${zoomUrl}` : ''}

If this new time doesn't work for you, just reply to this email.`.trim();

  return { subject, html, text };
}

/**
 * Sends the reschedule notification. Self-guards: a failure here is logged and
 * swallowed so it can never break the caller's reschedule flow.
 */
export async function sendRescheduleNotification(
  input: RescheduleNotificationInput
): Promise<void> {
  try {
    const { subject, html, text } = buildRescheduleEmail(input);
    await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: input.studentEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Error sending reschedule notification:', err);
  }
}
