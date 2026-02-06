# Manual Setup Instructions

This document contains all manual setup steps required before running the application.

## Google Cloud Console Setup

### 1. Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (e.g., `timothestes-youtube-project`)
3. Navigate to **APIs & Services** → **Library**
4. Search for "Google Calendar API"
5. Click on it and press **Enable**

### 2. Update OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Click **Edit App**
3. Under **Scopes**, click **Add or Remove Scopes**
4. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar.readonly` (View your calendars)
   - `email` (already added)
   - `profile` (already added)
   - `openid` (already added)
5. Click **Update** and **Save and Continue**

### 3. Update OAuth Client Redirect URIs

1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/google-calendar/callback` (for development)
   - `https://your-production-domain.com/api/auth/google-calendar/callback` (for production)
4. Click **Save**

### 4. Add Google Credentials to Environment

Add your Google OAuth credentials to `.env.local`:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Supabase Database Setup

### 1. Create Tables

Run the following SQL in your Supabase SQL Editor (or use the `supabase/seed.sql` file):

```sql
see supabase/seed.sql
```

### 5. Add Your Admin User

**Important:** After signing up with Google for the first time, add your email to the admins table:

```sql
INSERT INTO admins (email) VALUES ('your-email@gmail.com');
```

Replace `'your-email@gmail.com'` with your actual Google account email.

---

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# For Google Calendar API (admin calendar overlay)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# For Zoom OAuth Integration (see Zoom Setup section below)
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
```

---

## Zoom OAuth Setup

This app uses Zoom's OAuth API to automatically create unique Zoom meetings for each lesson. Follow these steps to set up Zoom integration.

### 1. Create a Zoom App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click **Develop** → **Build App** (top right)
4. Choose **General App** as the app type
5. Click **Create**

### 2. Configure App Settings

#### Basic Information
- **App Name**: Your app name (e.g., "Rosie Scheduler")
- **Short Description**: Brief description of your app
- **Company Name**: Your company or personal name

#### OAuth Settings
1. Navigate to the **App Credentials** or **OAuth** section
2. Under **OAuth Redirect URLs**, add:
   - For development: `http://localhost:3000/api/auth/zoom/callback`
   - For production: `https://your-domain.com/api/auth/zoom/callback`
3. Click **Add** for each URL

#### Scopes
1. Navigate to the **Scopes** section
2. Click **Add Scopes**
3. Add the following scopes:
   - `meeting:write:meeting` - Create and manage meetings
   - `meeting:delete:meeting` - Delete meetings
   - `meeting:update:meeting` - Update existing meetings
   - `user:read:user` - Read user information (for getting Zoom user ID)
4. Click **Done** to save

### 3. Get Your Credentials

1. Navigate to **App Credentials**
2. Copy your **Client ID** and **Client Secret**
3. Add them to your `.env.local`:
   ```env
   ZOOM_CLIENT_ID=your_client_id_here
   ZOOM_CLIENT_SECRET=your_client_secret_here
   ```

### 4. App Management Type

- When prompted, select **User-managed** (not Admin-managed)
- This allows individual users to authorize the app with their own Zoom accounts

### 5. Publish or Test Mode

- For development/testing, leave the app in **Development** mode
- Only you (and users you add to the app) can authorize it
- For production with multiple users, you'll need to publish the app

### 6. Connect Your Zoom Account

1. Start your development server: `make dev`
2. Go to `/admin` in your browser
3. In the **Quick Actions** section, click **Connect Zoom**
4. You'll be redirected to Zoom to authorize the app
5. After authorization, you'll be redirected back with a success message

### 7. Database Migration

Run this SQL in your Supabase SQL Editor to add the required columns:

```sql
-- Add Zoom columns to lessons table (Zoom uses Server-to-Server OAuth, no token table needed)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS zoom_join_url TEXT;
```

### Troubleshooting Zoom Integration

- **"Zoom not connected" error**: Make sure you've completed the OAuth flow by clicking "Connect Zoom" in the admin dashboard
- **Token expired**: The app automatically refreshes tokens, but if issues persist, reconnect via the admin dashboard
- **Scopes error**: Ensure all 4 scopes are added in the Zoom Marketplace app settings

---

## Verification Checklist

- [ ] Google Calendar API enabled in Google Cloud Console
- [ ] OAuth scopes updated (calendar.readonly)
- [ ] All Supabase tables created
- [ ] RLS policies enabled
- [ ] Triggers set up
- [ ] Admin email added to admins table
- [ ] Environment variables configured
- [ ] Zoom app created in Zoom Marketplace
- [ ] Zoom OAuth redirect URLs configured
- [ ] Zoom scopes added (meeting:write, meeting:delete, meeting:update, user:read)
- [ ] Zoom connected via admin dashboard
