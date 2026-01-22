import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return NextResponse.json({ connected: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Check if we have Google tokens
  const { data: tokens, error: tokenError } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (tokenError || !tokens) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({ 
    connected: true,
    expiresAt: tokens.expires_at
  });
}
