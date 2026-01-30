-- Add discount_percent field to users table for student discounts
-- Run this in Supabase SQL Editor

-- Add discount_percent column (0-100 representing percentage off)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;

-- Add constraint to ensure discount is between 0 and 100
ALTER TABLE users
ADD CONSTRAINT valid_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100);

-- Create index for efficient queries on discounted students
CREATE INDEX IF NOT EXISTS idx_users_discount ON users(discount_percent) WHERE discount_percent > 0;
