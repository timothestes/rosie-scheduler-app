import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/students - Get all students (admin only)
export async function GET(request: NextRequest) {
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

  // Get all users who are not admins (i.e., students)
  const { data: admins } = await supabase
    .from('admins')
    .select('email');

  const adminEmails = admins?.map((a) => a.email) || [];

  const { data: students, error } = await supabase
    .from('users')
    .select('*')
    .not('email', 'in', `(${adminEmails.join(',')})`)
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(students);
}

// POST /api/students - Create a new student (admin only)
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
  const { full_name, email, phone, address, discount_percent = 0, send_invite = true } = body;

  if (!full_name?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Create the auth user (triggers handle_new_user to create public.users row)
  let newUserId: string;
  if (send_invite) {
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim(),
      { data: { full_name: full_name.trim() } }
    );
    if (inviteError) {
      if (inviteError.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'A student with this email already exists' }, { status: 409 });
      }
      console.error('Error inviting user:', inviteError);
      return NextResponse.json({ error: 'Failed to create student account' }, { status: 500 });
    }
    newUserId = inviteData.user.id;
  } else {
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { full_name: full_name.trim() },
    });
    if (createError) {
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return NextResponse.json({ error: 'A student with this email already exists' }, { status: 409 });
      }
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: 'Failed to create student account' }, { status: 500 });
    }
    newUserId = createData.user.id;
  }

  // Update the auto-created public.users row with the extra profile fields
  // Use admin client to bypass RLS (admin can't update another user's row with normal client)
  const { data: updatedUser, error: updateError } = await adminClient
    .from('users')
    .update({
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      discount_percent: Math.min(100, Math.max(0, Number(discount_percent) || 0)),
      is_admin_created: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', newUserId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating user profile:', updateError);
    // User was created in auth but profile update failed — return partial success
    return NextResponse.json({ error: 'Student account created but profile update failed' }, { status: 500 });
  }

  return NextResponse.json(updatedUser, { status: 201 });
}
