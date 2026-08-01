import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAllGoogleCalendarEvents } from './google-calendar';

const page = (items: { id: string }[], nextPageToken?: string) =>
  new Response(JSON.stringify({ items, nextPageToken }), { status: 200 });

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
