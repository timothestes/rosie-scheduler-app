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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Availability</h3>
      
      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <div key={day} className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedule[day].enabled}
                  onChange={() => toggleDay(day)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 mr-3 dark:bg-gray-700"
                />
                <span className="font-medium text-gray-900 dark:text-white">{dayNames[day]}</span>
              </label>
              
              {schedule[day].enabled && (
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  + Add time slot
                </button>
              )}
            </div>
            
            {schedule[day].enabled && (
              <div className="space-y-2 ml-7">
                {schedule[day].slots.map((slot, slotIndex) => (
                  <div key={slotIndex} className="flex items-center space-x-2">
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
                    
                    <span className="text-gray-500 dark:text-gray-400">to</span>
                    
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
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex justify-end">
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
