# Schedule a lesson from the admin calendar

## Intent

Rosie lives on the admin Calendar. Today, booking a lesson for a student means
leaving it: Students → find the student → open details → "Schedule Lesson".
She should be able to book any student from the calendar, on the day she is
looking at, in as few clicks as possible.

## Goals

- Book any existing student from the Calendar page without navigating away.
- The date she's looking at is pre-filled.
- Picking a student fills in sensible defaults so most bookings are
  "pick student → confirm".
- She can see what else is on that day while choosing a time.

## Non-goals

- A day/week time-grid view with click-an-empty-slot booking (option B; much
  larger, deferred).
- Creating a brand-new student from the calendar (still done on Students).
- Changing server booking rules. Admin bookings keep bypassing availability,
  day-blocks and Google busy time, and keep failing on lesson overlap.

## Approaches considered

- **A. Extend the month view + existing modal (chosen).** "+ Schedule lesson"
  in the day panel (date pre-filled) and a "New Lesson" header button; the
  existing `AdminScheduleLessonModal` gains a student search and smart defaults.
  Small, reuses a form that already works, improves the Students-page flow too.
- **B. Day/week time-grid.** Most direct, but a new calendar view and several
  times the work. Deferred.

## Design

- `AdminScheduleLessonModal`: `student` becomes optional; new `initialDate`.
  With no student passed, the first field is a type-to-search student picker
  (name or email, keyboard navigable). The Students page keeps passing a fixed
  student and behaves as before (plus the defaults below).
- **Defaults on student pick** (from that student's lesson history):
  lesson type, Zoom vs in-person, and address come from their most recent
  non-cancelled lesson. A trial ("First Lesson") type maps to the regular type
  of the same length. With no history: a student marked as new
  (`is_returning_student === false`) gets the 30-min first lesson, mirroring
  the student booking page; otherwise the existing 30-min default.
- **Suggested time:** the first start (15-min steps) inside her availability
  for that date that doesn't overlap another lesson (incl. the in-person
  commute buffer) or imported Google busy time, and isn't in the past. It
  re-suggests when the date, student, length or location changes, until she
  picks a time herself. Falls back to 10:00 when nothing is open.
- **Day summary + soft warnings** under the date/time: her hours that day and
  the lessons already booked. Warnings for: blocked day (with reason), outside
  her hours, Google busy time (all still bookable), and
  overlap with another lesson or the in-person commute buffer (the server
  rejects both, even for admin bookings).
- Calendar page: buttons as above; past days fall back to today; success
  refetches the calendar and selects the booked day.

## Left to the builder

Pure logic (defaults, suggestion, warnings) lives in `lib/admin-scheduling.ts`
with unit tests; the modal composes it.
