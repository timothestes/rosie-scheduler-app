'use client';

import { useState } from 'react';
import { dayNames, formatTime24to12 } from '@/lib/utils';
import type { Availability } from '@/types';

interface AvailabilityEditorProps {
  availability: Availability[];
  onSave: (availability: Partial<Availability>[]) => Promise<void>;
  isLoading?: boolean;
}

interface DaySchedule {
  enabled: boolean;
  slots: { start: string; end: string }[];
}

type WeekSchedule = Record<number, DaySchedule>;

const DEFAULT_SLOT = { start: '09:00', end: '17:00' };

export default function AvailabilityEditor({
  availability,
  onSave,
  isLoading = false,
}: AvailabilityEditorProps) {
  // Initialize schedule from existing availability
  const initializeSchedule = (): WeekSchedule => {
    const schedule: WeekSchedule = {};
    
    for (let i = 0; i < 7; i++) {
      const dayAvailability = availability.filter((a) => a.day_of_week === i && a.is_recurring);
      
      schedule[i] = {
        enabled: dayAvailability.length > 0,
        slots: dayAvailability.length > 0
          ? dayAvailability.map((a) => ({
              start: a.start_time.substring(0, 5),
              end: a.end_time.substring(0, 5),
            }))
          : [{ ...DEFAULT_SLOT }],
      };
    }
    
    return schedule;
  };

  const [schedule, setSchedule] = useState<WeekSchedule>(initializeSchedule);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }));
  };

  const updateSlot = (day: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((slot, i) =>
          i === slotIndex ? { ...slot, [field]: value } : slot
        ),
      },
    }));
  };

  const addSlot = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...prev[day].slots, { ...DEFAULT_SLOT }],
      },
    }));
  };

  const removeSlot = (day: number, slotIndex: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((_, i) => i !== slotIndex),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    
    const newAvailability: Partial<Availability>[] = [];
    
    Object.entries(schedule).forEach(([day, daySchedule]) => {
      if (daySchedule.enabled) {
        daySchedule.slots.forEach((slot) => {
          newAvailability.push({
            day_of_week: parseInt(day),
            start_time: slot.start + ':00',
            end_time: slot.end + ':00',
            is_recurring: true,
          });
        });
      }
    });
    
    await onSave(newAvailability);
    setSaving(false);
  };

  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        options.push(
          `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        );
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
        <div 
          key={day} 
          className={`rounded-lg transition-all ${
            schedule[day].enabled 
              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 p-4' 
              : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {/* Day header - always visible, clickable */}
          <button
            type="button"
            onClick={() => toggleDay(day)}
            className={`w-full flex items-center justify-between ${
              schedule[day].enabled ? '' : 'py-3 px-4'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                schedule[day].enabled 
                  ? 'bg-indigo-600 border-indigo-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {schedule[day].enabled && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`font-medium ${
                schedule[day].enabled 
                  ? 'text-indigo-900 dark:text-indigo-100' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {dayNames[day]}
              </span>
            </div>
            
            {!schedule[day].enabled && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Click to add availability
              </span>
            )}
          </button>
          
          {/* Time slots - only when enabled */}
          {schedule[day].enabled && (
            <div className="mt-3 ml-8 space-y-2">
              {schedule[day].slots.map((slot, slotIndex) => (
                <div key={slotIndex} className="flex items-center gap-2">
                  <select
                    value={slot.start}
                    onChange={(e) => updateSlot(day, slotIndex, 'start', e.target.value)}
                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {formatTime24to12(time)}
                      </option>
                    ))}
                  </select>
                  
                  <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                  
                  <select
                    value={slot.end}
                    onChange={(e) => updateSlot(day, slotIndex, 'end', e.target.value)}
                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {formatTime24to12(time)}
                      </option>
                    ))}
                  </select>
                  
                  {schedule[day].slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlot(day, slotIndex)}
                      className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      title="Remove time slot"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => addSlot(day)}
                className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another time slot
              </button>
            </div>
          )}
        </div>
      ))}
      
      <div className="mt-6 flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving || isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
}
