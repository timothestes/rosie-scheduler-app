'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import type { Lesson } from '@/types';

interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  onSuccess: (updatedLesson: Lesson) => void;
}

export default function EditLessonModal({
  isOpen,
  onClose,
  lesson,
  onSuccess,
}: EditLessonModalProps) {
  const [notes, setNotes] = useState(lesson.notes || '');
  const [locationType, setLocationType] = useState<'zoom' | 'in-person'>(lesson.location_type);
  const [locationAddress, setLocationAddress] = useState(lesson.location_address || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when lesson changes
  useEffect(() => {
    if (isOpen) {
      setNotes(lesson.notes || '');
      setLocationType(lesson.location_type);
      setLocationAddress(lesson.location_address || '');
      setError(null);
    }
  }, [isOpen, lesson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || null,
          location_type: locationType,
          location_address: locationType === 'in-person' ? (locationAddress || null) : null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        onSuccess(updated);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save changes');
      }
    } catch {
      setError('Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startTime = new Date(lesson.start_time);
  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Lesson" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Lesson summary (read-only context) */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          {dateStr} · {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>

        {/* Location type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLocationType('zoom')}
              className={`flex-1 py-2 px-3 text-sm rounded-md border transition-colors ${
                locationType === 'zoom'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📹 Zoom
            </button>
            <button
              type="button"
              onClick={() => setLocationType('in-person')}
              className={`flex-1 py-2 px-3 text-sm rounded-md border transition-colors ${
                locationType === 'in-person'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📍 In-Person
            </button>
          </div>
          {locationType === 'in-person' && (
            <input
              type="text"
              value={locationAddress}
              onChange={e => setLocationAddress(e.target.value)}
              placeholder="Student address"
              className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          )}
          {locationType === 'zoom' && lesson.zoom_join_url && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Note: the existing Zoom link will remain unchanged.
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes for this lesson..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
