# Reschedule Length Flexibility + Lessons-Page Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher change a lesson's type/length (and price) during a reschedule, and surface the Reschedule action on the shared Lessons page.

**Architecture:** Extend the shipped reschedule flow. The `PATCH /api/lessons/[id]/reschedule` route accepts an optional `lesson_type`; when supplied it validates the id, recomputes duration/end_time from the new type, and drives Zoom/Calendar/email with the new length. `RescheduleLessonModal` gains an all-types radio picker whose selection feeds the live conflict preview and the PATCH body. The Lessons page wires the existing modal into its two LessonCard renders (admin-only).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase JS client, Vitest.

## Global Constraints

- Type/length changes ride ONLY through `PATCH /api/lessons/[id]/reschedule` (do not add `lesson_type` to the generic PATCH allow-list).
- Duration and price come from `config/lessonTypes.ts` — no free-form duration, no custom price. `getLessonDuration(id)`, `getLessonType(id)`, `getLessonRate(id)`, `formatRate(rate)`, and `lessonTypes` already exist there.
- Unknown `lesson_type` id → HTTP 400.
- `is_paid` is left untouched when the type/price changes; no billing reconciliation. The modal must surface the new price when it differs so the change is never silent.
- Single occurrence only: never touch sibling recurring lessons; `recurring_series_id` preserved.
- Side effects (conflict re-check, Zoom, Calendar, email) stay best-effort: each in its own try/catch, logged via `console.error`, never failing the reschedule. Conflict re-check is advisory (log-only), uses the NEW duration.
- Reschedule on the Lessons page is admin-only: pass `onReschedule` only for admins; `LessonCard` additionally self-gates `isAdmin && !isCancelled && !isPast`.
- No new env vars, no DB migrations.
- Verification: `npm run build` (types) must pass and `npm test` (Vitest, `lib/**/*.test.ts`) must stay green (currently 31 tests). These are UI/route tasks with no new pure-unit surface.

---

### Task 1: Reschedule route accepts an optional `lesson_type`

**Files:**
- Modify: `app/api/lessons/[id]/reschedule/route.ts`

**Interfaces:**
- Consumes: `getLessonDuration`, `getLessonType` (already imported in the file).
- Produces: `PATCH /api/lessons/[id]/reschedule` now accepts `{ start_time, notify_student, lesson_type? }`. When `lesson_type` is present and differs, it is validated, and the lesson's `lesson_type`/`end_time` (recomputed from the new type's duration) are updated; unknown id → 400.

- [ ] **Step 1: Add `lesson_type` to the request body destructure**

In `app/api/lessons/[id]/reschedule/route.ts`, change the destructure line:

```ts
  const { start_time, notify_student } = body as { start_time?: string; notify_student?: boolean };
```

to:

```ts
  const { start_time, notify_student, lesson_type } = body as { start_time?: string; notify_student?: boolean; lesson_type?: string };
```

- [ ] **Step 2: Resolve the effective type and validate it, then use it for duration**

Replace this block (currently right after the `if (!lesson) { ... 404 }` check):

```ts
  const duration = getLessonDuration(lesson.lesson_type);
  const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
  const oldStart = lesson.start_time;
```

with:

```ts
  // Resolve the (optionally changed) lesson type. Unknown id → 400.
  let effectiveType: string = lesson.lesson_type;
  if (lesson_type && lesson_type !== lesson.lesson_type) {
    if (!getLessonType(lesson_type)) {
      return NextResponse.json({ error: 'Unknown lesson type' }, { status: 400 });
    }
    effectiveType = lesson_type;
  }

  const duration = getLessonDuration(effectiveType);
  const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
  const oldStart = lesson.start_time;
```

(The conflict re-check below already uses `duration`, so it now uses the new type's duration automatically.)

- [ ] **Step 3: Persist the new `lesson_type` alongside the time**

In the `.update({ ... })` payload, add `lesson_type: effectiveType`:

```ts
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      lesson_type: effectiveType,
      updated_at: new Date().toISOString(),
    })
```

(Writing `effectiveType` unconditionally is a no-op when the type didn't change.)

- [ ] **Step 4: Use the effective type for the notification email**

In the notify block, change:

```ts
      const lessonTypeInfo = getLessonType(lesson.lesson_type);
```

to:

```ts
      const lessonTypeInfo = getLessonType(effectiveType);
```

(The Zoom update already passes the recomputed `duration`, so the meeting length updates too — no change needed there.)

- [ ] **Step 5: Verify build + tests**

Run: `npm run build`
Expected: compiles, no TypeScript errors; `/api/lessons/[id]/reschedule` still in the route table.

Run: `npm test`
Expected: 31 passing, no regressions.

- [ ] **Step 6: Commit**

```bash
git add app/api/lessons/[id]/reschedule/route.ts
git commit -m "feat: reschedule route accepts optional lesson_type (changes duration/price)"
```

---

### Task 2: Lesson-type picker in RescheduleLessonModal

**Files:**
- Modify: `components/RescheduleLessonModal.tsx`

**Interfaces:**
- Consumes: `PATCH /api/lessons/[id]/reschedule` (now accepts `lesson_type`, Task 1); `POST /api/lessons/preflight` (already derives duration from `lesson_type`); `lessonTypes`, `getLessonRate`, `formatRate`, `getLessonType` from `@/config/lessonTypes`.
- Produces: modal now sends the selected `lesson_type` in both the preflight preview and the reschedule PATCH; submit enables when time OR type changed.

- [ ] **Step 1: Import the lesson-type helpers**

Change the import at the top of `components/RescheduleLessonModal.tsx`:

```ts
import { getLessonType } from '@/config/lessonTypes';
```

to:

```ts
import { getLessonType, getLessonRate, formatRate, lessonTypes } from '@/config/lessonTypes';
```

- [ ] **Step 2: Add `lessonType` state and reset it on open**

Add the state alongside the others (after the `const [time, setTime] = useState(initialTime);` line):

```ts
  const [lessonType, setLessonType] = useState(lesson.lesson_type);
```

In the reset `useEffect` (the `if (isOpen) { ... }` block), add:

```ts
      setLessonType(lesson.lesson_type);
```

so the block reads:

```ts
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
      setLessonType(lesson.lesson_type);
      setNotify(true);
      setConflict(null);
      setError(null);
    }
```

- [ ] **Step 3: Fold type into the `unchanged` guard**

Change:

```ts
  const unchanged = date === initialDate && time === initialTime;
```

to:

```ts
  const unchanged = date === initialDate && time === initialTime && lessonType === lesson.lesson_type;
```

- [ ] **Step 4: Send the selected type in the preflight preview + re-run on type change**

In the debounced preflight `useEffect`, change the body's `lesson_type` from the lesson's to the selected state:

```ts
          body: JSON.stringify({
            lesson_type: lessonType,
            location_type: lesson.location_type,
            start_time: buildStart().toISOString(),
            exclude_lesson_id: lesson.id,
            student_id: lesson.student_id,
          }),
```

And add `lessonType` to that effect's dependency array so a type change re-runs the preview:

```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, lessonType, isOpen]);
```

- [ ] **Step 5: Send the selected type in the reschedule PATCH**

In `handleSubmit`, add `lesson_type` to the PATCH body:

```ts
        body: JSON.stringify({ start_time: buildStart().toISOString(), notify_student: notify, lesson_type: lessonType }),
```

- [ ] **Step 6: Compute the price-change flag**

Just below the `showZoomNote` line (near the other derived display values), add:

```ts
  const priceChanged = getLessonRate(lessonType) !== getLessonRate(lesson.lesson_type);
```

- [ ] **Step 7: Render the lesson-type picker**

Insert this block immediately AFTER the date/time `<div className="grid grid-cols-2 gap-4"> ... </div>` and BEFORE the `{/* Live conflict preview */}` block:

```tsx
        {/* Lesson type & length */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lesson type &amp; length
          </label>
          <div className="space-y-2">
            {lessonTypes.map(type => (
              <label
                key={type.id}
                className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-colors ${
                  lessonType === type.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="rescheduleLessonType"
                    value={type.id}
                    checked={lessonType === type.id}
                    onChange={() => setLessonType(type.id)}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{type.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatRate(type.rate)}
                </span>
              </label>
            ))}
          </div>
          {priceChanged && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Price changes to {formatRate(getLessonRate(lessonType))} (was {formatRate(getLessonRate(lesson.lesson_type))}). Paid status is left unchanged.
            </p>
          )}
        </div>
```

- [ ] **Step 8: Verify build + tests**

Run: `npm run build`
Expected: compiles, no TypeScript errors.

Run: `npm test`
Expected: 31 passing, no regressions.

- [ ] **Step 9: Commit**

```bash
git add components/RescheduleLessonModal.tsx
git commit -m "feat: add lesson-type/length picker to reschedule modal"
```

---

### Task 3: Wire Reschedule into the Lessons page

**Files:**
- Modify: `app/lessons/page.tsx`

**Interfaces:**
- Consumes: `RescheduleLessonModal` (`{ isOpen, onClose, lesson, onSuccess: (updated: Lesson) => void }`); `LessonCard`'s `onReschedule?: (lessonId: string) => void` prop.
- Produces: admin users get a Reschedule button on Lessons-page cards (timeline + grid); moved lesson updates in local state.

- [ ] **Step 1: Import the modal**

In `app/lessons/page.tsx`, add after the `CancelLessonModal` import (line 5):

```ts
import RescheduleLessonModal from '@/components/RescheduleLessonModal';
```

- [ ] **Step 2: Add reschedule state**

After the `lessonToCancel` state declaration (line 21), add:

```ts
  const [lessonToReschedule, setLessonToReschedule] = useState<Lesson | null>(null);
```

- [ ] **Step 3: Add the opener**

After the `openCancelModal` function (ends around line 64), add:

```ts
  const openRescheduleModal = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) setLessonToReschedule(lesson);
  };
```

- [ ] **Step 4: Pass `onReschedule` to the timeline LessonCard**

In the timeline render, the `LessonCard` currently reads:

```tsx
                        <LessonCard
                          key={lesson.id}
                          lesson={lesson}
                          isAdmin={isAdmin}
                          showStudent={isAdmin}
                          onCancel={
                            new Date(lesson.start_time) > now && lesson.status === 'scheduled'
                              ? openCancelModal
                              : undefined
                          }
                          onTogglePaid={isAdmin ? handleTogglePaid : undefined}
                          discountPercent={isAdmin ? (lesson.student?.discount_percent || 0) : discountPercent}
                        />
```

Add the `onReschedule` prop (after `onTogglePaid`):

```tsx
                          onReschedule={isAdmin ? openRescheduleModal : undefined}
```

- [ ] **Step 5: Pass `onReschedule` to the grid LessonCard**

In the grid/list render, the `LessonCard` currently reads:

```tsx
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isAdmin={isAdmin}
              showStudent={isAdmin}
              onCancel={
                new Date(lesson.start_time) > now && lesson.status === 'scheduled'
                  ? openCancelModal
                  : undefined
              }
              onTogglePaid={isAdmin ? handleTogglePaid : undefined}
              discountPercent={isAdmin ? (lesson.student?.discount_percent || 0) : discountPercent}
            />
```

Add the `onReschedule` prop (after `onTogglePaid`):

```tsx
              onReschedule={isAdmin ? openRescheduleModal : undefined}
```

- [ ] **Step 6: Render the modal**

Immediately after the `<CancelLessonModal ... />` element (around line 543), add:

```tsx
      {lessonToReschedule && (
        <RescheduleLessonModal
          isOpen={!!lessonToReschedule}
          onClose={() => setLessonToReschedule(null)}
          lesson={lessonToReschedule}
          onSuccess={(updated) => {
            setLessons((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setLessonToReschedule(null);
          }}
        />
      )}
```

- [ ] **Step 7: Verify build + tests**

Run: `npm run build`
Expected: compiles, no TypeScript errors.

Run: `npm test`
Expected: 31 passing, no regressions.

- [ ] **Step 8: Commit**

```bash
git add app/lessons/page.tsx
git commit -m "feat: add Reschedule action to Lessons page cards (admin only)"
```

---

## Manual Verification (after all tasks)

Run `npm run dev`, as an admin:

1. **Lessons page** (timeline + grid): each active lesson card shows **Reschedule**; a student account sees no such button.
2. Open Reschedule → change **30 Minute Voice Lesson** to **1 Hour Voice Lesson**: the price note appears, the conflict preview re-runs with the new length, and on confirm the card shows the new type; a check of the DB/Zoom/Calendar shows `end_time` a full hour and the Zoom meeting + Calendar event lengthened.
3. Change ONLY the type (leave date/time as-is): submit is enabled and works.
4. Reschedule from the calendar/students page still works unchanged and now also offers the type picker.
5. A type change on a recurring occurrence moves only that lesson; siblings unchanged.
6. Past/cancelled lessons show no Reschedule button.
