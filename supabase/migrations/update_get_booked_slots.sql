-- Update get_booked_slots function to include location_type and is_own_lesson for commute buffer calculation
DROP FUNCTION IF EXISTS get_booked_slots(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_booked_slots(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
  id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  lesson_type TEXT,
  location_type TEXT,
  status TEXT,
  is_own_lesson BOOLEAN
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.start_time, l.end_time, l.lesson_type, l.location_type, l.status,
         (l.student_id = auth.uid()) AS is_own_lesson
  FROM lessons l
  WHERE l.status != 'cancelled'
    AND l.start_time >= start_date
    AND l.start_time <= end_date;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_booked_slots TO authenticated;
