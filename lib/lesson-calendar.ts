export interface CalendarSummaryInput {
  lessonTypeName: string;
  studentName: string;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
}

export interface CalendarLocationInput {
  locationType: 'zoom' | 'in-person';
  locationAddress?: string | null;
  zoomJoinUrl?: string | null;
}

export interface CalendarDescriptionInput extends CalendarLocationInput {
  lessonTypeName: string;
  studentName: string;
  notes?: string | null;
  isRecurring?: boolean;
  recurringPosition?: string | null;
}

export interface LessonSyncState {
  location_type: 'zoom' | 'in-person';
  location_address: string | null;
  notes: string | null;
  zoom_meeting_id: string | null;
  google_calendar_event_id: string | null;
  start_time: string;
  status: string;
}

export interface LessonEditPatch {
  location_type?: 'zoom' | 'in-person';
  location_address?: string | null;
  notes?: string | null;
  status?: string;
}

export interface LessonSyncPlan {
  zoom: 'none' | 'create' | 'delete';
  calendar: boolean;
}

// The event title: "Weekly: 45-Minute Lesson with Ada Byron".
export function buildCalendarSummary(input: CalendarSummaryInput): string {
  const { lessonTypeName, studentName, isRecurring, recurringFrequency } = input;
  const base = `${lessonTypeName} with ${studentName}`;
  if (!isRecurring) return base;

  const label =
    recurringFrequency === 'weekly' ? 'Weekly'
    : recurringFrequency === 'biweekly' ? 'Bi-Weekly'
    : 'Monthly';
  return `${label}: ${base}`;
}

// The event location: the Zoom link for virtual lessons, the street address
// otherwise. Always derived from the *current* location_type, so a stale Zoom
// link never survives a switch to in-person (and vice versa).
export function buildCalendarLocation(input: CalendarLocationInput): string {
  const { locationType, locationAddress, zoomJoinUrl } = input;
  return locationType === 'zoom'
    ? (zoomJoinUrl || 'Zoom')
    : (locationAddress || 'In-Person');
}

export function buildCalendarDescription(input: CalendarDescriptionInput): string {
  const {
    lessonTypeName, studentName, locationType, locationAddress,
    notes, zoomJoinUrl, isRecurring, recurringPosition,
  } = input;

  const lines = [`Lesson Type: ${lessonTypeName}`, `Student: ${studentName}`];
  if (locationType === 'in-person' && locationAddress) lines.push(`Address: ${locationAddress}`);
  if (notes) lines.push(`Notes: ${notes}`);
  if (locationType === 'zoom' && zoomJoinUrl) lines.push(`Zoom: ${zoomJoinUrl}`);
  if (isRecurring && recurringPosition) lines.push(`Recurring: ${recurringPosition}`);

  return lines.join('\n');
}

// Rebuild the "Recurring: 3 of 12" line from the series' start times, so an
// edit can rewrite the description without losing the position booking wrote.
export function formatRecurringPosition(
  seriesStartTimes: string[],
  lessonStartTime: string
): string | null {
  const ordered = [...seriesStartTimes].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const target = new Date(lessonStartTime).getTime();
  const index = ordered.findIndex((t) => new Date(t).getTime() === target);

  return index === -1 ? null : `${index + 1} of ${ordered.length}`;
}

// Decide which integrations a lesson edit has to touch. Cancellations are
// excluded: the cancel path tears both integrations down instead. Past lessons
// are left alone — there is nothing useful to book or rewrite after the fact.
export function planLessonEditSync(
  before: LessonSyncState,
  patch: LessonEditPatch,
  now: Date = new Date()
): LessonSyncPlan {
  const NO_SYNC: LessonSyncPlan = { zoom: 'none', calendar: false };

  if (before.status === 'cancelled' || patch.status === 'cancelled') return NO_SYNC;
  if (new Date(before.start_time).getTime() <= now.getTime()) return NO_SYNC;

  const nextLocationType = patch.location_type ?? before.location_type;
  const locationTypeChanged = nextLocationType !== before.location_type;

  const addressChanged =
    patch.location_address !== undefined &&
    (patch.location_address || null) !== (before.location_address || null);

  const notesChanged =
    patch.notes !== undefined && (patch.notes || null) !== (before.notes || null);

  if (!locationTypeChanged && !addressChanged && !notesChanged) return NO_SYNC;

  let zoom: LessonSyncPlan['zoom'] = 'none';
  if (locationTypeChanged) {
    if (nextLocationType === 'zoom' && !before.zoom_meeting_id) zoom = 'create';
    if (nextLocationType === 'in-person' && before.zoom_meeting_id) zoom = 'delete';
  }

  return { zoom, calendar: !!before.google_calendar_event_id };
}
