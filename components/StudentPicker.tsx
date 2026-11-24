'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/types';

interface StudentPickerProps {
  students: User[];
  isLoading: boolean;
  onSelect: (student: User) => void;
}

// Type-to-search list of students: type a few letters of a name or email, then
// click or press Enter. Arrow keys move the highlight.
export default function StudentPicker({ students, isLoading, onSelect }: StudentPickerProps) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [students, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      // Never submit the surrounding form from the search box.
      e.preventDefault();
      if (matches[highlight]) onSelect(matches[highlight]);
    }
  };

  return (
    <div>
      <label htmlFor="student-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Who is the lesson for?
      </label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          ref={inputRef}
          id="student-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name or email"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="student-search-results"
          aria-activedescendant={matches[highlight] ? `student-option-${matches[highlight].id}` : undefined}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <ul
        ref={listRef}
        id="student-search-results"
        role="listbox"
        className="mt-2 max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700"
      >
        {isLoading ? (
          <li className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">Loading students…</li>
        ) : matches.length === 0 ? (
          <li className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
            {students.length === 0 ? 'No students yet. Add one on the Students page.' : `No students match “${query}”.`}
          </li>
        ) : (
          matches.map((s, i) => (
            <li
              key={s.id}
              id={`student-option-${s.id}`}
              data-index={i}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => onSelect(s)}
              className={`px-3 py-2 cursor-pointer ${
                i === highlight ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">{s.full_name || s.email}</p>
              {s.full_name && <p className="text-xs text-gray-500 dark:text-gray-400">{s.email}</p>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
