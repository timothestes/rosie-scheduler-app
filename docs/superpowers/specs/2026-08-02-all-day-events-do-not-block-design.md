# All-day Google events do not block bookings

**Date:** 2026-08-02
**Status:** Approved
**Amends:** [2026-07-31-google-calendar-busy-import-design.md](2026-07-31-google-calendar-busy-import-design.md) §4.3

## Problem

The busy-time import treats any opaque (Busy) Google event as unavailability. In
practice a teacher's all-day events are day *labels*, not unavailability:
"Laundry", "Cooking Day", "Joe's Birthday". Google reports these as Busy, so the
import blocked the entire day.

Measured against production on 2026-08-02:

| Metric | Value |
|---|---|
| All-day blocks in the 180-day mirror | 71 |
| Distinct days they covered | 67 |
| Teaching weekdays in next 90 days | 65 |
| Of those, fully blocked by all-day events | **31 (47.7%)** |
| All-day events spanning more than one day | **0** |

Roughly half of Rosie's teaching capacity was closed to students for no real
reason. Every all-day event was exactly one day long — none represented a trip
or vacation.

The original design assumed all-day events default to `transparency:
'transparent'` (Free) and would therefore block "only if marked Busy". That
assumption did not hold for this calendar: the events arrive opaque.

## Decision

**All-day (date-only) events never block, regardless of their Busy/Free setting.**

Timed events are unchanged.

Whole-day unavailability is expressed with in-app day-blocks
(`availability_overrides`), which the teacher already uses actively — 25 rows, 11
of them in the future, extending to 2026-10-03. That is the single, deliberate
mechanism for "I am away".

### Consequence, accepted

Nothing on the Google side blocks a whole day any more. An **all-day**
out-of-office event does not block. A **timed** out-of-office event still does.

This must be communicated to the teacher: *if you are away, block the day in the
app — marking it Busy in Google will not stop bookings.*

## Implementation

One rule in the pure predicate `shouldBlockEvent`
([lib/google-busy-core.ts](../../../lib/google-busy-core.ts)):

```ts
if (event.start.date && !event.start.dateTime) return false;
```

Placed before the `transparency` check, so all-day events are dropped whether
Google marks them Busy or Free.

### Why the filter lives at sync time, not read time

Two consumers read this data: the server-side conflict check
([lib/conflicts.ts](../../../lib/conflicts.ts)) and the student slot grid via
[/api/availability/busy](../../../app/api/availability/busy/route.ts). Filtering
on read would require both to filter identically forever, and any future reader
to remember.

That is exactly the failure mode this codebase just experienced in production:
the server and the UI disagreeing about availability. Filtering once at write
time makes both readers correct by construction and makes disagreement
structurally impossible.

### Data cleanup

None required. `replace_google_busy_blocks` performs a whole-table
delete-then-insert per admin, so the 71 stale all-day rows are purged by the
first cron run after deploy (≤15 minutes). The change is also trivially
reversible: revert and the next sync restores the previous contents.

### Not done

`is_all_day` and the all-day branch of `eventToInterval` are retained. The column
is harmless and the mapper remains a faithful model of Google's event shape;
removing either would mean a migration and churn for no benefit.

## Testing

Test-first, in `lib/google-busy-core.test.ts`:

- all-day event marked Busy → does not block *(failed before the change)*
- all-day event marked Free → does not block
- all-day out-of-office → does not block *(failed before the change)*
- timed out-of-office → still blocks (rule is scoped to all-day only)

Full suite: 117 tests passing.

### Post-deploy verification

After the first cron run, confirm against production that:

- Wed 2026-08-05 **3:00pm** still blocks (timed event) — unchanged
- Wed 2026-08-05 **10:00am** is now bookable (was blocked only by the all-day event)
- `select count(*) from google_busy_blocks where is_all_day` returns **0**
