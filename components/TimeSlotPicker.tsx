'use client';

import { formatTime24to12 } from '@/lib/utils';
import type { TimeSlot, Lesson } from '@/types';
import { getLessonType } from '@/config/lessonTypes';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSlotSelect: (time: string) => void;
  lessons?: Lesson[];
  selectedLessonType?: string;
  disabled?: boolean;
}

export default function TimeSlotPicker({
  slots,
  selectedSlot,
  onSlotSelect,
  lessons = [],
  selectedLessonType,
  disabled = false,
}: TimeSlotPickerProps) {
  const lessonDuration = selectedLessonType 
    ? (getLessonType(selectedLessonType)?.duration || 60)
    : 60;

  const isSlotBooked = (time: string): Lesson | undefined => {
    return lessons.find((lesson) => {
      const lessonStart = new Date(lesson.start_time);
      const slotHour = parseInt(time.split(':')[0]);
      const slotMinute = parseInt(time.split(':')[1]);
      return (
        lessonStart.getHours() === slotHour &&
        lessonStart.getMinutes() === slotMinute &&
        lesson.status !== 'cancelled'
      );
    });
  };

  const wouldOverlap = (time: string): boolean => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + lessonDuration * 60 * 1000);

    return lessons.some((lesson) => {
      if (lesson.status === 'cancelled') return false;
      const lessonStart = new Date(lesson.start_time);
      const lessonEnd = new Date(lesson.end_time);
      return slotStart < lessonEnd && slotEnd > lessonStart;
    });
  };

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No available time slots for this day
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {slots.map((slot) => {
        const bookedLesson = isSlotBooked(slot.start);
        const hasOverlap = !bookedLesson && wouldOverlap(slot.start);
        const isSelected = selectedSlot === slot.start;
        const isDisabled = disabled || !!bookedLesson || hasOverlap || !slot.isAvailable;

        return (
          <button
            key={slot.start}
            onClick={() => !isDisabled && onSlotSelect(slot.start)}
            disabled={isDisabled}
            className={`
              px-3 py-2 text-sm rounded-lg border transition-all
              ${isSelected 
                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500' 
                : ''}
              ${bookedLesson 
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 cursor-not-allowed' 
                : ''}
              ${hasOverlap && !bookedLesson 
                ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 cursor-not-allowed' 
                : ''}
              ${!slot.isAvailable && !bookedLesson 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed' 
                : ''}
              ${!isSelected && !isDisabled 
                ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30' 
                : ''}
            `}
            title={
              bookedLesson 
                ? `Booked: ${bookedLesson.lesson_type}` 
                : hasOverlap 
                  ? 'Would overlap with existing lesson'
                  : !slot.isAvailable 
                    ? 'Not available'
                    : ''
            }
          >
            {formatTime24to12(slot.start)}
          </button>
        );
      })}
    </div>
  );
}
