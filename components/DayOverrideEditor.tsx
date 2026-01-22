'use client';

import { useState } from 'react';
import { formatTime24to12 } from '@/lib/utils';

interface DayOverrideEditorProps {
  date: Date;
  currentOverride?: {
    is_available: boolean;
    start_time: string | null;
    end_time: string | null;
  } | null;
  weeklyAvailability?: { start_time: string; end_time: string }[];
  onSave: (data: { is_available: boolean; start_time?: string; end_time?: string }) => Promise<void>;
  onReset?: () => Promise<void>;
  onCancel: () => void;
}

export default function DayOverrideEditor({
  date,
  currentOverride,
  weeklyAvailability,
  onSave,
  onReset,
  onCancel,
}: DayOverrideEditorProps) {
  const [mode, setMode] = useState<'available' | 'blocked'>(
    currentOverride ? (currentOverride.is_available ? 'available' : 'blocked') : 'available'
  );
  const [startTime, setStartTime] = useState(
    currentOverride?.start_time?.substring(0, 5) || '09:00'
  );
  const [endTime, setEndTime] = useState(
    currentOverride?.end_time?.substring(0, 5) || '17:00'
  );
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      is_available: mode === 'available',
      start_time: mode === 'available' ? startTime + ':00' : undefined,
      end_time: mode === 'available' ? endTime + ':00' : undefined,
    });
    setSaving(false);
  };

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Set custom availability for <span className="font-medium text-gray-900 dark:text-white">{formattedDate}</span> only. 
        This won&apos;t affect your weekly schedule.
      </p>

      {weeklyAvailability && weeklyAvailability.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-1">Weekly schedule for this day:</p>
          {weeklyAvailability.map((slot, i) => (
            <p key={i} className="text-gray-700 dark:text-gray-300">
              {formatTime24to12(slot.start_time.substring(0, 5))} - {formatTime24to12(slot.end_time.substring(0, 5))}
            </p>
          ))}
        </div>
      )}

      {/* Mode Selection */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMode('available')}
          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
            mode === 'available'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              mode === 'available' ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {mode === 'available' && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Available with custom hours</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Set specific hours for this day</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode('blocked')}
          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
            mode === 'blocked'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              mode === 'blocked' ? 'border-red-500 bg-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {mode === 'blocked' && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Not available</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Block this entire day</p>
            </div>
          </div>
        </button>
      </div>

      {/* Time Selection (only when available) */}
      {mode === 'available' && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom hours</p>
          <div className="flex items-center gap-3">
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {formatTime24to12(time)}
                </option>
              ))}
            </select>
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {formatTime24to12(time)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
            mode === 'blocked' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {saving ? 'Saving...' : mode === 'blocked' ? 'Block This Day' : 'Save Custom Hours'}
        </button>
      </div>

      {/* Reset Option - only show if there's an existing override */}
      {currentOverride && onReset && (
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              await onReset();
              setSaving(false);
            }}
            disabled={saving}
            className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Reset to weekly schedule
          </button>
        </div>
      )}
    </div>
  );
}
