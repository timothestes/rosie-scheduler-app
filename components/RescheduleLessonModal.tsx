'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { getLessonType } from '@/config/lessonTypes';
import type { Lesson } from '@/types';

interface RescheduleLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  onSuccess: (updated: Lesson) => void;
}

const pad = (n: number) => n.toString().padStart(2, '0');

// 30-min slots 6:00 AM–9:30 PM (mirrors AdminScheduleLessonModal).
const timeSlots = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 21 && m === 30) break;
      const value = `${pad(h)}:${pad(m)}`;
      const label = new Date(`2000-01-01T${value}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      slots.push({ value, label });
    }
  }
  return slots;
})();

type ConflictInfo = { status: 'available' | 'conflict'; reason: 'overlap' | 'commute_buffer' | null };

export default function RescheduleLessonModal({
  isOpen, onClose, lesson, onSuccess,
}: RescheduleLessonModalProps) {
  const start = new Date(lesson.start_time);
  const initialDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const initialTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [notify, setNotify] = useState(true);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when reopened / lesson changes
  useEffect(() => {
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
      setNotify(true);
      setConflict(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lesson]);

  const buildStart = () => {
    const [hh, mm] = time.split(':').map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const unchanged = date === initialDate && time === initialTime;

  // Debounced live conflict preview
  useEffect(() => {
    if (!isOpen || unchanged) { setConflict(null); return; }
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/lessons/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lesson_type: lesson.lesson_type,
            location_type: lesson.location_type,
            start_time: buildStart().toISOString(),
            exclude_lesson_id: lesson.id,
            student_id: lesson.student_id,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          const occ = data.occurrences?.[0];
          setConflict(occ ? { status: occ.status, reason: occ.reason } : null);
        }
      } catch {
        // Preview is advisory; ignore failures.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, isOpen]);

  const hasConflict = conflict?.status === 'conflict';
  const conflictMsg = conflict?.reason === 'commute_buffer'
    ? 'Too close to an in-person lesson (30-min travel buffer).'
    : 'This time overlaps another lesson.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: buildStart().toISOString(), notify_student: notify }),
      });
      if (res.ok) {
        onSuccess(await res.json());
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reschedule');
      }
    } catch {
      setError('Failed to reschedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lessonTypeName = getLessonType(lesson.lesson_type)?.name || lesson.lesson_type;
  const currentLabel = start.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const showZoomNote = lesson.location_type === 'zoom' && !!lesson.zoom_join_url;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Lesson" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          {lessonTypeName} · Currently {currentLabel}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New date</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New time</label>
            <select
              value={time}
              onChange={e => setTime(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timeSlots.map(slot => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live conflict preview */}
        {!unchanged && (
          <div className="text-sm">
            {checking ? (
              <p className="text-gray-500 dark:text-gray-400">Checking availability…</p>
            ) : hasConflict ? (
              <p className="text-amber-700 dark:text-amber-400">⚠ {conflictMsg}</p>
            ) : conflict ? (
              <p className="text-green-600 dark:text-green-400">✓ This slot is free</p>
            ) : null}
          </div>
        )}

        {showZoomNote && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The existing Zoom link stays the same.
          </p>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Email student the new date/time</span>
        </label>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

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
            disabled={isSubmitting || unchanged}
            className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Rescheduling…' : hasConflict ? 'Reschedule anyway' : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
