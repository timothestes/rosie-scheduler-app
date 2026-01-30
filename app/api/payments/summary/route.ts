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
  // Join with users to get discount_percent
  const startDateTime = new Date(startDate);
  startDateTime.setHours(0, 0, 0, 0);
  
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, lesson_type, start_time, is_recurring, recurring_series_id, paid_at, student_id, student:users!lessons_student_id_fkey(discount_percent)')
    .eq('is_paid', true)
    .neq('status', 'cancelled')
    .gte('paid_at', startDateTime.toISOString())
    .lte('paid_at', endDateTime.toISOString());

  if (error) {
    console.error('Error fetching payment data:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }

  // Calculate totals by grouping into payments:
  // - Non-recurring lessons: each lesson is a payment
  // - Recurring lessons: group by student + month + series = one monthly payment
  let totalAmount = 0;
  let totalDiscount = 0;
  let recurringAmount = 0;
  let recurringCount = 0;
  const byType: { [key: string]: { count: number; amount: number; name: string } } = {};
  
  // Track recurring lessons grouped by student + series + month
  const recurringPayments = new Map<string, { 
    lessons: typeof lessons, 
    lessonType: string,
    discountPercent: number 
  }>();

  for (const lesson of lessons || []) {
    const lessonType = getLessonType(lesson.lesson_type);
    const discountPercent = (lesson.student as { discount_percent?: number })?.discount_percent || 0;
    
    // Track by type (count all lessons)
    if (!byType[lesson.lesson_type]) {
      byType[lesson.lesson_type] = {
        count: 0,
        amount: 0,
        name: lessonType?.name || lesson.lesson_type,
      };
    }
    byType[lesson.lesson_type].count += 1;
    
    if (lesson.is_recurring && lesson.recurring_series_id) {
      // Group recurring lessons by student + series + month
      const lessonDate = new Date(lesson.start_time);
      const monthKey = `${lesson.student_id}-${lesson.recurring_series_id}-${lessonDate.getFullYear()}-${lessonDate.getMonth()}`;
      
      if (!recurringPayments.has(monthKey)) {
        recurringPayments.set(monthKey, { 
          lessons: [], 
          lessonType: lesson.lesson_type,
          discountPercent 
        });
      }
      recurringPayments.get(monthKey)!.lessons!.push(lesson);
      recurringCount += 1;
    } else {
      // Non-recurring: each lesson is a separate payment
      const baseRate = lessonType?.rate ?? 0;
      const discountAmount = baseRate * (discountPercent / 100);
      const rate = discountPercent > 0 ? Math.ceil(baseRate - discountAmount) : baseRate;
      
      totalAmount += rate;
      totalDiscount += (baseRate - rate);
      byType[lesson.lesson_type].amount += rate;
    }
  }
  
  // Process recurring payments (one monthly payment per group)
  recurringPayments.forEach(({ lessonType, discountPercent }) => {
    const monthlyRate = getWeeklyMonthlyRate(lessonType);
    const discountAmount = monthlyRate * (discountPercent / 100);
    const rate = discountPercent > 0 ? Math.ceil(monthlyRate - discountAmount) : monthlyRate;
    
    totalAmount += rate;
    totalDiscount += (monthlyRate - rate);
    recurringAmount += rate;
    
    if (byType[lessonType]) {
      byType[lessonType].amount += rate;
    }
  });

  // Get count of active recurring students (unique students with future recurring lessons)
  // Include student discount info
  const { data: activeRecurringLessons } = await supabase
    .from('lessons')
    .select('student_id, lesson_type, student:users!lessons_student_id_fkey(discount_percent)')
    .eq('is_recurring', true)
    .eq('status', 'scheduled')
    .gte('start_time', new Date().toISOString());

  // Calculate monthly recurring revenue (unique students × their monthly rate, with discounts applied)
  const uniqueRecurringStudents = new Map<string, { lessonType: string; discountPercent: number }>(); // student_id -> { lessonType, discountPercent }
  for (const lesson of activeRecurringLessons || []) {
    if (!uniqueRecurringStudents.has(lesson.student_id)) {
      uniqueRecurringStudents.set(lesson.student_id, {
        lessonType: lesson.lesson_type,
        discountPercent: (lesson.student as { discount_percent?: number })?.discount_percent || 0,
      });
    }
  }

  let monthlyRecurringRevenue = 0;
  uniqueRecurringStudents.forEach(({ lessonType, discountPercent }) => {
    const baseRate = getWeeklyMonthlyRate(lessonType);
    // Round up to nearest dollar when discount is applied
    const discountedRate = discountPercent > 0 
      ? Math.ceil(baseRate * (1 - discountPercent / 100))
      : baseRate;
    monthlyRecurringRevenue += discountedRate;
  });

  return NextResponse.json({
    totalAmount,
    totalDiscount,
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
