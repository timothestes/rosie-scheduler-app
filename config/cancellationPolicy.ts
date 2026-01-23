export interface CancellationPolicy {
  noticePeriodHours: number;
  lateCancellationFee: number; // flat fee in dollars
  terms: string[];
  allowStudentCancellation: boolean;
}

export const cancellationPolicy: CancellationPolicy = {
  noticePeriodHours: 24,
  lateCancellationFee: 10,
  allowStudentCancellation: true,
  terms: [
    'Cancellations or rescheduling require at least 24 hours\' notice.',
    '1 reschedule per month included.',
    'Lessons cancelled with less than 24 hours\' notice will incur a $10 fee added to your next lesson.',
  ],
};

export function canCancelWithoutFee(lessonStartTime: Date): boolean {
  const now = new Date();
  const hoursUntilLesson = (lessonStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilLesson >= cancellationPolicy.noticePeriodHours;
}

export function getCancellationFee(lessonStartTime: Date): number {
  if (canCancelWithoutFee(lessonStartTime)) {
    return 0;
  }
  return cancellationPolicy.lateCancellationFee;
}

export function getTimeUntilLesson(lessonStartTime: Date): string {
  const now = new Date();
  const diffMs = lessonStartTime.getTime() - now.getTime();
  
  if (diffMs < 0) {
    return 'Lesson has already started';
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} until lesson`;
  }
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min until lesson`;
  }
  
  return `${minutes} minutes until lesson`;
}
