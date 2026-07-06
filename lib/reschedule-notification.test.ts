import { describe, it, expect, vi } from 'vitest';
import { buildRescheduleEmail } from './reschedule-notification';

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

const base = {
  studentName: 'Alex',
  oldStart: '2026-07-12T17:00:00.000Z', // 10:00 AM PT
  newStart: '2026-07-14T21:00:00.000Z', // 2:00 PM PT
  lessonTypeName: 'Voice 30',
  locationLabel: 'Zoom',
};

describe('buildRescheduleEmail', () => {
  it('subject says the lesson was moved', () => {
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
