import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return NextResponse.json({ connected: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Check if we have valid Zoom tokens
  const { data: tokens, error: tokenError } = await supabase
    .from('zoom_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokens) {
    return NextResponse.json({ connected: false });
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = new Date(tokens.expires_at) <= new Date(Date.now() + 5 * 60 * 1000);

  return NextResponse.json({ 
    connected: true,
    expired: isExpired,
    expiresAt: tokens.expires_at
  });
}
