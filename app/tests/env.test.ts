import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/lib/env';

const good = { DATABASE_URL: 'postgres://u:p@db.example:5432/rgs', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_EXTERNAL_TENANT_ID: 'et', ENTRA_EXTERNAL_CLIENT_ID: 'ec', STORAGE_ACCOUNT_NAME: 'sa', ACS_CONNECTION_STRING: 'endpoint=x', MAIL_FROM: 'portal@example.com' };

describe('environment configuration', () => {
  it('accepts a complete configuration and applies the agreed defaults', () => {
    const e = parseEnv(good);
    expect(e.SESSION_IDLE_MINUTES).toBe(30); expect(e.SESSION_MAX_HOURS).toBe(12); expect(e.MAX_UPLOAD_MB).toBe(100); expect(e.DATABASE_SSL).toBe('require');
  });
  it('lists every missing value at once', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*ENTRA_TENANT_ID[\s\S]*MAIL_FROM/);
  });
  it('rejects a bad sender address and out-of-range limits', () => {
    expect(() => parseEnv({ ...good, MAIL_FROM: 'nope' })).toThrow(/MAIL_FROM/);
    expect(() => parseEnv({ ...good, MAX_UPLOAD_MB: '5000' })).toThrow(/MAX_UPLOAD_MB/);
  });
  it('refuses unsafe settings in production', () => {
    expect(() => parseEnv({ ...good, APP_ENV: 'production', DATABASE_SSL: 'disable' })).toThrow(/cannot be disabled/);
    expect(() => parseEnv({ ...good, APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@localhost/rgs' })).toThrow(/local database/);
    expect(() => parseEnv({ ...good, APP_ENV: 'dev', DATABASE_SSL: 'disable' })).not.toThrow();
  });
});
