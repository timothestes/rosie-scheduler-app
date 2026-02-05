-- Add location_address field to lessons table for in-person lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN lessons.location_address IS 'Student address for in-person lessons';
