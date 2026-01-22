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

  const selectedLessonType = getLessonType(lessonType);

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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lesson Type
        </label>
        <div className="space-y-2">
          {lessonTypes.map((type) => (
            <label
              key={type.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                lessonType === type.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
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
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: type.color }}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900 dark:text-white">{formatRate(type.rate)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatDuration(type.duration)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Location
        </label>
        <div className="flex space-x-4">
          <label
            className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
              locationType === 'zoom'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
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
            className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
              locationType === 'in-person'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
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
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Any specific topics you'd like to cover?"
        />
      </div>

      {/* Cancellation Policy */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-transparent dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Cancellation Policy</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          {cancellationPolicy.terms.slice(0, 3).map((term, index) => (
            <li key={index} className="flex items-start">
              <span className="text-gray-400 dark:text-gray-500 mr-2">•</span>
              {term}
            </li>
          ))}
        </ul>
        <label className="flex items-center mt-3">
          <input
            type="checkbox"
            checked={agreedToPolicy}
            onChange={(e) => setAgreedToPolicy(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            I agree to the cancellation policy
          </span>
        </label>
      </div>

      {/* Summary */}
      {selectedLessonType && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between text-lg font-medium text-gray-900 dark:text-white">
            <span>Total</span>
            <span>{formatRate(selectedLessonType.rate)}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Payment will be handled separately
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !agreedToPolicy}
          className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Booking...' : 'Book Lesson'}
        </button>
      </div>
    </form>
  );
}
