export interface CancellationPolicy {
  noticePeriodHours: number;
  cancellationFeePercent: number;
  terms: string[];
  allowStudentCancellation: boolean;
}

export const cancellationPolicy: CancellationPolicy = {
  noticePeriodHours: 24,
  cancellationFeePercent: 50,
  allowStudentCancellation: true,
  terms: [
    'Lessons cancelled with at least 24 hours notice will receive a full refund or credit.',
    'Lessons cancelled with less than 24 hours notice may be subject to a 50% cancellation fee.',
    'No-shows will be charged the full lesson rate.',
    'In case of emergency, please contact us as soon as possible to discuss options.',
    'Rescheduling is available up to 2 hours before the lesson time.',
  ],
};

export function canCancelWithoutFee(lessonStartTime: Date): boolean {
  const now = new Date();
  const hoursUntilLesson = (lessonStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilLesson >= cancellationPolicy.noticePeriodHours;
}

export function getCancellationFee(lessonRate: number, lessonStartTime: Date): number {
  if (canCancelWithoutFee(lessonStartTime)) {
    return 0;
  }
  return Math.round(lessonRate * (cancellationPolicy.cancellationFeePercent / 100));
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
