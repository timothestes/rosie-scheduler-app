'use client';

import { useState } from 'react';
import { lessonTypes, getLessonType, formatDuration, formatRate } from '@/config/lessonTypes';
import { cancellationPolicy } from '@/config/cancellationPolicy';

interface BookingFormProps {
  selectedDate: Date;
  selectedTime: string;
  onSubmit: (data: BookingData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface BookingData {
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  notes: string;
  is_recurring: boolean;
  recurring_months?: number;
}

// Helper to get the ordinal suffix (1st, 2nd, 3rd, 4th)
function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Helper to get which week of month (1st, 2nd, 3rd, 4th, 5th)
function getWeekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

// Helper to format the recurring pattern
function formatRecurringPattern(date: Date): string {
  const weekOfMonth = getWeekOfMonth(date);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${getOrdinal(weekOfMonth)} ${dayName} of every month`;
}

export default function BookingForm({
  selectedDate,
  selectedTime,
  onSubmit,
  onCancel,
  isLoading = false,
}: BookingFormProps) {
  const [lessonType, setLessonType] = useState(lessonTypes[0].id);
  const [locationType, setLocationType] = useState<'in-person' | 'zoom'>('zoom');
  const [notes, setNotes] = useState('');
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(6);

  const selectedLessonType = getLessonType(lessonType);
  const displayRate = isRecurring ? selectedLessonType?.monthlyRate : selectedLessonType?.rate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreedToPolicy) {
      alert('Please agree to the cancellation policy');
      return;
    }

    await onSubmit({
      lesson_type: lessonType,
      location_type: locationType,
      notes,
      is_recurring: isRecurring,
      recurring_months: isRecurring ? recurringMonths : undefined,
    });
  };

  const formatSelectedDateTime = () => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selected Time Display */}
      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 border border-transparent dark:border-indigo-800">
        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Selected Time</p>
        <p className="text-lg text-indigo-900 dark:text-indigo-100">{formatSelectedDateTime()}</p>
      </div>

      {/* Lesson Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Lesson Type
        </label>
        <div className="space-y-3">
          {lessonTypes.map((type) => (
            <label
              key={type.id}
              className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                lessonType === type.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md ring-1 ring-indigo-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center">
                <input
                  type="radio"
                  name="lessonType"
                  value={type.id}
                  checked={lessonType === type.id}
                  onChange={(e) => setLessonType(e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`w-3 h-3 rounded-full mr-3 ring-2 ring-offset-2 dark:ring-offset-gray-800 ${
                    lessonType === type.id ? 'ring-indigo-500' : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: type.color }}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {isRecurring ? formatRate(type.monthlyRate) : formatRate(type.rate)}
                  </p>
                  {isRecurring && type.rate !== type.monthlyRate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 line-through">
                      {formatRate(type.rate)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatDuration(type.duration)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Monthly Recurring Toggle */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 dark:text-white">Make this monthly</p>
              {!isRecurring && selectedLessonType && selectedLessonType.rate > selectedLessonType.monthlyRate && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
                  Save ${selectedLessonType.rate - selectedLessonType.monthlyRate}/lesson
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isRecurring 
                ? `Schedule on the ${formatRecurringPattern(selectedDate)}`
                : 'Commit to regular lessons and save on every session'
              }
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRecurring(!isRecurring)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isRecurring ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isRecurring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {isRecurring && (
          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of months
            </label>
            <div className="flex space-x-2">
              {[3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setRecurringMonths(months)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    recurringMonths === months
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {months} months
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Save {selectedLessonType && selectedLessonType.rate > selectedLessonType.monthlyRate 
                ? formatRate((selectedLessonType.rate - selectedLessonType.monthlyRate) * recurringMonths)
                : '$0'} total with monthly pricing
            </p>
          </div>
        )}
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Location
        </label>
        <div className="flex space-x-3">
          <label
            className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
              locationType === 'zoom'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800 hover:shadow-sm'
            }`}
          >
            <input
              type="radio"
              name="locationType"
              value="zoom"
              checked={locationType === 'zoom'}
              onChange={() => setLocationType('zoom')}
              className="sr-only"
            />
            <span className="text-xl mr-2">📹</span>
            <span className="font-medium text-gray-900 dark:text-white">Zoom</span>
          </label>
          <label
            className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
              locationType === 'in-person'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800 hover:shadow-sm'
            }`}
          >
            <input
              type="radio"
              name="locationType"
              value="in-person"
              checked={locationType === 'in-person'}
              onChange={() => setLocationType('in-person')}
              className="sr-only"
            />
            <span className="text-xl mr-2">📍</span>
            <span className="font-medium text-gray-900 dark:text-white">In-Person</span>
          </label>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 p-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          placeholder="Any specific topics you'd like to cover?"
        />
      </div>

      {/* Cancellation Policy */}
      <div className="bg-gray-100 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Cancellation Policy</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          {cancellationPolicy.terms.slice(0, 3).map((term, index) => (
            <li key={index} className="flex items-start">
              <span className="text-gray-400 dark:text-gray-500 mr-2">•</span>
              {term}
            </li>
          ))}
        </ul>
        <label className="flex items-center mt-4 p-2 -mx-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600/50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={agreedToPolicy}
            onChange={(e) => setAgreedToPolicy(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-500 dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            I agree to the cancellation policy
          </span>
        </label>
      </div>

      {/* Summary */}
      {selectedLessonType && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600 min-h-[120px]">
          {isRecurring ? (
            <>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>{recurringMonths} lessons × {formatRate(selectedLessonType.monthlyRate)}</span>
                <span>{formatRate(selectedLessonType.monthlyRate * recurringMonths)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                <span>Total ({recurringMonths} months)</span>
                <span className="text-green-600 dark:text-green-400">{formatRate(selectedLessonType.monthlyRate * recurringMonths)}</span>
              </div>
              {selectedLessonType.rate > selectedLessonType.monthlyRate && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                  You save {formatRate((selectedLessonType.rate - selectedLessonType.monthlyRate) * recurringMonths)} vs single lessons!
                </p>
              )}
            </>
          ) : (
            <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
              <span>Total</span>
              <span>{formatRate(selectedLessonType.rate)}</span>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Payment will be handled separately
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !agreedToPolicy}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          {isLoading ? 'Booking...' : isRecurring ? `Book ${recurringMonths} Lessons` : 'Book Lesson'}
        </button>
      </div>
    </form>
  );
}
