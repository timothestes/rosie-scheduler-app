import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all unpaid lessons that have already occurred (past due)
  // Future lessons are not considered "unpaid" yet
  const now = new Date().toISOString();
  
  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, lesson_type, location_type, start_time, student:users!lessons_student_id_fkey(id, email, full_name)')
    .eq('is_paid', false)
    .eq('status', 'scheduled')
    .lt('start_time', now)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching unpaid lessons:', error);
    return NextResponse.json({ error: 'Failed to fetch unpaid lessons' }, { status: 500 });
  }

  return NextResponse.json({ lessons: lessons || [] });
}
