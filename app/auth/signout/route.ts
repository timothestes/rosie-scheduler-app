import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect('/login');
}

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect('/login');
}
