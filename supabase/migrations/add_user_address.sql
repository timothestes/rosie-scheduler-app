-- Add address field to users table for student addresses
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN users.address IS 'Student address for in-person lessons';
