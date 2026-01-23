import { createClient } from '@/lib/supabase/server';

const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_URL = 'https://api.zoom.us/v2';

interface ZoomToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface ZoomMeeting {
  id: number;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
}

export function getZoomAuthUrl(redirectUri: string): string {
  const clientId = process.env.ZOOM_CLIENT_ID;
  if (!clientId) {
    throw new Error('ZOOM_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return `${ZOOM_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Zoom credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Zoom token exchange error:', error);
    throw new Error('Failed to exchange code for tokens');
  }

  return response.json();
}

export async function refreshZoomToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Zoom credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Zoom token refresh error:', error);
    throw new Error('Failed to refresh Zoom token');
  }

  return response.json();
}

async function getValidAccessToken(adminId: string): Promise<string | null> {
  const supabase = await createClient();

  console.log('Looking up zoom_tokens for user_id:', adminId);

  const { data: tokenData, error } = await supabase
    .from('zoom_tokens')
    .select('*')
    .eq('user_id', adminId)
    .single();

  console.log('Zoom token lookup result:', { tokenData: tokenData ? 'found' : 'not found', error });

  if (!tokenData) {
    return null;
  }

  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();

  console.log('Token expires at:', expiresAt, 'Now:', now);

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      console.log('Token expired or expiring soon, refreshing...');
      const newTokens = await refreshZoomToken(tokenData.refresh_token);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

      await supabase
        .from('zoom_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', adminId);

      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh Zoom token:', error);
      return null;
    }
  }

  return tokenData.access_token;
}

// Export the token getter for batch operations
export async function getZoomAccessToken(adminId: string): Promise<string | null> {
  return getValidAccessToken(adminId);
}

export async function createZoomMeeting(
  adminId: string,
  topic: string,
  startTime: Date,
  durationMinutes: number,
  agenda?: string,
  accessToken?: string // Optional pre-fetched token for batch operations
): Promise<ZoomMeeting | null> {
  const token = accessToken || await getValidAccessToken(adminId);
  
  if (!token) {
    console.log('No valid Zoom access token available');
    return null;
  }

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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      agenda,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        auto_recording: 'none',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create Zoom meeting:', error);
    return null;
  }

  return response.json();
}

export async function deleteZoomMeeting(adminId: string, meetingId: string): Promise<boolean> {
  const accessToken = await getValidAccessToken(adminId);
  
  if (!accessToken) {
    console.log('No valid Zoom access token available');
    return false;
  }

  const response = await fetch(`${ZOOM_API_URL}/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    console.error('Failed to delete Zoom meeting:', error);
    return false;
  }

  return true;
}

export async function updateZoomMeeting(
  adminId: string,
  meetingId: string,
  updates: {
    topic?: string;
    start_time?: Date;
    duration?: number;
    agenda?: string;
  }
): Promise<boolean> {
  const accessToken = await getValidAccessToken(adminId);
  
  if (!accessToken) {
    console.log('No valid Zoom access token available');
    return false;
  }

  const body: Record<string, any> = {};
  if (updates.topic) body.topic = updates.topic;
  if (updates.start_time) body.start_time = updates.start_time.toISOString();
  if (updates.duration) body.duration = updates.duration;
  if (updates.agenda) body.agenda = updates.agenda;

  const response = await fetch(`${ZOOM_API_URL}/meetings/${meetingId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    console.error('Failed to update Zoom meeting:', error);
    return false;
  }

  return true;
}

export async function isZoomConnected(adminId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('zoom_tokens')
    .select('id')
    .eq('user_id', adminId)
    .single();

  return !!data;
}
