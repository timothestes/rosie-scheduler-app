'use client';

import { useState } from 'react';
import Modal from './Modal';
import { cancellationPolicy } from '@/config/cancellationPolicy';

interface CancelLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  lessonDate?: Date;
  lessonType?: string;
}

export default function CancelLessonModal({
  isOpen,
  onClose,
  onConfirm,
  lessonDate,
  lessonType,
}: CancelLessonModalProps) {
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!agreedToPolicy) return;
    
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error cancelling lesson:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAgreedToPolicy(false);
    onClose();
  };

  const formatLessonDate = () => {
    if (!lessonDate) return null;
    return lessonDate.toLocaleDateString('en-US', {
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Cancel Lesson" size="md">
      <div className="space-y-5">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-gray-900 dark:text-white font-medium text-lg">
            Are you sure you want to cancel this lesson?
          </p>
          {lessonDate && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              {lessonType && <span className="font-medium">{lessonType}</span>}
              {lessonType && ' · '}
              {formatLessonDate()}
            </p>
          )}
        </div>

        {/* Cancellation Policy */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
            <svg
              className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Cancellation Policy
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            {cancellationPolicy.terms.slice(0, 3).map((term, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gray-400 dark:text-gray-500 mr-2 mt-0.5">•</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Acknowledgment Checkbox */}
        <label className="flex items-start cursor-pointer group">
          <input
            type="checkbox"
            checked={agreedToPolicy}
            onChange={(e) => setAgreedToPolicy(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-red-600 focus:ring-red-500"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            I understand and agree to the cancellation policy
          </span>
        </label>

        {/* Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Keep Lesson
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!agreedToPolicy || isLoading}
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
            ) : (
              'Cancel Lesson'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
