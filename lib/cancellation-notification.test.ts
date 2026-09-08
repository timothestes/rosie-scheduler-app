import { describe, it, expect, vi } from 'vitest';
import { buildCancellationEmail } from './cancellation-notification';

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
  start: '2026-12-25T20:00:00.000Z', // 12:00 PM PT
  lessonTypeName: 'Voice 30',
};

describe('buildCancellationEmail', () => {
  it('subject says the lesson was cancelled', () => {
    const { subject } = buildCancellationEmail(base);
    expect(subject).toContain('cancelled');
  });

  it('shows the lesson date and time in the body', () => {
    const { html, text } = buildCancellationEmail(base);
    expect(text).toContain('December 25');
    expect(text).toContain('12:00');
    expect(html).toContain('December 25');
  });

  it('includes the reason when one is given', () => {
    const { html, text } = buildCancellationEmail({ ...base, reason: 'Wedding' });
    expect(text).toContain('Wedding');
    expect(html).toContain('Wedding');
  });

  it('falls back to generic copy when no reason is given', () => {
    const { text } = buildCancellationEmail(base);
    expect(text.toLowerCase()).toContain('no longer available');
  });

  it('escapes HTML in user-controlled values', () => {
    const { html } = buildCancellationEmail({ ...base, reason: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
