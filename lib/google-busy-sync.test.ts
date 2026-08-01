import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn().mockResolvedValue({ error: null });
const upsert = vi.fn().mockResolvedValue({ error: null });
const lessonRows = { data: [{ google_calendar_event_id: 'lesson-evt' }], error: null };
const from = vi.fn((table: string) => {
  if (table === 'google_sync_state') return { upsert };
  // lessons id-set query: .select().not() chain
  return { select: vi.fn(() => ({ not: vi.fn().mockResolvedValue(lessonRows) })) };
});

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc, from }) }));
vi.mock('@/lib/primary-admin', () => ({ getPrimaryAdminUserId: vi.fn().mockResolvedValue('admin-1') }));
vi.mock('@/lib/google-calendar', () => ({
  getGoogleTokensStrict: vi.fn(),
  getValidAccessToken: vi.fn(),
  fetchAllGoogleCalendarEvents: vi.fn(),
}));

import { syncGoogleBusyBlocks } from './google-busy-sync';
import { getGoogleTokensStrict, getValidAccessToken, fetchAllGoogleCalendarEvents } from '@/lib/google-calendar';

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
});

describe('syncGoogleBusyBlocks', () => {
  it('mirrors busy events and excludes app-created ones', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue('tok');
    vi.mocked(fetchAllGoogleCalendarEvents).mockResolvedValue([
      { id: 'busy1', summary: 'Dentist', status: 'confirmed', start: { dateTime: '2026-08-03T14:00:00-07:00' }, end: { dateTime: '2026-08-03T15:00:00-07:00' } },
      { id: 'lesson-evt', summary: 'Lesson', status: 'confirmed', start: { dateTime: '2026-08-03T16:00:00-07:00' }, end: { dateTime: '2026-08-03T17:00:00-07:00' } },
      { id: 'free1', summary: 'Maybe', status: 'confirmed', transparency: 'transparent', start: { dateTime: '2026-08-04T14:00:00-07:00' }, end: { dateTime: '2026-08-04T15:00:00-07:00' } },
    ]);
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: true, blocks: 1 });
    expect(rpc).toHaveBeenCalledWith('replace_google_busy_blocks', {
      p_admin_id: 'admin-1',
      p_blocks: [expect.objectContaining({ google_event_id: 'busy1' })],
    });
  });

  it('fails stale on fetch error: records the error and never calls the RPC', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue('tok');
    vi.mocked(fetchAllGoogleCalendarEvents).mockRejectedValue(new Error('Google 500'));
    const result = await syncGoogleBusyBlocks();
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ last_error: 'Google 500' }), expect.anything());
  });

  it('fails stale when token refresh fails (tokens exist but no access token)', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue(null);
    const result = await syncGoogleBusyBlocks();
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('resolves (does not throw) when recording sync state also fails', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue('tok');
    vi.mocked(fetchAllGoogleCalendarEvents).mockRejectedValue(new Error('Google 500'));
    upsert.mockRejectedValue(new Error('DB down'));
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: false, blocks: 0, error: 'Google 500' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('clears the mirror on explicit disconnect (no token row)', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue(null);
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: true, blocks: 0, cleared: true });
    expect(rpc).toHaveBeenCalledWith('replace_google_busy_blocks', { p_admin_id: 'admin-1', p_blocks: [] });
  });

  it('fails stale (does not clear the mirror) on a transient google_tokens read failure', async () => {
    // getGoogleTokensStrict throws on any read failure that isn't a genuine
    // zero-rows result, so a transient DB error must land in the catch block
    // and be recorded as an error, never treated as a disconnect.
    vi.mocked(getGoogleTokensStrict).mockRejectedValue(new Error('PostgREST: connection reset'));
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: false, blocks: 0 });
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ last_error: expect.stringContaining('connection reset') }),
      expect.anything()
    );
  });

  it('dedupes blocks by google_event_id before calling the RPC (last occurrence wins)', async () => {
    vi.mocked(getGoogleTokensStrict).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue('tok');
    vi.mocked(fetchAllGoogleCalendarEvents).mockResolvedValue([
      { id: 'dup1', summary: 'Dentist', status: 'confirmed', start: { dateTime: '2026-08-03T14:00:00-07:00' }, end: { dateTime: '2026-08-03T15:00:00-07:00' } },
      { id: 'dup1', summary: 'Dentist (moved)', status: 'confirmed', start: { dateTime: '2026-08-03T16:00:00-07:00' }, end: { dateTime: '2026-08-03T17:00:00-07:00' } },
    ]);
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: true, blocks: 1 });
    expect(rpc).toHaveBeenCalledWith('replace_google_busy_blocks', {
      p_admin_id: 'admin-1',
      p_blocks: [expect.objectContaining({ google_event_id: 'dup1', start_time: new Date('2026-08-03T16:00:00-07:00').toISOString() })],
    });
  });
});
