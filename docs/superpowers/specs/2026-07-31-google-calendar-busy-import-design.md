# Google Calendar Busy-Time Import — Design Spec

**Date:** 2026-07-31
**Status:** Draft — consensus of two independent architecture reviews
**Feature:** Import the teacher's Google Calendar events into the app as blocked-out time, so personal events (an hour-long appointment, a 2-day trip) automatically prevent student bookings — no more manual block-out in the app.

## 1. Requirements (decided with product owner)

- **Freshness:** ~15-minute polling cadence is acceptable.
- **What blocks:** respect Google's Busy/Free transparency. Only "Busy" (opaque) events block. All-day events block only if marked Busy (Google defaults all-day events to Free). Declined invites and cancelled events never block. Tentative events block.
- **Scope:** the teacher's `primary` Google calendar only (the same calendar the app writes lesson events to).
- **Admin bypass:** imported blocks restrict students only. Admin-placed bookings bypass them, matching existing behavior where admin bookings bypass availability.
- **Hard constraint:** the app writes its own lesson events to this same calendar. The import must never re-import app-created events as blocked time ("echo"), and no sync loop may be possible.

## 2. Architecture

Cron-driven one-way mirror:

```
Vercel cron (*/15) ──▶ /api/cron/sync-google-busy
                          │ 1. events.list (primary, paginated, singleEvents=true)
                          │ 2. pure busy-filter (lib/google-busy-core.ts)
                          │ 3. drop app-created events (ID set + marker)
                          ▼
                    google_busy_blocks (Postgres, transactional replace)
                          │
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                      ▼
 checkOccurrenceConflicts  GET /api/availability/busy   admin calendar
 (server enforcement,      (student slot grid,           (no change — live
  students only)            intervals only)               Google overlay already
                                                          shows these events)
```

Why this shape (both reviews converged independently):
- Polling into a local mirror keeps Google entirely out of the booking hot path: no added latency, no Google-outage coupling, and the client-side student slot grid can read it the same way it reads `availability_overrides` today.
- It must be `events.list`, **not** `freeBusy`: freeBusy returns anonymous intervals, so app-created lesson events could not be filtered out by ID — the echo constraint would be unmeetable.
- `availability_overrides` cannot be reused: it is day-granular by schema and by semantics (an override *replaces* the whole day's windows in `availabilityWindowsForDate`, `lib/availability-core.ts`), and that contract is baked into three duplicated consumers.
- Push notifications (watch channels) buy ~13 minutes of freshness the product doesn't need, at the cost of a public webhook, weekly channel renewal, and a polling fallback anyway.

## 3. Data model

New migration `supabase/migrations/add_google_busy_blocks.sql`:

```sql
-- Mirror of currently-busy Google events. Deliberately NO summary/title column:
-- privacy by schema — students can read rows for the slot grid, so event titles
-- never land in this table. The teacher already sees titles via the live
-- Google overlay on the admin calendar.
CREATE TABLE IF NOT EXISTS google_busy_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,   -- instance id (singleEvents expansion → unique per occurrence)
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, google_event_id)
);
CREATE INDEX idx_google_busy_blocks_window
  ON google_busy_blocks (admin_id, start_time, end_time);

-- Sync health, one row per admin.
CREATE TABLE IF NOT EXISTS google_sync_state (
  admin_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT
);

ALTER TABLE google_busy_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_state ENABLE ROW LEVEL SECURITY;

-- Intervals are the same information a fully-booked slot already leaks; titles
-- don't exist in this table, so a simple authenticated read is safe.
CREATE POLICY "Authenticated users can view busy blocks"
  ON google_busy_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can view sync state"
  ON google_sync_state FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins
                 WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));
-- No INSERT/UPDATE/DELETE policies on either table: only the service-role cron writes.

-- Atomic snapshot swap. Whole-table replace per admin is correct because the
-- table is a pure mirror of the rolling window; past blocks have no consumers.
CREATE OR REPLACE FUNCTION replace_google_busy_blocks(p_admin_id UUID, p_blocks JSONB)
RETURNS void LANGUAGE plpgsql AS $$
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

Readers never observe an empty table mid-swap (single transaction, READ COMMITTED).

## 4. Sync algorithm

New route `app/api/cron/sync-google-busy/route.ts`, plus a second `vercel.json` cron entry (`*/15 * * * *`), authorized with `Bearer ${CRON_SECRET}` exactly like `send-reminders`. The teacher is resolved via `getPrimaryAdminUserId()`.

1. **Window:** `timeMin = now`, `timeMax = now + 180 days` (shared constant `SYNC_WINDOW_DAYS`). Students can pick dates ~90 days out and recurring bookings fan out up to 3 more months, so 180 days covers every occurrence the conflict checker can ever test — **an invariant enforced server-side, not assumed** (see Section 6, booking-horizon enforcement): student occurrences beyond the window are rejected, so the UI caps can never be bypassed by a hand-crafted request. A code comment must link this constant to those two product caps so they grow together.
2. **Fetch:** paginated `events.list` on `primary` with `singleEvents=true&maxResults=2500`, looping `nextPageToken` (safety cap ~10 pages). This is a new `fetchAllGoogleCalendarEvents` in `lib/google-calendar.ts` — the existing `fetchGoogleCalendarEvents` has no pagination. No `fields` param is set today, so `transparency`, `attendees`, `eventType`, and `extendedProperties` already come back; only the `GoogleCalendarEvent` type (`types/index.ts`) needs the new optional fields.
3. **Filter** — pure `shouldBlockEvent(event, lessonEventIds)` in new `lib/google-busy-core.ts`. Keep an event iff ALL of:
   - `status !== 'cancelled'` (defensive; `showDeleted` defaults false),
   - `transparency !== 'transparent'` (Google omits the field for Busy; all-day events default to `transparent`, which automatically implements "all-day blocks only if marked Busy"),
   - self-attendee `responseStatus !== 'declined'` (organizer-only events have no `attendees` → busy, correct),
   - `eventType` not in `('workingLocation', 'birthday')` (`outOfOffice`/`focusTime` are opaque and correctly block via the transparency rule),
   - not app-created (Section 5).
4. **Normalize** — timed events: parse `start.dateTime`/`end.dateTime` directly. All-day events: convert `start.date` / exclusive `end.date` from `America/Los_Angeles` wall-clock midnight to UTC instants via a new DST-aware pure helper `businessDateToUtc()` in `lib/timezone.ts` (never `new Date('YYYY-MM-DD')`, which parses as UTC and shifts the day).
5. **Write:** one `replace_google_busy_blocks` RPC call — transactional delete-and-replace of the full mirror. No diffing: moved, resized, deleted, un-busied, and recurring-exception events are all handled by construction. Then upsert `google_sync_state.last_success_at` and clear `last_error`.
6. **Failure behavior — fail stale, never fail empty:**
   - Any error (Google 5xx, network, token refresh failure, partial pagination) → **do not touch `google_busy_blocks`**; write `last_error`/`last_attempt_at`; return 200 with an error payload (matches send-reminders' non-throwing style). The previous snapshot stays in force.
   - The replace only runs after *all* pages fetched successfully — a half-fetched list must never shrink the mirror. **Implementation requirement:** `fetchAllGoogleCalendarEvents` must *throw* on any failure — it must not copy the existing `fetchGoogleCalendarEvents` style of swallowing errors and returning `[]`, which under whole-table replace would be indistinguishable from an empty calendar and would wipe the mirror.
   - **Explicit disconnect** (no `google_tokens` row at all): clear the admin's `google_busy_blocks` rows and record the state. Disconnect means "stop importing"; stale-forever blocks would be wrong. **Implementation requirement:** the refactored token helpers must make "no token row" (→ clear) distinguishable from "refresh failed" (→ fail-stale) — today `getValidAccessToken` returns `null` for both, and conflating them would clear the mirror on a transient failure.
7. **Prerequisite refactor — token helpers must work without a session.** `getGoogleTokens` / `refreshGoogleToken` / `getValidAccessToken` (`lib/google-calendar.ts`) currently use the user-scoped RLS client; a session-less cron would silently read nothing. Parameterize them to accept a Supabase client (or switch to `createAdminClient()`); the cron passes the admin client.
   - **This also fixes a latent production bug found during review:** when a *student* books a lesson, `POST /api/lessons` reads the teacher's `google_tokens` row under the student's session; RLS returns nothing, so the Google event creation silently fails ("No valid Google access token"). Student-booked lessons likely never reach the teacher's calendar today. The helpers are server-only and every caller is auth-gated, so widening to the admin client is safe and strictly an improvement.
8. **Manual trigger:** admin-gated `POST /api/busy-blocks/sync` invoking the same sync function, wired to a "Sync now" button on the admin calendar — mitigates the 15-minute race when the teacher just added something.

## 5. Echo / loop prevention

Three independent layers; layer 1 alone makes an infinite loop structurally impossible:

1. **Read-only import path.** The sync never creates, updates, or deletes anything in Google, and nothing in the app writes to Google based on `google_busy_blocks`. The dataflow graph has no cycle — there is nothing to oscillate.
2. **Lesson-ID exclusion (covers all historical events).** The cron loads `SELECT google_calendar_event_id FROM lessons WHERE google_calendar_event_id IS NOT NULL` (admin client, **all lesson statuses including cancelled** — a cancelled lesson whose Google-event deletion failed must not resurrect as a block) and drops any Google event whose `id` is in the set. This is the exact pattern already proven in the admin calendar overlay (`app/admin/calendar/page.tsx:389-400`).
3. **Write-side marker (closes the creation race).** `createGoogleCalendarEvent` adds `extendedProperties: { private: { rosieApp: 'lesson' } }` to every event body; the sync drops any event carrying the marker. This covers the window where the cron runs between Google-event creation and the `lessons` row insert (and the orphan case where the insert fails), which the ID set cannot see. Legacy pre-marker events are covered by layer 2.

Failure direction is safe: if a filter ever misses, the result is over-blocking (a slot shows busy), never a lost or double booking.

## 6. Enforcement & threading (the three availability paths)

- **Server, authoritative — `checkOccurrenceConflicts` (`lib/conflicts.ts`).** Inside the existing `if (availabilityAdminId)` branch, add a third parallel query: `google_busy_blocks` rows overlapping the widened occurrence window. Per occurrence, if the interval overlaps any block (strict inequalities — back-to-back is allowed, same semantics as lesson conflicts), return `{ status: 'conflict', reason: 'unavailable' }`. Reusing `'unavailable'` means preflight UI needs zero changes and deliberately doesn't reveal that the block is a personal event. The pure overlap helper `overlapsBusyBlock(startMs, endMs, blocks)` lives in `lib/conflicts-core.ts`. No commute buffer applies to busy blocks.
  - **Admin bypass is preserved for free:** `POST /api/lessons` passes `availabilityAdminId: callerAdmin ? null : adminId`, preflight passes `admin ? null : primaryAdminId`, and the admin-only reschedule route never sets it — the busy check simply never runs for admins. All three call sites verified.
  - **Booking-horizon enforcement (required for the 180-day invariant).** The UI caps (90-day picker, 3-month recurrence) are client-side only: `POST /api/lessons` currently enforces no maximum `start_time` and does not validate `recurring_months`, so a hand-crafted authenticated request could place occurrences beyond the sync window where the busy check trivially passes. Two additive changes close this:
    1. In `checkOccurrenceConflicts`, when `availabilityAdminId` is set, any occurrence ending beyond `now + SYNC_WINDOW_DAYS` returns `{ status: 'conflict', reason: 'unavailable' }`. This enforces the invariant at the same authoritative choke point as everything else, for any request shape. Zero UI impact — the UI cannot produce such occurrences.
    2. Input validation in `POST /api/lessons` and preflight: every caller's `recurring_months` is validated against role-appropriate allowed values — students `{1, 3}` (what the student `BookingForm` offers), admins `{1, 3, 6}` (what `AdminScheduleLessonModal` offers today). This bounds occurrence-array size for all callers (resource safety) without breaking the existing admin 6-month recurring flow.
    The horizon check in (1) remains admin-bypassed (consistent with the availability bypass); admin bookings never consult busy blocks, so the mirror window is not implicated by admin recurrences.
- **Student booking page (`app/(student)/schedule/page.tsx`).** Add one fetch to a new thin endpoint `GET /api/availability/busy?startDate&endDate` (authenticated; plain RLS `SELECT` of `start_time`/`end_time` — no titles exist in the table). Pass intervals to `TimeSlotPicker` as a `busyBlocks` prop: slots whose `[start, start + duration)` intersects a block render crossed-out ("Not available"), and blocks are merged as pseudo-lessons (non-in-person, so no commute buffer) into the duration-capping logic so offered durations can't span a block. **Blocks must be matched to the selected day by interval overlap, not start-date equality** (the page's existing start-date filtering pattern would miss day two of a 2-day trip; server enforcement backstops any client miss with a 409, never a bad booking). Fast-follow, not v1: gray out calendar days whose windows are fully covered (a 2-day trip currently shows as an all-crossed-out day, matching today's fully-booked-day UX).
- **Admin calendar (`app/admin/calendar/page.tsx`).** No enforcement change (admins bypass), and her Google events already render with titles via the live `/api/calendar/events` overlay. Add: a staleness banner when `google_sync_state.last_success_at` is older than 60 minutes, and the "Sync now" button (Section 4.8).
- **Preflight** inherits enforcement through `checkOccurrenceConflicts` — recurring-booking previews automatically show busy occurrences as skippable conflicts.

## 7. Edge cases

| Case | Behavior |
|---|---|
| All-day event | `start.date`/`end.date` (end exclusive) converted at LA-midnight via DST-aware helper. Defaults to Free in Google → blocks only if teacher marks it Busy (or uses Out-of-office, which is always opaque). |
| Multi-day event (timed or all-day) | One long interval row; interval-overlap math needs no per-day expansion. Google's `timeMin/timeMax` uses overlap semantics, so an in-progress trip straddling `now` is still returned. |
| Declined invite | Self-attendee `responseStatus === 'declined'` → excluded. |
| Tentative | Blocks (opaque). |
| Cancelled / deleted since last run | Vanishes on next snapshot replace. |
| Recurring Google event | `singleEvents=true` expands to instances with unique per-instance IDs; moved/edited exceptions arrive pre-resolved; infinite series bounded by the 180-day window. |
| Event beyond 180 days | Not mirrored — but student occurrences beyond the window are rejected server-side as `unavailable` (Section 6 horizon enforcement), so nothing bookable can ever land there. Admins remain unrestricted. Comment links `SYNC_WINDOW_DAYS` to the UI caps. |
| Back-to-back (event ends 2:00, slot starts 2:00) | Allowed — strict-inequality overlap, consistent with lesson conflict semantics. |
| Existing lesson vs. newly added busy event | Lesson stays; blocks only prevent *new* student bookings. The teacher sees both on her calendar. |
| DST boundaries (Mar 8 / Nov 1, 2026) | Covered by `businessDateToUtc` unit tests. |

## 8. Failure modes (ranked) and mitigations

1. **Echo import shadowing lessons** — dual guard (ID set incl. cancelled + marker) + unit tests for both; failure direction is over-blocking, never lost bookings.
2. **Partial sync wiping blocks** — replace only after all pages fetched; single transactional RPC; advisory lock against overlapping runs.
3. **Token revoked / cron dead → new personal events silently don't block** — fail-stale; staleness banner keyed off `last_success_at` age (catches cron misconfig too, independent of error logging); Resend email nudge to the teacher after >24 h without a successful sync (reconnect flow already exists).
4. **All-day timezone off-by-one** — pure DST-aware helper + boundary tests.
5. **15-minute race (student books just after teacher adds an event)** — accepted by product; mitigated by "Sync now" and by the teacher seeing the lesson appear on her calendar immediately via the existing push.
6. **Google API outage** — run fails, previous snapshot retained, auto-retry in 15 min.
7. **Title privacy** — no title column exists; nothing to leak.

## 9. Testing strategy

- **Unit (vitest, matching the existing pure-core pattern):**
  - `lib/google-busy-core.test.ts` — `shouldBlockEvent` matrix: transparent, tentative, cancelled, declined-self, organizer-without-attendees, `workingLocation`/`birthday`, marker present, ID-set member; `eventToInterval` for timed / all-day single / all-day multi-day / end-exclusivity / DST boundaries.
  - `lib/timezone.test.ts` — `businessDateToUtc` across PST/PDT transitions.
  - `lib/conflicts-core.test.ts` — `overlapsBusyBlock`: touching endpoints don't conflict, containment, spanning multi-day block; duration-capping with pseudo-lesson blocks.
  - **Echo race tests:** marker-but-no-ID-set event → excluded; ID-set-but-no-marker (historical) event → excluded.
  - **Horizon tests:** student occurrence ending beyond `SYNC_WINDOW_DAYS` → `unavailable`; admin occurrence beyond it → allowed; `recurring_months` outside the caller's role-appropriate values → 400; admin `recurring_months: 6` → accepted.
- **Route-level:** cron route stays thin (fetch → pure filter → RPC) so logic lives in tested pure modules; test the auth gate and failure-leaves-snapshot behavior with a mocked client (including: fetch failure must throw, not resolve to `[]`; refresh failure must not clear the mirror; absent token row must clear it).
- **Manual E2E checklist:** Busy vs Free timed event; all-day Busy; 2-day trip; declined invite; app-booked lesson not re-imported; cancelled lesson's slot frees after next sync; admin books over a block (succeeds); student slot crossed out and server rejects a forced `POST /api/lessons` with `unavailable`; "Sync now" reflects a just-added event.
- **Regression:** existing `availability-core` / `conflicts-core` suites unchanged and green (new logic is additive behind `availabilityAdminId`).

## 10. Out of scope (v1)

- Multiple calendars / calendar picker (primary only; extend later if asked).
- Google push notifications (watch channels).
- Incremental `syncToken` sync (window replace is simpler and self-healing at this scale).
- Warning UI when an imported block overlaps an existing lesson.
- Graying out fully-blocked days in the student date picker (fast-follow).

## 11. Rejected alternatives

- **Live Google query in the booking path (freeBusy or events.list):** injects Google latency/outages into every booking; freeBusy's anonymous intervals make the echo constraint unmeetable — disqualifying.
- **Extend `availability_overrides`:** day-granular by schema and semantics; time-ranged rows would break the override-replaces-the-day contract in all three duplicated consumers.
- **Watch channels + webhook:** weekly renewal, public endpoint, no payload in notifications (still must list) — unjustified for accepted 15-min freshness.
- **Pseudo-lessons in the `lessons` table:** would leak into reminders, payments, and reports.

## 12. Consensus record

Two independent architecture reviews (A and B) converged on the identical core design (Sections 2, 4–6). Deltas were resolved as follows:

| Delta | A | B | Resolution |
|---|---|---|---|
| Table name | `busy_blocks` | `google_busy_blocks` | **B** — source-explicit |
| Event titles | No column (privacy by schema) | Store, admin-only RLS + reader RPC | **A** — YAGNI; admin overlay already shows titles; simpler RLS, no RPC for reads |
| Sync window | 12 months | 180 days tied to product caps | **B** — grounded in the actual 90-day picker + 3-month recurrence caps |
| Replace scope | Whole table per admin | Window-bounded + 7-day retention | **A** for simplicity, keeping **B**'s advisory lock |
| Disconnect semantics | Fail-stale always | No token row → clear blocks | **B** — explicit disconnect means "stop importing" |
| Student read path | Direct RLS SELECT | SECURITY DEFINER RPC | **A**'s mechanism (safe with no title column) at **B**'s endpoint path |

Additions each contributed: A — "Sync now" button, 24 h email nudge, pseudo-lesson duration capping. B — advisory lock, latent student-booking token bug, product-cap-linked window, `eventType` exclusions.

**Sign-off round:** A signed off with three implementation cautions, all incorporated as normative requirements (fetch-must-throw, distinguishable token-failure states, day-matching by interval overlap; plus `GRANT EXECUTE` on the RPC). B objected that the 180-day invariant was only client-enforced — confirmed against `POST /api/lessons` (no max `start_time`, unvalidated `recurring_months`) — resolved by the Section 6 booking-horizon enforcement.

**Confirmation round:** B confirmed the amended spec in full. A caught one contradiction introduced by the amendment — a flat `recurring_months ≤ 3` rule would 400 the existing admin 6-month option (`AdminScheduleLessonModal` offers `[1, 3, 6]`) — resolved with A's prescribed per-role validation (students `{1, 3}`, admins `{1, 3, 6}`), which still satisfies B's requirements verbatim (every caller validated, occurrence arrays bounded, student horizon bypass closed). Both architects confirmed the final text.
