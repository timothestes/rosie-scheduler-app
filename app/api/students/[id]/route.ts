import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/students/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Get student
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Get student's lessons
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('student_id', id)
    .order('start_time', { ascending: false });

  // Get student notes
  const { data: notes } = await supabase
    .from('student_notes')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    student,
    lessons: lessons || [],
    notes: notes || [],
  });
}

// PATCH /api/students/[id] - Update student (e.g., discount)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { discount_percent } = body;

  // Validate discount_percent if provided
  if (discount_percent !== undefined) {
    if (typeof discount_percent !== 'number' || discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json(
        { error: 'discount_percent must be a number between 0 and 100' },
        { status: 400 }
      );
    }
  }

  // Update student
  const updateData: { discount_percent?: number; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (discount_percent !== undefined) {
    updateData.discount_percent = discount_percent;
  }

  const { data: student, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }

  return NextResponse.json(student);
}
