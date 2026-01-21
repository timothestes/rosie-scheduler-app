// Database types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: string;
  email: string;
  created_at: string;
}

export interface StudentNote {
  id: string;
  student_id: string;
  admin_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  admin_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:mm:ss format
  end_time: string;
  is_recurring: boolean;
  specific_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityOverride {
  id: string;
  admin_id: string;
  override_date: string; // YYYY-MM-DD
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  student_id: string;
  admin_id: string | null;
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  start_time: string; // ISO 8601
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_paid: boolean;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: User;
}

export interface GoogleToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Google Calendar types
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: string;
}

// UI types
export interface TimeSlot {
  start: string; // HH:mm
  end: string;
  isAvailable: boolean;
  isBooked?: boolean;
  lesson?: Lesson;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
  isOverridden: boolean;
}

export interface LessonFormData {
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  start_time: string;
  notes?: string;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
}

export type UserRole = 'admin' | 'student' | null;
