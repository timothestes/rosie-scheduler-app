import { createClient } from '@/lib/supabase/server';
import type { GoogleCalendarEvent } from '@/types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export async function getGoogleTokens(userId: string) {
  const supabase = await createClient();
  
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return tokens;
}

export async function refreshGoogleToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', await response.text());
      return null;
    }

    const data: TokenResponse = await response.json();
    
    const supabase = await createClient();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    
    await supabase
      .from('google_tokens')
      .update({
        access_token: data.access_token,
        expires_at: expiresAt,
      })
      .eq('user_id', userId);

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    return null;
  }
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = await getGoogleTokens(userId);
  
  if (!tokens) {
    return null;
  }
  
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  
  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return await refreshGoogleToken(userId, tokens.refresh_token);
  }
  
  return tokens.access_token;
}

export async function fetchGoogleCalendarEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch calendar events:', await response.text());
      return [];
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return [];
  }
}

// Create a Google Calendar event
export async function createGoogleCalendarEvent(
  adminUserId: string,
  summary: string,
  description: string,
  startTime: Date,
  endTime: Date,
  location?: string
): Promise<{ id: string; htmlLink: string } | null> {
  const accessToken = await getValidAccessToken(adminUserId);
  
  if (!accessToken) {
    console.error('No valid Google access token for creating calendar event');
    return null;
  }

  try {
    const event = {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Los_Angeles', // TODO: Make configurable
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      ...(location && { location }),
    };

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      console.error('Failed to create calendar event:', await response.text());
      return null;
    }

    const data = await response.json();
    return { id: data.id, htmlLink: data.htmlLink };
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    return null;
  }
}

// Delete a Google Calendar event
export async function deleteGoogleCalendarEvent(
  adminUserId: string,
  eventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(adminUserId);
  
  if (!accessToken) {
    console.error('No valid Google access token for deleting calendar event');
    return false;
  }

  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      console.error('Failed to delete calendar event:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    return false;
  }
}

// Note: generateGoogleCalendarUrl moved to lib/utils.ts for client-side usage
