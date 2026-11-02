import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | undefined;

/** One pool per process. The connection string comes from the environment (Key Vault in Azure). */
export function getDb() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true } });
  }
  return drizzle(pool, { schema });
}
export async function closeDb() { await pool?.end(); pool = undefined; }
export { schema };
