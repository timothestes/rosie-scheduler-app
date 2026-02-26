-- Add is_admin_created flag to users table
-- Used to distinguish students created by admin (no login required) from self-registered students
-- Run this in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT false;
