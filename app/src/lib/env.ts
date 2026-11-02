import { z } from 'zod';

/**
 * Environment configuration, validated once at start-up so a missing or malformed value stops the deployment
 * instead of failing later in front of a user. Secrets come from Azure Key Vault references in App Service settings.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['dev', 'staging', 'production']).default('dev'),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['require', 'disable']).default('require'),
  ENTRA_TENANT_ID: z.string().min(1),
  ENTRA_CLIENT_ID: z.string().min(1),
  ENTRA_EXTERNAL_TENANT_ID: z.string().min(1),
  ENTRA_EXTERNAL_CLIENT_ID: z.string().min(1),
  STORAGE_ACCOUNT_NAME: z.string().min(1),
  STORAGE_CONTAINER: z.string().default('files'),
  ACS_CONNECTION_STRING: z.string().min(1),
  MAIL_FROM: z.string().email(),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(500).default(100),
});
export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const env = r.data;
  if (env.APP_ENV === 'production' && env.DATABASE_SSL === 'disable') throw new Error('Invalid configuration:\n  - DATABASE_SSL: cannot be disabled in production');
  if (env.APP_ENV === 'production' && /localhost|127\.0\.0\.1/.test(env.DATABASE_URL)) throw new Error('Invalid configuration:\n  - DATABASE_URL: points at a local database in production');
  return env;
}
