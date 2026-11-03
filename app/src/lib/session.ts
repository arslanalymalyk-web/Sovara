/**
 * Session policy: a session ends after `idleMinutes` without activity or `maxHours` after sign-in, whichever comes first.
 * The agreed policy is 30 minutes idle and 12 hours maximum for everyone (docs/PRODUCTION-PLAN.md §1a). Pure functions: the caller stores the
 * session (a signed, HTTP-only cookie holding this record) and passes in the clock.
 */
export interface SessionPolicy { idleMinutes: number; maxHours: number }
export interface Session { userId: string; createdAt: number; lastActivityAt: number }
export type SessionState = 'active' | 'idle_expired' | 'max_expired';
export const DEFAULT_POLICY: SessionPolicy = { idleMinutes: 30, maxHours: 12 };

export function newSession(userId: string, now: number): Session { return { userId, createdAt: now, lastActivityAt: now }; }

export function sessionState(s: Session, now: number, p: SessionPolicy = DEFAULT_POLICY): SessionState {
  if (now - s.createdAt >= p.maxHours * 3_600_000) return 'max_expired';
  if (now - s.lastActivityAt >= p.idleMinutes * 60_000) return 'idle_expired';
  return 'active';
}

/** Records activity. Returns null when the session has ended: the person must sign in again. Activity never extends the 12-hour limit. */
export function touch(s: Session, now: number, p: SessionPolicy = DEFAULT_POLICY): Session | null {
  if (sessionState(s, now, p) !== 'active') return null;
  return { ...s, lastActivityAt: now };
}

/** Milliseconds until the session ends if nothing happens (the earlier of the idle and maximum limits). */
export function msRemaining(s: Session, now: number, p: SessionPolicy = DEFAULT_POLICY): number {
  return Math.max(0, Math.min(s.lastActivityAt + p.idleMinutes * 60_000, s.createdAt + p.maxHours * 3_600_000) - now);
}
