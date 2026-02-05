import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { resend } from '@/lib/resend';

// Webhook secret for verifying requests from Resend
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// Where to forward received emails
const FORWARD_TO = process.env.EMAIL_FORWARD_TO!;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const headers = {
      'svix-id': request.headers.get('svix-id') || '',
      'svix-timestamp': request.headers.get('svix-timestamp') || '',
      'svix-signature': request.headers.get('svix-signature') || '',
    };

    // Verify webhook signature
    if (WEBHOOK_SECRET) {
      const wh = new Webhook(WEBHOOK_SECRET);
      try {
        wh.verify(payload, headers);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(payload);

    // Handle email.received event
    if (body.type === 'email.received') {
      const { data } = body;
      const emailId = data.email_id;

      console.log(`Received email from ${data.from} to ${data.to?.join(', ')}`);

      // Fetch the full email content from Resend API
      const emailResponse = await fetch(`https://api.resend.com/emails/${emailId}/content`, {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
      });

      if (!emailResponse.ok) {
        console.error('Failed to fetch email content:', await emailResponse.text());
        return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 });
      }

      const emailContent = await emailResponse.json();

      // Forward the email
      const { error } = await resend.emails.send({
        from: 'Rosie Inbox <rosie@rosielessons.com>',
        to: FORWARD_TO,
        subject: `Fwd: ${data.subject || '(no subject)'}`,
        html: `
          <div style="padding: 16px; background: #f3f4f6; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              <strong>From:</strong> ${data.from}<br>
              <strong>To:</strong> ${data.to?.join(', ')}<br>
              <strong>Subject:</strong> ${data.subject || '(no subject)'}
            </p>
          </div>
          <div>
            ${emailContent.html || emailContent.text || '<p>(no content)</p>'}
          </div>
        `,
        text: `
--- Forwarded Email ---
From: ${data.from}
To: ${data.to?.join(', ')}
Subject: ${data.subject || '(no subject)'}

${emailContent.text || '(no content)'}
        `,
      });

      if (error) {
        console.error('Failed to forward email:', error);
        return NextResponse.json({ error: 'Failed to forward' }, { status: 500 });
      }

      console.log(`Forwarded email to ${FORWARD_TO}`);
      return NextResponse.json({ success: true, forwarded_to: FORWARD_TO });
    }

    // Acknowledge other event types
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
