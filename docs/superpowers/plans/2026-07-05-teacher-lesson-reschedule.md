# Teacher Lesson Reschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher (admin) move any active lesson to a new date/time through a dedicated, stress-free Reschedule flow that keeps the Zoom link, Google Calendar, and (optionally) the student in sync.

**Architecture:** A new `PATCH /api/lessons/[id]/reschedule` sub-route orchestrates the side effects (DB move, Zoom update, Calendar update, optional student email). A new `RescheduleLessonModal` gives the teacher a focused surface with a live conflict preview driven by the existing `preflight` endpoint. The conflict engine gains a backward-compatible `excludeLessonId` so a lesson never conflicts with itself. Conflicts warn but never block; v1 moves a single occurrence only.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase JS client, Resend, Zoom + Google Calendar REST APIs, Vitest.

## Global Constraints

- Admin/teacher-only feature; non-admins must get 403 from the reschedule route.
- Reschedule goes **exclusively** through `PATCH /api/lessons/[id]/reschedule`; do **not** add `start_time`/`end_time` to the generic `PATCH /api/lessons/[id]` allow-list.
- Side effects (Zoom, Google Calendar, email) are best-effort: each in its own try/catch, logged via `console.error`, never failing the reschedule response.
- Conflicts **warn**, never block (server re-checks only to log).
- v1 reschedules the **single selected occurrence** only; keep `recurring_series_id` intact; never touch sibling lessons.
- Lesson type, duration, and location are **not** changed by this flow — only `start_time`/`end_time` (end recomputed from the existing lesson's type duration).
- No new env vars, no DB migrations.
- Timezone for display/email: `America/Los_Angeles` (match existing emails).
- Tests: `npm test` runs Vitest over `lib/**/*.test.ts` (node env). UI/route tasks verify with `npm run build`.

---

### Task 1: Conflict engine — self-exclusion (`excludeLessonId`)

**Files:**
- Modify: `lib/conflicts-core.ts`
- Modify: `lib/conflicts.ts`
- Test: `lib/conflicts-core.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ExistingLesson` gains `id: string`.
  - `evaluateConflict(occStart, occEnd, locationType, bookingStudentId, existing, bufferMs, excludeLessonId?)` — new optional 7th param.
  - `checkOccurrenceConflicts(occurrences, { duration, locationType, bookingStudentId, excludeLessonId? })` — new optional field.

- [ ] **Step 1: Update the test factory to include `id`, then write failing tests**

In `lib/conflicts-core.test.ts`, update the `lesson()` helper to include a default id, and add a new `describe` block. Change the factory:

```ts
function lesson(partial: Partial<ExistingLesson>): ExistingLesson {
  return {
    id: 'other-lesson',
    start_time: '2026-07-03T16:00:00.000Z',
    end_time: '2026-07-03T16:30:00.000Z',
    location_type: 'zoom',
    student_id: 'someone-else',
    status: 'scheduled',
    ...partial,
  };
}
```

Append these tests (after the existing `evaluateConflict` block):

```ts
describe('evaluateConflict with excludeLessonId', () => {
  it('ignores the excluded lesson (a lesson never conflicts with itself)', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME });
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [self], BUF, 'lesson-1');
    expect(r.status).toBe('available');
  });

  it('still flags a different overlapping lesson while excluding self', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME });
    const other = lesson({ id: 'lesson-2', student_id: 'someone-else' });
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [self, other], BUF, 'lesson-1');
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('overlap');
  });

  it('excludes self from the commute-buffer check too', () => {
    const self = lesson({ id: 'lesson-1', student_id: ME, location_type: 'in-person' });
    const r = evaluateConflict(occStart, occEnd, 'in-person', ME, [self], BUF, 'lesson-1');
    expect(r.status).toBe('available');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- conflicts-core`
Expected: FAIL — the three new tests fail because `evaluateConflict` ignores the 7th argument (self still flagged as `conflict`).

- [ ] **Step 3: Add `id` to `ExistingLesson` and thread `excludeLessonId` through `evaluateConflict`**

In `lib/conflicts-core.ts`, add `id` to the interface:

```ts
export interface ExistingLesson {
  id: string;
  start_time: string;
  end_time: string;
  location_type: string;
  student_id: string;
  status: string;
}
```

Change the `evaluateConflict` signature and both loops to skip the excluded row:

```ts
export function evaluateConflict(
  occStart: Date,
  occEnd: Date,
  locationType: string,
  bookingStudentId: string,
  existing: ExistingLesson[],
  bufferMs: number,
  excludeLessonId?: string
): ConflictResult {
  const occStartMs = occStart.getTime();
  const occEndMs = occEnd.getTime();

  // 1. Exact overlap with ANY non-cancelled lesson (including the student's own).
  for (const lesson of existing) {
    if (lesson.status === 'cancelled') continue;
    if (excludeLessonId && lesson.id === excludeLessonId) continue;
    const ls = new Date(lesson.start_time).getTime();
    const le = new Date(lesson.end_time).getTime();
    if (ls < occEndMs && le > occStartMs) {
      return {
        status: 'conflict',
        reason: 'overlap',
        conflictIsOwnLesson: lesson.student_id === bookingStudentId,
      };
    }
  }

  // 2. Commute buffer vs OTHER students' in-person lessons (only if the new lesson is in-person).
  if (locationType === 'in-person') {
    const bufStart = occStartMs - bufferMs;
    const bufEnd = occEndMs + bufferMs;
    for (const lesson of existing) {
      if (lesson.status === 'cancelled') continue;
      if (excludeLessonId && lesson.id === excludeLessonId) continue;
      if (lesson.location_type !== 'in-person') continue;
      if (lesson.student_id === bookingStudentId) continue;
      const ls = new Date(lesson.start_time).getTime();
      const le = new Date(lesson.end_time).getTime();
      if (ls < bufEnd && le > bufStart) {
        return { status: 'conflict', reason: 'commute_buffer', conflictIsOwnLesson: false };
      }
    }
  }

  return { status: 'available', reason: null, conflictIsOwnLesson: false };
}
```

- [ ] **Step 4: Thread `excludeLessonId` through `checkOccurrenceConflicts` and select `id`**

In `lib/conflicts.ts`, update the opts type, the DB select, and the `evaluateConflict` call:

```ts
export async function checkOccurrenceConflicts(
  occurrences: Date[],
  opts: { duration: number; locationType: string; bookingStudentId: string; excludeLessonId?: string }
): Promise<OccurrenceStatus[]> {
  if (occurrences.length === 0) return [];

  const { duration, locationType, bookingStudentId, excludeLessonId } = opts;
```

Change the select to include `id`:

```ts
  const { data, error } = await admin
    .from('lessons')
    .select('id, start_time, end_time, location_type, student_id, status')
    .neq('status', 'cancelled')
    .lte('start_time', windowEnd.toISOString())
    .gte('end_time', windowStart.toISOString());
```

Change the mapping call to pass the exclusion:

```ts
  return occurrences.map((start, index) => {
    const end = new Date(start.getTime() + durationMs);
    const result = evaluateConflict(start, end, locationType, bookingStudentId, existing, bufferMs, excludeLessonId);
    return { date: start.toISOString(), index, ...result };
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- conflicts-core`
Expected: PASS — all existing and the three new tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/conflicts-core.ts lib/conflicts.ts lib/conflicts-core.test.ts
git commit -m "feat: add excludeLessonId to conflict engine for reschedule self-exclusion"
```

---

### Task 2: Reschedule notification email module

**Files:**
- Create: `lib/reschedule-notification.ts`
- Test: `lib/reschedule-notification.test.ts`

**Interfaces:**
- Consumes: `resend`, `EMAIL_CONFIG` from `@/lib/resend`.
- Produces:
  - `buildRescheduleEmail(input: BuildRescheduleEmailInput): { subject: string; html: string; text: string }`
  - `sendRescheduleNotification(input: RescheduleNotificationInput): Promise<void>`
  - `BuildRescheduleEmailInput = { studentName: string; oldStart: string; newStart: string; lessonTypeName: string; locationLabel: string; zoomUrl?: string | null }`
  - `RescheduleNotificationInput = BuildRescheduleEmailInput & { studentEmail: string }`

- [ ] **Step 1: Write the failing tests**

Create `lib/reschedule-notification.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRescheduleEmail } from './reschedule-notification';

const base = {
  studentName: 'Alex',
  oldStart: '2026-07-12T17:00:00.000Z', // 10:00 AM PT
  newStart: '2026-07-14T21:00:00.000Z', // 2:00 PM PT
  lessonTypeName: 'Voice 30',
  locationLabel: 'Zoom',
};

describe('buildRescheduleEmail', () => {
  it('includes the student name in the subject', () => {
    const { subject } = buildRescheduleEmail(base);
    expect(subject).toContain('moved');
  });

  it('shows both the old and new Pacific times in the body', () => {
    const { html, text } = buildRescheduleEmail(base);
    // old: July 12, 10:00 AM ; new: July 14, 2:00 PM (America/Los_Angeles)
    expect(text).toContain('July 12');
    expect(text).toContain('10:00');
    expect(text).toContain('July 14');
    expect(text).toContain('2:00');
    expect(html).toContain('July 14');
  });

  it('includes the zoom link when present', () => {
    const { html, text } = buildRescheduleEmail({ ...base, zoomUrl: 'https://zoom.us/j/123' });
    expect(text).toContain('https://zoom.us/j/123');
    expect(html).toContain('https://zoom.us/j/123');
  });

  it('escapes HTML in user-controlled values', () => {
    const { html } = buildRescheduleEmail({ ...base, studentName: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- reschedule-notification`
Expected: FAIL — `Cannot find module './reschedule-notification'` / `buildRescheduleEmail is not a function`.

- [ ] **Step 3: Implement the module**

Create `lib/reschedule-notification.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- reschedule-notification`
Expected: PASS — all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/reschedule-notification.ts lib/reschedule-notification.test.ts
git commit -m "feat: add reschedule notification email builder + sender"
```

---

### Task 3: Google Calendar update helper

**Files:**
- Modify: `lib/google-calendar.ts`

**Interfaces:**
- Consumes: `getValidAccessToken`, `GOOGLE_CALENDAR_API` (already in the file).
- Produces: `updateGoogleCalendarEvent(adminUserId: string, eventId: string, updates: { summary?: string; description?: string; startTime: Date; endTime: Date; location?: string }): Promise<boolean>`

- [ ] **Step 1: Add the update helper**

This is network I/O (not unit-tested here; verified via build). Add after `deleteGoogleCalendarEvent` in `lib/google-calendar.ts`. It uses the Google Calendar `PATCH` verb, which preserves the existing event id and only changes provided fields:

```ts
// Update an existing Google Calendar event (PATCH preserves the event id).
export async function updateGoogleCalendarEvent(
  adminUserId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
  }
): Promise<boolean> {
  const accessToken = await getValidAccessToken(adminUserId);

  if (!accessToken) {
    console.error('No valid Google access token for updating calendar event');
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      start: { dateTime: updates.startTime.toISOString(), timeZone: 'America/Los_Angeles' },
      end: { dateTime: updates.endTime.toISOString(), timeZone: 'America/Los_Angeles' },
    };
    if (updates.summary !== undefined) body.summary = updates.summary;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.location !== undefined) body.location = updates.location;

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error('Failed to update calendar event:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    return false;
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build completes with no TypeScript errors in `lib/google-calendar.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/google-calendar.ts
git commit -m "feat: add updateGoogleCalendarEvent helper (PATCH preserves event id)"
```

---

### Task 4: Reschedule API route

**Files:**
- Create: `app/api/lessons/[id]/reschedule/route.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `getLessonDuration` (`@/config/lessonTypes`), `updateZoomMeeting` (`@/lib/zoom`), `updateGoogleCalendarEvent` (`@/lib/google-calendar`), `checkOccurrenceConflicts` (`@/lib/conflicts`), `sendRescheduleNotification` (`@/lib/reschedule-notification`), `getLessonType` (`@/config/lessonTypes`).
- Produces: `PATCH /api/lessons/[id]/reschedule` accepting `{ start_time: string; notify_student: boolean }`, returning the updated lesson row (joined with student).

- [ ] **Step 1: Implement the route**

Create `app/api/lessons/[id]/reschedule/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration, getLessonType } from '@/config/lessonTypes';
import { updateZoomMeeting } from '@/lib/zoom';
import { updateGoogleCalendarEvent } from '@/lib/google-calendar';
import { checkOccurrenceConflicts } from '@/lib/conflicts';
import { sendRescheduleNotification } from '@/lib/reschedule-notification';

// PATCH /api/lessons/[id]/reschedule - move a single lesson to a new time.
// Admin-only. Side effects (Zoom, Calendar, email) are best-effort.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { start_time, notify_student } = body as { start_time?: string; notify_student?: boolean };

  if (!start_time) {
    return NextResponse.json({ error: 'start_time is required' }, { status: 400 });
  }
  const newStart = new Date(start_time);
  if (isNaN(newStart.getTime())) {
    return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 });
  }

  // Load the lesson (with student for the email)
  const { data: lesson } = await supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .eq('id', id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const duration = getLessonDuration(lesson.lesson_type);
  const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
  const oldStart = lesson.start_time;

  // Re-check conflicts (advisory: log only, do not block — the client already
  // presented a conscious "Reschedule anyway" confirm). Excludes this lesson.
  try {
    const statuses = await checkOccurrenceConflicts([newStart], {
      duration,
      locationType: lesson.location_type,
      bookingStudentId: lesson.student_id,
      excludeLessonId: lesson.id,
    });
    if (statuses[0]?.status === 'conflict') {
      console.warn(`Reschedule of lesson ${id} proceeds over a ${statuses[0].reason} conflict`);
    }
  } catch (err) {
    console.error('Reschedule conflict re-check failed (continuing):', err);
  }

  // Persist the move
  const { data: updated, error } = await supabase
    .from('lessons')
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, student:users!lessons_student_id_fkey(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // --- Best-effort side effects (never fail the response) ---

  // Zoom: update the existing meeting in place (link preserved)
  if (lesson.zoom_meeting_id && lesson.admin_id) {
    try {
      await updateZoomMeeting(lesson.admin_id, lesson.zoom_meeting_id, {
        start_time: newStart,
        duration,
      });
    } catch (err) {
      console.error('Reschedule: Zoom update failed:', err);
    }
  }

  // Google Calendar: PATCH the event's start/end
  if (lesson.google_calendar_event_id && lesson.admin_id) {
    try {
      await updateGoogleCalendarEvent(lesson.admin_id, lesson.google_calendar_event_id, {
        startTime: newStart,
        endTime: newEnd,
      });
    } catch (err) {
      console.error('Reschedule: Google Calendar update failed:', err);
    }
  }

  // Notify the student (opt-in)
  if (notify_student && lesson.student?.email) {
    try {
      const lessonTypeInfo = getLessonType(lesson.lesson_type);
      await sendRescheduleNotification({
        studentEmail: lesson.student.email,
        studentName: lesson.student.full_name || lesson.student.email,
        oldStart,
        newStart: newStart.toISOString(),
        lessonTypeName: lessonTypeInfo?.name || lesson.lesson_type,
        locationLabel: lesson.location_type === 'zoom' ? 'Zoom' : (lesson.location_address || 'In-Person'),
        zoomUrl: lesson.zoom_join_url,
      });
    } catch (err) {
      console.error('Reschedule: student notification failed:', err);
    }
  }

  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Verify it type-checks / builds**

Run: `npm run build`
Expected: build completes with no TypeScript errors; the new route appears in the build output under `/api/lessons/[id]/reschedule`.

- [ ] **Step 3: Commit**

```bash
git add app/api/lessons/[id]/reschedule/route.ts
git commit -m "feat: add PATCH /api/lessons/[id]/reschedule route"
```

---

### Task 5: Reschedule-aware preflight

**Files:**
- Modify: `app/api/lessons/preflight/route.ts`

**Interfaces:**
- Consumes: `checkOccurrenceConflicts` (now with `excludeLessonId`).
- Produces: `POST /api/lessons/preflight` additionally accepts optional `exclude_lesson_id: string` and `student_id: string` (the latter honored only for admins).

- [ ] **Step 1: Add the two optional params**

In `app/api/lessons/preflight/route.ts`, destructure the new fields and resolve the effective student id + exclusion. Replace the body from the destructure through the `checkOccurrenceConflicts` call:

```ts
  const body = await request.json();
  const { lesson_type, location_type, start_time, is_recurring, recurring_frequency, recurring_months, exclude_lesson_id, student_id } = body;

  if (!lesson_type || !start_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Admins may check availability on behalf of a specific student (used by the
  // reschedule flow); everyone else is scoped to their own bookings.
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();
  const bookingStudentId = admin && student_id ? student_id : user.id;

  const duration = getLessonDuration(lesson_type);
  const startDate = new Date(start_time);

  const occurrences = is_recurring && recurring_months
    ? generateRecurringDates(startDate, recurring_frequency ?? 'monthly', recurring_months)
    : [startDate];

  try {
    const statuses = await checkOccurrenceConflicts(occurrences, {
      duration,
      locationType: location_type ?? 'zoom',
      bookingStudentId,
      excludeLessonId: admin ? exclude_lesson_id : undefined,
    });
    const availableCount = statuses.filter((s) => s.status === 'available').length;
    return NextResponse.json({ occurrences: statuses, availableCount, totalCount: statuses.length });
  } catch (err) {
    console.error('Preflight conflict check error:', err);
    return NextResponse.json({ error: 'Could not check availability' }, { status: 500 });
  }
```

Note: the existing `const { data: { user } } = await supabase.auth.getUser();` guard stays above this block unchanged.

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build completes; no TypeScript errors in the preflight route.

- [ ] **Step 3: Commit**

```bash
git add app/api/lessons/preflight/route.ts
git commit -m "feat: preflight honors exclude_lesson_id + student_id for admins"
```

---

### Task 6: RescheduleLessonModal component

**Files:**
- Create: `components/RescheduleLessonModal.tsx`

**Interfaces:**
- Consumes: `Modal` (`@/components/Modal`), `Lesson` type (`@/types`), `getLessonType` (`@/config/lessonTypes`), `PATCH /api/lessons/[id]/reschedule`, `POST /api/lessons/preflight`.
- Produces: `export default function RescheduleLessonModal({ isOpen, onClose, lesson, onSuccess }: { isOpen: boolean; onClose: () => void; lesson: Lesson; onSuccess: (updated: Lesson) => void })`

- [ ] **Step 1: Implement the modal**

Create `components/RescheduleLessonModal.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { getLessonType } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

interface RescheduleLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  onSuccess: (updated: Lesson) => void;
}

const pad = (n: number) => n.toString().padStart(2, '0');

// 30-min slots 6:00 AM–9:30 PM (mirrors AdminScheduleLessonModal).
const timeSlots = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 21 && m === 30) break;
      const value = `${pad(h)}:${pad(m)}`;
      const label = new Date(`2000-01-01T${value}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      slots.push({ value, label });
    }
  }
  return slots;
})();

type ConflictInfo = { status: 'available' | 'conflict'; reason: 'overlap' | 'commute_buffer' | null };

export default function RescheduleLessonModal({
  isOpen, onClose, lesson, onSuccess,
}: RescheduleLessonModalProps) {
  const start = new Date(lesson.start_time);
  const initialDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const initialTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [notify, setNotify] = useState(true);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when reopened / lesson changes
  useEffect(() => {
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
      setNotify(true);
      setConflict(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lesson]);

  const buildStart = () => {
    const [hh, mm] = time.split(':').map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const unchanged = date === initialDate && time === initialTime;

  // Debounced live conflict preview
  useEffect(() => {
    if (!isOpen || unchanged) { setConflict(null); return; }
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/lessons/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lesson_type: lesson.lesson_type,
            location_type: lesson.location_type,
            start_time: buildStart().toISOString(),
            exclude_lesson_id: lesson.id,
            student_id: lesson.student_id,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          const occ = data.occurrences?.[0];
          setConflict(occ ? { status: occ.status, reason: occ.reason } : null);
        }
      } catch {
        // Preview is advisory; ignore failures.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, isOpen]);

  const hasConflict = conflict?.status === 'conflict';
  const conflictMsg = conflict?.reason === 'commute_buffer'
    ? 'Too close to an in-person lesson (30-min travel buffer).'
    : 'This time overlaps another lesson.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: buildStart().toISOString(), notify_student: notify }),
      });
      if (res.ok) {
        onSuccess(await res.json());
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reschedule');
      }
    } catch {
      setError('Failed to reschedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lessonTypeName = getLessonType(lesson.lesson_type)?.name || lesson.lesson_type;
  const currentLabel = start.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const showZoomNote = lesson.location_type === 'zoom' && !!lesson.zoom_join_url;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Lesson" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          {lessonTypeName} · Currently {currentLabel}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New date</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New time</label>
            <select
              value={time}
              onChange={e => setTime(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timeSlots.map(slot => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live conflict preview */}
        {!unchanged && (
          <div className="text-sm">
            {checking ? (
              <p className="text-gray-500 dark:text-gray-400">Checking availability…</p>
            ) : hasConflict ? (
              <p className="text-amber-700 dark:text-amber-400">⚠ {conflictMsg}</p>
            ) : conflict ? (
              <p className="text-green-600 dark:text-green-400">✓ This slot is free</p>
            ) : null}
          </div>
        )}

        {showZoomNote && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The existing Zoom link stays the same.
          </p>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Email student the new date/time</span>
        </label>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || unchanged}
            className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Rescheduling…' : hasConflict ? 'Reschedule anyway' : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build completes; no TypeScript errors in `RescheduleLessonModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/RescheduleLessonModal.tsx
git commit -m "feat: add RescheduleLessonModal with live conflict preview"
```

---

### Task 7: Wire Reschedule button into LessonCard + both admin pages

**Files:**
- Modify: `components/LessonCard.tsx`
- Modify: `app/admin/calendar/page.tsx`
- Modify: `app/admin/students/page.tsx`

**Interfaces:**
- Consumes: `RescheduleLessonModal` (Task 6).
- Produces: `LessonCard` gains an optional `onReschedule?: (lessonId: string) => void` prop and renders a "Reschedule" button (admin, non-cancelled, non-past).

- [ ] **Step 1: Add the prop + button to `LessonCard`**

In `components/LessonCard.tsx`, add to the props interface and destructure:

```tsx
interface LessonCardProps {
  lesson: Lesson;
  isAdmin?: boolean;
  onCancel?: (lessonId: string) => void;
  onTogglePaid?: (lessonId: string, isPaid: boolean) => void;
  onEdit?: (lessonId: string) => void;
  onReschedule?: (lessonId: string) => void;
  showStudent?: boolean;
  discountPercent?: number;
}
```

```tsx
export default function LessonCard({
  lesson,
  isAdmin = false,
  onCancel,
  onTogglePaid,
  onEdit,
  onReschedule,
  showStudent = false,
  discountPercent = 0,
}: LessonCardProps) {
```

In the footer IIFE (around `LessonCard.tsx:286-290`), add `showReschedule` and include it in the guard:

```tsx
        const showZoom = lesson.location_type === 'zoom' && !isCancelled && !isPast && !!lesson.zoom_join_url;
        const showReschedule = isAdmin && !!onReschedule && !isCancelled && !isPast;
        const showEdit = isAdmin && !!onEdit && !isCancelled;
        const showCancel = !isCancelled && !isPast && !!onCancel;
        if (!showZoom && !showReschedule && !showEdit && !showCancel) return null;
```

Add the button just before the `showEdit` block (so order is Zoom · Reschedule · Edit · Cancel):

```tsx
            {showReschedule && (
              <button
                onClick={() => onReschedule!(lesson.id)}
                className="flex-1 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                Reschedule
              </button>
            )}
```

- [ ] **Step 2: Wire into the calendar page**

In `app/admin/calendar/page.tsx`:

Add the import near the other component imports (e.g. after the `LessonCard` import):

```tsx
import RescheduleLessonModal from '@/components/RescheduleLessonModal';
```

Add state near `lessonToCancel` (around line 35):

```tsx
  const [lessonToReschedule, setLessonToReschedule] = useState<Lesson | null>(null);
```

Add an opener next to `openCancelModal` (around line 137):

```tsx
  const openRescheduleModal = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) setLessonToReschedule(lesson);
  };
```

Pass the handler to `LessonCard` (the render around line 662-668 that has `onCancel={openCancelModal}`):

```tsx
                  onReschedule={openRescheduleModal}
```

Render the modal near the other modals (e.g. after the `LessonCard` list / alongside the cancel modal). Updating the moved lesson in local state:

```tsx
      {lessonToReschedule && (
        <RescheduleLessonModal
          isOpen={!!lessonToReschedule}
          onClose={() => setLessonToReschedule(null)}
          lesson={lessonToReschedule}
          onSuccess={(updated) => {
            setLessons((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setLessonToReschedule(null);
          }}
        />
      )}
```

- [ ] **Step 3: Wire into the students page**

In `app/admin/students/page.tsx`:

Add the import after the `EditLessonModal` import (line 10):

```tsx
import RescheduleLessonModal from '@/components/RescheduleLessonModal';
```

Add state near `lessonToEdit` (around line 59):

```tsx
  const [lessonToReschedule, setLessonToReschedule] = useState<Lesson | null>(null);
```

Add an opener (near the existing `openEditLesson`/`openCancelModal` handlers). It needs the lesson object; the students page already keeps lessons in student details state — reuse the same lookup the edit opener uses. Add:

```tsx
  const openRescheduleLesson = (lesson: Lesson) => setLessonToReschedule(lesson);
```

Pass to `LessonCard` (render around line 901-907 that has `onEdit={openEditLesson}`). Note `LessonCard.onReschedule` passes a `lessonId`, but this page's cards already have the full `lesson` in scope at the map — pass a closure that forwards the object:

```tsx
                      onReschedule={() => openRescheduleLesson(lesson)}
```

Render the modal next to `EditLessonModal` (around line 1171). Reuse the existing `handleEditLessonSuccess` (it already updates the displayed lesson after an edit):

```tsx
      {lessonToReschedule && (
        <RescheduleLessonModal
          isOpen={!!lessonToReschedule}
          onClose={() => setLessonToReschedule(null)}
          lesson={lessonToReschedule}
          onSuccess={(updated) => {
            handleEditLessonSuccess(updated);
            setLessonToReschedule(null);
          }}
        />
      )}
```

- [ ] **Step 4: Verify the whole thing builds**

Run: `npm run build`
Expected: build completes with no TypeScript errors across `LessonCard.tsx`, `app/admin/calendar/page.tsx`, and `app/admin/students/page.tsx`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing and new Vitest suites pass.

- [ ] **Step 6: Commit**

```bash
git add components/LessonCard.tsx app/admin/calendar/page.tsx app/admin/students/page.tsx
git commit -m "feat: wire Reschedule button into LessonCard, calendar, and students pages"
```

---

## Manual Verification (after all tasks)

Run `npm run dev` and, as an admin:

1. **Calendar page** — pick a day with a lesson. The card shows a **Reschedule** button. Click it.
2. Change the time to a free slot → "✓ This slot is free"; confirm → the card reflects the new time; the modal closes.
3. Reschedule onto another student's lesson time → "⚠ This time overlaps another lesson"; the button reads **"Reschedule anyway"**; confirm still works.
4. With "Email student the new date/time" checked, verify (Resend dashboard / logs) the student email is sent with old→new time; uncheck → no email.
5. **Zoom lesson** — after reschedule, the Zoom link is unchanged and the Google Calendar event moved (not duplicated).
6. **Students page** — same Reschedule button appears on that page's lesson cards and behaves identically.
7. **Recurring lesson** — rescheduling one occurrence moves only that lesson; siblings stay put.
8. **Past / cancelled lessons** — no Reschedule button.
