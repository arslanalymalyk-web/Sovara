// Applies migrations and syncs the access rules. Run by the deployment pipeline: `npm run db:migrate`.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { syncAccessRules } from '../src/db/sync-rbac';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true } });
const db = drizzle(pool);
// next to the bundle (deployed) or in the source tree (development)
const here = import.meta.dirname;
const migrationsFolder = [path.resolve(here, 'migrations'), path.resolve(here, '../src/db/migrations')].find((d) => existsSync(d));
if (!migrationsFolder) { console.error('migrations folder not found'); process.exit(1); }
await migrate(db, { migrationsFolder });
console.log('migrations applied;', await syncAccessRules(db));
await pool.end();
