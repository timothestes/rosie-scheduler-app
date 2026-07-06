# Reschedule: Lessons-Page Access + Length/Type Flexibility — Design

**Date:** 2026-07-05
**Status:** Approved (ready for implementation plan)

## Summary

Two enhancements to the existing teacher-reschedule feature:

- **Part A — Lessons-page access:** surface the existing Reschedule action on the
  lesson cards of the shared Lessons page (`app/lessons/page.tsx`), so the teacher
  can move a lesson from there too. Pure UI wiring; no API changes.
- **Part B — Length/type flexibility:** let the teacher change a lesson's
  **type** (and therefore its duration and price) during a reschedule — e.g. turn
  a 30-minute voice lesson into a 1-hour one. Because duration is tied to lesson
  type in this app, "make it an hour" means switching `voice_thirty` → `voice_sixty`.
  This rides inside the existing Reschedule modal, whose conflict re-check /
  Zoom / Calendar / email machinery is exactly what a duration change needs.

Both build on the shipped reschedule feature (see
`2026-07-05-teacher-lesson-reschedule-design.md`).

## Goals

- Reschedule button available on the Lessons page cards (admin/teacher only),
  in both the timeline and grid views.
- A **Lesson type** picker in the Reschedule modal offering all lesson types
  (full flexibility, including trial ↔ regular), defaulting to the lesson's
  current type, showing each option's price.
- Changing the type recomputes duration and drives the conflict preview, the
  persisted `end_time`, the Zoom meeting length, the Calendar event end, and the
  notification email.
- Price is derived from the type and updates automatically; `is_paid` is left
  untouched (teacher settles any difference directly). The modal shows the new
  price so a change is never silent.

## Non-Goals

- No free-form/custom duration or per-lesson custom pricing — duration and rate
  remain defined by `config/lessonTypes.ts` lesson types.
- No billing reconciliation when the price changes (no auto-unpaid, no proration,
  no monthly-rollup adjustment). Accepted for v1; documented below.
- No series-wide type/length change — single occurrence only, consistent with
  reschedule v1.
- No Edit-modal changes; type/length changes live only in the Reschedule flow.
- No new lesson types, no schema changes, no new env vars.

## Context (current state)

- **Reschedule feature (shipped):** `components/RescheduleLessonModal.tsx`
  (date/time picker + live conflict preview + notify toggle), the
  `PATCH /api/lessons/[id]/reschedule` route (best-effort Zoom/Calendar/email),
  the admin-gated `exclude_lesson_id`/`student_id` preflight, and the
  `onReschedule` prop on `components/LessonCard.tsx` (gated
  `isAdmin && !!onReschedule && !isCancelled && !isPast`).
- **Lessons page:** `app/lessons/page.tsx` — shared "All Lessons / My Lessons"
  view. `isAdmin` is fetched from `/api/profile`. It renders `LessonCard` twice
  (timeline, `page.tsx:489`; grid, `page.tsx:514`), wiring `onCancel` and
  `onTogglePaid` but **not** `onReschedule`. It manages its own `lessons` state.
- **Lesson types:** `config/lessonTypes.ts`. Duration and rate are properties of
  the type (`voice_thirty` 30m/$40, `voice_sixty` 60m/$80, `first_lesson_*` are
  trial/half-price and `isTrialLesson: true`). `getLessonDuration(id)`,
  `getLessonType(id)`, `getLessonRate(id)`, `formatRate(rate)` already exist.
  No rate/duration is stored on the `lessons` row — both are derived from
  `lesson_type` at read time.
- **Booking modal type picker:** `AdminScheduleLessonModal.tsx` already renders a
  radio list of `lessonTypes` (name + `formatRate(rate)`), the pattern to reuse.
- **Reschedule route duration:** currently derives `duration =
  getLessonDuration(lesson.lesson_type)` from the existing type; Part B makes this
  use the new type when one is supplied.
- **Preflight:** already accepts `lesson_type` and derives duration from it, so
  passing the newly-selected type makes the preview reflect the new length.

## Part A — Lessons-page wiring

Mirror the calendar-page wiring exactly:

- Import `RescheduleLessonModal`; add `lessonToReschedule` state and an
  `openRescheduleModal(lessonId)` opener that looks up the lesson in `lessons`.
- Pass `onReschedule={isAdmin ? openRescheduleModal : undefined}` to the
  `LessonCard` in **both** the timeline render (`app/lessons/page.tsx:489`) and
  the grid render (`page.tsx:514`). Non-admins pass `undefined`; `LessonCard`
  additionally self-gates on `isAdmin && !isCancelled && !isPast`, so students
  never see the button.
- Render `RescheduleLessonModal` once; `onSuccess(updated)` does
  `setLessons(prev => prev.map(l => l.id === updated.id ? updated : l))` and
  clears `lessonToReschedule`.

No API changes for Part A.

## Part B — Length/type flexibility

### Modal (`components/RescheduleLessonModal.tsx`)

- Add a **Lesson type** section: a radio list of all `lessonTypes`, each showing
  `type.name` + `formatRate(type.rate)`, styled like
  `AdminScheduleLessonModal`'s list. Initialize `lessonType` state to
  `lesson.lesson_type`.
- The debounced preflight call sends the **selected** `lesson_type` (not the
  original), so the conflict preview reflects the new duration. Keep
  `exclude_lesson_id` + `student_id` as today.
- Track `unchanged` as `date === initialDate && time === initialTime &&
  lessonType === lesson.lesson_type` — so changing only the type still enables
  submit (and still runs the conflict preview when the time is unchanged but the
  duration grew).
- Show the selected type's price (e.g. `formatRate(getLessonRate(lessonType))`),
  and, when it differs from the original type's price, a small note that the
  price will change and paid status is left as-is.
- On submit, include `lesson_type` in the PATCH body (always send it; the route
  no-ops when it equals the current type).

### Route (`app/api/lessons/[id]/reschedule/route.ts`)

- Accept optional `lesson_type` in the body alongside `start_time` /
  `notify_student`.
- If `lesson_type` is present: validate it via `getLessonType(lesson_type)`;
  unknown id → `400`. Use the **new** type for `duration =
  getLessonDuration(lesson_type)`; otherwise use the existing lesson's type.
- Recompute `end_time = newStart + duration`. Include `lesson_type` in the DB
  update payload when it changed.
- Use the resolved `duration` for: the conflict re-check (advisory/log-only, as
  today), `updateZoomMeeting({ start_time, duration })`, and
  `updateGoogleCalendarEvent({ startTime, endTime })`.
- The notification email's `lessonTypeName` uses the **new** type's name.
- `is_paid` / rate: untouched. Rate is derived from `lesson_type`, so it updates
  wherever it's displayed. No billing reconciliation.

### Preflight

No change required — it already accepts `lesson_type` and derives duration from
it. The modal simply passes the newly-selected type.

## Data Flow (Part B)

1. Teacher opens Reschedule on a lesson; picks a new time and/or a new lesson type.
2. Modal debounces a preflight call with the selected `lesson_type` +
   `exclude_lesson_id` + `student_id`; renders "slot free" / conflict warning
   using the new duration.
3. On confirm, `PATCH …/reschedule` with `{ start_time, lesson_type,
   notify_student }`. Route validates the type, recomputes duration/end_time,
   persists `start_time`/`end_time`/`lesson_type`, updates Zoom + Calendar with
   the new length, and (if opted in) emails the student the new time + type.
4. Modal's `onSuccess(updated)` replaces the lesson in the page's local state; the
   card now shows the new type, length, and derived price.

## Conflict Handling

Unchanged policy: conflicts **warn**, never block. A longer new duration widens
the lesson's window and may introduce an overlap the shorter one didn't — this
surfaces in the same preview and the same "Reschedule anyway" confirm. The
server re-check uses the new duration and remains log-only.

## Accepted Edge Cases

- **Already-paid price change:** if a paid lesson's type changes to a different
  price, `is_paid` stays true and the amount isn't reconciled. The modal shows
  the new price so it's a conscious change; the teacher settles the difference
  out-of-band (consistent with the app's Venmo/Zelle model).
- **Recurring occurrence:** changing one occurrence's type detaches only that
  lesson's type/length/price; `recurring_series_id` is preserved and siblings are
  untouched. The monthly-paid rollup (which groups by month) is not adjusted for
  the changed occurrence — same class of accepted edge as the existing
  month-boundary note.
- **Trial ↔ regular:** the picker allows switching a regular lesson to a trial
  type (half-price) or vice versa on a single occurrence. Allowed for maximum
  flexibility; `isTrialLesson` only constrains recurring *creation*, which this
  flow doesn't touch.
- **Type-only change (same time):** the email still reads "your lesson has been
  moved" and shows identical was/now times with the new type/length. Acceptable
  for v1.

## Error Handling

- Unknown `lesson_type` → `400`. Auth/admin failures → 401/403; missing lesson →
  404 (as today).
- Zoom / Calendar / email remain best-effort in their own try/catch, logged and
  swallowed; a side-effect failure never fails the reschedule.

## Testing

- **Route/lib:** no new pure unit surface beyond what exists; verification is
  `npm run build` (types) + `npm test` (existing suites stay green). If a small
  pure helper is extracted for duration/type resolution, unit-test it; otherwise
  rely on build + manual.
- **Manual:** (1) Lessons page shows Reschedule for admin on timeline + grid, not
  for students; (2) changing a 30-min lesson to 1-hour updates the conflict
  preview, persists the new end_time, lengthens the Zoom meeting and Calendar
  event, and the email shows the new type/time; (3) changing only the type (same
  time) still submits; (4) unknown type id is rejected; (5) recurring siblings
  unchanged.

## Rollout / Config

- No new env vars, no DB migrations. Reuses existing lesson types, Zoom/Google/
  Resend config, and the shipped reschedule route + preflight.
