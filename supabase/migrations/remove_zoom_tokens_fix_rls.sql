-- Remove unused zoom_tokens table (now using Zoom Server-to-Server OAuth)
DROP TABLE IF EXISTS zoom_tokens CASCADE;

-- Fix google_tokens RLS policies to include WITH CHECK for inserts
DROP POLICY IF EXISTS "Users can manage their own tokens" ON google_tokens;
DROP POLICY IF EXISTS "Admins can view all tokens" ON google_tokens;

-- Enable RLS on google_tokens
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Create corrected policies with WITH CHECK
CREATE POLICY "Users can manage their own google tokens"
  ON google_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all google tokens"
  ON google_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
