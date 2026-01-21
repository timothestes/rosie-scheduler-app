import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration } from '@/config/lessonTypes';

// GET /api/lessons - Get lessons
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const studentId = searchParams.get('studentId');
  const status = searchParams.get('status');

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  let query = supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .order('start_time', { ascending: true });

  // If not admin, only show user's own lessons
  if (!admin) {
    query = query.eq('student_id', user.id);
  } else if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (startDate) {
    query = query.gte('start_time', startDate);
  }

  if (endDate) {
    query = query.lte('start_time', endDate);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Lessons GET error:', error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/lessons - Create a new lesson
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { lesson_type, location_type, start_time, notes } = body;

  // Calculate end time based on lesson type duration
  const duration = getLessonDuration(lesson_type);
  const startDate = new Date(start_time);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  // Get an admin to assign the lesson to
  const { data: admins } = await supabase
    .from('admins')
    .select('email')
    .limit(1);

  let adminId = null;
  if (admins && admins.length > 0) {
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', admins[0].email)
      .single();
    adminId = adminUser?.id;
  }

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from('lessons')
    .select('id')
    .neq('status', 'cancelled')
    .lt('start_time', endDate.toISOString())
    .gt('end_time', startDate.toISOString());

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'This time slot is already booked' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id: user.id,
      admin_id: adminId,
      lesson_type,
      location_type,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      notes,
      status: 'scheduled',
      is_paid: false,
    })
    .select('*, student:users!lessons_student_id_fkey(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
