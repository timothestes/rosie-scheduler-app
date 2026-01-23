import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getLessonType, getWeeklyMonthlyRate } from '@/config/lessonTypes';

export async function GET(request: Request) {
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

  // Get date range from query params
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  // Query lessons that are paid within the date range
  // We use paid_at to determine when payment was received (not when lesson occurs)
  const startDateTime = new Date(startDate);
  startDateTime.setHours(0, 0, 0, 0);
  
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, lesson_type, start_time, is_recurring, paid_at')
    .eq('is_paid', true)
    .neq('status', 'cancelled')
    .gte('paid_at', startDateTime.toISOString())
    .lte('paid_at', endDateTime.toISOString());

  if (error) {
    console.error('Error fetching payment data:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }

  // Calculate totals
  let totalAmount = 0;
  let recurringAmount = 0;
  let recurringCount = 0;
  const byType: { [key: string]: { count: number; amount: number; name: string } } = {};

  for (const lesson of lessons || []) {
    const lessonType = getLessonType(lesson.lesson_type);
    // Use weekly monthly rate for recurring lessons, regular rate otherwise
    // Note: For weekly plans, weeklyMonthlyRate is the total monthly cost (not per lesson)
    // We divide by 4 to get the per-lesson cost for tracking purposes
    const rate = lesson.is_recurring 
      ? ((lessonType?.weeklyMonthlyRate ?? lessonType?.rate ?? 0) / 4)
      : (lessonType?.rate ?? 0);
    
    totalAmount += rate;

    if (lesson.is_recurring) {
      recurringAmount += rate;
      recurringCount += 1;
    }

    if (!byType[lesson.lesson_type]) {
      byType[lesson.lesson_type] = {
        count: 0,
        amount: 0,
        name: lessonType?.name || lesson.lesson_type,
      };
    }
    byType[lesson.lesson_type].count += 1;
    byType[lesson.lesson_type].amount += rate;
  }

  // Get count of active recurring students (unique students with future recurring lessons)
  const { data: activeRecurringLessons } = await supabase
    .from('lessons')
    .select('student_id, lesson_type')
    .eq('is_recurring', true)
    .eq('status', 'scheduled')
    .gte('start_time', new Date().toISOString());

  // Calculate monthly recurring revenue (unique students × their monthly rate)
  const uniqueRecurringStudents = new Map<string, string>(); // student_id -> lesson_type
  for (const lesson of activeRecurringLessons || []) {
    if (!uniqueRecurringStudents.has(lesson.student_id)) {
      uniqueRecurringStudents.set(lesson.student_id, lesson.lesson_type);
    }
  }

  let monthlyRecurringRevenue = 0;
  uniqueRecurringStudents.forEach((lessonType) => {
    monthlyRecurringRevenue += getWeeklyMonthlyRate(lessonType);
  });

  return NextResponse.json({
    totalAmount,
    lessonCount: lessons?.length || 0,
    byType,
    recurring: {
      amount: recurringAmount,
      count: recurringCount,
      monthlyRevenue: monthlyRecurringRevenue,
      activeStudents: uniqueRecurringStudents.size,
    },
  });
}
