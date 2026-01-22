import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/zoom';

// GET /api/auth/zoom/callback - Handle Zoom OAuth callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Zoom OAuth error:', error);
    return NextResponse.redirect(new URL('/admin?zoom_error=auth_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/admin?zoom_error=no_code', request.url));
  }

  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.redirect(new URL('/admin?zoom_error=not_admin', request.url));
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/zoom/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert the token (update if exists, insert if not)
    const { error: upsertError } = await supabase
      .from('zoom_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('Failed to save Zoom tokens:', upsertError);
      return NextResponse.redirect(new URL('/admin?zoom_error=save_failed', request.url));
    }

    return NextResponse.redirect(new URL('/admin?zoom_connected=true', request.url));
  } catch (err) {
    console.error('Zoom callback error:', err);
    return NextResponse.redirect(new URL('/admin?zoom_error=exchange_failed', request.url));
  }
}
