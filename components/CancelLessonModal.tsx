'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';

interface CancelLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cancelSeries?: boolean) => Promise<void>;
  lessonDate?: Date;
  lessonType?: string;
  isRecurring?: boolean;
  futureLessonsCount?: number;
}

export default function CancelLessonModal({
  isOpen,
  onClose,
  onConfirm,
  lessonDate,
  lessonType,
  isRecurring = false,
  futureLessonsCount = 0,
}: CancelLessonModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cancelSeries, setCancelSeries] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCancelSeries(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(cancelSeries);
      onClose();
    } catch (error) {
      console.error('Error cancelling lesson:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatLessonDate = () => {
    if (!lessonDate) return null;
    return lessonDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Check if cancellation is within 24 hours
  const isWithin24Hours = lessonDate && (lessonDate.getTime() - Date.now()) < 24 * 60 * 60 * 1000;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Lesson" size="md">
      <div className="space-y-4">
        {/* Lesson Info */}
        <div className="text-center py-2">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {lessonType || 'Lesson'}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {formatLessonDate()}
          </p>
        </div>

        {/* Warning for late cancellation */}
        {isWithin24Hours && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 border border-amber-200 dark:border-amber-700">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Less than 24 hours notice — a 50% fee may apply
            </p>
          </div>
        )}

        {/* Cancel Series Option */}
        {isRecurring && futureLessonsCount > 0 && (
          <button
            type="button"
            onClick={() => setCancelSeries(!cancelSeries)}
            className={`w-full text-left rounded-lg px-4 py-3 border-2 transition-all ${
              cancelSeries
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${cancelSeries ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                  Cancel entire series
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  +{futureLessonsCount} more {futureLessonsCount === 1 ? 'lesson' : 'lessons'}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                cancelSeries 
                  ? 'border-red-500 bg-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {cancelSeries && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        )}

        {/* Cancellation Policy */}
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            Cancellation Policy
          </h4>
          <div className="text-center space-y-1.5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              24+ hours notice → Full refund
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Under 24 hours → 50% fee
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No-show → Full charge
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cancelling...
              </span>
            ) : cancelSeries ? (
              `Cancel ${futureLessonsCount + 1} Lessons`
            ) : (
              'Cancel Lesson'
            )}
          </button>
        </div>

        {/* Subtle disclaimer */}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          By cancelling, you agree to the cancellation policy
        </p>
      </div>
    </Modal>
  );
}
