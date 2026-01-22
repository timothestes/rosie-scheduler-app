export interface LessonType {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  rate: number; // in dollars
  monthlyRate: number; // discounted rate for monthly recurring lessons
  color: string; // for UI display
}

export const lessonTypes: LessonType[] = [
  {
    id: 'standard',
    name: 'Standard Lesson',
    description: 'A regular one-on-one lesson',
    duration: 60,
    rate: 75,
    monthlyRate: 65,
    color: '#3B82F6', // blue
  },
  {
    id: 'extended',
    name: 'Extended Lesson',
    description: 'A longer session for more in-depth learning',
    duration: 90,
    rate: 100,
    monthlyRate: 85,
    color: '#8B5CF6', // purple
  },
  {
    id: 'trial',
    name: 'Trial Lesson',
    description: 'Introductory lesson for new students',
    duration: 30,
    rate: 0,
    monthlyRate: 0,
    color: '#10B981', // green
  },
  {
    id: 'intensive',
    name: 'Intensive Session',
    description: 'Extended practice session',
    duration: 120,
    rate: 140,
    monthlyRate: 120,
    color: '#F59E0B', // amber
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

export function getMonthlyRate(id: string): number {
  const type = getLessonType(id);
  return type?.monthlyRate ?? type?.rate ?? 0;
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
  return `$${rate}`;
}
