import { describe, it, expect } from 'vitest';
import {
  buildCalendarSummary,
  buildCalendarDescription,
  buildCalendarLocation,
  formatRecurringPosition,
  planLessonEditSync,
  type LessonSyncState,
  type LessonEditPatch,
} from './lesson-calendar';

describe('buildCalendarSummary', () => {
  it('names the lesson type and student for a one-off lesson', () => {
    expect(buildCalendarSummary({ lessonTypeName: '45-Minute Lesson', studentName: 'Ada Byron' }))
      .toBe('45-Minute Lesson with Ada Byron');
  });

  it('prefixes a weekly series with its cadence', () => {
    expect(buildCalendarSummary({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      isRecurring: true,
      recurringFrequency: 'weekly',
    })).toBe('Weekly: 45-Minute Lesson with Ada Byron');
  });

  it('spells a biweekly series as Bi-Weekly', () => {
    expect(buildCalendarSummary({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      isRecurring: true,
      recurringFrequency: 'biweekly',
    })).toBe('Bi-Weekly: 45-Minute Lesson with Ada Byron');
  });

  it('falls back to Monthly when a recurring lesson has no stored frequency', () => {
    expect(buildCalendarSummary({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      isRecurring: true,
      recurringFrequency: null,
    })).toBe('Monthly: 45-Minute Lesson with Ada Byron');
  });
});

describe('buildCalendarLocation', () => {
  it('uses the Zoom join url as the event location', () => {
    expect(buildCalendarLocation({ locationType: 'zoom', zoomJoinUrl: 'https://zoom.us/j/123' }))
      .toBe('https://zoom.us/j/123');
  });

  it('falls back to a plain Zoom label when no meeting link exists yet', () => {
    expect(buildCalendarLocation({ locationType: 'zoom', zoomJoinUrl: null })).toBe('Zoom');
  });

  it('uses the street address for an in-person lesson', () => {
    expect(buildCalendarLocation({ locationType: 'in-person', locationAddress: '12 Rue Alger' }))
      .toBe('12 Rue Alger');
  });

  it('ignores a stale Zoom link once the lesson is in-person', () => {
    expect(buildCalendarLocation({
      locationType: 'in-person',
      locationAddress: '12 Rue Alger',
      zoomJoinUrl: 'https://zoom.us/j/123',
    })).toBe('12 Rue Alger');
  });

  it('falls back to In-Person when no address is on file', () => {
    expect(buildCalendarLocation({ locationType: 'in-person', locationAddress: null })).toBe('In-Person');
  });
});

describe('buildCalendarDescription', () => {
  it('lists type and student for a bare lesson', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'in-person',
    })).toBe('Lesson Type: 45-Minute Lesson\nStudent: Ada Byron');
  });

  it('includes address, notes and recurrence position in creation order', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'in-person',
      locationAddress: '12 Rue Alger',
      notes: 'Bring the Bach',
      isRecurring: true,
      recurringPosition: '3 of 12',
    })).toBe(
      'Lesson Type: 45-Minute Lesson\nStudent: Ada Byron\nAddress: 12 Rue Alger\nNotes: Bring the Bach\nRecurring: 3 of 12'
    );
  });

  it('includes the Zoom link for a Zoom lesson', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'zoom',
      zoomJoinUrl: 'https://zoom.us/j/123',
    })).toBe('Lesson Type: 45-Minute Lesson\nStudent: Ada Byron\nZoom: https://zoom.us/j/123');
  });

  it('drops the address line once the lesson switches to Zoom', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'zoom',
      locationAddress: '12 Rue Alger',
      zoomJoinUrl: 'https://zoom.us/j/123',
    })).toBe('Lesson Type: 45-Minute Lesson\nStudent: Ada Byron\nZoom: https://zoom.us/j/123');
  });

  it('drops the Zoom line once the lesson switches to in-person', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'in-person',
      locationAddress: '12 Rue Alger',
      zoomJoinUrl: 'https://zoom.us/j/123',
    })).toBe('Lesson Type: 45-Minute Lesson\nStudent: Ada Byron\nAddress: 12 Rue Alger');
  });

  it('omits the recurrence line when the position is unknown', () => {
    expect(buildCalendarDescription({
      lessonTypeName: '45-Minute Lesson',
      studentName: 'Ada Byron',
      locationType: 'zoom',
      isRecurring: true,
      recurringPosition: null,
    })).toBe('Lesson Type: 45-Minute Lesson\nStudent: Ada Byron');
  });
});

describe('formatRecurringPosition', () => {
  const series = [
    '2026-08-21T17:00:00.000Z',
    '2026-08-07T17:00:00.000Z',
    '2026-08-14T17:00:00.000Z',
  ];

  it('numbers a lesson by its chronological place in the series', () => {
    expect(formatRecurringPosition(series, '2026-08-14T17:00:00.000Z')).toBe('2 of 3');
  });

  it('numbers the first lesson of the series', () => {
    expect(formatRecurringPosition(series, '2026-08-07T17:00:00.000Z')).toBe('1 of 3');
  });

  it('numbers the last lesson of the series', () => {
    expect(formatRecurringPosition(series, '2026-08-21T17:00:00.000Z')).toBe('3 of 3');
  });

  it('returns null when the lesson is not part of the given series', () => {
    expect(formatRecurringPosition(series, '2026-09-04T17:00:00.000Z')).toBeNull();
  });

  it('returns null for an empty series', () => {
    expect(formatRecurringPosition([], '2026-08-07T17:00:00.000Z')).toBeNull();
  });
});

describe('planLessonEditSync', () => {
  const NOW = new Date('2026-07-31T12:00:00.000Z');

  function lesson(partial: Partial<LessonSyncState> = {}): LessonSyncState {
    return {
      location_type: 'zoom',
      location_address: null,
      notes: null,
      zoom_meeting_id: 'zoom-1',
      google_calendar_event_id: 'gcal-1',
      start_time: '2026-08-14T17:00:00.000Z', // future
      status: 'scheduled',
      ...partial,
    };
  }

  function patch(partial: LessonEditPatch = {}): LessonEditPatch {
    return partial;
  }

  it('does nothing when the edit changes no synced field', () => {
    expect(planLessonEditSync(lesson(), patch({ location_type: 'zoom', location_address: null }), NOW))
      .toEqual({ zoom: 'none', calendar: false });
  });

  it('creates a Zoom meeting when an in-person lesson becomes a Zoom lesson', () => {
    const before = lesson({ location_type: 'in-person', location_address: '12 Rue Alger', zoom_meeting_id: null });
    expect(planLessonEditSync(before, patch({ location_type: 'zoom', location_address: null }), NOW))
      .toEqual({ zoom: 'create', calendar: true });
  });

  it('deletes the Zoom meeting when a Zoom lesson becomes in-person', () => {
    expect(planLessonEditSync(lesson(), patch({ location_type: 'in-person', location_address: '12 Rue Alger' }), NOW))
      .toEqual({ zoom: 'delete', calendar: true });
  });

  it('still syncs the calendar when a Zoom lesson without a meeting becomes in-person', () => {
    const before = lesson({ zoom_meeting_id: null });
    expect(planLessonEditSync(before, patch({ location_type: 'in-person' }), NOW))
      .toEqual({ zoom: 'none', calendar: true });
  });

  it('reuses an existing meeting rather than creating a second one', () => {
    const before = lesson({ location_type: 'in-person', zoom_meeting_id: 'zoom-1' });
    expect(planLessonEditSync(before, patch({ location_type: 'zoom' }), NOW))
      .toEqual({ zoom: 'none', calendar: true });
  });

  it('syncs the calendar for a notes-only edit', () => {
    expect(planLessonEditSync(lesson(), patch({ notes: 'Bring the Bach' }), NOW))
      .toEqual({ zoom: 'none', calendar: true });
  });

  it('syncs the calendar for an address-only edit', () => {
    const before = lesson({ location_type: 'in-person', location_address: '12 Rue Alger', zoom_meeting_id: null });
    expect(planLessonEditSync(before, patch({ location_type: 'in-person', location_address: '9 Rue Alger' }), NOW))
      .toEqual({ zoom: 'none', calendar: true });
  });

  it('leaves past lessons alone', () => {
    const before = lesson({ start_time: '2026-07-30T17:00:00.000Z' });
    expect(planLessonEditSync(before, patch({ location_type: 'in-person', notes: 'x' }), NOW))
      .toEqual({ zoom: 'none', calendar: false });
  });

  it('leaves cancelled lessons alone', () => {
    const before = lesson({ status: 'cancelled' });
    expect(planLessonEditSync(before, patch({ location_type: 'in-person' }), NOW))
      .toEqual({ zoom: 'none', calendar: false });
  });

  it('defers to the cancellation path when the edit is a cancellation', () => {
    expect(planLessonEditSync(lesson(), patch({ status: 'cancelled', location_type: 'in-person' }), NOW))
      .toEqual({ zoom: 'none', calendar: false });
  });

  it('still handles Zoom when the lesson has no calendar event', () => {
    const before = lesson({ google_calendar_event_id: null });
    expect(planLessonEditSync(before, patch({ location_type: 'in-person' }), NOW))
      .toEqual({ zoom: 'delete', calendar: false });
  });
});
