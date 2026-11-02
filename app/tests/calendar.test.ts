import { describe, it, expect } from 'vitest';
import { addWorkingDays, workingDaysBetween, isWeekend, isWorkingDay, riyadhDate, isOverdue, dayOfWeek, addDays } from '@/lib/calendar';

// 2026-11-01 is a Sunday.
describe('Sunday to Thursday week', () => {
  it('knows the weekend is Friday and Saturday', () => {
    expect(dayOfWeek('2026-11-01')).toBe(0);
    expect(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].every((d) => isWorkingDay(d))).toBe(true);
    expect(isWeekend('2026-11-06')).toBe(true); // Friday
    expect(isWeekend('2026-11-07')).toBe(true); // Saturday
  });
  it('adds working days across the weekend', () => {
    expect(addWorkingDays('2026-11-05', 1)).toBe('2026-11-08'); // Thursday + 1 = Sunday
    expect(addWorkingDays('2026-11-01', 5)).toBe('2026-11-08'); // Sunday + 5 = next Sunday
    expect(addWorkingDays('2026-11-08', -1)).toBe('2026-11-05'); // Sunday - 1 = Thursday
    expect(addWorkingDays('2026-11-06', 0)).toBe('2026-11-08'); // Friday rolls to Sunday
    expect(addWorkingDays('2026-11-02', 0)).toBe('2026-11-02');
  });
  it('skips supplied public holidays', () => {
    const h = new Set(['2026-11-02']);
    expect(addWorkingDays('2026-11-01', 1, h)).toBe('2026-11-03');
    expect(isWorkingDay('2026-11-02', h)).toBe(false);
  });
  it('counts working days between dates, both directions', () => {
    expect(workingDaysBetween('2026-11-01', '2026-11-08')).toBe(5);
    expect(workingDaysBetween('2026-11-08', '2026-11-01')).toBe(-5);
    expect(workingDaysBetween('2026-11-05', '2026-11-08')).toBe(1);
    expect(workingDaysBetween('2026-11-06', '2026-11-07')).toBe(0);
    expect(workingDaysBetween('2026-11-01', '2026-11-01')).toBe(0);
  });
  it('round-trips: adding then counting gives the same number', () => {
    for (let n = 0; n <= 40; n++) expect(workingDaysBetween('2026-11-01', addWorkingDays('2026-11-01', n))).toBe(n);
  });
  it('rejects things that are not dates', () => {
    expect(() => isWeekend('2026-02-30')).toThrow(RangeError);
    expect(() => isWeekend('soon')).toThrow(RangeError);
  });
});

describe('Riyadh time zone', () => {
  it('moves to the next calendar day at 21:00 UTC (midnight in Riyadh)', () => {
    expect(riyadhDate('2026-11-01T20:59:00Z')).toBe('2026-11-01');
    expect(riyadhDate('2026-11-01T21:00:00Z')).toBe('2026-11-02');
  });
  it('treats a date as overdue from the day after it', () => {
    expect(isOverdue('2026-11-01', '2026-11-01T20:00:00Z')).toBe(false);
    expect(isOverdue('2026-11-01', '2026-11-01T21:30:00Z')).toBe(true);
  });
  it('adds calendar days across a month end', () => { expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); });
});
