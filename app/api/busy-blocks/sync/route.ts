import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncGoogleBusyBlocks } from '@/lib/google-busy-sync';
import { getPrimaryAdminUserId } from '@/lib/primary-admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();
  return admin ? user : null;
}

// POST /api/busy-blocks/sync - "Sync now": run a sync pass immediately.
export async function POST() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const result = await syncGoogleBusyBlocks();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

// GET /api/busy-blocks/sync - sync health for the admin staleness banner.
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const adminId = await getPrimaryAdminUserId();
  if (!adminId) return NextResponse.json(null);
  const { data } = await createAdminClient()
    .from('google_sync_state')
    .select('last_attempt_at, last_success_at, last_error')
    .eq('admin_id', adminId)
    .single();
  return NextResponse.json(data ?? null);
}
