// One sync pass: mirror the primary admin's Google Calendar busy events into
// google_busy_blocks. Shared by the 15-min cron and the admin "Sync now" button.
// Failure contract (spec §4.6): any error → fail stale (mirror untouched, error
// recorded); ONLY an absent google_tokens row (explicit disconnect / never
// connected) clears the mirror.
import { createAdminClient } from '@/lib/supabase/admin';
import { getPrimaryAdminUserId } from '@/lib/primary-admin';
import { getGoogleTokensStrict, getValidAccessToken, fetchAllGoogleCalendarEvents } from '@/lib/google-calendar';
import { shouldBlockEvent, eventToInterval, SYNC_WINDOW_DAYS, type BusyInterval } from '@/lib/google-busy-core';

export interface SyncResult {
  ok: boolean;
  blocks: number;
  cleared?: boolean;
  error?: string;
}

export async function syncGoogleBusyBlocks(): Promise<SyncResult> {
  const admin = createAdminClient();
  const adminId = await getPrimaryAdminUserId();
  if (!adminId) return { ok: false, blocks: 0, error: 'No primary admin configured' };

  const recordState = async (fields: Record<string, unknown>) => {
    const { error } = await admin
      .from('google_sync_state')
      .upsert({ admin_id: adminId, last_attempt_at: new Date().toISOString(), ...fields }, { onConflict: 'admin_id' });
    if (error) console.error('Failed to record sync state:', error.message ?? error);
  };

  try {
    // Strict read: throws on a transient DB error instead of returning null,
    // so only a genuine "no row" (explicit disconnect) reaches the clear path.
    const tokens = await getGoogleTokensStrict(adminId);
    if (!tokens) {
      const { error } = await admin.rpc('replace_google_busy_blocks', { p_admin_id: adminId, p_blocks: [] });
      if (error) throw new Error(`Clear on disconnect failed: ${error.message}`);
      await recordState({ last_success_at: new Date().toISOString(), last_error: null });
      return { ok: true, blocks: 0, cleared: true };
    }

    const accessToken = await getValidAccessToken(adminId);
    if (!accessToken) throw new Error('Google token refresh failed');

    const timeMin = new Date();
    const timeMax = new Date(timeMin.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [events, lessonIdsRes] = await Promise.all([
      fetchAllGoogleCalendarEvents(accessToken, timeMin, timeMax),
      // ALL statuses on purpose: a cancelled lesson whose Google-event deletion
      // failed must not resurrect as a block (spec §5.2).
      admin.from('lessons').select('google_calendar_event_id').not('google_calendar_event_id', 'is', null),
    ]);
    if (lessonIdsRes.error) throw new Error(`Lesson id fetch failed: ${lessonIdsRes.error.message}`);
    const lessonEventIds = new Set(
      (lessonIdsRes.data ?? []).map((r) => r.google_calendar_event_id as string)
    );

    const blocks = events
      .filter((e) => shouldBlockEvent(e, lessonEventIds))
      .map(eventToInterval)
      .filter((b): b is BusyInterval => b !== null);

    // Dedupe by google_event_id (last occurrence wins): an event updated
    // mid-pagination can surface twice across pages, and the RPC's
    // UNIQUE(admin_id, google_event_id) constraint would fail the whole run.
    const deduped = Array.from(new Map(blocks.map((b) => [b.google_event_id, b])).values());

    const { error: rpcError } = await admin.rpc('replace_google_busy_blocks', {
      p_admin_id: adminId,
      p_blocks: deduped,
    });
    if (rpcError) throw new Error(`replace_google_busy_blocks failed: ${rpcError.message}`);

    await recordState({ last_success_at: new Date().toISOString(), last_error: null, stale_notified_at: null });
    return { ok: true, blocks: deduped.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('Google busy sync failed:', message);
    // recordState itself hitting a DB error (e.g. Supabase down) must not turn
    // a handled sync failure into an unhandled rejection — the contract is that
    // this function always resolves with a SyncResult.
    try {
      await recordState({ last_error: message });
    } catch (stateErr) {
      console.error('Failed to record sync state:', stateErr);
    }
    return { ok: false, blocks: 0, error: message };
  }
}
