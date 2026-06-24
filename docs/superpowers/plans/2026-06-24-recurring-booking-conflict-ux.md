# Recurring-Booking Conflict Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-or-nothing native `alert()` on recurring lesson bookings with a live, per-occurrence availability breakdown inside the booking modal, partial booking of the open dates, and honest pro-rated pricing.

**Architecture:** A single shared server conflict helper (`checkOccurrenceConflicts`) backs both a new read-only preflight endpoint and the real `POST /api/lessons`, so the in-modal preview can never disagree with what booking actually does. The booking modal calls the preflight endpoint (debounced) as the student configures their plan and renders a per-occurrence breakdown. The booking POST becomes partial-success: it books the open dates, skips the rest, and reports what it skipped.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 18, TypeScript 5.3, Tailwind CSS 3.4, Supabase (`@supabase/ssr` server client + service-role admin client). Vitest (added in Task 1) for pure-logic unit tests.

## Global Constraints

- **Conflict semantics (copy exactly, preserve current behavior):** A date is a conflict if (a) it exactly overlaps **any** non-cancelled lesson — `existing.start < occ.end && existing.end > occ.start` — including the student's own; OR (b) the new lesson is **in-person** and falls within a **30-minute** commute buffer (`commuteConfig.bufferMinutes`) of **another student's** in-person lesson. The student's own lessons never trigger the buffer.
- **Server is the source of truth.** The client preview is advisory; the POST re-runs the same conflict check at write time.
- **Copy says "lessons"/"dates", never "weeks"** (biweekly plans are not consecutive weeks).
- **Per-lesson plan rate:** weekly = `weeklyMonthlyRate / 4` (`getWeeklyPerLessonRate`), biweekly = `biweeklyMonthlyRate / 2` (`getBiweeklyPerLessonRate`). Apply the existing discount with `applyDiscount(rate) = Math.ceil(rate * (1 - discountPercent/100))`; format with `formatRate(n) = \`$${Math.round(n)}\``.
- **Dark mode required** on every new UI element (always pair `dark:` variants).
- **Testing reality:** Only the pure modules in `lib/` are unit-tested (Vitest, `npm test`). API routes and React components are verified with `npx tsc --noEmit`, `npm run build`, and the explicit manual steps in each task. Do not invent a Supabase/DOM test harness.

---

## File Structure

**New files:**
- `vitest.config.ts` — Vitest config (node env, `lib/**/*.test.ts`).
- `lib/recurring-dates.ts` — pure recurring date generators + dispatcher (moved from `route.ts`).
- `lib/recurring-dates.test.ts` — unit tests.
- `lib/conflicts-core.ts` — pure `evaluateConflict` predicate + `ExistingLesson` type (no `@/` imports, so Vitest needs no path-alias config).
- `lib/conflicts-core.test.ts` — unit tests.
- `lib/conflicts.ts` — async `checkOccurrenceConflicts` (service-role fetch + pure predicate).
- `app/api/lessons/preflight/route.ts` — read-only preflight endpoint.
- `components/RecurringConflictBreakdown.tsx` — presentational breakdown panel.

**Modified files:**
- `types/index.ts` — add `OccurrenceStatus`, `PreflightResponse`.
- `app/api/lessons/route.ts` — use shared helpers; partial-success POST contract.
- `components/BookingForm.tsx` — preflight fetch/debounce/state, breakdown, pro-rated pricing, `skip_dates`, inline error, remove dead `alert()`.
- `app/(student)/schedule/page.tsx` — replace failure `alert()`s with inline error + informational toast; thread `skip_dates`; handle partial-success.
- `package.json` — add `vitest` devDependency + `test` scripts.

---

### Task 1: Vitest setup + shared recurring date generators

**Files:**
- Modify: `package.json` (scripts + devDependency)
- Create: `vitest.config.ts`
- Create: `lib/recurring-dates.ts`
- Test: `lib/recurring-dates.test.ts`

**Interfaces:**
- Produces:
  - `generateWeeklyRecurringDates(startDate: Date, weeks: number): Date[]`
  - `generateBiweeklyRecurringDates(startDate: Date, count: number): Date[]`
  - `generateMonthlyRecurringDates(startDate: Date, months: number): Date[]`
  - `generateRecurringDates(startDate: Date, frequency: 'weekly' | 'biweekly' | 'monthly', months: number): Date[]`

- [ ] **Step 1: Install Vitest and add scripts**

Run:
```bash
npm install -D vitest@^2
```

Then edit `package.json` `scripts` to add:
```json
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing test** — `lib/recurring-dates.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  generateWeeklyRecurringDates,
  generateBiweeklyRecurringDates,
  generateRecurringDates,
} from './recurring-dates';

const start = new Date(2026, 5, 26, 16, 0, 0, 0); // Fri Jun 26 2026 4:00pm local

describe('recurring date generators', () => {
  it('weekly: produces N dates 7 days apart at the same wall-clock time', () => {
    const dates = generateWeeklyRecurringDates(start, 4);
    expect(dates).toHaveLength(4);
    expect(dates[0].getDate()).toBe(26);
    expect(dates[1].getDate()).toBe(3); // Jul 3
    expect(dates[1].getMonth()).toBe(6); // July
    expect(dates[3].getDate()).toBe(17); // Jul 17
    dates.forEach((d) => {
      expect(d.getHours()).toBe(16);
      expect(d.getMinutes()).toBe(0);
    });
  });

  it('biweekly: produces N dates 14 days apart', () => {
    const dates = generateBiweeklyRecurringDates(start, 2);
    expect(dates).toHaveLength(2);
    expect(dates[1].getDate()).toBe(10); // Jul 10
  });

  it('dispatcher maps frequency+months to the right count', () => {
    expect(generateRecurringDates(start, 'weekly', 1)).toHaveLength(4);
    expect(generateRecurringDates(start, 'weekly', 3)).toHaveLength(12);
    expect(generateRecurringDates(start, 'biweekly', 1)).toHaveLength(2);
    expect(generateRecurringDates(start, 'biweekly', 3)).toHaveLength(6);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./recurring-dates"` (file does not exist yet).

- [ ] **Step 5: Implement `lib/recurring-dates.ts`**

```ts
// Pure recurring-lesson date generators. No framework imports so this module
// is trivially unit-testable and shared by the booking POST and preflight API.

// Generate weekly recurring lesson dates (same weekday/time each week).
export function generateWeeklyRecurringDates(startDate: Date, weeks: number): Date[] {
  const dates: Date[] = [];
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < weeks; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * 7);
    date.setHours(hours, minutes, 0, 0);
    dates.push(date);
  }
  return dates;
}

// Generate bi-weekly recurring lesson dates (every 14 days).
export function generateBiweeklyRecurringDates(startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * 14);
    date.setHours(hours, minutes, 0, 0);
    dates.push(date);
  }
  return dates;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return date;
    }
  }
  return null;
}

// Generate monthly recurring lesson dates (same relative weekday each month).
export function generateMonthlyRecurringDates(startDate: Date, months: number): Date[] {
  const dates: Date[] = [];
  const weekday = startDate.getDay();
  const weekOfMonth = Math.ceil(startDate.getDate() / 7);
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  for (let i = 0; i < months; i++) {
    const targetMonth = startDate.getMonth() + i;
    const targetYear = startDate.getFullYear() + Math.floor(targetMonth / 12);
    const adjustedMonth = ((targetMonth % 12) + 12) % 12;
    const date = getNthWeekdayOfMonth(targetYear, adjustedMonth, weekday, weekOfMonth);
    if (date) {
      date.setHours(hours, minutes, 0, 0);
      dates.push(date);
    }
  }
  return dates;
}

// Dispatch to the right generator based on plan frequency.
export function generateRecurringDates(
  startDate: Date,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  months: number
): Date[] {
  if (frequency === 'weekly') return generateWeeklyRecurringDates(startDate, months * 4);
  if (frequency === 'biweekly') return generateBiweeklyRecurringDates(startDate, months * 2);
  return generateMonthlyRecurringDates(startDate, months);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 3 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/recurring-dates.ts lib/recurring-dates.test.ts
git commit -m "feat: add Vitest + shared recurring date generators"
```

---

### Task 2: Pure conflict predicate

**Files:**
- Create: `lib/conflicts-core.ts`
- Test: `lib/conflicts-core.test.ts`

**Interfaces:**
- Produces:
  - `interface ExistingLesson { start_time: string; end_time: string; location_type: string; student_id: string; status: string; }`
  - `interface ConflictResult { status: 'available' | 'conflict'; reason: 'overlap' | 'commute_buffer' | null; conflictIsOwnLesson: boolean; }`
  - `evaluateConflict(occStart: Date, occEnd: Date, locationType: string, bookingStudentId: string, existing: ExistingLesson[], bufferMs: number): ConflictResult`

- [ ] **Step 1: Write the failing test** — `lib/conflicts-core.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { evaluateConflict, type ExistingLesson } from './conflicts-core';

const BUF = 30 * 60 * 1000; // 30 min
const occStart = new Date('2026-07-03T16:00:00.000Z');
const occEnd = new Date('2026-07-03T16:30:00.000Z'); // 30-min lesson
const ME = 'student-me';

function lesson(partial: Partial<ExistingLesson>): ExistingLesson {
  return {
    start_time: '2026-07-03T16:00:00.000Z',
    end_time: '2026-07-03T16:30:00.000Z',
    location_type: 'zoom',
    student_id: 'someone-else',
    status: 'scheduled',
    ...partial,
  };
}

describe('evaluateConflict', () => {
  it('returns available when there are no existing lessons', () => {
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [], BUF)).toEqual({
      status: 'available',
      reason: null,
      conflictIsOwnLesson: false,
    });
  });

  it('flags an exact overlap with another student (own=false)', () => {
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({})], BUF);
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('overlap');
    expect(r.conflictIsOwnLesson).toBe(false);
  });

  it('flags an exact overlap with the student\'s own lesson (own=true)', () => {
    const r = evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({ student_id: ME })], BUF);
    expect(r.status).toBe('conflict');
    expect(r.conflictIsOwnLesson).toBe(true);
  });

  it('treats an adjacent (touching, non-overlapping) lesson as available', () => {
    const adjacent = lesson({ start_time: '2026-07-03T16:30:00.000Z', end_time: '2026-07-03T17:00:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [adjacent], BUF).status).toBe('available');
  });

  it('applies the commute buffer vs another student\'s in-person lesson', () => {
    // Other student's in-person lesson ends 15 min before occ start -> within 30-min buffer
    const near = lesson({ location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    const r = evaluateConflict(occStart, occEnd, 'in-person', ME, [near], BUF);
    expect(r.status).toBe('conflict');
    expect(r.reason).toBe('commute_buffer');
  });

  it('does NOT apply the buffer against the student\'s own in-person lesson', () => {
    const ownNear = lesson({ student_id: ME, location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'in-person', ME, [ownNear], BUF).status).toBe('available');
  });

  it('does NOT apply the buffer when the new lesson is zoom', () => {
    const near = lesson({ location_type: 'in-person', start_time: '2026-07-03T15:15:00.000Z', end_time: '2026-07-03T15:45:00.000Z' });
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [near], BUF).status).toBe('available');
  });

  it('ignores cancelled lessons', () => {
    expect(evaluateConflict(occStart, occEnd, 'zoom', ME, [lesson({ status: 'cancelled' })], BUF).status).toBe('available');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./conflicts-core"`.

- [ ] **Step 3: Implement `lib/conflicts-core.ts`**

```ts
// Pure conflict predicate shared by the booking POST and the preflight API.
// Kept free of `@/` imports so it is trivially unit-testable.

export interface ExistingLesson {
  start_time: string;
  end_time: string;
  location_type: string;
  student_id: string;
  status: string;
}

export interface ConflictResult {
  status: 'available' | 'conflict';
  reason: 'overlap' | 'commute_buffer' | null;
  conflictIsOwnLesson: boolean;
}

export function evaluateConflict(
  occStart: Date,
  occEnd: Date,
  locationType: string,
  bookingStudentId: string,
  existing: ExistingLesson[],
  bufferMs: number
): ConflictResult {
  const occStartMs = occStart.getTime();
  const occEndMs = occEnd.getTime();

  // 1. Exact overlap with ANY non-cancelled lesson (including the student's own).
  for (const lesson of existing) {
    if (lesson.status === 'cancelled') continue;
    const ls = new Date(lesson.start_time).getTime();
    const le = new Date(lesson.end_time).getTime();
    if (ls < occEndMs && le > occStartMs) {
      return {
        status: 'conflict',
        reason: 'overlap',
        conflictIsOwnLesson: lesson.student_id === bookingStudentId,
      };
    }
  }

  // 2. Commute buffer vs OTHER students' in-person lessons (only if the new lesson is in-person).
  if (locationType === 'in-person') {
    const bufStart = occStartMs - bufferMs;
    const bufEnd = occEndMs + bufferMs;
    for (const lesson of existing) {
      if (lesson.status === 'cancelled') continue;
      if (lesson.location_type !== 'in-person') continue;
      if (lesson.student_id === bookingStudentId) continue;
      const ls = new Date(lesson.start_time).getTime();
      const le = new Date(lesson.end_time).getTime();
      if (ls < bufEnd && le > bufStart) {
        return { status: 'conflict', reason: 'commute_buffer', conflictIsOwnLesson: false };
      }
    }
  }

  return { status: 'available', reason: null, conflictIsOwnLesson: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `evaluateConflict` cases pass (plus Task 1's still green).

- [ ] **Step 5: Commit**

```bash
git add lib/conflicts-core.ts lib/conflicts-core.test.ts
git commit -m "feat: add pure conflict predicate with unit tests"
```

---

### Task 3: Shared async conflict helper + response types

**Files:**
- Modify: `types/index.ts` (append new interfaces)
- Create: `lib/conflicts.ts`

**Interfaces:**
- Consumes: `evaluateConflict`, `ExistingLesson` (Task 2); `commuteConfig` (`@/config/commute`); `createAdminClient` (`@/lib/supabase/admin`).
- Produces:
  - `interface OccurrenceStatus { date: string; index: number; status: 'available' | 'conflict'; reason: 'overlap' | 'commute_buffer' | null; conflictIsOwnLesson: boolean; }`
  - `interface PreflightResponse { occurrences: OccurrenceStatus[]; availableCount: number; totalCount: number; }`
  - `checkOccurrenceConflicts(occurrences: Date[], opts: { duration: number; locationType: string; bookingStudentId: string }): Promise<OccurrenceStatus[]>`

- [ ] **Step 1: Append shared types to `types/index.ts`**

Add at the end of the file:
```ts
// Per-occurrence conflict status for recurring-booking preflight + partial booking.
export interface OccurrenceStatus {
  date: string; // ISO datetime of the occurrence
  index: number; // 0-based position in the series
  status: 'available' | 'conflict';
  reason: 'overlap' | 'commute_buffer' | null;
  conflictIsOwnLesson: boolean;
}

export interface PreflightResponse {
  occurrences: OccurrenceStatus[];
  availableCount: number;
  totalCount: number;
}
```

- [ ] **Step 2: Implement `lib/conflicts.ts`**

```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { commuteConfig } from '@/config/commute';
import { evaluateConflict, type ExistingLesson } from '@/lib/conflicts-core';
import type { OccurrenceStatus } from '@/types';

// Check every occurrence against existing lessons. Uses the service-role client
// so it reliably sees ALL students' lessons (conflict detection must not be
// limited by the booking user's RLS scope). Both POST /api/lessons and the
// preflight endpoint call this, guaranteeing the preview matches booking.
export async function checkOccurrenceConflicts(
  occurrences: Date[],
  opts: { duration: number; locationType: string; bookingStudentId: string }
): Promise<OccurrenceStatus[]> {
  if (occurrences.length === 0) return [];

  const { duration, locationType, bookingStudentId } = opts;
  const bufferMs = commuteConfig.bufferMinutes * 60 * 1000;
  const durationMs = duration * 60 * 1000;

  const starts = occurrences.map((d) => d.getTime());
  const ends = occurrences.map((d) => d.getTime() + durationMs);
  // Widen the window by the buffer plus one hour (max lesson length) so a lesson
  // that starts before the first occurrence but still overlaps is included.
  const windowStart = new Date(Math.min(...starts) - bufferMs - 60 * 60 * 1000);
  const windowEnd = new Date(Math.max(...ends) + bufferMs);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lessons')
    .select('start_time, end_time, location_type, student_id, status')
    .neq('status', 'cancelled')
    .lte('start_time', windowEnd.toISOString())
    .gte('end_time', windowStart.toISOString());

  if (error) {
    throw new Error(`Conflict check failed: ${error.message}`);
  }

  const existing = (data ?? []) as ExistingLesson[];

  return occurrences.map((start, index) => {
    const end = new Date(start.getTime() + durationMs);
    const result = evaluateConflict(start, end, locationType, bookingStudentId, existing, bufferMs);
    return { date: start.toISOString(), index, ...result };
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `createAdminClient`'s return type makes `.from('lessons')` untyped, that's acceptable — the cast to `ExistingLesson[]` handles the shape.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/conflicts.ts
git commit -m "feat: add shared async occurrence-conflict helper + types"
```

---

### Task 4: Preflight endpoint

**Files:**
- Create: `app/api/lessons/preflight/route.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`); `getLessonDuration` (`@/config/lessonTypes`); `generateRecurringDates` (Task 1); `checkOccurrenceConflicts` (Task 3).
- Produces: `POST /api/lessons/preflight` returning `PreflightResponse`.

- [ ] **Step 1: Implement `app/api/lessons/preflight/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration } from '@/config/lessonTypes';
import { generateRecurringDates } from '@/lib/recurring-dates';
import { checkOccurrenceConflicts } from '@/lib/conflicts';

// POST /api/lessons/preflight - read-only availability check for a (possibly
// recurring) booking. Returns per-occurrence conflict status. Advisory only:
// POST /api/lessons re-checks at write time using the same helper.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { lesson_type, location_type, start_time, is_recurring, recurring_frequency, recurring_months } = body;

  if (!lesson_type || !start_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const duration = getLessonDuration(lesson_type);
  const startDate = new Date(start_time);

  const occurrences = is_recurring && recurring_months
    ? generateRecurringDates(startDate, recurring_frequency ?? 'monthly', recurring_months)
    : [startDate];

  try {
    const statuses = await checkOccurrenceConflicts(occurrences, {
      duration,
      locationType: location_type ?? 'zoom',
      bookingStudentId: user.id,
    });
    const availableCount = statuses.filter((s) => s.status === 'available').length;
    return NextResponse.json({ occurrences: statuses, availableCount, totalCount: statuses.length });
  } catch (err) {
    console.error('Preflight conflict check error:', err);
    return NextResponse.json({ error: 'Could not check availability' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual verification (dev server)**

Run: `npm run dev`, sign in as a student, open the booking modal, and (after Task 7 wires the client) the call will be exercised. For now verify the route compiles and responds: while logged in, in the browser devtools console on the app run:
```js
await fetch('/api/lessons/preflight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_type: 'voice_thirty', location_type: 'zoom', start_time: new Date(Date.now()+3*864e5).toISOString(), is_recurring: true, recurring_frequency: 'weekly', recurring_months: 1 }) }).then(r => r.json())
```
Expected: `{ occurrences: [4 items with status/reason/conflictIsOwnLesson], availableCount, totalCount: 4 }`.

- [ ] **Step 4: Commit**

```bash
git add app/api/lessons/preflight/route.ts
git commit -m "feat: add read-only booking-conflict preflight endpoint"
```

---

### Task 5: Partial-success booking POST

**Files:**
- Modify: `app/api/lessons/route.ts`

**Interfaces:**
- Consumes: `generateRecurringDates` (Task 1), `checkOccurrenceConflicts` (Task 3).
- Produces: `POST /api/lessons` now accepts optional `skip_dates: string[]`; recurring success response shape becomes `{ lessons, count, skipped: { date: string; reason: string }[] }`; zero-bookable returns `409 { error, occurrences }`.

- [ ] **Step 1: Add imports and remove the local date generators**

At the top of `app/api/lessons/route.ts`, add:
```ts
import { generateRecurringDates } from '@/lib/recurring-dates';
import { checkOccurrenceConflicts } from '@/lib/conflicts';
```
Then delete the three local functions `getNthWeekdayOfMonth`, `generateWeeklyRecurringDates`, `generateBiweeklyRecurringDates`, `generateMonthlyRecurringDates` (the block at the end of the file, lines ~539-613). They now live in `lib/recurring-dates.ts`.

- [ ] **Step 2: Add `skip_dates` to the request destructure**

Change the body destructure (currently line ~105) to include `skip_dates`:
```ts
  const { lesson_type, location_type, location_address, start_time, notes, is_recurring, recurring_frequency, recurring_months, skip_dates, student_id: body_student_id, send_confirmation_email } = body;
```

- [ ] **Step 3: Replace the date-generation + conflict block**

Replace the entire block from `// Generate all lesson dates (single or recurring)` through the end of the `for (const date of lessonDates) { ... }` conflict loop (currently lines ~166-230) with:
```ts
  // Generate all lesson dates (single or recurring)
  const lessonDates: Date[] = is_recurring && recurring_months
    ? generateRecurringDates(startDate, recurring_frequency ?? 'monthly', recurring_months)
    : [startDate];

  // Dates the student explicitly chose to skip (conflicting occurrences in the preview)
  const skipSet = new Set<string>(
    (Array.isArray(skip_dates) ? skip_dates : []).map((d: string) => new Date(d).toISOString())
  );

  // Single source of truth: re-check conflicts at write time (shared with preflight)
  const statuses = await checkOccurrenceConflicts(lessonDates, {
    duration,
    locationType: location_type,
    bookingStudentId,
  });

  // Partition occurrences into bookable vs skipped (conflict OR user-skipped)
  const datesToBook: Date[] = [];
  const skipped: { date: string; reason: string }[] = [];
  for (let i = 0; i < lessonDates.length; i++) {
    const iso = lessonDates[i].toISOString();
    if (statuses[i].status === 'conflict') {
      skipped.push({ date: iso, reason: statuses[i].reason ?? 'overlap' });
    } else if (skipSet.has(iso)) {
      skipped.push({ date: iso, reason: 'user_skipped' });
    } else {
      datesToBook.push(lessonDates[i]);
    }
  }

  // Nothing bookable: surface a structured conflict so the modal can re-render the breakdown
  if (datesToBook.length === 0) {
    return NextResponse.json(
      {
        error: 'None of these times are available. Please pick a different time.',
        occurrences: statuses,
      },
      { status: 409 }
    );
  }
```

- [ ] **Step 4: Point the creation loop at `datesToBook`**

In the creation loop, change the header (currently line ~262) from `lessonDates` to `datesToBook`:
```ts
  for (let i = 0; i < datesToBook.length; i++) {
    const lessonStart = datesToBook[i];
```
And in the Google Calendar description in that loop, change the recurring counter (currently `${i + 1} of ${lessonDates.length}`) to use `datesToBook.length`:
```ts
${is_recurring ? `\nRecurring: ${i + 1} of ${datesToBook.length}` : ''}
```

- [ ] **Step 5: Add `skipped` to the success response**

Change the final return (currently line ~533) to:
```ts
  return NextResponse.json(
    is_recurring ? { lessons: createdLessons, count: createdLessons.length, skipped } : createdLessons[0],
    { status: 201 }
  );
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If `duration` or `bookingStudentId` are referenced before their declarations, confirm this block stays after `const duration = ...` line ~108 and `const bookingStudentId = ...` line ~130 — it does.)

- [ ] **Step 7: Manual verification (dev server)**

With `npm run dev` and signed in as a student:
1. Book a single zoom lesson on a free slot → still returns the single lesson and succeeds (no regression).
2. Book a 1-month weekly plan where one week already has a lesson, passing that week in `skip_dates` (via the console fetch from Task 4 Step 3 but to `/api/lessons` POST with `skip_dates: ['<iso of conflict>']`) → returns `{ lessons: [3], count: 3, skipped: [{date, reason}] }` and creates 3 lessons.
3. Confirm in "My Lessons" that exactly the open weeks were booked.

- [ ] **Step 8: Commit**

```bash
git add app/api/lessons/route.ts
git commit -m "feat: partial-success recurring booking (skip conflicts, report skipped)"
```

---

### Task 6: Breakdown presentational component

**Files:**
- Create: `components/RecurringConflictBreakdown.tsx`

**Interfaces:**
- Consumes: `OccurrenceStatus` (`@/types`).
- Produces: default-exported `RecurringConflictBreakdown` with props
  `{ state: 'checking' | 'all_clear' | 'partial' | 'all_conflict' | 'check_error'; occurrences: OccurrenceStatus[]; availableCount: number; totalCount: number; }`.

- [ ] **Step 1: Implement `components/RecurringConflictBreakdown.tsx`**

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/RecurringConflictBreakdown.tsx
git commit -m "feat: add recurring conflict breakdown component"
```

---

### Task 7: Wire the breakdown into BookingForm

**Files:**
- Modify: `components/BookingForm.tsx`

**Interfaces:**
- Consumes: `RecurringConflictBreakdown` (Task 6); `OccurrenceStatus` (`@/types`); `getWeeklyPerLessonRate`, `getBiweeklyPerLessonRate` (`@/config/lessonTypes`); `POST /api/lessons/preflight` (Task 4).
- Produces: `BookingData` gains optional `skip_dates?: string[]`; `BookingFormProps` gains optional `submitError?: string | null`.

- [ ] **Step 1: Update imports**

Change the React import (line 3) and config import (line 4), and add the component + types imports:
```tsx
import { useState, useEffect, useRef } from 'react';
import { lessonTypes, getLessonType, LessonType, formatDuration, formatRate, getWeeklySavings, getBiweeklySavings, getWeeklyPerLessonRate, getBiweeklyPerLessonRate } from '@/config/lessonTypes';
import { cancellationPolicy } from '@/config/cancellationPolicy';
import RecurringConflictBreakdown from '@/components/RecurringConflictBreakdown';
import type { OccurrenceStatus } from '@/types';
```

- [ ] **Step 2: Extend `BookingData` and `BookingFormProps`**

Add `skip_dates` to `BookingData` (after `recurring_months`):
```tsx
  recurring_months?: number; // For weekly/biweekly: how many months to book
  skip_dates?: string[]; // ISO dates of conflicting occurrences to skip
```
Add `submitError` to `BookingFormProps` (after `defaultAddress`):
```tsx
  defaultAddress?: string; // Pre-fill address from user profile
  submitError?: string | null; // Inline error from a failed booking submit
```
And add it to the destructured props (after `defaultAddress = ''`):
```tsx
  defaultAddress = '',
  submitError = null,
```

- [ ] **Step 3: Add conflict-check state + derived counts**

After the existing `recurringMonths` state (line ~56), add:
```tsx
  const [conflictState, setConflictState] = useState<'idle' | 'checking' | 'all_clear' | 'partial' | 'all_conflict' | 'check_error'>('idle');
  const [occurrences, setOccurrences] = useState<OccurrenceStatus[]>([]);
  const requestIdRef = useRef(0);

  const totalCount = occurrences.length;
  const availableCount = occurrences.filter((o) => o.status === 'available').length;
```

- [ ] **Step 4: Add the debounced preflight effect**

After the "Reset recurring if user selects a trial lesson" effect (line ~73), add:
```tsx
  // Live availability preflight for recurring plans (advisory; server re-checks on submit).
  useEffect(() => {
    if (!isRecurring || isTrialLesson) {
      setConflictState('idle');
      setOccurrences([]);
      return;
    }

    setConflictState('checking');
    const reqId = ++requestIdRef.current;
    const controller = new AbortController();

    const handle = setTimeout(async () => {
      try {
        const [h, m] = selectedTime.split(':').map(Number);
        const startTime = new Date(selectedDate);
        startTime.setHours(h, m, 0, 0);

        const res = await fetch('/api/lessons/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            lesson_type: lessonType,
            location_type: locationType,
            start_time: startTime.toISOString(),
            is_recurring: true,
            recurring_frequency: recurringFrequency,
            recurring_months: recurringMonths,
          }),
        });
        if (!res.ok) throw new Error('preflight failed');
        const data = await res.json();
        if (reqId !== requestIdRef.current) return; // a newer request superseded this one

        const occ: OccurrenceStatus[] = data.occurrences ?? [];
        const avail = data.availableCount ?? 0;
        setOccurrences(occ);
        setConflictState(avail === 0 ? 'all_conflict' : avail < occ.length ? 'partial' : 'all_clear');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (reqId !== requestIdRef.current) return;
        setConflictState('check_error');
        setOccurrences([]);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [isRecurring, isTrialLesson, lessonType, locationType, recurringFrequency, recurringMonths, selectedDate, selectedTime]);
```

- [ ] **Step 5: Block submit on all-conflict and pass `skip_dates`**

Replace `handleSubmit` (lines ~75-92) with:
```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToPolicy) {
      setPolicyNeedsAttention(true);
      setTimeout(() => setPolicyNeedsAttention(false), 2000);
      return;
    }

    // Don't submit a recurring plan with zero open dates.
    if (isRecurring && !isTrialLesson && conflictState === 'all_conflict') {
      return;
    }

    const recurring = isRecurring && !isTrialLesson;
    const skip_dates = recurring && conflictState === 'partial'
      ? occurrences.filter((o) => o.status === 'conflict').map((o) => o.date)
      : undefined;

    await onSubmit({
      lesson_type: lessonType,
      location_type: locationType,
      location_address: locationType === 'in-person' ? locationAddress : undefined,
      notes,
      is_recurring: recurring,
      recurring_frequency: recurring ? recurringFrequency : undefined,
      recurring_months: recurring ? recurringMonths : undefined,
      skip_dates,
    });
  };
```

- [ ] **Step 6: Render the breakdown inside the recurring card**

In the recurring section, the `{isRecurring && (...)}` block ends with the "lessons total" paragraph (line ~319-321). Immediately after that closing `</p>` and before the block's closing `</div>` tags, insert the breakdown. Concretely, change:
```tsx
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {totalLessons} lessons total • Billed {formatRate(selectedLessonType ? getActiveMonthlyRate(selectedLessonType) : 0)}/month
                </p>
              </div>
            </div>
          )}
```
to:
```tsx
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {totalLessons} lessons total • Billed {formatRate(selectedLessonType ? getActiveMonthlyRate(selectedLessonType) : 0)}/month
                </p>
              </div>
              {conflictState !== 'idle' && (
                <RecurringConflictBreakdown
                  state={conflictState}
                  occurrences={occurrences}
                  availableCount={availableCount}
                  totalCount={totalCount}
                />
              )}
            </div>
          )}
```

- [ ] **Step 7: Pro-rate the price summary for partial bookings**

In the summary block, replace the recurring branch (currently lines ~461-482, the `{isRecurring && !isTrialLesson ? ( ... ) : ( ... )}` recurring side) so a partial plan shows a pro-rated total. Change the opening of the recurring branch from:
```tsx
          {isRecurring && !isTrialLesson ? (
            <>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                <span>Monthly Rate</span>
                <span className="text-green-600 dark:text-green-400">
                  {hasDiscount && (
                    <span className="text-base text-gray-400 dark:text-gray-500 line-through mr-2">
                      {formatRate(getActiveMonthlyRate(selectedLessonType))}
                    </span>
                  )}
                  {formatRate(applyDiscount(getActiveMonthlyRate(selectedLessonType)))}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalLessons} {recurringFrequency === 'biweekly' ? 'bi-weekly' : 'weekly'} lessons over {recurringMonths} {recurringMonths === 1 ? 'month' : 'months'}
              </p>
              {monthlySavings > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                  Save ~{formatRate(monthlySavings)}/mo vs individual lessons!
                </p>
              )}
            </>
          ) : (
```
to:
```tsx
          {isRecurring && !isTrialLesson && conflictState === 'partial' ? (
            <>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                <span>This month</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatRate(applyDiscount(Math.round(
                    (recurringFrequency === 'biweekly'
                      ? getBiweeklyPerLessonRate(lessonType)
                      : getWeeklyPerLessonRate(lessonType)) * availableCount
                  )))}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {availableCount} of {totalLessons} lessons — billed at your {recurringFrequency === 'biweekly' ? 'bi-weekly' : 'weekly'} plan rate. Skipped dates aren&apos;t charged.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Future months bill at the full {formatRate(applyDiscount(getActiveMonthlyRate(selectedLessonType)))}/mo rate.
              </p>
            </>
          ) : isRecurring && !isTrialLesson ? (
            <>
              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                <span>Monthly Rate</span>
                <span className="text-green-600 dark:text-green-400">
                  {hasDiscount && (
                    <span className="text-base text-gray-400 dark:text-gray-500 line-through mr-2">
                      {formatRate(getActiveMonthlyRate(selectedLessonType))}
                    </span>
                  )}
                  {formatRate(applyDiscount(getActiveMonthlyRate(selectedLessonType)))}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalLessons} {recurringFrequency === 'biweekly' ? 'bi-weekly' : 'weekly'} lessons over {recurringMonths} {recurringMonths === 1 ? 'month' : 'months'}
              </p>
              {monthlySavings > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                  Save ~{formatRate(monthlySavings)}/mo vs individual lessons!
                </p>
              )}
            </>
          ) : (
```

- [ ] **Step 8: Render the inline submit error and update the action button**

Replace the entire `{/* Actions */}` block (lines ~506-535) with:
```tsx
      {/* Inline submit error (replaces the old window.alert) */}
      {submitError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
          <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        >
          {isRecurring && !isTrialLesson && (conflictState === 'partial' || conflictState === 'all_conflict')
            ? 'Pick a different time'
            : 'Cancel'}
        </button>
        {/* Wrapper div to capture clicks on disabled button */}
        <div
          className="flex-1 cursor-pointer"
          onClick={() => {
            if (!agreedToPolicy && !isLoading) {
              setPolicyNeedsAttention(true);
              setTimeout(() => setPolicyNeedsAttention(false), 2000);
            }
          }}
        >
          <button
            type="submit"
            disabled={
              isLoading ||
              !agreedToPolicy ||
              (isRecurring && !isTrialLesson && (conflictState === 'checking' || conflictState === 'all_conflict'))
            }
            className={`w-full px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none ${
              !agreedToPolicy && !isLoading ? 'pointer-events-none' : ''
            }`}
          >
            {isLoading
              ? 'Booking...'
              : isRecurring && !isTrialLesson
                ? conflictState === 'checking'
                  ? 'Checking availability…'
                  : conflictState === 'all_conflict'
                    ? 'No open dates — pick another time'
                    : conflictState === 'partial'
                      ? `Book ${availableCount} Available Lessons`
                      : `Book ${totalLessons} Lessons`
                : 'Book Lesson'}
          </button>
        </div>
      </div>
```

Note: the "Pick a different time" secondary action reuses the existing `onCancel` (closes the modal back to the slot picker).

- [ ] **Step 9: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (build completes). The dead `alert()` at the old line 79 is gone (replaced in Step 5).

- [ ] **Step 10: Manual verification (dev server)**

With `npm run dev`, signed in as a student, open the booking modal on a date/time where a future week is already booked by someone:
1. Toggle recurring on → spinner "Checking your schedule…" then a breakdown appears.
2. A conflicting week shows an amber ✗ with the right label; open weeks show green ✓.
3. The Book button reads "Book N Available Lessons"; the price shows the pro-rated "This month" total.
4. Toggle dark mode → all colors render correctly.
5. Pick a slot where every week conflicts → red panel, button disabled "No open dates — pick another time", Cancel reads "Pick a different time".

- [ ] **Step 11: Commit**

```bash
git add components/BookingForm.tsx
git commit -m "feat: live conflict breakdown + pro-rated pricing in booking modal"
```

---

### Task 8: Schedule page — partial-success + inline errors

**Files:**
- Modify: `app/(student)/schedule/page.tsx`

**Interfaces:**
- Consumes: `BookingData.skip_dates`, `BookingFormProps.submitError` (Task 7); partial-success response `{ lessons, count, skipped }` (Task 5).

- [ ] **Step 1: Add submit-error and booking-message state**

After the existing `bookingSuccess` state (line ~22), add:
```tsx
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
```
(Keep the existing `bookingSuccess` line; add the two new lines below it.)

- [ ] **Step 2: Rewrite `handleBookingSubmit`**

Replace `handleBookingSubmit` (lines ~192-235) with:
```tsx
  const handleBookingSubmit = async (data: BookingData) => {
    if (!selectedTime) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_type: data.lesson_type,
          location_type: data.location_type,
          location_address: data.location_address,
          start_time: startTime.toISOString(),
          notes: data.notes,
          is_recurring: data.is_recurring,
          recurring_frequency: data.recurring_frequency,
          recurring_months: data.recurring_months,
          skip_dates: data.skip_dates,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const skippedCount = Array.isArray(result?.skipped) ? result.skipped.length : 0;
        const bookedCount = typeof result?.count === 'number' ? result.count : 1;
        setBookingMessage(
          skippedCount > 0
            ? `Booked ${bookedCount} of ${bookedCount + skippedCount} lessons — ${skippedCount} ${skippedCount === 1 ? 'date was' : 'dates were'} unavailable.`
            : ''
        );
        setBookingSuccess(true);
        setShowBookingForm(false);
        setSelectedTime(null);
        await fetchData();
        setTimeout(() => setBookingSuccess(false), 6000);
      } else {
        const error = await res.json();
        setSubmitError(error.error || 'Failed to book lesson. Please try again.');
      }
    } catch (error) {
      console.error('Error booking lesson:', error);
      setSubmitError('Something went wrong while booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 3: Show the skipped message in the success toast**

In the success toast (lines ~259-266), change the second `<p>` to use `bookingMessage` when present:
```tsx
            <p className="text-green-800 dark:text-green-200 font-medium">✓ Lesson booked successfully!</p>
            <p className="text-green-600 dark:text-green-400 text-sm">{bookingMessage || 'Check your email for confirmation details.'}</p>
```

- [ ] **Step 4: Pass `submitError` to BookingForm and clear it on close**

In the Modal's `onClose` (lines ~354-357) add `setSubmitError(null)`:
```tsx
        onClose={() => {
          setShowBookingForm(false);
          setSelectedTime(null);
          setSubmitError(null);
        }}
```
In the `<BookingForm ... />` props, add `submitError` and also clear it in the form's `onCancel`:
```tsx
            onCancel={() => {
              setShowBookingForm(false);
              setSelectedTime(null);
              setSubmitError(null);
            }}
            isLoading={isSubmitting}
            submitError={submitError}
```
(Insert `submitError={submitError}` alongside the other props passed to `BookingForm`; keep all existing props.)

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Confirm there are no remaining `alert(` calls in `app/(student)/schedule/page.tsx`:
```bash
grep -n "alert(" app/(student)/schedule/page.tsx || echo "no alerts remaining"
```
Expected: `no alerts remaining`.

- [ ] **Step 6: Manual verification (dev server) — full flow**

With `npm run dev`, signed in as a student, reproduce the original screenshot scenario:
1. Pick a recurring weekly plan where one week (e.g. Jul 3) is already taken.
2. The breakdown shows that week as a conflict before you click Book.
3. Click "Book N Available Lessons" → modal closes, the toast says "Booked 3 of 4 lessons — 1 date was unavailable.", and only the open weeks appear in My Lessons.
4. Force a failure (e.g. temporarily book the remaining weeks from another account, then submit) → an inline red error appears inside the modal instead of a native alert.
5. Verify in light and dark mode.

- [ ] **Step 7: Commit**

```bash
git add "app/(student)/schedule/page.tsx"
git commit -m "feat: inline booking errors + partial-success toast on schedule page"
```

---

## Self-Review

**Spec coverage:**
- Replace native alert in booking flow → Tasks 7 (form) + 8 (schedule page); both `alert()`s removed (Step 5/grep check).
- Live per-occurrence breakdown → Tasks 4 (endpoint) + 6 (component) + 7 (wiring, debounced).
- Book only open dates / pick a different time → Task 5 (`skip_dates`, partial success) + Task 7 (button + secondary action).
- Honest pro-rated pricing → Task 7 Step 7.
- Server source of truth / no double-book → Task 5 Step 3 (re-check at write time via shared helper).
- Shared conflict helper (no drift) → Tasks 2-3, consumed by Tasks 4 and 5.
- Shared date generation → Task 1, consumed by Tasks 4 and 5.
- Conflict-reason copy (own / other / commute buffer) → Task 6 `statusLabel`.
- All-conflict, first-week-not-special, own-vs-other, commute-buffer, check-error, race-on-submit edge cases → Tasks 2 (predicate), 5 (zero-bookable 409 + skipped), 6 (states), 7 (states/labels).
- "lessons"/"dates" copy, dark mode → Tasks 6-7.
- Remove dead policy `alert()` → Task 7 Step 5.

**Placeholder scan:** No TBD/TODO; every code step contains full code; every test step has concrete assertions and expected output.

**Type consistency:** `OccurrenceStatus` (types/index.ts) is produced by `checkOccurrenceConflicts` (Task 3), returned by the preflight endpoint (Task 4), consumed by `RecurringConflictBreakdown` and `BookingForm` (Tasks 6-7). `ConflictResult` (Task 2) is spread into `OccurrenceStatus` (Task 3) — fields match (`status`, `reason`, `conflictIsOwnLesson`). `skip_dates` is added to `BookingData` (Task 7) and read by POST (Task 5). `generateRecurringDates` signature is identical across Tasks 1, 4, 5.

**Note on email pricing (spec "should-do"):** The confirmation email still prints the full Monthly Rate. This is intentionally deferred per the spec (non-blocking). If desired, it can be a follow-up task updating the payment section of `route.ts` to reflect `createdLessons.length`.
