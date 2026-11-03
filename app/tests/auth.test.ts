import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT, generateKeyPair, createLocalJWKSet, exportJWK, type JWK } from 'jose';
import { sql } from 'drizzle-orm';
import { createTestDb, seedDemo, uid } from './db';
import { verifyIdToken, AuthError, type IdentityConfig } from '@/lib/auth/entra';
import { signIn } from '@/domain/auth';
import { inviteUser, setUserStatus } from '@/domain/admin';
import { sessionState } from '@/lib/session';

const TENANT = '11111111-2222-3333-4444-555555555555', CLIENT = 'portal-client-id', ISS = `https://login.microsoftonline.com/${TENANT}/v2.0`;
let cfg: IdentityConfig, priv: CryptoKey, other: CryptoKey;
const now = new Date('2026-11-03T08:00:00Z');

async function token(over: Record<string, unknown> = {}, opts: { key?: CryptoKey; iss?: string; aud?: string; exp?: number; iat?: number } = {}) {
  const claims = { tid: TENANT, oid: 'oid-ali', nonce: 'n-1', amr: ['pwd', 'mfa'], email: 'ali@rgs.example', name: 'Ali', ...over };
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(opts.iss ?? ISS).setAudience(opts.aud ?? CLIENT)
    .setIssuedAt(opts.iat ?? Math.floor(now.getTime() / 1000) - 60).setExpirationTime(opts.exp ?? Math.floor(now.getTime() / 1000) + 3600).sign(opts.key ?? priv);
}
const reason = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return e instanceof AuthError ? e.code : 'THROWN ' + (e as Error).message; } };

beforeAll(async () => {
  const a = await generateKeyPair('RS256'), b = await generateKeyPair('RS256');
  priv = a.privateKey; other = b.privateKey;
  const jwk: JWK = { ...(await exportJWK(a.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  cfg = { issuer: ISS, audience: CLIENT, tenantId: TENANT, jwks: createLocalJWKSet({ keys: [jwk] }), subjectClaim: 'oid', requireMfa: true };
});

describe('identity token verification', () => {
  it('accepts a correct token and returns who it is', async () => {
    expect(await verifyIdToken(await token(), cfg, { nonce: 'n-1', now })).toEqual({ subject: 'oid-ali', email: 'ali@rgs.example', name: 'Ali' });
  });
  it('rejects a token signed with a different key', async () => { expect(await reason(verifyIdToken(await token({}, { key: other }), cfg, { nonce: 'n-1', now }))).toBe('invalid_token'); });
  it('rejects the wrong issuer, audience or tenant', async () => {
    expect(await reason(verifyIdToken(await token({}, { iss: 'https://evil.example/v2.0' }), cfg, { nonce: 'n-1', now }))).toBe('invalid_token');
    expect(await reason(verifyIdToken(await token({}, { aud: 'someone-else' }), cfg, { nonce: 'n-1', now }))).toBe('invalid_token');
    expect(await reason(verifyIdToken(await token({ tid: 'other-tenant' }), cfg, { nonce: 'n-1', now }))).toBe('wrong_tenant');
  });
  it('rejects an expired token', async () => { expect(await reason(verifyIdToken(await token({}, { exp: Math.floor(now.getTime() / 1000) - 600 }), cfg, { nonce: 'n-1', now }))).toBe('expired'); });
  it('rejects a replayed sign-in (nonce) and a missing second factor', async () => {
    expect(await reason(verifyIdToken(await token(), cfg, { nonce: 'a-different-attempt', now }))).toBe('nonce_mismatch');
    expect(await reason(verifyIdToken(await token({ amr: ['pwd'] }), cfg, { nonce: 'n-1', now }))).toBe('mfa_required');
    expect(await reason(verifyIdToken(await token({ amr: undefined }), cfg, { nonce: 'n-1', now }))).toBe('mfa_required');
  });
  it('rejects a token with no stable identity or no email', async () => {
    expect(await reason(verifyIdToken(await token({ oid: undefined }), cfg, { nonce: 'n-1', now }))).toBe('missing_identity');
    expect(await reason(verifyIdToken(await token({ email: undefined }), cfg, { nonce: 'n-1', now }))).toBe('missing_email');
  });
  it('refuses an unsigned ("alg: none") token', async () => {
    const unsigned = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ iss: ISS, aud: CLIENT, tid: TENANT, oid: 'x', nonce: 'n-1', amr: ['mfa'], email: 'a@b.co', exp: 9999999999 })).toString('base64url') + '.';
    expect(await reason(verifyIdToken(unsigned, cfg, { nonce: 'n-1', now }))).toBe('invalid_token');
  });
});

describe('signing in end to end', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>; let db: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  beforeAll(async () => { t = await createTestDb(); db = t.db; await seedDemo(db); });
  afterAll(async () => { await t.client.close(); });

  it('an invited person signs in, is activated, and gets a session with the agreed limits', async () => {
    await inviteUser(db, uid('u-adm'), { name: 'Ali Hassan', email: 'ali@rgs.example', orgId: uid('org-rgs'), role: 'service_supervisor', projectId: uid('p1') });
    const r = await signIn(db, await token(), cfg, { nonce: 'n-1', now });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(sessionState(r.session, now.getTime() + 29 * 60_000)).toBe('active');
      expect(sessionState(r.session, now.getTime() + 31 * 60_000)).toBe('idle_expired');
      expect((await db.execute(sql`select status from users where id = ${r.userId}`) as { rows: { status: string }[] }).rows[0]!.status).toBe('active');
    }
  });
  it('the same person can sign in again; a different identity cannot take over the account', async () => {
    expect((await signIn(db, await token(), cfg, { nonce: 'n-1', now })).ok).toBe(true);
    const thief = await signIn(db, await token({ oid: 'oid-someone-else' }), cfg, { nonce: 'n-1', now });
    expect(thief).toEqual({ ok: false, reason: 'no_invitation' });
  });
  it('a person with no invitation is refused, even with a valid token', async () => {
    expect(await signIn(db, await token({ oid: 'oid-x', email: 'stranger@example.com' }), cfg, { nonce: 'n-1', now })).toEqual({ ok: false, reason: 'no_invitation' });
  });
  it('a suspended person is refused, and a bad token never reaches the database', async () => {
    const id = ((await db.execute(sql`select id from users where email = 'ali@rgs.example'`)) as { rows: { id: string }[] }).rows[0]!.id;
    await setUserStatus(db, uid('u-adm'), { id, status: 'suspended', reason: 'Left the company.' });
    expect(await signIn(db, await token(), cfg, { nonce: 'n-1', now })).toEqual({ ok: false, reason: 'not_active' });
    const before = ((await db.execute(sql`select count(*)::int as n from audit_log`)) as { rows: { n: number }[] }).rows[0]!.n;
    expect(await signIn(db, await token({ amr: ['pwd'] }), cfg, { nonce: 'n-1', now })).toEqual({ ok: false, reason: 'mfa_required' });
    expect(((await db.execute(sql`select count(*)::int as n from audit_log`)) as { rows: { n: number }[] }).rows[0]!.n).toBe(before);
  });
});
