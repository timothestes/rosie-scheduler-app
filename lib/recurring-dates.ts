// Pure recurring-lesson date generators. No framework imports so this module
// is trivially unit-testable and shared by the booking POST and preflight API.

// Generate weekly recurring lesson dates (same weekday/time each week).
export function generateWeeklyRecurringDates(startDate: Date, weeks: number): Date[] {
  const dates: Date[] = [];
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < weeks; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * 7);
    date.setHours(hours, minutes, 0, 0);
    dates.push(date);
  }
  return dates;
}

// Generate bi-weekly recurring lesson dates (every 14 days).
export function generateBiweeklyRecurringDates(startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * 14);
    date.setHours(hours, minutes, 0, 0);
    dates.push(date);
  }
  return dates;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return date;
    }
  }
  return null;
}

// Generate monthly recurring lesson dates (same relative weekday each month).
export function generateMonthlyRecurringDates(startDate: Date, months: number): Date[] {
  const dates: Date[] = [];
  const weekday = startDate.getDay();
  const weekOfMonth = Math.ceil(startDate.getDate() / 7);
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < months; i++) {
    const targetMonth = startDate.getMonth() + i;
    const targetYear = startDate.getFullYear() + Math.floor(targetMonth / 12);
    const adjustedMonth = ((targetMonth % 12) + 12) % 12;
    const date = getNthWeekdayOfMonth(targetYear, adjustedMonth, weekday, weekOfMonth);
    if (date) {
      date.setHours(hours, minutes, 0, 0);
      dates.push(date);
    }
  }
  return dates;
}

// Dispatch to the right generator based on plan frequency.
export function generateRecurringDates(
  startDate: Date,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  months: number
): Date[] {
  if (frequency === 'weekly') return generateWeeklyRecurringDates(startDate, months * 4);
  if (frequency === 'biweekly') return generateBiweeklyRecurringDates(startDate, months * 2);
  return generateMonthlyRecurringDates(startDate, months);
}
