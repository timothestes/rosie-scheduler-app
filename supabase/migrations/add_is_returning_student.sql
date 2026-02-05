-- Add is_returning_student field to users table
-- NULL = not yet asked, true = returning student (no first lesson discount), false = new student (eligible for first lesson discount)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_returning_student BOOLEAN DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN users.is_returning_student IS 'Whether the student is a returning student (taken lessons before this app). NULL means not yet asked. Returning students are not eligible for first lesson discount.';
