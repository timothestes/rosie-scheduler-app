import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/availability - Get all availability
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  let query = supabase
    .from('availability')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (adminId) {
    query = query.eq('admin_id', adminId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/availability - Create/update availability
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (adminError || !admin) {
    console.error('Admin check failed:', adminError?.message, 'User email:', user.email);
    return NextResponse.json({ 
      error: 'Admin access required. Make sure your email is in the admins table.',
      userEmail: user.email 
    }, { status: 403 });
  }

  const body = await request.json();
  const { availability, replaceAll = true } = body;

  if (replaceAll) {
    // Delete existing recurring availability
    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('admin_id', user.id)
      .eq('is_recurring', true);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
    }
  }

  // Insert new availability
  const newAvailability = availability.map((slot: any) => ({
    ...slot,
    admin_id: user.id,
  }));

  console.log('Inserting availability:', JSON.stringify(newAvailability, null, 2));

  const { data, error } = await supabase
    .from('availability')
    .insert(newAvailability)
    .select();

  if (error) {
    console.error('Insert error:', error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json(data);
}
