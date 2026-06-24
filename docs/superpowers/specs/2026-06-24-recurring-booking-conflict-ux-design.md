# Recurring-Booking Conflict Transparency — Design

**Date:** 2026-06-24
**Status:** Approved direction, pending spec review
**Area:** Student booking flow

## Problem

When a student books a recurring lesson plan (e.g. "4 weekly lessons over 1 month"), the booking API
([`app/api/lessons/route.ts:190-230`](../../../app/api/lessons/route.ts)) loops over every generated
occurrence and rejects the **entire** booking with a `409` the moment **any single** occurrence
conflicts. The message (`Time slot conflict on 7/3/2026`) is then shown through a raw
`window.alert()` ([`app/(student)/schedule/page.tsx:227`](../../../app/(student)/schedule/page.tsx)).

Two stacked problems:

1. **Ugly surface** — a native browser alert that clashes with the polished dark UI and offers no path forward.
2. **Confusing, all-or-nothing logic** — one conflicting week out of four kills the whole booking, and
   the student never sees *which* dates were open, *which* conflicted, or *what to do next*.

## Goals (v1)

- Replace the native alert in the booking flow with in-modal, in-context UI.
- Show a **per-occurrence availability breakdown** for recurring plans **before** the student commits.
- Let the student **book only the open weeks** or **pick a different time** — never a dead end.
- Keep pricing honest when fewer than the full month is booked.
- Keep the server as the single source of truth; the preview must never be able to double-book.

## Non-goals (explicitly deferred)

- Per-occurrence rescheduling (choosing a different time for one conflicting week).
- Auto-suggesting the nearest open alternate slot.
- Waitlists / "notify me if this week frees up".
- Multi-month itemized billing breakdown (a single adjusted total is sufficient).
- Any change to the admin booking modals (`AdminScheduleLessonModal.tsx`).

## Locked decisions (from brainstorming)

1. **Show conflicts upfront** with a per-occurrence ✓/✗ breakdown; let the student choose.
2. **Live**, inside the modal, as the student configures the plan — not gated behind the Book click.
3. **Coarse recovery** in v1: "Book the N available weeks" + "Pick a different time".
4. **Pro-rate pricing**, keeping the plan discount; skipped weeks are not charged.
5. **First-week conflict is not special** — booking weeks 2–4 is valid; the series ID is a UUID, not
   tied to a physical first lesson.
6. **Conflict rows are amber** (a routable warning), red is reserved for the all-conflict blocking case.
7. **Calm happy path** — when all weeks are open, collapse to a single confirmation line.

## Architecture

### Conflict detection: one shared server helper, one read-only endpoint

The booking modal **always** calls a new read-only preflight endpoint when the recurring plan is
configured or changed (debounced ~250ms). We deliberately do **not** re-implement conflict detection
on the client. Reasons: it removes any chance of client/server drift, avoids duplicating the
overlap + commute-buffer logic, and costs only one debounced fetch per config change (recurring
config changes are infrequent — toggle on, pick frequency, pick months).

**New helper** `checkOccurrenceConflicts()` — extracted from the existing POST loop
([`route.ts:190-230`](../../../app/api/lessons/route.ts)) into a shared server function. Given a list
of candidate dates + duration + location type + the booking student's id, it returns per-date status.
**Both** the preflight endpoint and the real POST call this helper, guaranteeing the preview matches
what booking will actually do. The exact-overlap and 30-minute in-person commute-buffer semantics
(buffer applies only vs. *other* students' in-person lessons) are preserved exactly.

**New endpoint** `POST /api/lessons/preflight`:

Request:
```jsonc
{
  "lesson_type": "voice_thirty",
  "location_type": "zoom" | "in-person",
  "start_time": "2026-06-26T16:00:00.000Z",
  "is_recurring": true,
  "recurring_frequency": "weekly" | "biweekly",
  "recurring_months": 1
}
```

Response (`200`):
```jsonc
{
  "occurrences": [
    {
      "date": "2026-06-26T16:00:00.000Z",
      "index": 0,                         // 1-based "Week N" shown in UI = index + 1
      "status": "available" | "conflict",
      "reason": null | "overlap" | "commute_buffer",
      "conflictIsOwnLesson": false        // true when it clashes with the student's own lesson
    }
    // ...one per generated occurrence
  ],
  "availableCount": 3,
  "totalCount": 4
}
```

The endpoint generates the occurrence dates with the **same** generator the POST uses (see "Shared
date generation"), so the `date` strings it returns are canonical and can be echoed back on submit.

### Shared date generation

The three generators (`generateWeeklyRecurringDates`, `generateBiweeklyRecurringDates`,
`generateMonthlyRecurringDates`) move from `route.ts` into a shared module (e.g.
`lib/recurring-dates.ts`) imported by the POST handler and the preflight endpoint. This keeps date
generation defined once. (Timezone note: generators use local-time `setHours`; this is the existing
behavior and is unchanged. Because the preflight and POST run on the same server, their generated
dates agree; the client only displays dates returned by the server, so there is no client/server
date-gen drift.)

### Booking: partial-success POST contract

`POST /api/lessons` is changed so a recurring booking is no longer all-or-nothing:

- Request gains an optional field **`skip_dates: string[]`** — ISO strings (from the preflight
  response) the student chose not to book.
- The handler generates the full series, removes `skip_dates`, then re-runs
  `checkOccurrenceConflicts()` on the remaining dates at write time (closing the race window between
  preflight and submit).
- It **books every still-available date** and returns a partial-success payload instead of failing
  the batch:
  ```jsonc
  {
    "lessons": [ /* created */ ],
    "count": 3,
    "skipped": [ { "date": "2026-07-03T16:00:00.000Z", "reason": "overlap" } ]
  }
  ```
  `skipped` combines user-chosen skips and any dates that became conflicted between preflight and
  submit.
- If **zero** dates are bookable (everything filled up), return `409` with the same
  `occurrences`-shaped payload so the modal can re-render a fresh breakdown rather than alert.

Single (non-recurring) booking behavior is unchanged except that its conflict response uses the same
structured shape (so the modal renders an inline error instead of an alert).

### Client: the breakdown lives in the modal

`BookingForm` owns the breakdown. State machine for the recurring section:

- `idle` — recurring off: no breakdown.
- `checking` — debounced preflight in flight: skeleton rows + "Checking your schedule…".
- `all_clear` — every occurrence available: single green confirmation line.
- `partial` — some conflicts: full per-row list + amber summary + pro-rated price + updated Book label.
- `all_conflict` — none available: red panel, Book disabled, "Pick a different time" primary.
- `check_error` — preflight failed: soft amber notice "Couldn't check all weeks — we'll confirm when
  you book"; booking still allowed (POST is authoritative).

`BookingForm.onSubmit` passes the chosen `skip_dates` (the conflicting occurrences) up to
`handleBookingSubmit`, which forwards them to the POST. The success toast becomes informational when
`skipped` is non-empty: e.g. "Booked 3 of 4 lessons — 1 week was unavailable." "Pick a different time"
simply closes the modal back to the time-slot picker (existing `onCancel` path, resets `selectedTime`).

## UX & copy

**Placement.** The breakdown renders inside the existing green "Recurring Lessons" card in
`BookingForm`, below the frequency/months controls and above the `{totalLessons} lessons total` line —
only when the recurring toggle is on.

**Layout.** A vertical list, one row per occurrence: `[icon] Lesson N · Weekday, Mon D · h:mm AM —
[status]`. ("Lesson N", not "Week N", because biweekly occurrences are not consecutive weeks.) For
long plans (max 12 rows for 3-month weekly), the list is `max-h-64 overflow-y-auto`.

**Color semantics** (reuse existing tokens already in the file):
- Available row: neutral text `text-gray-700 dark:text-gray-300`, green check `text-green-600 dark:text-green-400`.
- Conflict row: amber — `bg-amber-50 dark:bg-amber-900/20`, `text-amber-800 dark:text-amber-200`,
  amber ✗ `text-amber-600 dark:text-amber-400` (matches the existing in-person travel-fee notice).
- All-conflict panel escalates to the red inline-error styling (`bg-red-50 dark:bg-red-900/20`, red ring).
- Loading: existing `animate-pulse` skeleton rows.

**Microcopy:**

("lessons" is used in copy rather than "weeks" so it reads correctly for both weekly and biweekly plans.)

| State | Header | Detail |
|---|---|---|
| all_clear | `All 4 lessons are available ✓` | (no list, or a collapsed "view dates" affordance) |
| partial | `3 of 4 lessons are available` | `Book the open dates now, or pick a different time.` |
| all_conflict | `This time isn't open for a recurring plan` | `Every date already has a conflict. Try a different day or time.` |
| checking | `Checking your schedule…` | skeleton rows |
| check_error | `Couldn't check all dates right now` | `We'll confirm availability when you book.` |

Per-row right-hand label:
- available → `Available`
- conflict, generic/other student (`reason: overlap`, not own) → `Already booked`
- conflict, own lesson (`conflictIsOwnLesson`) → `You already have a lesson then`
- conflict, commute buffer (`reason: commute_buffer`) → `Too close to an in-person lesson (30-min travel buffer)`

Primary button label (the existing submit button):
- all_clear → `Book 4 Lessons` (current behavior)
- partial → `Book 3 Available Lessons`
- all_conflict → disabled, `No open dates — pick another time`

Secondary action (shown in partial & all_conflict): `Pick a different time`.

Success toast (partial): `Booked 3 of 4 lessons — 1 date was unavailable.`

## Pricing

When `bookedCount < fullMonthCount`, the summary switches from the flat "Monthly Rate" to a pro-rated
total computed at the **plan per-lesson rate** (helpers already exist:
[`getWeeklyPerLessonRate`](../../../config/lessonTypes.ts) = `weeklyMonthlyRate / 4`,
`getBiweeklyPerLessonRate` = `biweeklyMonthlyRate / 2`), times `bookedCount`, with the existing
`applyDiscount` applied. Skipped weeks are not charged; the student keeps the plan discount (we do
**not** drop them to the higher individual rate).

- Full plan (no conflicts): unchanged — "Monthly Rate $145/mo" + savings badge.
- Partial (e.g. 3 of 4 weekly): label becomes **"This month"**, total `$109`, sub-line:
  `3 of 4 lessons — billed at your weekly plan rate. Skipped weeks aren't charged. Future months bill at the full $145/mo rate.`
- Multi-month plan with a conflict in one month: show one adjusted total at the per-lesson plan rate ×
  total booked count (no per-month itemization in v1).

Email consistency (should-do, not blocking): the confirmation email's payment section currently always
prints the full "Monthly Rate". Update it to reflect the actual booked count / pro-rated note when a
partial series is booked.

## Edge cases

| Case | Handling |
|---|---|
| All occurrences conflict | Red panel; Book disabled with "No open weeks — pick another time"; offer "Pick a different time". Never submit an empty series. |
| First (anchor) week conflicts | Treated like any other row; booking weeks 2–4 is allowed. No special-casing. |
| Conflict is the student's own lesson | Distinct copy "You already have a lesson then" via `conflictIsOwnLesson`. Still ✗/skipped (can't double-book). |
| In-person commute buffer | Distinct copy "Too close to an in-person lesson (30-min travel buffer)" via `reason: commute_buffer`. |
| Preflight fails / times out | Fail open: soft amber notice, booking still allowed; POST re-validates. |
| Slot fills between preflight and submit | POST books the rest, returns `skipped`; toast says "Booked N of M…". Never a blanket 409 unless zero bookable. |
| Trial lesson selected | Recurring is already force-disabled for trials; no breakdown shown. |
| Cancellation-policy alert (`BookingForm.tsx:79`) | Dead code — submit is already disabled until the box is checked (pulsing-ring pattern handles it). Remove the `alert()` line as a small consistency cleanup. |

## Files to change

- `app/api/lessons/route.ts` — extract `checkOccurrenceConflicts()`; change POST conflict handling to
  partial-success with `skip_dates` + `skipped` response; structured conflict payloads.
- `lib/recurring-dates.ts` *(new)* — shared date generators.
- `app/api/lessons/preflight/route.ts` *(new)* — read-only preflight endpoint.
- `components/BookingForm.tsx` — breakdown panel + state machine + pro-rated pricing + Book label;
  remove dead policy `alert()`; pass `skip_dates` to `onSubmit`.
- `components/RecurringConflictBreakdown.tsx` *(new, optional)* — extract the breakdown list/rows to
  keep `BookingForm` focused.
- `app/(student)/schedule/page.tsx` — replace the failure `alert()`s with inline error / informational
  toast; thread `skip_dates` through `handleBookingSubmit`; handle the `{ lessons, count, skipped }`
  partial-success response.
- `BookingData` interface — add optional `skip_dates?: string[]`.

## Testing

- **Unit (shared helpers):** date generators (weekly/biweekly/monthly counts & spacing);
  `checkOccurrenceConflicts` for exact overlap, commute buffer vs other-student in-person only,
  own-lesson exclusion.
- **API:** preflight returns correct per-occurrence statuses; POST with `skip_dates` books the subset;
  POST returns `skipped` when a slot conflicts at write time; POST returns 409-with-occurrences when
  zero bookable; single-booking conflict returns structured payload.
- **Component:** BookingForm renders each state (all_clear / partial / all_conflict / checking /
  check_error); Book label and pro-rated price update with availableCount; "Pick a different time"
  resets correctly.
- **Manual:** reproduce the original screenshot scenario (one conflicting week) and confirm the new
  breakdown + partial booking + honest price, in light and dark mode.

## Open / future (v2)

Per-occurrence rescheduling, nearest-open-slot suggestions, waitlist, multi-month itemized billing,
admin-modal parity.
