import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// from().select().eq().single() chain — resolves to whatever `single` is
// mocked to return for that test. Only getGoogleTokensStrict touches
// supabase in this file; fetchAllGoogleCalendarEvents talks to fetch only,
// so mocking this module here has no effect on those tests.
const single = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

import { fetchAllGoogleCalendarEvents, getGoogleTokensStrict } from './google-calendar';

const page = (items: { id: string }[], nextPageToken?: string) =>
  new Response(JSON.stringify({ items, nextPageToken }), { status: 200 });

beforeEach(() => single.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('fetchAllGoogleCalendarEvents', () => {
  it('follows nextPageToken and concatenates pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: 'a' }], 'tok2'))
      .mockResolvedValueOnce(page([{ id: 'b' }]));
    vi.stubGlobal('fetch', fetchMock);
    const events = await fetchAllGoogleCalendarEvents('token', new Date(), new Date());
    expect(events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=tok2');
  });

  it('throws on a non-OK response instead of returning []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(fetchAllGoogleCalendarEvents('token', new Date(), new Date())).rejects.toThrow(/500/);
  });

  it('throws if pagination exceeds the safety cap', async () => {
    // mockImplementation (not mockResolvedValue) so each call gets a fresh
    // Response — a Response body can only be read once, and this test's
    // whole point is to keep paging past a single call.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => page([{ id: 'x' }], 'again')));
    await expect(fetchAllGoogleCalendarEvents('token', new Date(), new Date())).rejects.toThrow(/pages/);
  });
});

describe('getGoogleTokensStrict', () => {
  it('returns null on a genuine zero-rows result (PGRST116)', async () => {
    single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    await expect(getGoogleTokensStrict('user-1')).resolves.toBeNull();
  });

  it('returns null when there is no error and no data', async () => {
    single.mockResolvedValue({ data: null, error: null });
    await expect(getGoogleTokensStrict('user-1')).resolves.toBeNull();
  });

  it('returns the row when the read succeeds', async () => {
    single.mockResolvedValue({ data: { user_id: 'user-1', refresh_token: 'r' }, error: null });
    await expect(getGoogleTokensStrict('user-1')).resolves.toEqual({ user_id: 'user-1', refresh_token: 'r' });
  });

  it('throws on any non-zero-rows error instead of returning null (transient failure must fail stale)', async () => {
    single.mockResolvedValue({ data: null, error: { code: '500', message: 'connection reset' } });
    await expect(getGoogleTokensStrict('user-1')).rejects.toThrow(/connection reset/);
  });
});
