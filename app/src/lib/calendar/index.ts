/**
 * Working calendar for RGS: the working week is Sunday to Thursday; Friday and Saturday are the weekend.
 * Dates are calendar dates in Asia/Riyadh written `YYYY-MM-DD`. Public holidays are supplied by the caller (a set of such dates),
 * because the list is a policy RGS maintains, not a constant.
 */
export const TIME_ZONE = 'Asia/Riyadh';
export const WEEKEND_DAYS: readonly number[] = [5, 6]; // 0 = Sunday ... 6 = Saturday

export type DateString = string;
export type Holidays = ReadonlySet<DateString>;
const NO_HOLIDAYS: Holidays = new Set();
const DAY = 86_400_000;

function parse(d: DateString): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new RangeError(`Not a date (YYYY-MM-DD): ${d}`);
  const t = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) throw new RangeError(`Not a real date: ${d}`);
  return t;
}
const fmt = (t: Date): DateString => t.toISOString().slice(0, 10);

/** The Riyadh calendar date of an instant (Riyadh is UTC+3 all year, with no daylight saving). */
export function riyadhDate(instant: Date | string | number): DateString {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
export function dayOfWeek(d: DateString): number { return parse(d).getUTCDay(); }
export function isWeekend(d: DateString): boolean { return WEEKEND_DAYS.includes(dayOfWeek(d)); }
export function isWorkingDay(d: DateString, holidays: Holidays = NO_HOLIDAYS): boolean { return !isWeekend(d) && !holidays.has(d); }
export function addDays(d: DateString, n: number): DateString { return fmt(new Date(parse(d).getTime() + n * DAY)); }

/** The date `n` working days after `d` (negative goes back). `n = 0` returns `d` if it is a working day, else the next one. */
export function addWorkingDays(d: DateString, n: number, holidays: Holidays = NO_HOLIDAYS): DateString {
  let cur = d;
  if (n === 0) { while (!isWorkingDay(cur, holidays)) cur = addDays(cur, 1); return cur; }
  const step = n > 0 ? 1 : -1;
  let left = Math.abs(n);
  while (left > 0) { cur = addDays(cur, step); if (isWorkingDay(cur, holidays)) left--; }
  return cur;
}
/** Working days from `from` (exclusive) to `to` (inclusive); negative when `to` is earlier. */
export function workingDaysBetween(from: DateString, to: DateString, holidays: Holidays = NO_HOLIDAYS): number {
  if (from === to) return 0;
  const sign = from < to ? 1 : -1;
  const [a, b] = sign === 1 ? [from, to] : [to, from];
  let n = 0;
  for (let cur = addDays(a, 1); cur <= b; cur = addDays(cur, 1)) if (isWorkingDay(cur, holidays)) n++;
  return sign * n;
}
/** Is a due date in the past, judged by the Riyadh calendar? A date is overdue from the day after it. */
export function isOverdue(due: DateString, now: Date | string | number = Date.now()): boolean { return due < riyadhDate(now); }
