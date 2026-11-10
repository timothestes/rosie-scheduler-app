// Granularity of the start times offered in the scheduling UI. The server
// validates bookings in exact minutes, so these only shape what the pickers show.

// Step between start times students can pick on the booking page.
export const STUDENT_SLOT_STEP_MINUTES = 15;

// Step for the teacher's pickers: scheduling/rescheduling a lesson and the
// start/end of her availability hours.
export const ADMIN_SLOT_STEP_MINUTES = 15;

// Shortest lesson offered. A start time is only shown if at least this much
// time remains before the availability window closes.
export const MIN_LESSON_MINUTES = 30;
