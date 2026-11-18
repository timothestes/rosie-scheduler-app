// Builds the "set / reset your password" emails. Pure (no I/O) so it can be
// unit-tested; callers generate the token and send via Resend.

export type AuthEmailKind =
  | 'setup' // teacher created the account, student sets a first password
  | 'reset' // teacher clicked "Send Password Reset"
  | 'self-reset'; // student used "Forgot password?" on the login page

export const RESET_PASSWORD_PATH = '/login/reset-password';
export const FORGOT_PASSWORD_PATH = '/login/forgot-password';

// The link lands on our own set-password page carrying the token. The token is
// only redeemed when the student submits the form, so email scanners that
// pre-open links can't burn the one-time token.
export function buildPasswordLink(appUrl: string, hashedToken: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${RESET_PASSWORD_PATH}?token_hash=${encodeURIComponent(hashedToken)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface AuthEmailInput {
  kind: AuthEmailKind;
  /** Full name from the student's profile, if we have one. */
  fullName?: string | null;
  /** From buildPasswordLink(). */
  link: string;
  appUrl: string;
}

export interface AuthEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildAuthEmail({ kind, fullName, link, appUrl }: AuthEmailInput): AuthEmail {
  const firstName = fullName?.trim().split(/\s+/)[0] || 'there';
  const isSetup = kind === 'setup';
  const forgotUrl = `${appUrl.replace(/\/+$/, '')}${FORGOT_PASSWORD_PATH}`;

  const subject = isSetup
    ? 'Set Up Your Rosie Lessons Account'
    : 'Reset Your Rosie Lessons Password';
  const headline = isSetup ? 'Welcome to Rosie Lessons!' : 'Reset Your Password';
  const headlineEmoji = isSetup ? '🎵' : '🔑';
  const bodyText = {
    setup:
      'Your teacher has set up a Rosie Lessons account for you. Click the button below to set your password and access your lessons.',
    reset:
      'A password reset was requested for your Rosie Lessons account. Click the button below to choose a new password.',
    'self-reset':
      'We got a request to reset the password for your Rosie Lessons account. Click the button below to choose a new one.',
  }[kind];
  const buttonText = isSetup ? 'Set Up My Account' : 'Reset My Password';
  const ignoreText = isSetup
    ? `If you weren't expecting this, you can safely ignore it.`
    : `If you didn't request a password reset, you can safely ignore this email — your password won't change.`;
  const expiryText = 'This link can only be used once. If it has expired, you can get a new one here:';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${headlineEmoji} ${headline}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${escapeHtml(firstName)},</p>
          <p style="font-size: 16px; margin-bottom: 30px;">${bodyText}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(link)}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
              ${buttonText}
            </a>
          </div>

          <p style="font-size: 13px; color: #888; margin-top: 30px; text-align: center;">
            ${expiryText} <a href="${escapeHtml(forgotUrl)}" style="color: #667eea;">${escapeHtml(forgotUrl)}</a>
          </p>
          <p style="font-size: 13px; color: #888; text-align: center;">${ignoreText}</p>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>Questions?</strong> Reply to this email to get in touch with Rosie.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${firstName},

${bodyText}

${isSetup ? 'Set up your account' : 'Reset your password'} here:
${link}

${expiryText}
${forgotUrl}

${ignoreText}

Questions? Reply to this email to get in touch with Rosie.
  `.trim();

  return { subject, html, text };
}
