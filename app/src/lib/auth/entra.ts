/**
 * Verifies identity tokens from Microsoft Entra ID (staff) and Microsoft Entra External ID (customers).
 * The portal never sees a password: it accepts a signed token, checks everything that makes it trustworthy, and requires MFA.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

export class AuthError extends Error {
  constructor(public readonly code: 'invalid_token' | 'expired' | 'wrong_tenant' | 'mfa_required' | 'nonce_mismatch' | 'missing_identity' | 'missing_email', message?: string) { super(message ?? code); this.name = 'AuthError'; }
}

export interface IdentityConfig {
  /** Exact `iss` the provider puts in tokens, e.g. https://login.microsoftonline.com/<tenant>/v2.0 */
  issuer: string;
  /** The portal's application (client) id: the token's `aud`. */
  audience: string;
  tenantId: string;
  jwks: JWTVerifyGetKey;
  /** Which claim identifies the person for good. Entra staff: `oid`; External ID: `sub`. */
  subjectClaim: 'oid' | 'sub';
  requireMfa: boolean;
}
export interface VerifiedIdentity { subject: string; email: string; name: string | null }

export function staffConfig(env: { ENTRA_TENANT_ID: string; ENTRA_CLIENT_ID: string }): IdentityConfig {
  const base = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}`;
  return { issuer: `${base}/v2.0`, audience: env.ENTRA_CLIENT_ID, tenantId: env.ENTRA_TENANT_ID, jwks: createRemoteJWKSet(new URL(`${base}/discovery/v2.0/keys`)), subjectClaim: 'oid', requireMfa: true };
}
export function customerConfig(env: { ENTRA_EXTERNAL_TENANT_ID: string; ENTRA_EXTERNAL_CLIENT_ID: string; ENTRA_EXTERNAL_SUBDOMAIN?: string }): IdentityConfig {
  const host = `${env.ENTRA_EXTERNAL_SUBDOMAIN ?? env.ENTRA_EXTERNAL_TENANT_ID}.ciamlogin.com`;
  return { issuer: `https://${host}/${env.ENTRA_EXTERNAL_TENANT_ID}/v2.0`, audience: env.ENTRA_EXTERNAL_CLIENT_ID, tenantId: env.ENTRA_EXTERNAL_TENANT_ID, jwks: createRemoteJWKSet(new URL(`https://${host}/${env.ENTRA_EXTERNAL_TENANT_ID}/discovery/v2.0/keys`)), subjectClaim: 'sub', requireMfa: true };
}

function pickEmail(p: JWTPayload): string | null {
  const c = [p.email, p.preferred_username, p.upn, Array.isArray(p.emails) ? p.emails[0] : undefined].find((x) => typeof x === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  return c ? String(c).toLowerCase() : null;
}

/** Accepts only a correctly signed, unexpired token for this application, tenant and sign-in attempt, with MFA completed. */
export async function verifyIdToken(token: string, cfg: IdentityConfig, opts: { nonce: string; now?: Date }): Promise<VerifiedIdentity> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, cfg.jwks, { issuer: cfg.issuer, audience: cfg.audience, algorithms: ['RS256'], clockTolerance: 60, currentDate: opts.now }));
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new AuthError(code === 'ERR_JWT_EXPIRED' ? 'expired' : 'invalid_token', String((e as Error).message));
  }
  if (payload.tid !== cfg.tenantId) throw new AuthError('wrong_tenant');
  if (payload.nonce !== opts.nonce) throw new AuthError('nonce_mismatch');
  if (cfg.requireMfa && !(Array.isArray(payload.amr) && payload.amr.includes('mfa'))) throw new AuthError('mfa_required');
  const subject = payload[cfg.subjectClaim];
  if (typeof subject !== 'string' || !subject) throw new AuthError('missing_identity');
  const email = pickEmail(payload);
  if (!email) throw new AuthError('missing_email');
  return { subject, email, name: typeof payload.name === 'string' ? payload.name : null };
}
