'use client';

import { useState, useEffect, useMemo } from 'react';
import { ADMIN_SLOT_STEP_MINUTES } from '@/config/scheduling';
import { getCommuteBufferMs } from '@/config/commute';
import Modal from '@/components/Modal';
import StudentPicker from '@/components/StudentPicker';
import {
  lessonTypes,
  getLessonType,
  formatRate,
  getWeeklyMonthlyRate,
  getBiweeklyMonthlyRate,
} from '@/config/lessonTypes';
import { formatDate, formatTime, formatTime24to12 } from '@/lib/utils';
import {
  availableWindows,
  defaultsForStudent,
  localInstant,
  minutesToHHMM,
  slotWarnings,
  suggestStartTime,
  type DayContext,
  type SlotWarning,
} from '@/lib/admin-scheduling';
import type { BusyBlock } from '@/lib/conflicts-core';
import type { Availability, AvailabilityOverride, Lesson, User } from '@/types';

interface AdminScheduleLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  // A fixed student (Students page). Omit to choose one in the modal (Calendar).
  student?: User | null;
  // 'YYYY-MM-DD' to start on; past dates fall back to today.
  initialDate?: string;
  onSuccess: (bookedDate: string) => void;
}

const DEFAULT_TIME = '10:00';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Start times offered: 6:00 AM to 9:00 PM.
const timeSlots = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let m = 6 * 60; m <= 21 * 60; m += ADMIN_SLOT_STEP_MINUTES) {
    const value = minutesToHHMM(m);
    slots.push({ value, label: formatTime24to12(value) });
  }
  return slots;
})();

interface DayData {
  dateStr: string;
  lessons: Lesson[];
  overrides: AvailabilityOverride[];
  busyBlocks: BusyBlock[];
}

const fetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
};

const isHardWarning = (w: SlotWarning) => w.kind === 'overlap' || w.kind === 'commute_buffer';

function warningText(w: SlotWarning, bufferMinutes: number): string {
  switch (w.kind) {
    case 'blocked':
      return `You blocked this day${w.reason ? ` (${w.reason})` : ''}. You can still book it.`;
    case 'outside_hours':
      return 'This is outside your available hours. You can still book it.';
    case 'busy':
      return 'This overlaps something on your Google Calendar.';
    case 'overlap':
      return w.ownLesson
        ? 'This student already has a lesson at this time, so it can’t be booked.'
        : 'This overlaps another lesson, so it can’t be booked.';
    case 'commute_buffer':
      return `Too close to another in-person lesson (needs ${bufferMinutes} min to travel), so it can’t be booked.`;
  }
}

export default function AdminScheduleLessonModal({
  isOpen,
  onClose,
  student,
  initialDate,
  onSuccess,
}: AdminScheduleLessonModalProps) {
  const todayStr = formatDate(new Date(), 'iso');
  const bufferMs = getCommuteBufferMs();

  const [picked, setPicked] = useState<User | null>(student ?? null);
  const [students, setStudents] = useState<User[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(DEFAULT_TIME);
  // Once she picks a time herself, stop re-suggesting one.
  const [timeTouched, setTimeTouched] = useState(false);
  const [lessonType, setLessonType] = useState('voice_thirty');
  const [locationType, setLocationType] = useState<'zoom' | 'in-person'>('zoom');
  const [locationAddress, setLocationAddress] = useState(student?.address || '');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [recurringMonths, setRecurringMonths] = useState(1);
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<Availability[] | null>(null);
  const [day, setDay] = useState<DayData | null>(null);

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setPicked(student ?? null);
    setDate(initialDate && ISO_DATE.test(initialDate) && initialDate >= todayStr ? initialDate : todayStr);
    setTime(DEFAULT_TIME);
    setTimeTouched(false);
    setLessonType('voice_thirty');
    setLocationType('zoom');
    setLocationAddress(student?.address || '');
    setNotes('');
    setIsRecurring(false);
    setRecurringFrequency('weekly');
    setRecurringMonths(1);
    setSendEmail(true);
    setError(null);
    setDay(null);
  }, [isOpen, student?.id, initialDate]);

  // Student list for the picker (only when no student was handed in).
  const hasFixedStudent = !!student;
  useEffect(() => {
    if (!isOpen || hasFixedStudent) return;
    let ignore = false;
    setStudentsLoading(true);
    fetchJson<User[]>('/api/students', []).then((list) => {
      if (ignore) return;
      setStudents(list);
      setStudentsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, hasFixedStudent]);

  // Repeat the picked student's usual lesson: type, location, address.
  useEffect(() => {
    if (!isOpen || !picked) return;
    let ignore = false;
    setHistoryLoading(true);
    fetchJson<Lesson[]>(`/api/lessons?studentId=${picked.id}`, []).then((history) => {
      if (ignore) return;
      const d = defaultsForStudent(picked, history);
      setLessonType(d.lessonType);
      setLocationType(d.locationType);
      setLocationAddress(d.locationAddress);
      if (getLessonType(d.lessonType)?.isTrialLesson) setIsRecurring(false);
      setHistoryLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, picked?.id]);

  // Her weekly hours, once per open.
  useEffect(() => {
    if (!isOpen) return;
    fetchJson<Availability[]>('/api/availability', []).then(setAvailability);
  }, [isOpen]);

  // Everything already on the chosen day: lessons, day-blocks, Google busy time.
  useEffect(() => {
    if (!isOpen || !ISO_DATE.test(date)) return;
    let ignore = false;
    const dayStart = localInstant(date, 0);
    const dayEnd = localInstant(date, 24 * 60);
    // Reach back far enough to catch a late lesson from the night before.
    const lookBack = new Date(dayStart.getTime() - 2 * 60 * 60 * 1000);
    Promise.all([
      fetchJson<Lesson[]>(`/api/lessons?startDate=${lookBack.toISOString()}&endDate=${dayEnd.toISOString()}`, []),
      fetchJson<AvailabilityOverride[]>(`/api/availability/overrides?startDate=${date}&endDate=${date}`, []),
      fetchJson<BusyBlock[]>(
        `/api/availability/busy?startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`,
        []
      ),
    ]).then(([lessons, overrides, busyBlocks]) => {
      if (!ignore) setDay({ dateStr: date, lessons, overrides, busyBlocks });
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, date]);

  const dayCtx: DayContext | null = useMemo(() => {
    if (!availability || !day || day.dateStr !== date) return null;
    return {
      dateStr: date,
      availability,
      overrides: day.overrides,
      lessons: day.lessons,
      busyBlocks: day.busyBlocks,
    };
  }, [availability, day, date]);

  const selectedType = lessonTypes.find((t) => t.id === lessonType);
  const duration = selectedType?.duration ?? 30;
  const studentId = picked?.id ?? null;

  const suggestedTime = useMemo(() => {
    if (!dayCtx) return null;
    const s = suggestStartTime(dayCtx, {
      studentId,
      durationMinutes: duration,
      locationType,
      bufferMs,
      stepMinutes: ADMIN_SLOT_STEP_MINUTES,
      now: new Date(),
    });
    return s && timeSlots.some((slot) => slot.value === s) ? s : null;
  }, [dayCtx, studentId, duration, locationType, bufferMs]);

  useEffect(() => {
    if (!timeTouched && suggestedTime) setTime(suggestedTime);
  }, [timeTouched, suggestedTime]);

  const warnings = useMemo(() => {
    if (!dayCtx) return [];
    const [hh, mm] = time.split(':').map(Number);
    return slotWarnings(dayCtx, {
      studentId,
      durationMinutes: duration,
      locationType,
      bufferMs,
      startMinutes: hh * 60 + mm,
    });
  }, [dayCtx, time, studentId, duration, locationType, bufferMs]);

  const hours = dayCtx ? availableWindows(dayCtx) : [];
  const blockedOverride = day?.overrides.find((o) => o.override_date === date && !o.is_available);
  const dayLessons = (day?.dateStr === date ? day.lessons : [])
    .filter((l) => l.status !== 'cancelled' && formatDate(new Date(l.start_time), 'iso') === date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

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
    if (!picked) return;
    setError(null);
    setIsSubmitting(true);

    const [hh, mm] = time.split(':').map(Number);
    const startTime = localInstant(date, hh * 60 + mm);

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: picked.id,
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
        onSuccess(date);
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

  const title = student ? `Schedule Lesson for ${student.full_name || student.email}` : 'Schedule Lesson';
  const dateLabel = ISO_DATE.test(date) ? formatDate(localInstant(date, 12 * 60), 'long') : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {!picked ? (
        // Step 1 (Calendar only): who is it for?
        <div className="space-y-4">
          {dateLabel && <p className="text-sm text-gray-500 dark:text-gray-400">{dateLabel}</p>}
          <StudentPicker students={students} isLoading={studentsLoading} onSelect={setPicked} />
          <div className="flex pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Picked student */}
          {!student && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm font-semibold">
                  {(picked.full_name || picked.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {picked.full_name || picked.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {historyLoading ? 'Loading their usual lesson…' : picked.full_name ? picked.email : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="flex-shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
                {!timeTouched && suggestedTime === time && (
                  <span className="text-xs font-normal text-green-600 dark:text-green-400">first open time</span>
                )}
              </label>
              <select
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setTimeTouched(true);
                }}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              >
                {timeSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* What else is on this day */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            {!dayCtx ? (
              <p className="text-gray-400 dark:text-gray-500">Checking your day…</p>
            ) : (
              <>
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Your hours: </span>
                  {blockedOverride
                    ? `Blocked${blockedOverride.reason ? ` — ${blockedOverride.reason}` : ''}`
                    : hours.length > 0
                      ? hours
                          .map((w) => `${formatTime24to12(minutesToHHMM(w.start))} – ${formatTime24to12(minutesToHHMM(w.end))}`)
                          .join(', ')
                      : 'None set for this day'}
                </p>
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Booked: </span>
                  {dayLessons.length === 0
                    ? 'Nothing yet'
                    : dayLessons
                        .map(
                          (l) =>
                            `${formatTime(l.start_time)} ${l.student?.full_name || l.student?.email || 'Student'}${
                              l.location_type === 'in-person' ? ' (in person)' : ''
                            }`
                        )
                        .join(' · ')}
                </p>
              </>
            )}
            {warnings.map((w) => (
              <p
                key={w.kind}
                className={`font-medium ${
                  isHardWarning(w) ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {isHardWarning(w) ? '✕ ' : '⚠ '}
                {warningText(w, bufferMs / 60000)}
              </p>
            ))}
          </div>

          {/* Lesson Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lesson Type</label>
            <div className="space-y-2">
              {lessonTypes.map((type) => (
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatRate(type.rate)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
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
                onChange={(e) => setLocationAddress(e.target.value)}
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
                  onClick={() => setIsRecurring((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    isRecurring ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                      isRecurring ? 'translate-x-[18px]' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring (Monthly Plan)</span>
              </label>

              {isRecurring && (
                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Frequency</p>
                    <div className="flex gap-2">
                      {(['weekly', 'biweekly'] as const).map((freq) => (
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
                      {[1, 3, 6].map((months) => (
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
              onChange={(e) => setNotes(e.target.value)}
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
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Send confirmation email to student</span>
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
      )}
    </Modal>
  );
}
