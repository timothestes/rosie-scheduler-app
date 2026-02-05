-- Add columns to track when reminders were sent for each lesson
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN lessons.reminder_24h_sent_at IS 'Timestamp when the 24-hour reminder email was sent';
COMMENT ON COLUMN lessons.reminder_1h_sent_at IS 'Timestamp when the 1-hour reminder email was sent';

-- Create index for efficient querying of lessons needing reminders
CREATE INDEX IF NOT EXISTS idx_lessons_reminder_pending 
ON lessons (start_time, status) 
WHERE status = 'scheduled';
