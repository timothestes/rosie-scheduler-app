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
  selectedDate?: Date;
  disabled?: boolean;
}

export default function TimeSlotPicker({
  slots,
  selectedSlot,
  onSlotSelect,
  lessons = [],
  selectedLessonType,
  selectedDate,
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
    // Use the selected date, or extract from first lesson, or fallback to today
    const baseDate = selectedDate || (lessons.length > 0 ? new Date(lessons[0].start_time) : new Date());
    const slotStart = new Date(baseDate);
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

  const hasUnavailableSlots = slots.some((slot) => {
    const bookedLesson = isSlotBooked(slot.start);
    const hasOverlap = !bookedLesson && wouldOverlap(slot.start);
    return bookedLesson || hasOverlap || !slot.isAvailable;
  });

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {slots.map((slot) => {
          const bookedLesson = isSlotBooked(slot.start);
          const hasOverlap = !bookedLesson && wouldOverlap(slot.start);
          const isSelected = selectedSlot === slot.start;
          const isUnavailable = !!bookedLesson || hasOverlap || !slot.isAvailable;
          const isDisabled = disabled || isUnavailable;

          return (
            <button
              key={slot.start}
              onClick={() => !isDisabled && onSlotSelect(slot.start)}
              disabled={isDisabled}
              className={`
                flex items-center justify-center h-12 text-sm font-medium rounded-lg border transition-all
                ${isSelected 
                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-md' 
                  : ''}
                ${isUnavailable && !isSelected
                  ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700/50 cursor-not-allowed line-through decoration-gray-400/50' 
                  : ''}
                ${!isSelected && !isDisabled 
                  ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm' 
                  : ''}
              `}
              title={
                bookedLesson 
                  ? `Booked: ${bookedLesson.lesson_type}` 
                  : hasOverlap 
                    ? 'This time overlaps with an existing lesson'
                    : !slot.isAvailable 
                      ? 'Not available'
                      : 'Click to select this time'
              }
            >
              {formatTime24to12(slot.start)}
            </button>
          );
        })}
      </div>
      
      {hasUnavailableSlots && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="line-through">Crossed out</span> times are unavailable
        </p>
      )}
    </div>
  );
}
