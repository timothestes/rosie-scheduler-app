import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // User ID passed from auth initiation
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=missing_params`);
  }

  const supabase = await createClient();

  // Verify the user is still logged in and matches the state
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=auth_mismatch`);
  }

  // Exchange code for tokens
  const redirectUri = `${baseUrl}/api/auth/google-calendar/callback`;
  
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for tokens:', errorText);
      return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    
    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in database
    const { error: upsertError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('Failed to store Google tokens:', upsertError);
      return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=storage_failed`);
    }

    return NextResponse.redirect(`${baseUrl}/admin/calendar?google_connected=true`);
  } catch (err) {
    console.error('Error in Google Calendar OAuth callback:', err);
    return NextResponse.redirect(`${baseUrl}/admin/calendar?google_error=unknown`);
  }
}
