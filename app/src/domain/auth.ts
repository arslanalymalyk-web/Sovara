import { sql } from 'drizzle-orm';
import type { Db } from './command';
import { AuthError, verifyIdToken, type IdentityConfig } from '@/lib/auth/entra';
import { newSession, type Session } from '@/lib/session';

export type SignInResult = { ok: true; userId: string; session: Session } | { ok: false; reason: 'invalid_token' | 'expired' | 'wrong_tenant' | 'mfa_required' | 'nonce_mismatch' | 'missing_identity' | 'missing_email' | 'no_invitation' | 'not_active' };

/**
 * Completes sign-in after the identity provider redirects back. The token is verified first; only then is the account looked up.
 * An invited person is activated on first sign-in (accepting the invitation); a suspended person is refused.
 */
export async function signIn(db: Db, token: string, cfg: IdentityConfig, opts: { nonce: string; now?: Date }): Promise<SignInResult> {
  let who;
  try { who = await verifyIdToken(token, cfg, opts); }
  catch (e) { if (e instanceof AuthError) return { ok: false, reason: e.code }; throw e; }
  const r = (await db.transaction(async (tx) => {
    await tx.execute(sql`set local role rgs_app_rw`);
    return tx.execute(sql`select * from app_sign_in(${who.subject}, ${who.email})`);
  })) as unknown as { rows: { out_user_id: string | null; out_status: string | null; out_outcome: string }[] };
  const row = r.rows[0]!;
  if (row.out_outcome !== 'ok' || !row.out_user_id) return { ok: false, reason: row.out_outcome === 'not_active' ? 'not_active' : 'no_invitation' };
  return { ok: true, userId: row.out_user_id, session: newSession(row.out_user_id, (opts.now ?? new Date()).getTime()) };
}
