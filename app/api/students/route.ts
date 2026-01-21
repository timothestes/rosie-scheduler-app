import { createClient } from '@/lib/supabase/server';
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
