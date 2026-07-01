# Teacher Booking Notification Email — Design

**Date:** 2026-06-30
**Status:** Approved (ready for implementation plan)

## Summary

When a student schedules a lesson, send the teacher (the primary admin) a
celebratory notification email. Each email includes the booking details plus a
randomly selected, cute encouragement. This rides alongside the existing
student booking-confirmation email and reuses the same Resend infrastructure.

## Goals

- Notify the teacher whenever a student books a lesson (single or recurring).
- Make the email feel celebratory and warm — greet her by name, cute tone.
- Include a random cute encouragement, varied per email.
- Add no new dependencies, no schema changes, and no new env vars.
- Never let a notification failure break or delay a booking.

## Non-Goals

- No AI-generated encouragements (curated list only for now). The picker is
  isolated behind a function so an AI source could be swapped in later without
  touching the route.
- No teacher-facing settings/UI to toggle or edit encouragements in this pass
  (copy is edited directly in the source array).
- No notifications for admin-initiated bookings (see Trigger Conditions).

## Context (current state)

- Booking creation: `POST /api/lessons` — `app/api/lessons/route.ts`.
  - Lessons are created into `createdLessons`; unavailable/user-skipped dates
    collect into `skipped`.
  - The student confirmation email is built as inline HTML/text and sent via
    Resend inside a `try/catch` that intentionally does **not** fail the
    booking (`app/api/lessons/route.ts:342-526`).
  - `lessonDetails` (formatted date/time/type/location, Pacific Time) and
    `isRecurringBooking` are already computed for that email and can be reused.
  - `callerAdmin` indicates whether the request was made by an admin.
  - The teacher/admin is resolved via `getPrimaryAdminEmail()` and a `users`
    lookup by email (`app/api/lessons/route.ts:136-165`).
- Email config: `lib/resend.ts` exports the `resend` client and `EMAIL_CONFIG`
  (`fromEmail`, `appUrl`).
- Stack: Next.js 16 (App Router), TypeScript, Supabase JS client, Resend +
  React Email, Vitest for tests.

## Architecture

Extract the notification into its own module rather than adding a second large
inline block to `route.ts` (which is already long). This keeps the route
focused and makes the logic unit-testable.

### New file: `lib/teacher-notification.tsx`

Exports:

- `ENCOURAGEMENTS: string[]` — a curated array of short, cute one-liners.
  Ships with a small, tasteful starter set that is trivial to edit or extend.
  Final copy to be curated by the user.
- `pickEncouragement(): string` — returns a random entry from `ENCOURAGEMENTS`
  using `Math.random()`. Isolated so the source can later change (e.g. AI)
  without changing callers.
- `buildTeacherBookingEmail(input): { subject, html, text }` — pure function
  that builds the email body from its inputs (no I/O), so it can be tested
  directly.
- `sendTeacherBookingNotification(input): Promise<void>` — calls
  `buildTeacherBookingEmail`, then sends via the existing `resend` client and
  `EMAIL_CONFIG.fromEmail`. Wraps its own errors and logs them; callers do not
  depend on the result.

Input shape (`TeacherBookingEmailInput`):

```ts
{
  teacherName?: string;        // greeting; falls back to "Rosie" if absent
  teacherEmail: string;        // recipient
  studentName: string;         // who booked
  lessonDetails: Array<{       // reused from the route
    date: string; time: string; type: string; location: string;
    zoomUrl?: string | null;
  }>;
  isRecurringBooking: boolean;
  skippedCount: number;        // honest note when > 0
}
```

### Change: `app/api/lessons/route.ts`

1. Extend the existing admin lookup so it also selects `full_name` (in addition
   to `id`) for the resolved teacher, so we can greet her by name. Fall back to
   `"Rosie"` when no name is available.
2. After the student confirmation email block (~line 526), add a new
   `try/catch` that calls `sendTeacherBookingNotification(...)`, passing the
   already-computed `lessonDetails`, `isRecurringBooking`, `studentInfo.full_name`,
   `skipped.length`, and the teacher's name/email. The `catch` logs and swallows
   the error — a failed notification never affects the booking response.

## Trigger Conditions

The notification is sent only when **all** of the following hold:

- Lessons were successfully created (`createdLessons.length > 0`).
- The booking was made by a student, not an admin (`!callerAdmin`). When the
  teacher books on her own behalf as admin, she is not notified of her own
  action.
- A teacher email was resolved.

Exactly **one** email is sent per booking action, regardless of how many
lessons a recurring booking created.

## Email Content

- **Subject** (celebratory):
  - Single: `🎉 {StudentName} just booked a lesson!`
  - Recurring: `🎉 {StudentName} booked {N} lessons!`
- **Body**:
  - Greets the teacher by name.
  - States who booked and the lesson details (date / time / type / location),
    reusing `lessonDetails`. For recurring bookings, shows the count.
  - When `skippedCount > 0`, includes an honest note that some requested dates
    were unavailable and were not scheduled (mirrors the existing student-email
    honesty pattern).
  - Ends with a highlighted, randomly selected cute encouragement.
  - HTML styled to match the existing gradient aesthetic, with a plain-text
    fallback.

## Error Handling

- The send is wrapped in its own `try/catch` in the route; failures are logged
  via `console.error` and swallowed. The booking always succeeds/returns
  independent of email outcome — consistent with the existing student email.

## Testing (Vitest)

- `pickEncouragement()` always returns a non-empty string that is a member of
  `ENCOURAGEMENTS`.
- `buildTeacherBookingEmail(...)`:
  - Single booking: subject uses the singular form; body contains the student
    name, the one lesson's details, and an encouragement line.
  - Recurring booking: subject uses the plural form with the correct count;
    body reflects multiple lessons.
  - Partial (`skippedCount > 0`): body includes the "some dates unavailable"
    note.
  - Missing `teacherName`: greeting falls back to "Rosie".

## Rollout / Config

- No new env vars. Reuses `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the
  primary-admin resolution already in place.
- No database migrations.
