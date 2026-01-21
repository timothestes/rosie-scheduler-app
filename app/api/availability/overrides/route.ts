import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/availability/overrides - Get availability overrides
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const adminId = searchParams.get('adminId');

  let query = supabase
    .from('availability_overrides')
    .select('*');

  if (adminId) {
    query = query.eq('admin_id', adminId);
  }

  if (startDate) {
    query = query.gte('override_date', startDate);
  }

  if (endDate) {
    query = query.lte('override_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/availability/overrides - Create override
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { override_date, is_available, start_time, end_time } = body;

  // Upsert override (replace if exists for same date)
  const { data: existing } = await supabase
    .from('availability_overrides')
    .select('id')
    .eq('admin_id', user.id)
    .eq('override_date', override_date)
    .single();

  let result;
  if (existing) {
    result = await supabase
      .from('availability_overrides')
      .update({ is_available, start_time, end_time })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('availability_overrides')
      .insert({
        admin_id: user.id,
        override_date,
        is_available,
        start_time,
        end_time,
      })
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}

// DELETE /api/availability/overrides - Delete override
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const overrideId = searchParams.get('id');
  const overrideDate = searchParams.get('date');

  let query = supabase
    .from('availability_overrides')
    .delete()
    .eq('admin_id', user.id);

  if (overrideId) {
    query = query.eq('id', overrideId);
  } else if (overrideDate) {
    query = query.eq('override_date', overrideDate);
  } else {
    return NextResponse.json({ error: 'Missing id or date parameter' }, { status: 400 });
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
