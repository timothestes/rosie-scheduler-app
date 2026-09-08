-- Optional reason shown to students when a day is blocked (e.g. "Wedding",
-- "Christmas break"). Admin-authored only — never populated from Google
-- Calendar event titles (see add_google_busy_blocks.sql for that boundary).
ALTER TABLE availability_overrides ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN availability_overrides.reason IS 'Optional note shown to students for a blocked day (is_available = false). Never set from Google Calendar.';
