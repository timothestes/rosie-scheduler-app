'use client';

import { useState, type FormEvent } from 'react';
import type { ContactField, ContactTopic } from '@/lib/contact';
import { site } from '../_content/site';

type Status = 'idle' | 'sending' | 'sent' | 'failed';
type FieldErrors = Partial<Record<ContactField, string>>;

const labelClass = 'rq-label block';

export default function ContactForm({
  topic = 'general',
  submitLabel = 'Send message',
  sentMessage,
}: {
  topic?: ContactTopic;
  submitLabel?: string;
  /** Rosie's own sign-off, shown once the message has gone. */
  sentMessage: string;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    setStatus('sending');
    setErrors({});

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, topic }),
      });

      if (response.ok) {
        setStatus('sent');
        return;
      }

      const body = await response.json().catch(() => null);
      if (response.status === 400 && body?.errors) {
        setErrors(body.errors);
        setStatus('idle');
        const first = Object.keys(body.errors)[0];
        (form.elements.namedItem(first) as HTMLElement | null)?.focus();
        return;
      }
      setStatus('failed');
    } catch {
      setStatus('failed');
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="border-t-2 border-rq-ink pt-6">
        <p className="rq-display text-[2rem] text-rq-ink">Thank you. Your message is on its way.</p>
        <p className="mt-3 text-rq-muted">{sentMessage}</p>
      </div>
    );
  }

  const field = (name: ContactField) => ({
    id: `contact-${topic}-${name}`,
    name,
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `contact-${topic}-${name}-error` : undefined,
    className: 'rq-field mt-2',
  });

  const errorFor = (name: ContactField) =>
    errors[name] ? (
      <p id={`contact-${topic}-${name}-error`} className="mt-2 text-sm text-rq-accent">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="rq-form grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
      <div>
        <label htmlFor={`contact-${topic}-firstName`} className={labelClass}>
          First name
        </label>
        <input type="text" autoComplete="given-name" required maxLength={80} {...field('firstName')} />
        {errorFor('firstName')}
      </div>

      <div>
        <label htmlFor={`contact-${topic}-lastName`} className={labelClass}>
          Last name
        </label>
        <input type="text" autoComplete="family-name" maxLength={80} {...field('lastName')} />
        {errorFor('lastName')}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`contact-${topic}-email`} className={labelClass}>
          Email
        </label>
        <input type="email" autoComplete="email" required maxLength={254} {...field('email')} />
        {errorFor('email')}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`contact-${topic}-message`} className={labelClass}>
          Message
        </label>
        <textarea rows={4} maxLength={4000} {...field('message')} />
        {errorFor('message')}
      </div>

      {/* Hidden from people; only form-filling bots complete it. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rq-button rq-button-solid"
        >
          {status === 'sending' ? 'Sending…' : submitLabel}
        </button>
        {status === 'failed' && (
          <p role="alert" className="text-sm text-rq-accent">
            That didn’t send. Please try again, or email{' '}
            <a href={`mailto:${site.email}`} className="rq-link">
              {site.email}
            </a>
            .
          </p>
        )}
      </div>
    </form>
  );
}
