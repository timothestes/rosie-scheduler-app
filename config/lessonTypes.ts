export interface LessonType {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  rate: number; // individual lesson price (billed on day of lesson)
  weeklyMonthlyRate: number; // total monthly cost for weekly lessons (billed monthly)
  color: string; // for UI display
  isTrialLesson?: boolean; // trial lessons can't be recurring
}

export const lessonTypes: LessonType[] = [
  {
    id: 'first_lesson_thirty',
    name: 'First Lesson (30 min)',
    description: 'Half price! Focus on setting goals and evaluating points of strength and growth.',
    duration: 30,
    rate: 20, // half of $40
    weeklyMonthlyRate: 20,
    color: '#10B981', // green
    isTrialLesson: true,
  },
  {
    id: 'first_lesson_sixty',
    name: 'First Lesson (1 hour)',
    description: 'Half price! Focus on setting goals and evaluating points of strength and growth.',
    duration: 60,
    rate: 40, // half of $80
    weeklyMonthlyRate: 40,
    color: '#10B981', // green
    isTrialLesson: true,
  },
  {
    id: 'voice_thirty',
    name: '30 Minute Voice Lesson',
    description: 'A regular one-on-one voice lesson',
    duration: 30,
    rate: 40,
    weeklyMonthlyRate: 145, // ~$15 savings vs 4x$40=$160
    color: '#3B82F6', // blue
  },
  {
    id: 'voice_sixty',
    name: '1 Hour Voice Lesson',
    description: 'A full hour one-on-one voice lesson',
    duration: 60,
    rate: 80,
    weeklyMonthlyRate: 305, // ~$15 savings vs 4x$80=$320
    color: '#8B5CF6', // purple
  },
];

export function getLessonType(id: string): LessonType | undefined {
  return lessonTypes.find((type) => type.id === id);
}

export function getLessonDuration(id: string): number {
  const type = getLessonType(id);
  return type?.duration ?? 60;
}

export function getLessonRate(id: string): number {
  const type = getLessonType(id);
  return type?.rate ?? 0;
}

export function getWeeklyMonthlyRate(id: string): number {
  const type = getLessonType(id);
  return type?.weeklyMonthlyRate ?? type?.rate ?? 0;
}

// Calculate per-lesson price when on weekly plan
export function getWeeklyPerLessonRate(id: string): number {
  const type = getLessonType(id);
  if (!type) return 0;
  return type.weeklyMonthlyRate / 4;
}

// Calculate savings per month on weekly plan
export function getWeeklySavings(id: string): number {
  const type = getLessonType(id);
  if (!type || type.isTrialLesson) return 0;
  return (type.rate * 4) - type.weeklyMonthlyRate;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}

export function formatRate(rate: number): string {
  if (rate === 0) {
    return 'Free';
  }
  // Format as whole number (discounts are rounded up to nearest dollar)
  return `$${Math.round(rate)}`;
}
