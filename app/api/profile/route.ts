import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/profile - Get current user's profile
export async function GET() {
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

  const isAdmin = !!admin;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, avatar_url, discount_percent, address, is_returning_student, created_at')
    .eq('id', user.id)
    .single();

  if (error) {
    // User might not exist in users table yet
    return NextResponse.json({ 
      id: user.id,
      email: user.email,
      full_name: null,
      phone: null,
      discount_percent: 0,
      address: null,
      is_returning_student: null,
      isAdmin,
    });
  }

  return NextResponse.json({ ...profile, isAdmin });
}

// Validation helpers
const NAME_MAX_LENGTH = 50;
const isValidName = (name: string) => /^[a-zA-Z\s\-']+$/.test(name);
const isValidPhone = (phone: string) => /^\d{10}$/.test(phone.replace(/\D/g, ''));

// PATCH /api/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { full_name, phone, is_returning_student } = body;

  // Check if this is just a returning student status update
  const isOnlyReturningStudentUpdate = typeof is_returning_student === 'boolean' && !full_name && !phone;

  if (isOnlyReturningStudentUpdate) {
    // Just update the returning student status
    const { data, error } = await supabase
      .from('users')
      .update({
        is_returning_student,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  // Server-side validation for full profile update
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }

  const nameParts = full_name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    return NextResponse.json({ error: 'Please provide first and last name' }, { status: 400 });
  }

  for (const part of nameParts) {
    if (part.length > NAME_MAX_LENGTH) {
      return NextResponse.json({ error: `Name parts must be ${NAME_MAX_LENGTH} characters or less` }, { status: 400 });
    }
    if (!isValidName(part)) {
      return NextResponse.json({ error: 'Name can only contain letters, spaces, hyphens, and apostrophes' }, { status: 400 });
    }
  }

  if (!phone || typeof phone !== 'string' || !isValidPhone(phone)) {
    return NextResponse.json({ error: 'Valid 10-digit phone number is required' }, { status: 400 });
  }

  // Upsert the user profile
  const updateData: Record<string, unknown> = {
    id: user.id,
    email: user.email!,
    full_name,
    phone,
    updated_at: new Date().toISOString(),
  };
  
  // Only include is_returning_student if explicitly provided
  if (typeof is_returning_student === 'boolean') {
    updateData.is_returning_student = is_returning_student;
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(updateData, {
      onConflict: 'id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json(data);
}
