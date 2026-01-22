-- Schedule a Lesson with Rosie Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins table (stores admin emails)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extended profile info)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student notes (private admin notes about students)
CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability table (admin availability slots)
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE, -- For non-recurring, specific date availability
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability overrides (for editing specific days)
CREATE TABLE IF NOT EXISTS availability_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false, -- false = blocked, true = custom availability
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons table (booked lessons)
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lesson_type TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('in-person', 'zoom')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  is_paid BOOLEAN DEFAULT false,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
  google_calendar_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Google tokens table (for Google Calendar integration)
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lessons_student_id ON lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_admin_id ON lessons(admin_id);
CREATE INDEX IF NOT EXISTS idx_lessons_start_time ON lessons(start_time);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_availability_admin_id ON availability(admin_id);
CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_date ON availability_overrides(override_date);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_notes_updated_at
  BEFORE UPDATE ON student_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins policies
CREATE POLICY "Anyone can check if they are admin"
  ON admins FOR SELECT
  USING (true);

-- Student notes policies (admin only)
CREATE POLICY "Admins can manage student notes"
  ON student_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Availability policies
CREATE POLICY "Anyone can view availability"
  ON availability FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage availability"
  ON availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Availability overrides policies
CREATE POLICY "Anyone can view availability overrides"
  ON availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage availability overrides"
  ON availability_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Lessons policies
CREATE POLICY "Students can view their own lessons"
  ON lessons FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create lessons"
  ON lessons FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own lessons"
  ON lessons FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage all lessons"
  ON lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Google tokens policies
CREATE POLICY "Users can manage their own tokens"
  ON google_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tokens"
  ON google_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
