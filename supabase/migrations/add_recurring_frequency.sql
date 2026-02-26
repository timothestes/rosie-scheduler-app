-- Add recurring_frequency column to lessons table
-- Tracks whether recurring lessons are 'weekly' or 'biweekly'
-- This is needed so the payment summary can apply the correct monthly rate per series

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS recurring_frequency TEXT;

-- Create index for queries filtering by frequency
CREATE INDEX IF NOT EXISTS idx_lessons_recurring_frequency ON lessons(recurring_frequency) WHERE recurring_frequency IS NOT NULL;
