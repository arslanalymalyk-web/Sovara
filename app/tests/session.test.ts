import { describe, it, expect } from 'vitest';
import { newSession, sessionState, touch, msRemaining, DEFAULT_POLICY } from '@/lib/session';

const MIN = 60_000, HOUR = 3_600_000, T0 = Date.UTC(2026, 10, 3, 8, 0, 0);
describe('session policy (30 minutes idle, 12 hours maximum)', () => {
  it('is the agreed default', () => { expect(DEFAULT_POLICY).toEqual({ idleMinutes: 30, maxHours: 12 }); });
  it('stays active while the person keeps working', () => {
    let s = newSession('u1', T0);
    for (let m = 20; m <= 600; m += 20) { const next = touch(s, T0 + m * MIN); expect(next, `at ${m} min`).not.toBeNull(); s = next!; }
    expect(sessionState(s, T0 + 600 * MIN)).toBe('active');
  });
  it('ends after 30 minutes without activity', () => {
    const s = newSession('u1', T0);
    expect(sessionState(s, T0 + 29 * MIN)).toBe('active');
    expect(sessionState(s, T0 + 30 * MIN)).toBe('idle_expired');
    expect(touch(s, T0 + 31 * MIN)).toBeNull();
  });
  it('ends after 12 hours however active the person is', () => {
    let s = newSession('u1', T0);
    for (let m = 20; m < 12 * 60; m += 20) s = touch(s, T0 + m * MIN)!;
    expect(sessionState(s, T0 + 12 * HOUR)).toBe('max_expired');
    expect(touch(s, T0 + 12 * HOUR + 1)).toBeNull();
  });
  it('reports the time left as the earlier of the two limits', () => {
    const s = newSession('u1', T0);
    expect(msRemaining(s, T0)).toBe(30 * MIN);
    const late = { ...s, lastActivityAt: T0 + 11 * HOUR + 40 * MIN }; // active just now, within the last 20 minutes of the 12 hours
    expect(msRemaining(late, T0 + 11 * HOUR + 40 * MIN)).toBe(20 * MIN);
    expect(msRemaining(s, T0 + 5 * HOUR)).toBe(0);
  });
  it('accepts a custom policy', () => { expect(sessionState(newSession('u', T0), T0 + 10 * MIN, { idleMinutes: 5, maxHours: 1 })).toBe('idle_expired'); });
});
