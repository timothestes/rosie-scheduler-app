import { resend, EMAIL_CONFIG } from '@/lib/resend';

/**
 * Cute, celebratory one-liners shown to the teacher when a student books.
 * These are starter placeholders — edit freely to match your own voice.
 */
export const ENCOURAGEMENTS: string[] = [
  "A new student just said yes to learning from you 🎶",
  "Someone can't wait to make music with you 🎹",
  "You turn practice into joy — go get 'em ✨",
  "Another heart about to fall in love with music, thanks to you 💛",
  "Booked solid because you're the best there is 🌟",
  "Go be the teacher they'll always remember 🎼",
];

/** Returns a random encouragement. Isolated so an AI source could replace it later. */
export function pickEncouragement(): string {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}

export interface TeacherLesson {
  start_time: string;
  zoom_join_url?: string | null;
}

export interface BuildTeacherBookingEmailInput {
  teacherName?: string;
  studentName: string;
  lessons: TeacherLesson[];
  lessonTypeName: string;
  locationLabel: string;
  skippedCount: number;
  encouragement: string;
}

export interface TeacherBookingNotificationInput
  extends Omit<BuildTeacherBookingEmailInput, 'encouragement'> {
  teacherEmail: string;
  encouragement?: string;
}

// The teacher email interpolates user-controlled values (student name, lesson
// type, in-person address) into raw HTML, so escape them at each HTML
// interpolation point. (The plain-text body and the subject header are not HTML
// and are left raw.)
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

export function buildTeacherBookingEmail(
  input: BuildTeacherBookingEmailInput
): { subject: string; html: string; text: string } {
  const { studentName, lessons, lessonTypeName, locationLabel, skippedCount, encouragement } = input;
  const firstName = input.teacherName?.split(' ')[0] || 'Rosie';
  const isRecurring = lessons.length > 1;

  const subject = isRecurring
    ? `🎉 ${studentName} booked ${lessons.length} lessons!`
    : `🎉 ${studentName} just booked a lesson!`;

  const rows = lessons.map((l) => {
    const { date, time } = formatPacific(l.start_time);
    return { date, time, zoom: l.zoom_join_url ?? null };
  });

  const lessonNoun = isRecurring
    ? `${lessons.length} ${lessonTypeName} lessons`
    : `a ${lessonTypeName} lesson`;

  const skippedNote =
    skippedCount > 0
      ? `Heads up: ${skippedCount} requested date${skippedCount > 1 ? 's were' : ' was'} unavailable and ${skippedCount > 1 ? "weren't" : "wasn't"} scheduled.`
      : '';

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 26px;">🎉 New Booking!</h1>
    </div>
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px; margin: 0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size: 16px; margin: 0 0 20px 0;">
        <strong>${escapeHtml(studentName)}</strong> just booked ${escapeHtml(lessonNoun)}! 🎶
      </p>
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
        <h2 style="font-size: 16px; margin-top: 0; color: #667eea;">${isRecurring ? 'Lessons' : 'Lesson'}</h2>
        ${rows
          .map(
            (r, i) => `
          ${isRecurring && i > 0 ? '<div style="border-top: 1px solid #f0f0f0; margin: 12px 0;"></div>' : ''}
          ${isRecurring ? `<p style="font-weight:600; color:#667eea; margin:0 0 6px 0;">Lesson ${i + 1}</p>` : ''}
          <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${r.date}</p>
          <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${r.time}</p>
          ${r.zoom ? `<p style="margin: 5px 0;"><strong>💻 Zoom:</strong> <a href="${escapeHtml(r.zoom)}" style="color:#0066cc; word-break:break-all;">${escapeHtml(r.zoom)}</a></p>` : ''}
        `
          )
          .join('')}
        <p style="margin: 12px 0 0 0;"><strong>📚 Type:</strong> ${escapeHtml(lessonTypeName)}</p>
        <p style="margin: 5px 0 0 0;"><strong>📍 Location:</strong> ${escapeHtml(locationLabel)}</p>
      </div>
      ${
        skippedNote
          ? `<p style="background:#fffbeb; border-left:4px solid #f59e0b; padding:10px; border-radius:4px; font-size:14px; color:#b45309; margin:0 0 20px 0;">${skippedNote}</p>`
          : ''
      }
      <div style="background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%); border-radius: 10px; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 17px; color: #6d28d9; font-weight: 600;">${encouragement}</p>
      </div>
    </div>
  </body>
</html>`;

  const text = `Hi ${firstName},

${studentName} just booked ${lessonNoun}!

${rows
    .map((r, i) => `${isRecurring ? `Lesson ${i + 1}: ` : ''}${r.date} at ${r.time}${r.zoom ? ` (Zoom: ${r.zoom})` : ''}`)
    .join('\n')}

Type: ${lessonTypeName}
Location: ${locationLabel}
${skippedNote ? `\n${skippedNote}\n` : ''}
${encouragement}`.trim();

  return { subject, html, text };
}

/**
 * Sends the celebratory teacher notification. Self-guards: a failure here is
 * logged and swallowed so it can never break the caller's booking flow.
 */
export async function sendTeacherBookingNotification(
  input: TeacherBookingNotificationInput
): Promise<void> {
  try {
    const encouragement = input.encouragement ?? pickEncouragement();
    const { subject, html, text } = buildTeacherBookingEmail({ ...input, encouragement });
    await resend.emails.send({
      from: EMAIL_CONFIG.fromEmail,
      to: input.teacherEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Error sending teacher booking notification:', err);
  }
}
