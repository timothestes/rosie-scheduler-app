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
