'use client';

import type { OccurrenceStatus } from '@/types';

interface Props {
  state: 'checking' | 'all_clear' | 'partial' | 'all_conflict' | 'check_error';
  occurrences: OccurrenceStatus[];
  availableCount: number;
  totalCount: number;
}

function formatOccurrence(dateIso: string): string {
  const d = new Date(dateIso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

function statusLabel(o: OccurrenceStatus): string {
  if (o.status === 'available') return 'Available';
  if (o.reason === 'commute_buffer') return 'Too close to an in-person lesson (30-min travel buffer)';
  if (o.conflictIsOwnLesson) return 'You already have a lesson then';
  return 'Already booked';
}

export default function RecurringConflictBreakdown({ state, occurrences, availableCount, totalCount }: Props) {
  if (state === 'checking') {
    return (
      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">Checking your schedule…</p>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 rounded-md bg-gray-200/70 dark:bg-gray-700/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (state === 'check_error') {
    return (
      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Couldn&apos;t check all dates right now.</span> We&apos;ll confirm availability when you book.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'all_clear') {
    return (
      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          ✓ All {totalCount} lessons are available at this time.
        </p>
      </div>
    );
  }

  const header =
    state === 'all_conflict'
      ? "This time isn't open for a recurring plan"
      : `${availableCount} of ${totalCount} lessons are available`;
  const detail =
    state === 'all_conflict'
      ? 'Every date already has a conflict. Try a different day or time.'
      : 'Book the open dates now, or pick a different time.';

  return (
    <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
      <div
        className={`rounded-lg p-3 mb-3 border ${
          state === 'all_conflict'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}
      >
        <p
          className={`text-sm font-semibold ${
            state === 'all_conflict' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'
          }`}
        >
          {header}
        </p>
        <p
          className={`text-sm ${
            state === 'all_conflict' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {detail}
        </p>
      </div>
      <ul className="space-y-1.5 max-h-64 overflow-y-auto" aria-label="Lesson availability by date">
        {occurrences.map((o) => {
          const conflict = o.status === 'conflict';
          return (
            <li
              key={o.date}
              className={`flex items-start justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm ${
                conflict ? 'bg-amber-50 dark:bg-amber-900/20' : ''
              }`}
            >
              <span className="flex items-start gap-2 min-w-0">
                <span
                  className={`mt-0.5 flex-shrink-0 ${
                    conflict ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                  }`}
                  aria-hidden="true"
                >
                  {conflict ? '✗' : '✓'}
                </span>
                <span className="text-gray-700 dark:text-gray-300 truncate">
                  Lesson {o.index + 1} · {formatOccurrence(o.date)}
                </span>
              </span>
              <span
                className={`flex-shrink-0 text-right ${
                  conflict ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {statusLabel(o)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
