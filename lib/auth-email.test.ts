import { describe, it, expect } from 'vitest';
import { buildAuthEmail, buildPasswordLink } from './auth-email';

const APP_URL = 'https://rosielessons.com';

describe('buildPasswordLink', () => {
  it('points at the in-app set-password page with the token', () => {
    expect(buildPasswordLink(APP_URL, 'abc123')).toBe(
      'https://rosielessons.com/login/reset-password?token_hash=abc123'
    );
  });

  it('tolerates a trailing slash and encodes the token', () => {
    expect(buildPasswordLink('http://localhost:3000/', 'a+b/c')).toBe(
      'http://localhost:3000/login/reset-password?token_hash=a%2Bb%2Fc'
    );
  });
});

describe('buildAuthEmail', () => {
  const link = buildPasswordLink(APP_URL, 'tok');

  it('greets by first name and includes the link in html and text', () => {
    const email = buildAuthEmail({ kind: 'self-reset', fullName: 'Sarah Johnson', link, appUrl: APP_URL });
    expect(email.subject).toBe('Reset Your Rosie Lessons Password');
    expect(email.html).toContain('Hi Sarah,');
    expect(email.html).toContain(`href="${link}"`);
    expect(email.text).toContain('Hi Sarah,');
    expect(email.text).toContain(link);
  });

  it('falls back to a generic greeting without a name', () => {
    const email = buildAuthEmail({ kind: 'reset', fullName: null, link, appUrl: APP_URL });
    expect(email.html).toContain('Hi there,');
  });

  it('uses setup wording for teacher-created accounts', () => {
    const email = buildAuthEmail({ kind: 'setup', fullName: 'Sam', link, appUrl: APP_URL });
    expect(email.subject).toBe('Set Up Your Rosie Lessons Account');
    expect(email.html).toContain('Set Up My Account');
    expect(email.text).toContain('Set up your account here:');
  });

  it('tells the student where to get a fresh link', () => {
    const email = buildAuthEmail({ kind: 'self-reset', fullName: 'Sam', link, appUrl: APP_URL });
    expect(email.text).toContain('https://rosielessons.com/login/forgot-password');
    expect(email.html).toContain('https://rosielessons.com/login/forgot-password');
  });

  it('escapes html in the name', () => {
    const email = buildAuthEmail({ kind: 'reset', fullName: '<b>x</b> y', link, appUrl: APP_URL });
    expect(email.html).toContain('Hi &lt;b&gt;x&lt;/b&gt;,');
    expect(email.html).not.toContain('<b>x</b>');
  });
});
