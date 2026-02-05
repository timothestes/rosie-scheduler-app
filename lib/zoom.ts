/**
 * Zoom Server-to-Server OAuth Integration
 * 
 * This uses Zoom's Server-to-Server OAuth which doesn't require user authorization.
 * Meetings are created on the account that owns the Server-to-Server app.
 * 
 * Required env vars:
 * - ZOOM_ACCOUNT_ID
 * - ZOOM_CLIENT_ID
 * - ZOOM_CLIENT_SECRET
 */

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_URL = 'https://api.zoom.us/v2';

interface ZoomMeeting {
  id: number;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
}

// Cache the access token in memory (server-side)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid access token using Server-to-Server OAuth
 * Tokens are cached and refreshed automatically
 */
async function getServerToServerToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    console.error('Zoom Server-to-Server credentials not configured. Need: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET');
    return null;
  }

  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  console.log('Fetching new Zoom Server-to-Server access token...');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Zoom token error:', response.status, error);
      return null;
    }

    const data = await response.json();
    
    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    console.log('Zoom access token obtained successfully');
    return data.access_token;
  } catch (error) {
    console.error('Failed to get Zoom access token:', error);
    return null;
  }
}

/**
 * Check if Zoom is configured (Server-to-Server)
 */
export function isZoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}

/**
 * Check if Zoom is connected - with Server-to-Server, it's always "connected" if configured
 */
export async function isZoomConnected(_adminId?: string): Promise<boolean> {
  return isZoomConfigured();
}

/**
 * Get Zoom access token for API calls
 * For Server-to-Server, we don't need adminId anymore
 */
export async function getZoomAccessToken(_adminId?: string): Promise<string | null> {
  return getServerToServerToken();
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(
  _adminId: string, // Kept for API compatibility, not used
  topic: string,
  startTime: Date,
  durationMinutes: number,
  agenda?: string,
  accessToken?: string
): Promise<ZoomMeeting | null> {
  const token = accessToken || await getServerToServerToken();
  
  if (!token) {
    console.error('No valid Zoom access token available');
    return null;
  }

  try {
    const response = await fetch(`${ZOOM_API_URL}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        type: 2, // Scheduled meeting
        start_time: startTime.toISOString(),
        duration: durationMinutes,
        timezone: 'America/Los_Angeles',
        agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          waiting_room: false,
          auto_recording: 'none',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create Zoom meeting:', response.status, error);
      return null;
    }

    const meeting = await response.json();
    console.log('Zoom meeting created:', meeting.id);
    return meeting;
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    return null;
  }
}

/**
 * Delete a Zoom meeting
 */
export async function deleteZoomMeeting(_adminId: string, meetingId: string): Promise<boolean> {
  const token = await getServerToServerToken();
  
  if (!token) {
    console.error('No valid Zoom access token available');
    return false;
  }

  try {
    const response = await fetch(`${ZOOM_API_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      console.error('Failed to delete Zoom meeting:', response.status, error);
      return false;
    }

    console.log('Zoom meeting deleted:', meetingId);
    return true;
  } catch (error) {
    console.error('Error deleting Zoom meeting:', error);
    return false;
  }
}

/**
 * Update a Zoom meeting
 */
export async function updateZoomMeeting(
  _adminId: string,
  meetingId: string,
  updates: {
    topic?: string;
    start_time?: Date;
    duration?: number;
    agenda?: string;
  }
): Promise<boolean> {
  const token = await getServerToServerToken();
  
  if (!token) {
    console.error('No valid Zoom access token available');
    return false;
  }

  try {
    const body: Record<string, unknown> = {};
    if (updates.topic) body.topic = updates.topic;
    if (updates.start_time) body.start_time = updates.start_time.toISOString();
    if (updates.duration) body.duration = updates.duration;
    if (updates.agenda) body.agenda = updates.agenda;

    const response = await fetch(`${ZOOM_API_URL}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      console.error('Failed to update Zoom meeting:', response.status, error);
      return false;
    }

    console.log('Zoom meeting updated:', meetingId);
    return true;
  } catch (error) {
    console.error('Error updating Zoom meeting:', error);
    return false;
  }
}

// Legacy functions for backwards compatibility
/** @deprecated Use Server-to-Server OAuth - no auth URL needed */
export function getZoomAuthUrl(_redirectUri: string): string {
  return '';
}

/** @deprecated Use Server-to-Server OAuth - no code exchange needed */
export async function exchangeCodeForTokens(_code: string, _redirectUri: string): Promise<never> {
  throw new Error('OAuth flow is deprecated - using Server-to-Server OAuth');
}
