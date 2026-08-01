# Google Calendar Busy-Time Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the teacher's Google Calendar Busy events into the app as blocked time so students can't book over her personal events.

**Architecture:** A 15-minute Vercel cron mirrors the primary calendar's busy events into a new `google_busy_blocks` table (transactional delete-and-replace); `checkOccurrenceConflicts` enforces the blocks for student bookings only; the student slot grid reads intervals from a thin endpoint. App-created lesson events are excluded by ID set + a new `extendedProperties` marker, and the import path never writes to Google (no loop possible).

**Tech Stack:** Next.js 16 App Router, Supabase/Postgres (RLS + service-role RPC), raw-fetch Google Calendar v3, vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-07-31-google-calendar-busy-import-design.md` — the authoritative design. Read it before starting any task.

## Global Constraints

- Business timezone is `America/Los_Angeles` (`BUSINESS_TIMEZONE` in `lib/timezone.ts`); never parse `'YYYY-MM-DD'` with `new Date(str)` (that's UTC midnight, wrong day).
- Sync window constant: `SYNC_WINDOW_DAYS = 180`, exported from `lib/google-busy-core.ts`, with a comment linking it to the 90-day student picker (`app/(student)/schedule/page.tsx:82`) and the 3-month max student recurrence (`components/BookingForm.tsx`).
- Busy predicate (spec §4.3): blocks iff `status !== 'cancelled'` AND `transparency !== 'transparent'` AND `eventType` not in `('workingLocation','birthday')` AND self-attendee not declined AND not app-created.
- Echo guards (spec §5): lesson-ID set (ALL statuses incl. cancelled) + `extendedProperties.private.rosieApp` marker. Import path never writes to Google.
- Failure behavior (spec §4.6): errors → fail-stale (never touch the mirror); only an absent `google_tokens` row clears it. `fetchAllGoogleCalendarEvents` must THROW on failure, never return `[]`.
- Blocks restrict students only: every enforcement change goes inside the existing `if (availabilityAdminId)` gate; conflict reason is always `'unavailable'`.
- Overlap semantics are strict inequalities (`start < end && end > start`) — back-to-back is allowed, matching `evaluateConflict`.
- Pure logic lives in `lib/*.ts` modules with vitest tests (`npm test`); routes stay thin. Vitest resolves the `@/` alias; tests must match `lib/**/*.test.ts`.
- Match existing code style: no semicolonless lines, existing comment density, `NextResponse.json` error shapes.
- Commit after every task with a conventional-commit message ending in the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Work on branch `feat/google-calendar-busy-import` (already exists, spec committed).

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/add_google_busy_blocks.sql`

**Interfaces:**
- Produces: tables `google_busy_blocks(id, admin_id, google_event_id, start_time, end_time, is_all_day, synced_at)`, `google_sync_state(admin_id, last_attempt_at, last_success_at, last_error, stale_notified_at)`; RPC `replace_google_busy_blocks(p_admin_id UUID, p_blocks JSONB)`. Later tasks call the RPC via `admin.rpc('replace_google_busy_blocks', { p_admin_id, p_blocks })` where `p_blocks` is a JSON array of `{ google_event_id, start_time, end_time, is_all_day }`.

- [ ] **Step 1: Write the migration**

```sql
-- Google Calendar busy-time import (see docs/superpowers/specs/2026-07-31-google-calendar-busy-import-design.md)
-- Mirror of currently-busy Google events. Deliberately NO summary/title column:
-- students can read rows for the slot grid, so event titles never land in this
-- table. The teacher sees titles via the live Google overlay on the admin calendar.
CREATE TABLE IF NOT EXISTS google_busy_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS idx_google_busy_blocks_window
  ON google_busy_blocks (admin_id, start_time, end_time);

-- Sync health, one row per admin.
CREATE TABLE IF NOT EXISTS google_sync_state (
  admin_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  stale_notified_at TIMESTAMPTZ
);

ALTER TABLE google_busy_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_state ENABLE ROW LEVEL SECURITY;

-- Intervals are the same information a fully-booked slot grid already leaks;
-- no titles exist in this table, so an authenticated read is safe.
CREATE POLICY "Authenticated users can view busy blocks"
  ON google_busy_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can view google sync state"
  ON google_sync_state FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins
                 WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));
-- No INSERT/UPDATE/DELETE policies on either table: only the service-role cron writes.

-- Atomic snapshot swap. Whole-table replace per admin is correct because the
-- table is a pure mirror of the rolling sync window; past blocks have no readers.
CREATE OR REPLACE FUNCTION replace_google_busy_blocks(p_admin_id UUID, p_blocks JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Serialize concurrent runs (overlapping cron + "Sync now" button).
  PERFORM pg_advisory_xact_lock(hashtext('gbusy_' || p_admin_id::text));
  DELETE FROM google_busy_blocks WHERE admin_id = p_admin_id;
  INSERT INTO google_busy_blocks (admin_id, google_event_id, start_time, end_time, is_all_day)
  SELECT p_admin_id, b->>'google_event_id', (b->>'start_time')::timestamptz,
         (b->>'end_time')::timestamptz, COALESCE((b->>'is_all_day')::boolean, false)
  FROM jsonb_array_elements(p_blocks) b;
END $$;
REVOKE ALL ON FUNCTION replace_google_busy_blocks(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_google_busy_blocks(UUID, JSONB) TO service_role;
```

- [ ] **Step 2: Sanity-check the SQL**

Read the file back and verify: both tables have RLS enabled, the busy-blocks read policy is `TO authenticated`, the RPC has `SECURITY DEFINER` + the advisory lock + the `REVOKE`/`GRANT` pair, and the style matches `supabase/migrations/remove_zoom_tokens_fix_rls.sql`. Do NOT apply the migration to any database — this project hand-runs migrations at deploy time.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/add_google_busy_blocks.sql
git commit -m "feat: add google_busy_blocks tables and replace RPC migration"
```

---

### Task 2: Pure core — timezone helper, type extension, busy predicate

**Files:**
- Modify: `lib/timezone.ts` (add `businessDateToUtc`)
- Modify: `types/index.ts:103-118` (extend `GoogleCalendarEvent`)
- Create: `lib/google-busy-core.ts`, `lib/timezone.test.ts`, `lib/google-busy-core.test.ts`

**Interfaces:**
- Consumes: `getBusinessTimeParts(date, timeZone?)` from `lib/timezone.ts`.
- Produces:
  - `businessDateToUtc(dateStr: string, timeZone?: string): Date` — the UTC instant of local midnight of `dateStr` in the business timezone.
  - `GoogleCalendarEvent` gains optional `transparency?: 'opaque' | 'transparent'`, `eventType?: string`, `attendees?: { self?: boolean; responseStatus?: string; email?: string }[]`, `extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }`.
  - From `lib/google-busy-core.ts`: `SYNC_WINDOW_DAYS = 180`, `BUSY_MARKER_KEY = 'rosieApp'`, `interface BusyInterval { google_event_id: string; start_time: string; end_time: string; is_all_day: boolean }`, `shouldBlockEvent(event: GoogleCalendarEvent, lessonEventIds: Set<string>): boolean`, `eventToInterval(event: GoogleCalendarEvent): BusyInterval | null`.

- [ ] **Step 1: Write failing tests for `businessDateToUtc`** in `lib/timezone.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { businessDateToUtc } from './timezone';

describe('businessDateToUtc', () => {
  it('converts a PST date to LA midnight (UTC-8)', () => {
    expect(businessDateToUtc('2026-01-15').toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });
  it('converts a PDT date to LA midnight (UTC-7)', () => {
    expect(businessDateToUtc('2026-07-15').toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });
  it('handles the spring-forward day (Mar 8 2026 starts in PST)', () => {
    expect(businessDateToUtc('2026-03-08').toISOString()).toBe('2026-03-08T08:00:00.000Z');
  });
  it('handles the fall-back day (Nov 1 2026 starts in PDT)', () => {
    expect(businessDateToUtc('2026-11-01').toISOString()).toBe('2026-11-01T07:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- lib/timezone.test.ts` → FAIL (`businessDateToUtc` not exported).

- [ ] **Step 3: Implement `businessDateToUtc`** in `lib/timezone.ts`

```ts
// The UTC instant at which the given business-timezone calendar date begins
// (local midnight). Needed for all-day Google events, which carry only a
// 'YYYY-MM-DD' date. Never use `new Date('YYYY-MM-DD')` for this — that parses
// as UTC midnight and shifts the day. Two correction passes make the result
// stable across DST transitions.
export function businessDateToUtc(dateStr: string, timeZone: string = BUSINESS_TIMEZONE): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetWallMs = Date.UTC(y, m - 1, d);
  let ts = targetWallMs;
  for (let i = 0; i < 2; i++) {
    const parts = getBusinessTimeParts(new Date(ts), timeZone);
    const wallMs =
      Date.UTC(
        Number(parts.dateStr.slice(0, 4)),
        Number(parts.dateStr.slice(5, 7)) - 1,
        Number(parts.dateStr.slice(8, 10))
      ) + parts.minutes * 60000;
    ts += targetWallMs - wallMs;
  }
  return new Date(ts);
}
```

- [ ] **Step 4: Run** — `npm test -- lib/timezone.test.ts` → PASS.

- [ ] **Step 5: Extend `GoogleCalendarEvent`** in `types/index.ts` — add after `status: string;`:

```ts
  transparency?: 'opaque' | 'transparent';
  eventType?: string;
  attendees?: { self?: boolean; responseStatus?: string; email?: string }[];
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
```

- [ ] **Step 6: Write failing tests for the busy predicate** in `lib/google-busy-core.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { shouldBlockEvent, eventToInterval, SYNC_WINDOW_DAYS } from './google-busy-core';
import type { GoogleCalendarEvent } from '@/types';

const timed = (over: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent => ({
  id: 'evt1',
  summary: 'Dentist',
  start: { dateTime: '2026-08-03T14:00:00-07:00' },
  end: { dateTime: '2026-08-03T15:00:00-07:00' },
  status: 'confirmed',
  ...over,
});
const none = new Set<string>();

describe('shouldBlockEvent', () => {
  it('blocks a plain confirmed timed event (transparency omitted = opaque)', () => {
    expect(shouldBlockEvent(timed(), none)).toBe(true);
  });
  it('blocks a tentative event', () => {
    expect(shouldBlockEvent(timed({ status: 'tentative' }), none)).toBe(true);
  });
  it('does not block a transparent (Free) event', () => {
    expect(shouldBlockEvent(timed({ transparency: 'transparent' }), none)).toBe(false);
  });
  it('does not block a cancelled event', () => {
    expect(shouldBlockEvent(timed({ status: 'cancelled' }), none)).toBe(false);
  });
  it('does not block a self-declined invite', () => {
    expect(shouldBlockEvent(timed({ attendees: [{ self: true, responseStatus: 'declined' }] }), none)).toBe(false);
  });
  it('blocks an organizer-only event with no attendees array', () => {
    expect(shouldBlockEvent(timed({ attendees: undefined }), none)).toBe(true);
  });
  it('does not block workingLocation or birthday event types', () => {
    expect(shouldBlockEvent(timed({ eventType: 'workingLocation' }), none)).toBe(false);
    expect(shouldBlockEvent(timed({ eventType: 'birthday' }), none)).toBe(false);
  });
  it('does not block an event carrying the app marker (creation race)', () => {
    expect(shouldBlockEvent(timed({ extendedProperties: { private: { rosieApp: 'lesson' } } }), none)).toBe(false);
  });
  it('does not block an event whose id is a known lesson event (historical)', () => {
    expect(shouldBlockEvent(timed(), new Set(['evt1']))).toBe(false);
  });
});

describe('eventToInterval', () => {
  it('maps a timed event to its exact interval', () => {
    const b = eventToInterval(timed());
    expect(b).toEqual({
      google_event_id: 'evt1',
      start_time: '2026-08-03T21:00:00.000Z',
      end_time: '2026-08-03T22:00:00.000Z',
      is_all_day: false,
    });
  });
  it('maps an all-day event at LA midnights with exclusive end date', () => {
    const b = eventToInterval(timed({
      start: { date: '2026-08-03' },
      end: { date: '2026-08-05' }, // 2-day event Aug 3-4; end date exclusive
    }));
    expect(b).toEqual({
      google_event_id: 'evt1',
      start_time: '2026-08-03T07:00:00.000Z',
      end_time: '2026-08-05T07:00:00.000Z',
      is_all_day: true,
    });
  });
  it('returns null for an event with no usable times', () => {
    expect(eventToInterval(timed({ start: {}, end: {} }))).toBeNull();
  });
});

describe('SYNC_WINDOW_DAYS', () => {
  it('is 180 (covers 90-day picker + 3-month recurrence fan-out)', () => {
    expect(SYNC_WINDOW_DAYS).toBe(180);
  });
});
```

- [ ] **Step 7: Run to verify failure** — `npm test -- lib/google-busy-core.test.ts` → FAIL (module missing).

- [ ] **Step 8: Implement `lib/google-busy-core.ts`**

```ts
// Pure filter/normalize logic for the Google Calendar busy-time import.
// See docs/superpowers/specs/2026-07-31-google-calendar-busy-import-design.md.
// Kept side-effect free so it is trivially unit-testable.
import { businessDateToUtc } from './timezone';
import type { GoogleCalendarEvent } from '@/types';

// Sync horizon. Must cover every occurrence the conflict checker can test for a
// student: the date picker offers 90 days (app/(student)/schedule/page.tsx) and
// student recurrence caps at 3 months (components/BookingForm.tsx) → ~166 days
// worst case. checkOccurrenceConflicts rejects student occurrences beyond this
// window, so growing either product cap requires growing this constant with it.
export const SYNC_WINDOW_DAYS = 180;

// extendedProperties.private key stamped on app-created events (echo guard).
export const BUSY_MARKER_KEY = 'rosieApp';

export interface BusyInterval {
  google_event_id: string;
  start_time: string; // ISO instant
  end_time: string; // ISO instant
  is_all_day: boolean;
}

// Busy predicate per spec §4.3. Google omits `transparency` for Busy (opaque)
// events; all-day events default to 'transparent', which automatically gives
// "all-day blocks only if marked Busy". outOfOffice/focusTime are opaque and
// correctly block via the transparency rule.
export function shouldBlockEvent(
  event: GoogleCalendarEvent,
  lessonEventIds: Set<string>
): boolean {
  if (event.status === 'cancelled') return false;
  if (event.transparency === 'transparent') return false;
  if (event.eventType === 'workingLocation' || event.eventType === 'birthday') return false;
  const self = event.attendees?.find((a) => a.self);
  if (self?.responseStatus === 'declined') return false;
  if (event.extendedProperties?.private?.[BUSY_MARKER_KEY]) return false;
  if (lessonEventIds.has(event.id)) return false;
  return true;
}

// Timed events use their exact instants; all-day events (date-only, end
// exclusive) span business-timezone midnights.
export function eventToInterval(event: GoogleCalendarEvent): BusyInterval | null {
  if (event.start.dateTime && event.end.dateTime) {
    return {
      google_event_id: event.id,
      start_time: new Date(event.start.dateTime).toISOString(),
      end_time: new Date(event.end.dateTime).toISOString(),
      is_all_day: false,
    };
  }
  if (event.start.date && event.end.date) {
    return {
      google_event_id: event.id,
      start_time: businessDateToUtc(event.start.date).toISOString(),
      end_time: businessDateToUtc(event.end.date).toISOString(),
      is_all_day: true,
    };
  }
  return null;
}
```

- [ ] **Step 9: Run all tests** — `npm test` → all PASS (including pre-existing suites).

- [ ] **Step 10: Commit**

```bash
git add lib/timezone.ts lib/timezone.test.ts types/index.ts lib/google-busy-core.ts lib/google-busy-core.test.ts
git commit -m "feat: add busy-event predicate, interval mapping, and DST-safe date helper"
```

---

### Task 3: Google client — admin-client tokens, event marker, paginated fetch

**Files:**
- Modify: `lib/google-calendar.ts`
- Create: `lib/google-calendar.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `@/lib/supabase/admin`; `BUSY_MARKER_KEY` from `./google-busy-core`.
- Produces: `fetchAllGoogleCalendarEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<GoogleCalendarEvent[]>` (THROWS on any failure); `getGoogleTokens`/`refreshGoogleToken`/`getValidAccessToken` unchanged signatures but now service-role-backed; `createGoogleCalendarEvent` now stamps the marker.

- [ ] **Step 1: Switch token helpers to the admin client.** In `lib/google-calendar.ts`, replace the import `import { createClient } from '@/lib/supabase/server';` with `import { createAdminClient } from '@/lib/supabase/admin';`. In `getGoogleTokens` (line 14) and `refreshGoogleToken` (line 48), replace `const supabase = await createClient();` with `const supabase = createAdminClient();`. Add this comment above `getGoogleTokens`:

```ts
// Service-role client on purpose: token reads/writes must work (a) in the
// session-less sync cron and (b) when a STUDENT books a lesson — the event is
// created on the TEACHER's calendar, and under the student's RLS session this
// read silently returned nothing, so student bookings never reached Google.
// The module is server-only and every route calling into it is auth-gated.
```

- [ ] **Step 2: Stamp the marker on created events.** In `createGoogleCalendarEvent`, add to the `event` object literal (after the `end` property):

```ts
      // Echo guard: lets the busy-time import recognize app-created events even
      // before/without the lessons row (see lib/google-busy-core.ts).
      extendedProperties: { private: { rosieApp: 'lesson' } },
```

- [ ] **Step 3: Write failing tests for `fetchAllGoogleCalendarEvents`** in `lib/google-calendar.test.ts`

```ts
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page([{ id: 'x' }], 'again')));
    await expect(fetchAllGoogleCalendarEvents('token', new Date(), new Date())).rejects.toThrow(/pages/);
  });
});
```

- [ ] **Step 4: Run to verify failure** — `npm test -- lib/google-calendar.test.ts` → FAIL (function not exported).

- [ ] **Step 5: Implement `fetchAllGoogleCalendarEvents`** in `lib/google-calendar.ts` (after `fetchGoogleCalendarEvents`):

```ts
// Paginated events.list for the busy-time import. Unlike fetchGoogleCalendarEvents
// (display overlay, fails soft to []), this THROWS on any failure: the sync's
// whole-table replace would otherwise mistake a transient error for an empty
// calendar and wipe the mirror. Caller supplies the access token so the sync can
// distinguish "no tokens" (disconnect) from "refresh failed" (fail stale) first.
export async function fetchAllGoogleCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  for (let pageCount = 0; pageCount < 10; pageCount++) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Google Calendar list failed (${response.status}): ${await response.text()}`);
    }
    const data = await response.json();
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
    if (!pageToken) return events;
  }

  throw new Error('Google Calendar list exceeded 10 pages; aborting to avoid a partial sync');
}
```

- [ ] **Step 6: Run all tests + typecheck** — `npm test` → PASS; `npx tsc --noEmit` → clean (the token-helper change removes the only `await createClient()` uses; ensure no unused imports remain).

- [ ] **Step 7: Commit**

```bash
git add lib/google-calendar.ts lib/google-calendar.test.ts
git commit -m "feat: service-role token access, app-event marker, paginated throwing fetch"
```

---

### Task 4: Sync orchestrator

**Files:**
- Create: `lib/google-busy-sync.ts`, `lib/google-busy-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 RPC; Task 2 `shouldBlockEvent`/`eventToInterval`/`SYNC_WINDOW_DAYS`; Task 3 `getGoogleTokens`/`getValidAccessToken`/`fetchAllGoogleCalendarEvents`; `getPrimaryAdminUserId()` from `@/lib/primary-admin`; `createAdminClient()` from `@/lib/supabase/admin`.
- Produces: `syncGoogleBusyBlocks(): Promise<SyncResult>` where `interface SyncResult { ok: boolean; blocks: number; cleared?: boolean; error?: string }`. Routes in Task 5 call exactly this.

- [ ] **Step 1: Write failing tests** in `lib/google-busy-sync.test.ts` (mock every module boundary)

```ts
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
  getGoogleTokens: vi.fn(),
  getValidAccessToken: vi.fn(),
  fetchAllGoogleCalendarEvents: vi.fn(),
}));

import { syncGoogleBusyBlocks } from './google-busy-sync';
import { getGoogleTokens, getValidAccessToken, fetchAllGoogleCalendarEvents } from '@/lib/google-calendar';

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
});

describe('syncGoogleBusyBlocks', () => {
  it('mirrors busy events and excludes app-created ones', async () => {
    vi.mocked(getGoogleTokens).mockResolvedValue({ refresh_token: 'r' });
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
    vi.mocked(getGoogleTokens).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue('tok');
    vi.mocked(fetchAllGoogleCalendarEvents).mockRejectedValue(new Error('Google 500'));
    const result = await syncGoogleBusyBlocks();
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ last_error: 'Google 500' }), expect.anything());
  });

  it('fails stale when token refresh fails (tokens exist but no access token)', async () => {
    vi.mocked(getGoogleTokens).mockResolvedValue({ refresh_token: 'r' });
    vi.mocked(getValidAccessToken).mockResolvedValue(null);
    const result = await syncGoogleBusyBlocks();
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('clears the mirror on explicit disconnect (no token row)', async () => {
    vi.mocked(getGoogleTokens).mockResolvedValue(null);
    const result = await syncGoogleBusyBlocks();
    expect(result).toMatchObject({ ok: true, blocks: 0, cleared: true });
    expect(rpc).toHaveBeenCalledWith('replace_google_busy_blocks', { p_admin_id: 'admin-1', p_blocks: [] });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- lib/google-busy-sync.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/google-busy-sync.ts`**

```ts
// One sync pass: mirror the primary admin's Google Calendar busy events into
// google_busy_blocks. Shared by the 15-min cron and the admin "Sync now" button.
// Failure contract (spec §4.6): any error → fail stale (mirror untouched, error
// recorded); ONLY an absent google_tokens row (explicit disconnect / never
// connected) clears the mirror.
import { createAdminClient } from '@/lib/supabase/admin';
import { getPrimaryAdminUserId } from '@/lib/primary-admin';
import { getGoogleTokens, getValidAccessToken, fetchAllGoogleCalendarEvents } from '@/lib/google-calendar';
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
    await admin
      .from('google_sync_state')
      .upsert({ admin_id: adminId, last_attempt_at: new Date().toISOString(), ...fields }, { onConflict: 'admin_id' });
  };

  try {
    const tokens = await getGoogleTokens(adminId);
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

    const { error: rpcError } = await admin.rpc('replace_google_busy_blocks', {
      p_admin_id: adminId,
      p_blocks: blocks,
    });
    if (rpcError) throw new Error(`replace_google_busy_blocks failed: ${rpcError.message}`);

    await recordState({ last_success_at: new Date().toISOString(), last_error: null, stale_notified_at: null });
    return { ok: true, blocks: blocks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('Google busy sync failed:', message);
    await recordState({ last_error: message });
    return { ok: false, blocks: 0, error: message };
  }
}
```

- [ ] **Step 4: Run** — `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/google-busy-sync.ts lib/google-busy-sync.test.ts
git commit -m "feat: add busy-block sync orchestrator with fail-stale semantics"
```

---

### Task 5: Cron route, manual-sync endpoint, vercel.json

**Files:**
- Create: `app/api/cron/sync-google-busy/route.ts`, `app/api/busy-blocks/sync/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `syncGoogleBusyBlocks()` from Task 4; `resend, EMAIL_CONFIG` from `@/lib/resend`; `getPrimaryAdminEmail` from `@/lib/utils`.
- Produces: `GET /api/cron/sync-google-busy` (Bearer CRON_SECRET), `POST /api/busy-blocks/sync` (admin-gated, runs a sync), `GET /api/busy-blocks/sync` (admin-gated, returns the `google_sync_state` row or null). Task 7's admin UI calls both `/api/busy-blocks/sync` verbs.

- [ ] **Step 1: Add the cron entry** to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/send-reminders", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/sync-google-busy", "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 2: Implement `app/api/cron/sync-google-busy/route.ts`** (auth pattern copied from `app/api/cron/send-reminders/route.ts:14-24`):

```ts
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
```

- [ ] **Step 3: Implement `app/api/busy-blocks/sync/route.ts`** (admin gate pattern from `app/api/availability/overrides/route.ts:44-61`):

```ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncGoogleBusyBlocks } from '@/lib/google-busy-sync';
import { getPrimaryAdminUserId } from '@/lib/primary-admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();
  return admin ? user : null;
}

// POST /api/busy-blocks/sync - "Sync now": run a sync pass immediately.
export async function POST() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const result = await syncGoogleBusyBlocks();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

// GET /api/busy-blocks/sync - sync health for the admin staleness banner.
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const adminId = await getPrimaryAdminUserId();
  if (!adminId) return NextResponse.json(null);
  const { data } = await createAdminClient()
    .from('google_sync_state')
    .select('last_attempt_at, last_success_at, last_error')
    .eq('admin_id', adminId)
    .single();
  return NextResponse.json(data ?? null);
}
```

- [ ] **Step 4: Verify** — `npm test` (all green, nothing broken) and `npx tsc --noEmit` → clean. Optionally boot `npm run dev` and hit `GET http://localhost:3000/api/cron/sync-google-busy` (dev bypasses the Bearer check); without the migration applied locally it should return `{ ok: false, ... }` with a table-missing error — proving the fail-stale path returns 200 and records nothing fatal.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/sync-google-busy/route.ts app/api/busy-blocks/sync/route.ts vercel.json
git commit -m "feat: add busy-sync cron, manual sync endpoint, and stale-sync email nudge"
```

---

### Task 6: Enforcement — conflicts threading, horizon, recurring_months validation

**Files:**
- Modify: `lib/conflicts-core.ts`, `lib/conflicts.ts`, `app/api/lessons/route.ts`, `app/api/lessons/preflight/route.ts`
- Modify (tests): `lib/conflicts-core.test.ts`

**Interfaces:**
- Consumes: `SYNC_WINDOW_DAYS` from `@/lib/google-busy-core`; table `google_busy_blocks` (Task 1).
- Produces: `overlapsBusyBlock(occStartMs: number, occEndMs: number, blocks: { start_time: string; end_time: string }[]): boolean` in `lib/conflicts-core.ts`; `checkOccurrenceConflicts` now returns `reason: 'unavailable'` for occurrences that overlap a busy block or end beyond the sync horizon (student paths only).

- [ ] **Step 1: Write failing tests** — append to `lib/conflicts-core.test.ts`:

```ts
import { overlapsBusyBlock } from './conflicts-core';

describe('overlapsBusyBlock', () => {
  const blocks = [
    { start_time: '2026-08-03T21:00:00.000Z', end_time: '2026-08-03T22:00:00.000Z' },
    // 2-day all-day trip
    { start_time: '2026-08-10T07:00:00.000Z', end_time: '2026-08-12T07:00:00.000Z' },
  ];
  const ms = (iso: string) => new Date(iso).getTime();

  it('flags an occurrence inside a block', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T21:15:00Z'), ms('2026-08-03T21:45:00Z'), blocks)).toBe(true);
  });
  it('flags an occurrence spanning a multi-day block', () => {
    expect(overlapsBusyBlock(ms('2026-08-11T17:00:00Z'), ms('2026-08-11T18:00:00Z'), blocks)).toBe(true);
  });
  it('allows back-to-back (occurrence starts exactly when the block ends)', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T22:00:00Z'), ms('2026-08-03T23:00:00Z'), blocks)).toBe(false);
  });
  it('allows an occurrence ending exactly when the block starts', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T20:00:00Z'), ms('2026-08-03T21:00:00Z'), blocks)).toBe(false);
  });
  it('is false with no blocks', () => {
    expect(overlapsBusyBlock(ms('2026-08-03T21:00:00Z'), ms('2026-08-03T22:00:00Z'), [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- lib/conflicts-core.test.ts` → FAIL.

- [ ] **Step 3: Implement `overlapsBusyBlock`** in `lib/conflicts-core.ts`:

```ts
export interface BusyBlock {
  start_time: string;
  end_time: string;
}

// Imported Google-Calendar busy time. Strict inequalities: back-to-back with a
// busy block is allowed, matching evaluateConflict's lesson-overlap semantics.
// No commute buffer — busy blocks aren't lessons at a location.
export function overlapsBusyBlock(
  occStartMs: number,
  occEndMs: number,
  blocks: BusyBlock[]
): boolean {
  return blocks.some((b) => {
    const bs = new Date(b.start_time).getTime();
    const be = new Date(b.end_time).getTime();
    return bs < occEndMs && be > occStartMs;
  });
}
```

- [ ] **Step 4: Run** — `npm test -- lib/conflicts-core.test.ts` → PASS.

- [ ] **Step 5: Thread through `checkOccurrenceConflicts`** in `lib/conflicts.ts`:
  - Add imports: `overlapsBusyBlock, type BusyBlock` to the existing `@/lib/conflicts-core` import; `import { SYNC_WINDOW_DAYS } from '@/lib/google-busy-core';`.
  - In the `if (availabilityAdminId)` block (lines 54-74), extend the `Promise.all` with a third query and destructure it:

```ts
    const [availRes, overrideRes, busyRes] = await Promise.all([
      admin
        .from('availability')
        .select('day_of_week, start_time, end_time, is_recurring')
        .eq('admin_id', availabilityAdminId),
      admin
        .from('availability_overrides')
        .select('override_date, is_available, start_time, end_time')
        .eq('admin_id', availabilityAdminId)
        .gte('override_date', minDate)
        .lte('override_date', maxDate),
      // Imported Google-Calendar busy time (students only, like availability).
      admin
        .from('google_busy_blocks')
        .select('start_time, end_time')
        .eq('admin_id', availabilityAdminId)
        .lt('start_time', windowEnd.toISOString())
        .gt('end_time', windowStart.toISOString()),
    ]);
    if (availRes.error) throw new Error(`Availability check failed: ${availRes.error.message}`);
    if (overrideRes.error) throw new Error(`Override check failed: ${overrideRes.error.message}`);
    if (busyRes.error) throw new Error(`Busy block check failed: ${busyRes.error.message}`);
    availability = (availRes.data ?? []) as AvailabilityWindow[];
    overrides = (overrideRes.data ?? []) as DayOverride[];
    busyBlocks = (busyRes.data ?? []) as BusyBlock[];
```

  - Declare alongside the existing accumulators (near line 52-53): `let busyBlocks: BusyBlock[] = [];` and, before the `occurrences.map`, `const horizonMs = Date.now() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;`.
  - In the per-occurrence `if (availabilityAdminId)` block (after the `isWithinAvailability` check, before `evaluateConflict`), add:

```ts
      // The busy-block mirror only extends SYNC_WINDOW_DAYS out, so a student
      // occurrence beyond it can't be checked — reject rather than assume free.
      // (UI caps keep legitimate bookings ~2 weeks inside this horizon.)
      if (end.getTime() > horizonMs) {
        return { date: start.toISOString(), index, status: 'conflict' as const, reason: 'unavailable' as const, conflictIsOwnLesson: false };
      }
      if (overlapsBusyBlock(start.getTime(), end.getTime(), busyBlocks)) {
        return { date: start.toISOString(), index, status: 'conflict' as const, reason: 'unavailable' as const, conflictIsOwnLesson: false };
      }
```

- [ ] **Step 6: Validate `recurring_months` in both routes.**
  - `app/api/lessons/route.ts` — after the `callerAdmin` lookup (line 124) and before the 24-hour check, add:

```ts
  // Bound the recurrence fan-out server-side. Students get the values the
  // BookingForm offers; admins additionally get the 6-month option from
  // AdminScheduleLessonModal. Also keeps occurrence arrays bounded and every
  // student occurrence inside the busy-sync horizon (SYNC_WINDOW_DAYS).
  if (is_recurring) {
    const allowedMonths = callerAdmin ? [1, 3, 6] : [1, 3];
    if (!allowedMonths.includes(Number(recurring_months))) {
      return NextResponse.json({ error: 'Invalid recurring duration' }, { status: 400 });
    }
  }
```

  - `app/api/lessons/preflight/route.ts` — after the `admin` lookup (line 32) and before `generateRecurringDates`, add the same block with `admin` in place of `callerAdmin`:

```ts
  if (is_recurring) {
    const allowedMonths = admin ? [1, 3, 6] : [1, 3];
    if (!allowedMonths.includes(Number(recurring_months))) {
      return NextResponse.json({ error: 'Invalid recurring duration' }, { status: 400 });
    }
  }
```

  Note: preflight destructures `is_recurring, recurring_months` already (line 19); the lessons route destructures them at line 112 — no destructuring changes needed.

- [ ] **Step 7: Run everything** — `npm test` → PASS; `npx tsc --noEmit` → clean.

- [ ] **Step 8: Commit**

```bash
git add lib/conflicts-core.ts lib/conflicts-core.test.ts lib/conflicts.ts app/api/lessons/route.ts app/api/lessons/preflight/route.ts
git commit -m "feat: enforce imported busy blocks, sync horizon, and recurrence bounds server-side"
```

---

### Task 7: Student booking UI — busy endpoint + slot grid threading

**Files:**
- Create: `app/api/availability/busy/route.ts`
- Modify: `app/(student)/schedule/page.tsx`, `components/TimeSlotPicker.tsx`

**Interfaces:**
- Consumes: table `google_busy_blocks` via authenticated RLS SELECT (Task 1); `getPrimaryAdminUserId` from `@/lib/primary-admin`.
- Produces: `GET /api/availability/busy?startDate&endDate` → `{ start_time: string; end_time: string }[]`; `TimeSlotPicker` gains optional prop `busyBlocks?: { start_time: string; end_time: string }[]`.

- [ ] **Step 1: Implement the endpoint** `app/api/availability/busy/route.ts` (pattern: `app/api/availability/overrides/route.ts` GET):

```ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/availability/busy - imported Google-Calendar busy intervals for the
// student slot grid. Intervals only — the table stores no event titles.
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let query = supabase.from('google_busy_blocks').select('start_time, end_time');
  // Interval overlap with [startDate, endDate], not containment — a multi-day
  // block straddling the range boundary must still be returned.
  if (endDate) query = query.lt('start_time', endDate);
  if (startDate) query = query.gt('end_time', startDate);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 2: Add the `busyBlocks` prop to `TimeSlotPicker`** (`components/TimeSlotPicker.tsx`):
  - Extend the props interface and destructuring:

```ts
  busyBlocks?: { start_time: string; end_time: string }[];
```

    (destructure as `busyBlocks = []`).
  - Add a checker next to `wouldOverlap` (same baseDate logic; plain overlap, no buffer):

```ts
  // Imported Google-Calendar busy time. Plain strict-inequality overlap against
  // the would-be lesson [start, start + duration) — no commute buffer.
  const isBusyBlocked = (time: string): boolean => {
    const [hours, minutes] = time.split(':').map(Number);
    const baseDate = selectedDate || (lessons.length > 0 ? new Date(lessons[0].start_time) : new Date());
    const slotStart = new Date(baseDate);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + lessonDuration * 60 * 1000);
    return busyBlocks.some((b) => new Date(b.start_time) < slotEnd && new Date(b.end_time) > slotStart);
  };
```

  - Thread it through both places slot availability is computed (`hasUnavailableSlots` around line 94 and the per-slot render around line 105): compute `const busyBlocked = isBusyBlocked(slot.start);`, include it in `isUnavailable`, and add a `title` branch `busyBlocked ? 'Not available' : ...` ordered after `bookedLesson`/`hasOverlap` and before `doesntFit`.

- [ ] **Step 3: Thread the student page** (`app/(student)/schedule/page.tsx`):
  - State: `const [busyBlocks, setBusyBlocks] = useState<{ start_time: string; end_time: string }[]>([]);`
  - In `fetchData`'s `Promise.all` (line 41-47), add `fetch(`/api/availability/busy?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)` as `busyRes`, and after: `if (busyRes.ok) setBusyBlocks(await busyRes.json());`
  - Below `allDayLessons` (line 264-267), select the day's blocks **by interval overlap, not start-date equality** (a 2-day trip must cross out day two):

```ts
  // Busy blocks touching the selected day (interval overlap — a multi-day block
  // straddling midnight must still gray out this day's slots).
  const dayStart = new Date(selectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayBusyBlocks = busyBlocks.filter(
    (b) => new Date(b.start_time) < dayEnd && new Date(b.end_time) > dayStart
  );
```

  - Pass `busyBlocks={dayBusyBlocks}` to `<TimeSlotPicker>` (line 330).
  - In the `maxDuration` computation passed to `BookingForm` (line 401-408), append the day's busy blocks as pseudo-lessons so offered durations can't span a block (zoom + 'other' → plain overlap, no commute buffer, in `maxAvailableDuration`):

```ts
              const existing = [
                ...allDayLessons.map((l) => ({
                  start_time: l.start_time,
                  end_time: l.end_time,
                  location_type: l.location_type,
                  status: l.status,
                  student_id: (l as Lesson & { is_own_lesson?: boolean }).is_own_lesson ? 'me' : 'other',
                })),
                // Imported busy blocks cap durations exactly like another
                // student's zoom lesson: hard boundary, no commute buffer.
                ...dayBusyBlocks.map((b) => ({
                  start_time: b.start_time,
                  end_time: b.end_time,
                  location_type: 'zoom',
                  status: 'scheduled',
                  student_id: 'other',
                })),
              ];
```

- [ ] **Step 4: Verify** — `npm test` → PASS; `npx tsc --noEmit` → clean; `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/api/availability/busy/route.ts components/TimeSlotPicker.tsx "app/(student)/schedule/page.tsx"
git commit -m "feat: surface imported busy blocks in the student booking grid"
```

---

### Task 8: Admin calendar — staleness banner + Sync now; SETUP.md scope fix

**Files:**
- Modify: `app/admin/calendar/page.tsx`, `SETUP.md`

**Interfaces:**
- Consumes: `GET /api/busy-blocks/sync` → `{ last_attempt_at, last_success_at, last_error } | null`; `POST /api/busy-blocks/sync` → `SyncResult` (Task 5).

- [ ] **Step 1: Read `app/admin/calendar/page.tsx` in full first.** It already tracks Google connection state (via `/api/calendar/status`) and renders a Google-events overlay; place the new UI beside those existing controls, matching the page's styling.

- [ ] **Step 2: Add sync-state fetch + Sync now.**
  - State: `const [syncState, setSyncState] = useState<{ last_success_at: string | null; last_error: string | null } | null>(null);` and `const [isSyncing, setIsSyncing] = useState(false);`
  - Fetch `GET /api/busy-blocks/sync` wherever the page loads its calendar-status data; store with `setSyncState`.
  - Handler:

```ts
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/busy-blocks/sync', { method: 'POST' });
      if (res.ok) {
        const stateRes = await fetch('/api/busy-blocks/sync');
        if (stateRes.ok) setSyncState(await stateRes.json());
      }
    } finally {
      setIsSyncing(false);
    }
  };
```

  - Render a small "Sync now" button (disabled while `isSyncing`, label "Syncing…" during) near the Google Calendar connection controls, visible only when Google is connected.

- [ ] **Step 3: Staleness banner.** Above the calendar, when Google is connected and the last successful sync is over 60 minutes old (or has never happened), render a warning banner in the page's existing alert style:

```ts
  const syncIsStale =
    googleConnected &&
    (!syncState?.last_success_at ||
      Date.now() - new Date(syncState.last_success_at).getTime() > 60 * 60 * 1000);
```

Banner copy: `⚠️ Google Calendar sync hasn't succeeded in the last hour — new events on your calendar may not be blocking student bookings.` plus `syncState?.last_error` in smaller text when present. (Use the page's actual connected-state variable name in place of `googleConnected`.)

- [ ] **Step 4: Fix SETUP.md.** Replace the `calendar.readonly` scope on line 21 with `https://www.googleapis.com/auth/calendar` (matching what `app/api/auth/google-calendar/route.ts` actually requests) and update the line-175 checklist item to say `OAuth scopes updated (calendar — read/write)`. Add one sentence to the Google section: events the app creates are tagged and the teacher's Busy events are imported as blocked booking time every 15 minutes.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean, `npm run build` succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/admin/calendar/page.tsx SETUP.md
git commit -m "feat: admin sync-health banner and manual sync trigger; fix documented OAuth scope"
```

---

### Task 9: Full verification + PR

- [ ] **Step 1: Full suite** — `npm test` → every suite green. `npx tsc --noEmit` → clean. `npm run build` → succeeds.
- [ ] **Step 2: Diff review** — `git diff main...HEAD` and check against the spec: every §-requirement maps to a commit; no stray debug code; no `console.log` beyond the codebase's existing error-logging idiom.
- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/google-calendar-busy-import
gh pr create --title "feat: import teacher's Google Calendar as blocked booking time" --body "$(cat <<'EOF'
## Summary
- Imports Rosie's primary Google Calendar Busy events as blocked time: a 15-min cron mirrors them into a new `google_busy_blocks` table, and student bookings are rejected (`unavailable`) when they overlap a block. Admin bookings bypass, matching existing availability behavior.
- Echo/loop-proof: import path never writes to Google; app lesson events are excluded by ID set + a new `extendedProperties.private.rosieApp` marker.
- Fixes a latent bug: token reads used the caller's RLS session, so student-initiated bookings silently failed to create Google Calendar events. Token helpers now use the service-role client.
- Adds server-side booking-horizon + `recurring_months` validation (previously client-only caps).
- Student slot grid crosses out busy times; admin calendar gets a sync-health banner + "Sync now"; email nudge if sync fails for >24h.

Design: `docs/superpowers/specs/2026-07-31-google-calendar-busy-import-design.md` (consensus of two independent architecture reviews + adversarial sign-off rounds).
Plan: `docs/superpowers/plans/2026-07-31-google-calendar-busy-import.md`

## Deploy notes
- **Apply `supabase/migrations/add_google_busy_blocks.sql` before merging** (additive: 2 tables, RLS, 1 RPC).
- No new env vars. New cron entry in `vercel.json` uses the existing `CRON_SECRET`.

## Test plan
- [ ] `npm test` (new: busy predicate matrix, DST date helper, pagination, sync fail-stale, overlap)
- [ ] Manual: Busy vs Free event, all-day Busy, 2-day trip, declined invite, app lesson not re-imported, admin books over block, student slot crossed out + server 409

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
