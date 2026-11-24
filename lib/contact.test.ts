import { describe, expect, it } from 'vitest';
import { buildContactEmail, CONTACT_LIMITS, parseContactSubmission } from './contact';

const valid = {
  firstName: ' Ada ',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  message: 'I would love to book a lesson.',
};

describe('parseContactSubmission', () => {
  it('accepts a complete submission and trims it', () => {
    expect(parseContactSubmission(valid)).toEqual({
      ok: true,
      submission: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        message: 'I would love to book a lesson.',
        topic: 'general',
      },
    });
  });

  it('allows an empty last name and message', () => {
    const result = parseContactSubmission({ firstName: 'Ada', email: 'ada@example.com' });
    expect(result).toMatchObject({ ok: true, submission: { lastName: '', message: '' } });
  });

  it('only recognises the lessons topic explicitly', () => {
    expect(parseContactSubmission({ ...valid, topic: 'lessons' })).toMatchObject({
      submission: { topic: 'lessons' },
    });
    expect(parseContactSubmission({ ...valid, topic: 'anything-else' })).toMatchObject({
      submission: { topic: 'general' },
    });
  });

  it('requires a first name and a plausible email', () => {
    expect(parseContactSubmission({ ...valid, firstName: '  ' })).toMatchObject({
      ok: false,
      errors: { firstName: expect.any(String) },
    });
    for (const email of ['', 'not-an-email', 'a@b', 'a b@example.com', 'ada@example.com\nbcc: x@y.z', '<a@b.co>']) {
      expect(parseContactSubmission({ ...valid, email }), email).toMatchObject({
        ok: false,
        errors: { email: expect.any(String) },
      });
    }
  });

  it('rejects oversized fields', () => {
    expect(parseContactSubmission({ ...valid, firstName: 'a'.repeat(CONTACT_LIMITS.name + 1) })).toMatchObject({
      ok: false,
      errors: { firstName: expect.any(String) },
    });
    expect(parseContactSubmission({ ...valid, message: 'a'.repeat(CONTACT_LIMITS.message + 1) })).toMatchObject({
      ok: false,
      errors: { message: expect.any(String) },
    });
  });

  it('reports every problem at once', () => {
    const result = parseContactSubmission({ firstName: '', email: 'nope' });
    expect(result).toMatchObject({ ok: false, errors: { firstName: expect.any(String), email: expect.any(String) } });
  });

  it('quietly drops submissions that fill the honeypot', () => {
    expect(parseContactSubmission({ ...valid, website: 'https://spam.example' })).toEqual({
      ok: true,
      submission: null,
    });
  });

  it('survives junk input', () => {
    for (const body of [null, undefined, 'hello', 42, [], { firstName: 7, email: {} }]) {
      expect(parseContactSubmission(body)).toMatchObject({ ok: false });
    }
  });

  it('keeps names on one line', () => {
    const result = parseContactSubmission({ ...valid, firstName: 'Ada\r\nBcc: someone@example.com' });
    expect(result).toMatchObject({ ok: true, submission: { firstName: 'Ada Bcc: someone@example.com' } });
  });
});

describe('buildContactEmail', () => {
  const submission = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    message: 'Hello!\nSecond line.',
    topic: 'general' as const,
  };

  it('addresses replies to the visitor', () => {
    expect(buildContactEmail(submission).replyTo).toBe('ada@example.com');
  });

  it('names the sender in the subject, by topic', () => {
    expect(buildContactEmail(submission).subject).toBe('Website message from Ada Lovelace');
    expect(buildContactEmail({ ...submission, topic: 'lessons' }).subject).toBe(
      'Voice lesson inquiry from Ada Lovelace'
    );
  });

  it('includes the message and contact details', () => {
    const { text } = buildContactEmail(submission);
    expect(text).toContain('Hello!\nSecond line.');
    expect(text).toContain('Email: ada@example.com');
  });

  it('says so when there is no message', () => {
    const { text, subject } = buildContactEmail({ ...submission, lastName: '', message: '' });
    expect(subject).toBe('Website message from Ada');
    expect(text).toContain('(They did not include a message.)');
  });
});
