import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncGoogleBusyBlocks } from '@/lib/google-busy-sync';
import { getPrimaryAdminUserId } from '@/lib/primary-admin';
import { getPrimaryAdminEmail } from '@/lib/utils';
import { resend, EMAIL_CONFIG } from '@/lib/resend';

// Verify the request is from Vercel Cron (same contract as send-reminders).
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// If syncing has been failing for >24h the teacher's new personal events are
// silently not blocking bookings — email her once per stale period (cleared on
// the next successful sync via stale_notified_at).
async function maybeSendStaleNudge() {
  const adminId = await getPrimaryAdminUserId();
  const adminEmail = getPrimaryAdminEmail();
  if (!adminId || !adminEmail) return;

  const admin = createAdminClient();
  const { data: state } = await admin
    .from('google_sync_state')
    .select('last_success_at, stale_notified_at')
    .eq('admin_id', adminId)
    .single();
  if (!state?.last_success_at) return;

  const staleSince = Date.now() - new Date(state.last_success_at).getTime();
  const alreadyNotified =
    state.stale_notified_at &&
    Date.now() - new Date(state.stale_notified_at).getTime() < STALE_AFTER_MS;
  if (staleSince < STALE_AFTER_MS || alreadyNotified) return;

  await resend.emails.send({
    from: EMAIL_CONFIG.fromEmail,
    to: adminEmail,
    subject: 'Your Google Calendar sync has stopped working',
    text: `Your Google Calendar hasn't synced to the scheduler in over 24 hours, so new events on your calendar are NOT blocking student bookings.\n\nPlease open the admin calendar and reconnect Google Calendar: ${EMAIL_CONFIG.appUrl}/admin/calendar`,
  });
  await admin
    .from('google_sync_state')
    .update({ stale_notified_at: new Date().toISOString() })
    .eq('admin_id', adminId);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await syncGoogleBusyBlocks();
  if (!result.ok) {
    try {
      await maybeSendStaleNudge();
    } catch (err) {
      console.error('Stale-sync nudge failed:', err);
    }
  }
  // 200 even on sync failure: observability lives in google_sync_state + the
  // admin banner; a 500 here would only make Vercel cron noise.
  return NextResponse.json(result);
}
