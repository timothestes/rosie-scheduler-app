import { Resend } from 'resend';

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
// Update FROM_EMAIL once you've verified your domain in Resend
export const EMAIL_CONFIG = {
  // Verified domain: rosielessons.com
  fromEmail: process.env.RESEND_FROM_EMAIL || 'Rosie <rosie@rosielessons.com>',
  
  // Your app URL for links in emails
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://rosielessons.com',
};
