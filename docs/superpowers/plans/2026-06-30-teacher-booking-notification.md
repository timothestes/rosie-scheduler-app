# Teacher Booking Notification Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student books a lesson, email the teacher a celebratory notification with the booking details and a randomly-picked cute encouragement.

**Architecture:** A new self-contained module (`lib/teacher-notification.ts`) owns the encouragement list, a random picker, a pure email-body builder, and a thin Resend sender. `app/api/lessons/route.ts` calls the sender once per booking, right after the existing student-confirmation email, inside its own guard that never fails the booking.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase JS client, Resend, Vitest (Node env).

## Global Constraints

- No new dependencies, no database migrations, no new env vars. Reuse `resend` + `EMAIL_CONFIG` from `lib/resend.ts`.
- Vitest test glob is `lib/**/*.test.ts` (Node environment) — the module and its tests must live under `lib/`.
- All lesson dates/times render in Pacific Time (`timeZone: 'America/Los_Angeles'`), matching the existing student email.
- Exactly one teacher email per booking action (a recurring booking that creates N lessons still sends one email).
- The notification fires only when the booking was made by a student, not an admin (`!callerAdmin`).
- A notification failure must never break or delay the booking response.

---

## File Structure

- **Create** `lib/teacher-notification.ts` — encouragement list, `pickEncouragement()`, `buildTeacherBookingEmail()` (pure), `sendTeacherBookingNotification()` (sends via Resend). One responsibility: producing and sending the teacher's celebratory email.
- **Create** `lib/teacher-notification.test.ts` — unit tests for the picker and the pure builder.
- **Modify** `app/api/lessons/route.ts` — import the sender and add one guarded notification block after the student-email block (after line 526).

---

## Task 1: Teacher notification module

**Files:**
- Create: `lib/teacher-notification.ts`
- Test: `lib/teacher-notification.test.ts`

**Interfaces:**
- Consumes: `resend`, `EMAIL_CONFIG` from `@/lib/resend` (already exist).
- Produces (relied on by Task 2):
  - `sendTeacherBookingNotification(input: TeacherBookingNotificationInput): Promise<void>`
  - `TeacherBookingNotificationInput = { teacherEmail: string; teacherName?: string; studentName: string; lessons: Array<{ start_time: string; zoom_join_url?: string | null }>; lessonTypeName: string; locationLabel: string; skippedCount: number; encouragement?: string }`
  - Also exported: `ENCOURAGEMENTS: string[]`, `pickEncouragement(): string`, `buildTeacherBookingEmail(input): { subject: string; html: string; text: string }`.

- [ ] **Step 1: Write the failing tests**

Create `lib/teacher-notification.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ENCOURAGEMENTS,
  pickEncouragement,
  buildTeacherBookingEmail,
} from './teacher-notification';

// 2026-07-06 22:00:00 UTC === Monday, July 6, 2026, 3:00 PM PDT (UTC-7)
const JULY_6_3PM = '2026-07-06T22:00:00.000Z';
// 2026-07-13 22:00:00 UTC === Monday, July 13, 2026, 3:00 PM PDT
const JULY_13_3PM = '2026-07-13T22:00:00.000Z';

function baseInput() {
  return {
    teacherName: 'Rosie Smith',
    studentName: 'Sarah Johnson',
    lessons: [{ start_time: JULY_6_3PM, zoom_join_url: null }],
    lessonTypeName: 'Piano (30 min)',
    locationLabel: 'Zoom',
    skippedCount: 0,
    encouragement: 'You make music feel like magic',
  };
}

describe('pickEncouragement', () => {
  it('returns a non-empty string that is a member of ENCOURAGEMENTS', () => {
    expect(ENCOURAGEMENTS.length).toBeGreaterThan(0);
    const pick = pickEncouragement();
    expect(typeof pick).toBe('string');
    expect(pick.length).toBeGreaterThan(0);
    expect(ENCOURAGEMENTS).toContain(pick);
  });
});

describe('buildTeacherBookingEmail', () => {
  it('single booking: singular subject, greets teacher by first name, includes student, date/time, type, encouragement', () => {
    const { subject, html, text } = buildTeacherBookingEmail(baseInput());
    expect(subject).toBe('🎉 Sarah Johnson just booked a lesson!');
    expect(html).toContain('Hi Rosie,');
    expect(html).toContain('Sarah Johnson');
    expect(html).toContain('July 6, 2026');
    expect(html).toContain('3:00 PM');
    expect(html).toContain('Piano (30 min)');
    expect(html).toContain('You make music feel like magic');
    expect(text).toContain('Sarah Johnson');
    expect(text).toContain('July 6, 2026');
    expect(text).toContain('You make music feel like magic');
  });

  it('recurring booking: plural subject with count and reflects multiple lessons', () => {
    const input = {
      ...baseInput(),
      lessons: [
        { start_time: JULY_6_3PM, zoom_join_url: null },
        { start_time: JULY_13_3PM, zoom_join_url: null },
      ],
    };
    const { subject, html } = buildTeacherBookingEmail(input);
    expect(subject).toBe('🎉 Sarah Johnson booked 2 lessons!');
    expect(html).toContain('July 6, 2026');
    expect(html).toContain('July 13, 2026');
  });

  it('includes an honest note when dates were skipped', () => {
    const { html, text } = buildTeacherBookingEmail({ ...baseInput(), skippedCount: 2 });
    expect(html).toContain('unavailable');
    expect(text).toContain('unavailable');
  });

  it('renders a Zoom link when present', () => {
    const { html } = buildTeacherBookingEmail({
      ...baseInput(),
      lessons: [{ start_time: JULY_6_3PM, zoom_join_url: 'https://zoom.us/j/123' }],
    });
    expect(html).toContain('https://zoom.us/j/123');
  });

  it('falls back to "Rosie" when no teacher name is provided', () => {
    const input = { ...baseInput() };
    delete (input as { teacherName?: string }).teacherName;
    const { html } = buildTeacherBookingEmail(input);
    expect(html).toContain('Hi Rosie,');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/teacher-notification.test.ts`
Expected: FAIL — cannot resolve `./teacher-notification` (module does not exist yet).

- [ ] **Step 3: Write the module**

Create `lib/teacher-notification.ts`:

```ts
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
      <p style="font-size: 16px; margin: 0 0 16px 0;">Hi ${firstName},</p>
      <p style="font-size: 16px; margin: 0 0 20px 0;">
        <strong>${studentName}</strong> just booked ${lessonNoun}! 🎶
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
          ${r.zoom ? `<p style="margin: 5px 0;"><strong>💻 Zoom:</strong> <a href="${r.zoom}" style="color:#0066cc; word-break:break-all;">${r.zoom}</a></p>` : ''}
        `
          )
          .join('')}
        <p style="margin: 12px 0 0 0;"><strong>📚 Type:</strong> ${lessonTypeName}</p>
        <p style="margin: 5px 0 0 0;"><strong>📍 Location:</strong> ${locationLabel}</p>
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
```

Note: `sendTeacherBookingNotification` is a thin wire from builder → Resend and is intentionally not unit-tested (it would only assert a mock was called). The logic-bearing parts (`pickEncouragement`, `buildTeacherBookingEmail`) are fully covered above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/teacher-notification.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/teacher-notification.ts lib/teacher-notification.test.ts
git commit -m "feat: teacher booking notification module (encouragements + email builder)"
```

---

## Task 2: Wire the notification into the booking route

**Files:**
- Modify: `app/api/lessons/route.ts` (add import near line 8; add notification block after line 526)

**Interfaces:**
- Consumes: `sendTeacherBookingNotification` from Task 1.
- In-scope variables available at the insertion point (outer function scope of `POST`): `supabase`, `callerAdmin` (object or `null`), `adminId` (string or `null`), `createdLessons`, `skipped`, `studentName` (full name, line 238), `lessonTypeInfo`, `lesson_type`, `location_type`, `location_address`.
- Note: `lessonDetails` and `isRecurringBooking` are **not** in scope here (they are declared inside the student-email `try` block), so the teacher block passes raw `createdLessons` to the module, which formats them.

- [ ] **Step 1: Add the import**

In `app/api/lessons/route.ts`, add after the existing `import { resend, EMAIL_CONFIG } from '@/lib/resend';` line (line 7):

```ts
import { sendTeacherBookingNotification } from '@/lib/teacher-notification';
```

- [ ] **Step 2: Add the notification block**

In `app/api/lessons/route.ts`, immediately after the student-email `try/catch` closes (after line 526, `// Don't fail the booking if email fails` / closing `}`) and before the `// Return first lesson for single booking, or all for recurring` comment (line 528), insert:

```ts
  // Notify the teacher when a STUDENT books (not when an admin books on their behalf).
  // One email per booking action; never blocks or fails the booking.
  if (!callerAdmin && createdLessons.length > 0 && adminId) {
    try {
      const { data: teacher } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', adminId)
        .single();

      if (teacher?.email) {
        await sendTeacherBookingNotification({
          teacherEmail: teacher.email,
          teacherName: teacher.full_name ?? undefined,
          studentName,
          lessons: createdLessons.map((l) => ({
            start_time: l.start_time,
            zoom_join_url: l.zoom_join_url,
          })),
          lessonTypeName: lessonTypeInfo?.name || lesson_type,
          locationLabel: location_type === 'zoom' ? 'Zoom' : (location_address || 'In-Person'),
          skippedCount: skipped.length,
        });
      }
    } catch (teacherEmailError) {
      console.error('Error sending teacher booking notification:', teacherEmailError);
      // Don't fail the booking if the teacher notification fails
    }
  }
```

- [ ] **Step 3: Typecheck the change**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. (If `l` is implicitly `any` in the `.map`, the fields still resolve; add an explicit type only if `tsc` complains.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — existing `lib/conflicts-core.test.ts`, `lib/recurring-dates.test.ts`, and the new `lib/teacher-notification.test.ts` all green.

- [ ] **Step 5: Manual verification (route has no automated test harness)**

The repo only unit-tests `lib/`, so verify the wiring manually:
1. Run the app (`npm run dev`).
2. As a **student** (not admin), book a single lesson.
3. Confirm the teacher's inbox (the primary admin email) receives one `🎉 … just booked a lesson!` email with correct date/time (Pacific), type, location, and a cute encouragement line.
4. Book a **recurring** lesson that has at least one unavailable date; confirm exactly one email arrives with the plural subject, the correct lesson count, and the "unavailable" note.
5. As the **admin/teacher**, book a lesson on a student's behalf; confirm **no** teacher notification is sent (only the student confirmation).

- [ ] **Step 6: Commit**

```bash
git add app/api/lessons/route.ts
git commit -m "feat: notify teacher with celebratory email when a student books"
```

---

## Self-Review

**Spec coverage:**
- Notify teacher on student booking → Task 2 block (`!callerAdmin` guard). ✓
- Celebratory + cute + greets by name → `buildTeacherBookingEmail` subject/greeting + encouragement. ✓
- Random cute encouragement, curated list → `ENCOURAGEMENTS` + `pickEncouragement`. ✓
- One email per booking action → single `sendTeacherBookingNotification` call over all `createdLessons`. ✓
- Only when a student books → `!callerAdmin` guard. ✓
- Recipient = primary admin, greeted by name with "Rosie" fallback → re-fetch by `adminId`; `teacherName` fallback in builder. ✓
- Honest skipped-dates note → `skippedCount` handling. ✓
- Never breaks booking → module self-guard + route `try/catch`. ✓
- No new deps / schema / env vars → module reuses `resend`/`EMAIL_CONFIG`. ✓
- Vitest tests for picker + builder (single/recurring/partial/fallback) → Task 1 tests. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" placeholders; all code and commands are concrete. The encouragement lines are concrete, intentionally editable starter content (not placeholders in the plan-failure sense). ✓

**Type consistency:** `sendTeacherBookingNotification` / `buildTeacherBookingEmail` / `pickEncouragement` / `ENCOURAGEMENTS` and the `TeacherBookingNotificationInput` field names (`teacherEmail`, `teacherName`, `studentName`, `lessons[].start_time`, `lessons[].zoom_join_url`, `lessonTypeName`, `locationLabel`, `skippedCount`, `encouragement`) are used identically in Task 1's definition and Task 2's call site. ✓
