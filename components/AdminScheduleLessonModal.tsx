'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { lessonTypes, formatRate, getWeeklyMonthlyRate, getBiweeklyMonthlyRate } from '@/config/lessonTypes';
import type { User, Availability, AvailabilityOverride } from '@/types';

interface AdminScheduleLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User;
  onSuccess: () => void;
}

export default function AdminScheduleLessonModal({
  isOpen,
  onClose,
  student,
  onSuccess,
}: AdminScheduleLessonModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [lessonType, setLessonType] = useState('voice_thirty');
  const [locationType, setLocationType] = useState<'zoom' | 'in-person'>('zoom');
  const [locationAddress, setLocationAddress] = useState(student.address || '');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [recurringMonths, setRecurringMonths] = useState(1);
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Availability for "outside window" warning
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [outsideWindow, setOutsideWindow] = useState(false);

  // Reset form when student changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setDate(today);
      setTime('10:00');
      setLessonType('voice_thirty');
      setLocationType('zoom');
      setLocationAddress(student.address || '');
      setNotes('');
      setIsRecurring(false);
      setRecurringFrequency('weekly');
      setRecurringMonths(1);
      setSendEmail(true);
      setError(null);
    }
  }, [isOpen, student]);

  // Fetch availability windows once
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      fetch('/api/availability').then(r => r.json()),
      fetch('/api/availability/overrides').then(r => r.json()),
    ]).then(([avail, ovr]) => {
      setAvailability(Array.isArray(avail) ? avail : []);
      setOverrides(Array.isArray(ovr) ? ovr : []);
    }).catch(() => {});
  }, [isOpen]);

  // Check if selected date+time falls outside normal availability
  useEffect(() => {
    if (!date || !time) { setOutsideWindow(false); return; }

    const selectedDate = new Date(`${date}T${time}`);
    const dayOfWeek = selectedDate.getDay();
    const [hh, mm] = time.split(':').map(Number);
    const minuteOfDay = hh * 60 + mm;

    // Check for date override first
    const override = overrides.find(o => o.override_date === date);
    if (override) {
      if (!override.is_available) { setOutsideWindow(true); return; }
      if (override.start_time && override.end_time) {
        const [oh, om] = override.start_time.split(':').map(Number);
        const [eh, em] = override.end_time.split(':').map(Number);
        const inWindow = minuteOfDay >= oh * 60 + om && minuteOfDay < eh * 60 + em;
        setOutsideWindow(!inWindow);
        return;
      }
    }

    // Check regular availability
    const dayWindows = availability.filter(a => a.day_of_week === dayOfWeek && a.is_recurring);
    if (dayWindows.length === 0) { setOutsideWindow(true); return; }

    const inAnyWindow = dayWindows.some(w => {
      const [sh, sm] = w.start_time.split(':').map(Number);
      const [eh, em] = w.end_time.split(':').map(Number);
      return minuteOfDay >= sh * 60 + sm && minuteOfDay < eh * 60 + em;
    });
    setOutsideWindow(!inAnyWindow);
  }, [date, time, availability, overrides]);

  const selectedType = lessonTypes.find(t => t.id === lessonType);

  const getDisplayRate = () => {
    if (!selectedType) return '';
    if (!isRecurring) return formatRate(selectedType.rate);
    if (recurringFrequency === 'weekly') return `${formatRate(getWeeklyMonthlyRate(lessonType))}/mo`;
    return `${formatRate(getBiweeklyMonthlyRate(lessonType))}/mo`;
  };

  const getTotalLessons = () => {
    if (!isRecurring) return 1;
    return recurringMonths * (recurringFrequency === 'weekly' ? 4 : 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const [hh, mm] = time.split(':').map(Number);
    const startTime = new Date(`${date}T00:00:00`);
    startTime.setHours(hh, mm, 0, 0);

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          lesson_type: lessonType,
          location_type: locationType,
          location_address: locationType === 'in-person' ? locationAddress : undefined,
          start_time: startTime.toISOString(),
          notes: notes || undefined,
          is_recurring: isRecurring,
          recurring_frequency: isRecurring ? recurringFrequency : undefined,
          recurring_months: isRecurring ? recurringMonths : undefined,
          send_confirmation_email: sendEmail,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to schedule lesson');
      }
    } catch {
      setError('Failed to schedule lesson');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Schedule Lesson for ${student.full_name || student.email}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time
            </label>
            <input
              type="time"
              value={time}
              step={1800}
              onChange={e => setTime(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Outside availability warning */}
        {outsideWindow && (
          <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md px-3 py-2">
            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              This time is outside your normal availability. You can still proceed.
            </p>
          </div>
        )}

        {/* Lesson Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lesson Type
          </label>
          <div className="space-y-2">
            {lessonTypes.map(type => (
              <label
                key={type.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  lessonType === type.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="lessonType"
                    value={type.id}
                    checked={lessonType === type.id}
                    onChange={() => {
                      setLessonType(type.id);
                      if (type.isTrialLesson) setIsRecurring(false);
                    }}
                    className="text-indigo-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{type.name}</p>
                    {type.isTrialLesson && (
                      <span className="text-xs text-green-600 dark:text-green-400">50% off intro lesson</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatRate(type.rate)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Location */}
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
        </div>

        {/* Recurring */}
        {!selectedType?.isTrialLesson && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsRecurring(v => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  isRecurring ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                  isRecurring ? 'translate-x-[18px]' : 'translate-x-1'
                }`} />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring (Monthly Plan)</span>
            </label>

            {isRecurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Frequency</p>
                  <div className="flex gap-2">
                    {(['weekly', 'biweekly'] as const).map(freq => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFrequency(freq)}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                          recurringFrequency === freq
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {freq === 'weekly' ? 'Weekly (4/mo)' : 'Bi-weekly (2/mo)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Duration</p>
                  <div className="flex gap-2">
                    {[1, 3, 6].map(months => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setRecurringMonths(months)}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                          recurringMonths === months
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {months} mo
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {getTotalLessons()} lessons total · {getDisplayRate()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes for this lesson..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
        </div>

        {/* Send email toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Send confirmation email to student
          </span>
        </label>

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
            {isSubmitting
              ? 'Scheduling...'
              : isRecurring
                ? `Schedule ${getTotalLessons()} Lessons`
                : 'Schedule Lesson'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
