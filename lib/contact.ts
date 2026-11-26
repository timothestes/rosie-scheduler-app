// Validation and email content for the portfolio's public contact form.
// Pure functions; the route handler in app/api/contact does the sending.

export const CONTACT_LIMITS = {
  name: 80,
  email: 254,
  message: 4000,
} as const;

export type ContactTopic = 'general' | 'lessons';

export interface ContactSubmission {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  topic: ContactTopic;
}

export type ContactField = 'firstName' | 'lastName' | 'email' | 'message';

export type ContactParseResult =
  | { ok: true; submission: ContactSubmission }
  // A filled honeypot: answer as if it worked, send nothing.
  | { ok: true; submission: null }
  | { ok: false; errors: Partial<Record<ContactField, string>> };

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Collapse anything that could break out of a single header-ish line. */
function singleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function parseContactSubmission(body: unknown): ContactParseResult {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  // "website" is hidden from people; only form-filling bots complete it.
  if (text(input.website) !== '') return { ok: true, submission: null };

  const firstName = singleLine(text(input.firstName));
  const lastName = singleLine(text(input.lastName));
  const email = text(input.email);
  const message = text(input.message).replace(/\r\n/g, '\n');
  const topic: ContactTopic = input.topic === 'lessons' ? 'lessons' : 'general';

  const errors: Partial<Record<ContactField, string>> = {};

  if (!firstName) errors.firstName = 'Please add your first name.';
  else if (firstName.length > CONTACT_LIMITS.name) errors.firstName = 'That name is too long.';

  if (lastName.length > CONTACT_LIMITS.name) errors.lastName = 'That name is too long.';

  if (!email) errors.email = 'Please add your email so Rosie can reply.';
  else if (email.length > CONTACT_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    errors.email = 'That email address doesn’t look right.';
  }

  if (message.length > CONTACT_LIMITS.message) {
    errors.message = `Please keep your message under ${CONTACT_LIMITS.message} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, submission: { firstName, lastName, email, message, topic } };
}

export function buildContactEmail(submission: ContactSubmission): {
  subject: string;
  text: string;
  replyTo: string;
} {
  const name = [submission.firstName, submission.lastName].filter(Boolean).join(' ');
  const subject =
    submission.topic === 'lessons'
      ? `Voice lesson inquiry from ${name}`
      : `Website message from ${name}`;

  const lines = [
    submission.topic === 'lessons'
      ? `${name} sent a message from the Coaching page of your website.`
      : `${name} sent a message from your website.`,
    '',
    `Name: ${name}`,
    `Email: ${submission.email}`,
    '',
    submission.message ? submission.message : '(They did not include a message.)',
    '',
    'Reply to this email to write back to them directly.',
  ];

  return { subject, text: lines.join('\n'), replyTo: submission.email };
}
