# Schedule a Lesson with Rosie

A lesson scheduling application built with Next.js and Supabase, featuring role-based access for administrators and students.

> **⚠️ Important:** Before running the app, complete the manual setup steps in [SETUP.md](SETUP.md)

## Features

### Authentication
- Google OAuth sign-in via Supabase
- Role-based access control (Admin vs Student)
- Persistent sessions

### User Roles

#### Admins
- Stored in dedicated `admins` table in Supabase
- Access to admin-specific features
- Can manage availability and view all students

#### Students
- Regular authenticated users (not in admins table)
- Can view available lesson slots and book lessons

### Navigation
- Top navigation bar with responsive design
- Sign in/sign out button pinned at top right
- Mobile-friendly interface

**Admin Navigation:**
- Calendar
- Students

**Student Navigation:**
- Schedule Lessons

### Admin Features

#### Dashboard (Home)
- Overview of upcoming lessons
- Total bookings summary
- Quick stats and metrics
- Recent activity

#### Calendar Page
- Set availability times for each day
- Create repeating availability patterns with configurable durations
- Edit availability on a per-day basis
- View all scheduled lessons
- **Overlay admin's Google Calendar events** (read-only) to help with scheduling
- Visual distinction between availability slots and personal calendar events

#### Students Page
- View list of all students
- See student lesson history
- Manage student information (instant confirmation)
- Choose lesson type (in-person or Zoom)
- View Zoom meeting link for virtual lessons
- View upcoming scheduled lessons
- Add booked lessons to Google Calendar
- Cancel lessons (subject to cancellation policy)
- View payment status for lessons
- Send balance reminder emails to students with unpaid lessons

### Student Features

##Location options (in-person, Zoom, or both)
- Any additional metadata

#### Cancellation Policy (`config/cancellationPolicy.ts`)
- Cancellation terms and conditions
- Cancellation rate/fee
- Notice period requirements

#### Email Configuration
- Email reminder system (v2 - logic placeholder for now)
- Balance reminder emails for unpaid lesson
### Configuration
 (includes payment status, location type)
- `student_notes` - Private admin notes about students
#### Lesson Types (`config/lessonTypes.ts`)
- Lesson name/type
- Description
- Rate/price
- Duration
- Any additional metadata

#### Cancellation Policy (`config/cancellationPolicy.ts`)
- Cancellation terms and conditions
- Cancellation rate/fee
- Notice period requirements

## Database Schema

### Tables
- `admins` - List of admin users (email-based)
- `availability` - Admin availability slots
- `lessons` - Scheduled lesson bookings
- `users` - User profiles (managed by Supabase Auth)

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Authentication:** Supabase Auth (Google OAuth)
- **Database:** Supabase (PostgreSQL with TIMESTAMPTZ columns)
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Date Management:** date-fns for date parsing, formatting, and manipulation
- **Calendar UI:** Custom calendar component built with Tailwind CSS for mobile responsiveness

> **📋 Prerequisites:** Complete all steps in [SETUP.md](SETUP.md) before proceeding.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Zoom OAuth (see SETUP.md for detailed instructions)
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
```

3. Run the development server:
```bash
make dev
```

4. Build for production:
```bash
make build
```

## Requirements Summary
- Mobile-responsive design
- Role-based UI rendering
- Repeating availability patterns
- Per-day availability editing
- Lesson booking system (instant confirmation)
- Configurable lesson types
- Configurable cancellation policy
- In-person and Zoom lesson options
- Payment tracking (paid/unpaid status)
- Private student notes for admins
- Google Calendar integration for students
- **Google Calendar overlay for admin scheduling view**
- ISO 8601 format for data transfer

### Calendar Component
- Custom-built calendar UI using Tailwind CSS
- Mobile-first responsive design
- Month/week/day view navigation
- Visual indicators for available/booked/blocked slots

### Payment & Booking
- Payment tracking via checkbox (paid/unpaid)
- Instant booking confirmation
- Payment handled outside the app

### Integrations
- Google Calendar export for booked lessons (students)
- **Google Calendar API integration for admin calendar overlay**
- OAuth scope: `calendar.readonly` for viewing admin's personal calendar
- Zoom meeting link display from environment variable
- Email notifications (framework v1, logic v2)1, logic v2)
- ISO 8601 format for data transfer

### Calendar Component
- Custom-built calendar UI using Tailwind CSS
- Mobile-first responsive design
- Month/week/day view navigation
- Visual indicators for available/booked/blocked slots
- Configurable lesson types
- Configurable cancellation policy
