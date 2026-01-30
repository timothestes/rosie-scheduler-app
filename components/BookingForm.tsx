'use client';

import { useState, useEffect } from 'react';
import { lessonTypes, getLessonType, formatDuration, formatRate, getWeeklySavings } from '@/config/lessonTypes';
import { cancellationPolicy } from '@/config/cancellationPolicy';

interface BookingFormProps {
  selectedDate: Date;
  selectedTime: string;
  onSubmit: (data: BookingData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isFirstLesson?: boolean;
  maxDuration?: number; // Maximum available time in minutes for the selected slot
  discountPercent?: number; // Student's discount percentage (0-100)
}

export interface BookingData {
  lesson_type: string;
  location_type: 'in-person' | 'zoom';
  notes: string;
  is_recurring: boolean;
  recurring_frequency?: 'weekly';
  recurring_months?: number; // For weekly: how many months to book
}

export default function BookingForm({
  selectedDate,
  selectedTime,
  onSubmit,
  onCancel,
  isLoading = false,
  isFirstLesson = false,
  maxDuration,
  discountPercent = 0,
}: BookingFormProps) {
  // Filter lesson types: show trial lessons only for first-time students
  // Also filter by max duration if specified
  const availableLessonTypes = lessonTypes.filter((type) => {
    const matchesTrialFilter = isFirstLesson ? type.isTrialLesson : !type.isTrialLesson;
    const fitsInSlot = maxDuration ? type.duration <= maxDuration : true;
    return matchesTrialFilter && fitsInSlot;
  });
  
  const [lessonType, setLessonType] = useState(availableLessonTypes[0]?.id || lessonTypes[0].id);
  const [locationType, setLocationType] = useState<'in-person' | 'zoom'>('zoom');
  const [notes, setNotes] = useState('');
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(1);

  const selectedLessonType = getLessonType(lessonType);
  const isTrialLesson = selectedLessonType?.isTrialLesson ?? false;
  
  // Reset recurring if user selects a trial lesson
  useEffect(() => {
    if (isTrialLesson && isRecurring) {
      setIsRecurring(false);
    }
  }, [isTrialLesson, isRecurring]);

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
      is_recurring: isRecurring && !isTrialLesson,
      recurring_frequency: isRecurring && !isTrialLesson ? 'weekly' : undefined,
      recurring_months: isRecurring && !isTrialLesson ? recurringMonths : undefined,
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

  const getDayName = () => {
    return selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getTimeOnly = () => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Calculate total lessons for weekly recurring
  const totalWeeklyLessons = recurringMonths * 4;
  
  // Apply discount to a rate (rounds up to nearest dollar)
  const applyDiscount = (rate: number) => {
    if (discountPercent <= 0) return rate;
    return Math.ceil(rate * (1 - discountPercent / 100));
  };
  
  // Calculate pricing (with discount applied)
  const getTotalPrice = () => {
    if (!selectedLessonType) return 0;
    if (isRecurring && !isTrialLesson) {
      return applyDiscount(selectedLessonType.weeklyMonthlyRate * recurringMonths);
    }
    return applyDiscount(selectedLessonType.rate);
  };
  
  // Get original price (without discount) for comparison
  const getOriginalPrice = () => {
    if (!selectedLessonType) return 0;
    if (isRecurring && !isTrialLesson) {
      return selectedLessonType.weeklyMonthlyRate * recurringMonths;
    }
    return selectedLessonType.rate;
  };

  const monthlySavings = selectedLessonType ? getWeeklySavings(selectedLessonType.id) : 0;
  const hasDiscount = discountPercent > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selected Time Display */}
      <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Selected Time</p>
        <p className="text-lg text-gray-900 dark:text-white">{formatSelectedDateTime()}</p>
      </div>

      {/* Lesson Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Lesson Type
        </label>
        <div className="space-y-3">
          {availableLessonTypes.map((type) => {
            const showRecurringPrice = isRecurring && !type.isTrialLesson;
            
            return (
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
                    className={`w-4 h-4 flex-shrink-0 rounded-full mr-3 border-2 ${
                      lessonType === type.id ? 'border-indigo-500' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: type.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                      {type.isTrialLesson && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                          50% Off
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  {hasDiscount ? (
                    <div>
                      <p className="text-sm text-gray-400 dark:text-gray-500 line-through whitespace-nowrap">
                        {showRecurringPrice ? `${formatRate(type.weeklyMonthlyRate)}/mo` : formatRate(type.rate)}
                      </p>
                      <p className="font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                        {showRecurringPrice 
                          ? `${formatRate(applyDiscount(type.weeklyMonthlyRate))}/mo` 
                          : formatRate(applyDiscount(type.rate))}
                      </p>
                    </div>
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {showRecurringPrice ? `${formatRate(type.weeklyMonthlyRate)}/mo` : formatRate(type.rate)}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDuration(type.duration)}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Weekly Plan Toggle - Only show for non-trial lessons */}
      {!isTrialLesson && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 dark:text-white">Weekly Lessons (Monthly Plan)</p>
                {!isRecurring && monthlySavings > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
                    Save ~${monthlySavings}/month
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isRecurring 
                  ? `Every ${getDayName()} at ${getTimeOnly()}`
                  : 'Best value! Weekly lessons billed monthly'
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
                How long would you like to commit?
              </label>
              <div className="flex space-x-2">
                {[1, 3, 6].map((months) => (
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
                    {months} {months === 1 ? 'month' : 'months'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {totalWeeklyLessons} lessons total • Billed {formatRate(selectedLessonType?.weeklyMonthlyRate ?? 0)}/month
              </p>
            </div>
          )}
        </div>
      )}

      {/* Location Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Location
        </label>
        <div className="flex space-x-3">
          <label
            className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
              locationType === 'zoom'
                ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-gray-700 shadow-sm'
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
                ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-gray-700 shadow-sm'
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
        {locationType === 'in-person' && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Central Coast area only.</span> If you live further than 20 minutes from Santa Maria/Orcutt, a travel fee of $10–$15 may apply.
            </p>
          </div>
        )}
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
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 p-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
          {hasDiscount && (
            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                🎉 Rosie is giving you an extra {discountPercent}% off!
              </span>
            </div>
          )}
          {isRecurring && !isTrialLesson ? (
            <>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                <span>Monthly Rate</span>
                <span className="text-green-600 dark:text-green-400">
                  {hasDiscount && (
                    <span className="text-base text-gray-400 dark:text-gray-500 line-through mr-2">
                      {formatRate(selectedLessonType.weeklyMonthlyRate)}
                    </span>
                  )}
                  {formatRate(applyDiscount(selectedLessonType.weeklyMonthlyRate))}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalWeeklyLessons} weekly lessons over {recurringMonths} {recurringMonths === 1 ? 'month' : 'months'}
              </p>
              {monthlySavings > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                  Save ~{formatRate(monthlySavings)}/mo vs individual lessons!
                </p>
              )}
            </>
          ) : (
            <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
              <span>Total</span>
              <span>
                {hasDiscount && (
                  <span className="text-base text-gray-400 dark:text-gray-500 line-through mr-2">
                    {formatRate(selectedLessonType.rate)}
                  </span>
                )}
                <span className={hasDiscount ? 'text-green-600 dark:text-green-400' : ''}>
                  {formatRate(applyDiscount(selectedLessonType.rate))}
                </span>
              </span>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {isRecurring 
              ? 'Monthly plans are billed at the start of each month, with payment due on the 1st.' 
              : 'Payment will be due at the end of the lesson'}
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
          {isLoading ? 'Booking...' : isRecurring ? `Book ${totalWeeklyLessons} Lessons` : 'Book Lesson'}
        </button>
      </div>
    </form>
  );
}
