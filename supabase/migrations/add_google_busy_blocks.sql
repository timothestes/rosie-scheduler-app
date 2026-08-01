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
