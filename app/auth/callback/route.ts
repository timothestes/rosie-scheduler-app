import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL('/error', request.url))
    }

    // Store Google tokens for Calendar API access
    if (data.session?.provider_token && data.session?.provider_refresh_token) {
      const expiresAt = new Date(Date.now() + (data.session.expires_in || 3600) * 1000);
      
      await supabase.from('google_tokens').upsert({
        user_id: data.session.user.id,
        access_token: data.session.provider_token,
        refresh_token: data.session.provider_refresh_token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'user_id',
      });
    }
  }

  // Redirect to the 'next' URL or home
  return NextResponse.redirect(new URL(next, request.url))
}
