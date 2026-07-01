import { describe, it, expect, vi } from 'vitest';
import {
  ENCOURAGEMENTS,
  pickEncouragement,
  buildTeacherBookingEmail,
} from './teacher-notification';

// Mock resend module to avoid API key requirement
vi.mock('@/lib/resend', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
  EMAIL_CONFIG: {
    fromEmail: 'test@example.com',
  },
}));

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

  it('uses singular grammar in the skipped note when exactly one date was skipped', () => {
    const { html, text } = buildTeacherBookingEmail({ ...baseInput(), skippedCount: 1 });
    expect(html).toContain('1 requested date was unavailable');
    expect(text).toContain('1 requested date was unavailable');
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
