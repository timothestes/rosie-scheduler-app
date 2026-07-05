# Teacher Lesson Reschedule — Design

**Date:** 2026-07-05
**Status:** Approved (ready for implementation plan)

## Summary

Let the teacher (admin) change the date/time of any active lesson through a
dedicated, focused **Reschedule** flow. Rescheduling moves a single lesson to a
new time, keeps the existing Zoom link, updates the teacher's Google Calendar,
and — when opted in — emails the student the new time. The north star is that
the flow is **as stress-free as possible for a solo teacher**: a clear
current-time → new-time surface, a live "is this slot free?" preview, conflicts
that warn but never trap her, and one conscious confirm.

Two independent design reviews reached the same conclusions on all three open
UX questions (dedicated surface, warn-don't-block, single-occurrence v1); this
spec records that consensus.

## Goals

- A dedicated **Reschedule** action on each active admin lesson card that opens
  a focused modal (current time, new date/time picker, live conflict preview,
  notify-student toggle).
- Persist the new `start_time`/`end_time`; recompute `end_time` from the
  lesson's existing type duration (type/duration are not changed here).
- Keep the existing **Zoom link** by updating the meeting in place.
- Keep the teacher's **Google Calendar** in sync.
- Optionally email the student that their lesson moved (toggle, default ON).
- Conflicts (overlap or commute buffer) **warn but allow a conscious override**.
- Never let a Zoom / Calendar / email side-effect failure fail the reschedule.

## Non-Goals

- **No series-wide reschedule.** Moving a recurring occurrence affects only that
  one lesson. "This and all future" is deferred to a possible fast-follow.
- **No changing lesson type, duration, or location** in this flow — those stay
  in the existing Edit modal. Reschedule only moves *when*.
- No student-initiated reschedule (admin/teacher only).
- No new schema, no new env vars.

## Context (current state)

- **Edit surface:** `components/EditLessonModal.tsx`, opened from the admin
  "Edit" button on `components/LessonCard.tsx`. Edits location + notes only; it
  currently renders the lesson date/time as **read-only** context
  (`EditLessonModal.tsx:76-79`). It triggers **no** external side effects.
- **Booking surface:** `components/AdminScheduleLessonModal.tsx` — picks date
  (date input) + time (30-min `<select>`, 6:00 AM–9:30 PM), and has a
  "send confirmation email" toggle we mirror here.
- **API:** `app/api/lessons/[id]/route.ts` — `PATCH` handler; admin-allowed
  fields currently exclude `start_time`/`end_time`. `DELETE` and the cancel /
  cancel-series logic also live here.
- **Conflict engine:** `lib/conflicts.ts` (`checkOccurrenceConflicts`) +
  `lib/conflicts-core.ts` (`evaluateConflict`). Detects overlaps with other
  non-cancelled lessons and enforces a commute buffer for in-person lessons.
  The window select does **not** currently fetch `id`
  (`lib/conflicts.ts:28-33`).
- **Conflict preview:** `POST /api/lessons/preflight` (`app/api/lessons/preflight/route.ts`)
  drives the live check; today it hardcodes `bookingStudentId: user.id` and
  performs no self-exclusion. `components/RecurringConflictBreakdown.tsx` holds
  the conflict-reason copy to reuse.
- **Zoom:** `lib/zoom.ts` already exports
  `updateZoomMeeting(adminId, meetingId, { start_time, duration })`.
- **Google Calendar:** `lib/google-calendar.ts` has `createGoogleCalendarEvent`
  and `deleteGoogleCalendarEvent` but **no update** helper.
- **Recurring:** lessons carry `recurring_series_id` / `recurring_frequency`.
  The monthly-paid rollup in the PATCH handler groups by the lesson's
  `start_time` month (`app/api/lessons/[id]/route.ts:104-122`).
- **Reminders:** the reminders cron reads `start_time`, so it picks up a new
  time automatically — no change needed.
- **Trust model:** teachers already bypass the 24-hour-advance rule enforced on
  students (`app/api/lessons/route.ts:121-128`).
- Stack: Next.js 16 (App Router), TypeScript, Supabase JS client, Resend,
  Vitest.

## UX Flow

The **Reschedule** button appears on the admin `LessonCard` next to Edit/Cancel,
gated exactly like the existing Cancel button — **hidden for past and cancelled
lessons** (`LessonCard.tsx:287-289`). Clicking it opens a focused modal:

```
Reschedule Lesson
───────────────────────────────
 Currently:  Sun Jul 12 · 10:00 AM

 New date   [ Jul 14, 2026    ▾ ]
 New time   [ 2:00 PM         ▾ ]      ← same 30-min slots (6:00 AM–9:30 PM) as booking

 ✓ Slot is free                        ← live preflight result; updates as she picks

 [✓] Email student the new date/time
───────────────────────────────
        [ Cancel ]  [ Confirm Reschedule ]
```

- The date picker defaults to today-forward (`min = today`) for sanity.
- The modal reassures her that the **Zoom link stays the same** (for zoom
  lessons with a meeting), since the meeting is updated in place.
- When the selected slot conflicts, the "✓ Slot is free" line flips to a warning
  (reusing `RecurringConflictBreakdown` copy — e.g. "Already booked: {type} with
  {student}" / "Too close to an in-person lesson — 30-min travel buffer"), and
  the confirm button label becomes **"Reschedule anyway."** One conscious click,
  never a dead end.

## Architecture

### Conflict engine change (self-exclusion)

`checkOccurrenceConflicts` must be able to ignore the lesson being moved (a
lesson always overlaps itself).

- `lib/conflicts.ts`: add `id` to the `.select(...)` and accept an optional
  `excludeLessonId` in `opts`; filter that row out before evaluation (or pass it
  into `evaluateConflict`).
- `lib/conflicts-core.ts`: thread `excludeLessonId` through so an existing
  lesson whose `id === excludeLessonId` is skipped. Behavior is **unchanged**
  when `excludeLessonId` is undefined (booking + preflight callers unaffected).
- Sibling occurrences of the same recurring series are genuine other lessons and
  still surface as conflicts.

### Preflight change (reschedule-aware preview)

`POST /api/lessons/preflight` gains two optional, admin-gated params so the live
preview matches the server's write-time re-check:

- `exclude_lesson_id` — passed to `checkOccurrenceConflicts` as `excludeLessonId`.
- `student_id` — the lesson's student (so the conflict check uses the right
  student for same-student-overlap logic). Only honored for admins; students
  keep using `user.id`.

Duration and `location_type` for the check come from the lesson (fetched by
`exclude_lesson_id`) rather than a passed `lesson_type`.

### New Google Calendar helper

`lib/google-calendar.ts`: add `updateGoogleCalendarEvent(adminUserId, eventId,
{ summary?, description?, startTime, endTime, location? })`. Because the Google
API PATCH for events is not currently wired, the first implementation may
**delete + recreate** the event and return the new event id; the route stores
that new `google_calendar_event_id`. Keep the delete+recreate detail inside this
helper so the route stays clean.

### New route: `PATCH /api/lessons/[id]/reschedule`

A dedicated sub-route isolates the side-effect orchestration (consistent with
existing `/api/students/[id]/notes`, `/send-reminder` sub-routes). Admin-only.

Request body: `{ start_time: string (ISO), notify_student: boolean }`.

Steps:

1. **Auth:** require an authenticated admin (same admin lookup pattern as the
   existing PATCH). Non-admins → 403.
2. **Load lesson** by id; 404 if missing. Capture the *old* start time for the
   email.
3. **Recompute** `end_time` = `new start` + duration from the lesson's
   `lesson_type` (`getLessonDuration`).
4. **Conflict re-check** via `checkOccurrenceConflicts([newStart], { duration,
   locationType: lesson.location_type, bookingStudentId: lesson.student_id,
   excludeLessonId: lesson.id })`. This does **not** block the write — the client
   already presented a conscious "Reschedule anyway" confirm — but the result is
   logged. (The reschedule is authoritative; the preview is advisory, mirroring
   how booking treats preflight.)
5. **Persist** `start_time` / `end_time` (+ `updated_at`).
6. **Zoom** (if `zoom_meeting_id` and `admin_id`): `updateZoomMeeting(admin_id,
   zoom_meeting_id, { start_time: newStart, duration })`. Link is preserved.
7. **Google Calendar** (if `google_calendar_event_id` and `admin_id`):
   `updateGoogleCalendarEvent(...)`; persist any new event id returned.
8. **Notify** (if `notify_student`): send the "lesson moved" email (below).
9. Steps 6–8 are best-effort inside their own try/catch — a failure is logged
   and swallowed; the reschedule response still succeeds (consistent with the
   booking flow's treatment of Zoom/Calendar/email).
10. Return the updated lesson (`select('*, student:users!..(*)')`) so the client
    can update its list in place.

`start_time` is **not** added to the generic PATCH allow-list — rescheduling
goes exclusively through this sub-route so the side effects can't be bypassed by
a plain field update.

### New reschedule email

Add a focused module `lib/reschedule-notification.ts`, mirroring the existing
`lib/teacher-notification.ts` structure — a pure `buildRescheduleEmail(input):
{ subject, html, text }` plus a thin `sendRescheduleNotification(input)` sender
that uses the existing `resend` client and `EMAIL_CONFIG`. Content: friendly "your lesson has been moved," the
**old** time → **new** time, lesson type, location, and the Zoom link if
present. HTML styled to match the existing gradient emails, with a plain-text
fallback. Wrapped in try/catch; never fails the reschedule.

### Client: `components/RescheduleLessonModal.tsx`

New modal component (built on `components/Modal.tsx`, styled like
`EditLessonModal`):

- Props: `{ isOpen, onClose, lesson, onSuccess(updatedLesson) }`.
- Shows the current date/time read-only.
- New-date `<input type="date" min={today}>` + new-time `<select>` reusing the
  30-min slot vocabulary from `AdminScheduleLessonModal`.
- Debounced call to `/api/lessons/preflight` with `exclude_lesson_id` +
  `student_id` as the teacher edits; renders availability / conflict inline.
- "Email student the new date/time" checkbox, default checked.
- Confirm button posts to `PATCH /api/lessons/[id]/reschedule`; label reads
  "Reschedule anyway" when a conflict is present. On success calls `onSuccess`
  and closes.

Wire it into the two places that already render admin lesson cards / Edit:
`app/admin/calendar/page.tsx` and `app/admin/students/page.tsx` — add
`lessonToReschedule` state, a `Reschedule` handler on `LessonCard`, and update
the lesson in local state on success (same pattern as the existing Edit/Cancel
handlers).

`LessonCard.tsx`: add an optional `onReschedule?(lessonId)` prop and render the
button under the same `!isCancelled && !isPast` gating used for Cancel.

## Conflict Handling (policy)

- Overlap with another non-cancelled lesson, or a commute-buffer violation for
  in-person lessons, is surfaced as a **warning**, not a block.
- The teacher confirms consciously via the "Reschedule anyway" button.
- The server does not reject on conflict (it re-checks only to log). Rationale:
  the teacher owns the calendar and is the source of truth; the commute buffer
  is a heuristic that legitimately doesn't always apply; and this matches the
  app already trusting teachers to bypass the 24-hour rule.

## Recurring Scope (policy)

- v1 reschedules **only the selected occurrence**.
- The moved lesson **keeps its `recurring_series_id`** and simply becomes an
  exception at a custom time; sibling occurrences are untouched.
- "This and all future" is explicitly out of scope for v1 (bulk re-timing means
  N conflict checks + N Zoom updates + N calendar recreates, with many
  partial-failure states — higher risk than the dominant "move one lesson" need).

## Accepted Edge Cases

- **Month-boundary billing:** moving an occurrence across a month boundary
  shifts which month it groups into for the monthly-paid rollup. Left **as-is**
  for v1 (rare; arguably correct since the lesson now genuinely occurs in the new
  month). Documented, not fixed.
- **Past times:** the picker defaults to today-forward, but the server does not
  hard-block a past time (teacher trust; e.g. logging a lesson that already
  shifted). The conflict-warn + confirm is the guardrail.
- **Non-zoom / no-calendar lessons:** steps 6–7 are skipped when the relevant id
  is absent; the DB move + optional email still happen.

## Error Handling

- Auth failures → 401/403; missing lesson → 404; malformed body → 400.
- Zoom, Google Calendar, and email side effects each run in their own try/catch,
  are logged via `console.error`, and never fail the reschedule response —
  consistent with the booking flow.

## Testing (Vitest)

- **Conflict core:** `evaluateConflict` / `checkOccurrenceConflicts` with
  `excludeLessonId` ignores the excluded row but still flags a genuine overlap
  from a different lesson (including a sibling in the same series). Behavior is
  unchanged when `excludeLessonId` is omitted.
- **Reschedule email builder:** `buildRescheduleEmail(...)` includes old→new
  time, type, location, and the Zoom link when present; subject/body render for
  both zoom and in-person.
- **Route-level (where practical):** rescheduling recomputes `end_time` from the
  lesson duration; a conflicting new time still succeeds (warn-not-block); Zoom /
  Calendar / email failures do not fail the response.

## Rollout / Config

- No new env vars (reuses Zoom, Google, and Resend config already in place).
- No database migrations.
