-- Add recurring fields to lessons table
-- Run this in Supabase SQL Editor

-- Add is_recurring column
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Add recurring_series_id column to link recurring lessons together
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS recurring_series_id UUID;

-- Add paid_at timestamp to track when payment was received (not when lesson occurs)
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Create index for efficient queries on recurring series
CREATE INDEX IF NOT EXISTS idx_lessons_recurring_series_id ON lessons(recurring_series_id);

-- Create index for payment date queries
CREATE INDEX IF NOT EXISTS idx_lessons_paid_at ON lessons(paid_at);
