import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as schema from '@/db/schema';
import { syncAccessRules } from '@/db/sync-rbac';
import { fixtures } from './helpers';

/** Deterministic uuid for a prototype id such as "u-pm", so the demo data can be loaded into uuid columns. */
export function uid(id: string): string {
  const h = createHash('md5').update('rgs:' + id).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const migrationsFolder = path.resolve(import.meta.dirname, '../src/db/migrations');

/**
 * Builds a fresh database with the real migrations. By default it is an in-memory PostgreSQL (PGlite).
 * Set TEST_DATABASE_URL to run the very same tests against a real PostgreSQL server (CI does this); the `public` schema is wiped first.
 */
export async function createTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 1 });
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
    const pdb = drizzlePg(pool, { schema });
    await pgMigrate(pdb, { migrationsFolder });
    const synced = await syncAccessRules(pdb as never);
    return { client: { close: () => pool.end() }, db: pdb as unknown as ReturnType<typeof drizzle<typeof schema>>, synced };
  }
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  const synced = await syncAccessRules(db);
  return { client, db, synced };
}

/** Loads the prototype's demo data. Skips the one authority the prototype keeps as a deliberate "longer than 12 months" example. */
export async function seedDemo(db: Awaited<ReturnType<typeof createTestDb>>['db']) {
  const f = fixtures as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.organisations).values(f.orgs.map((o: any) => ({ id: uid(o.id), kind: o.kind, name: o.name, nameAr: o.nameAr }))); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.users).values(f.users.map((u: any) => ({ id: uid(u.id), orgId: uid(u.orgId), email: u.email, name: u.name, status: u.status }))); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.projects).values(f.projects.map((p: any) => ({ id: uid(p.id), code: p.code, customerOrgId: uid(p.customerOrgId), type: p.type, name: p.name, status: ['planning', 'execution', 'handover', 'closed'].includes(p.status) ? p.status : 'execution' }))); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.areas).values(f.areas.map((a: any) => ({ id: uid(a.id), projectId: uid(a.projectId), code: a.code, name: a.name, kind: a.kind }))); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.packages).values(f.packages.map((w: any) => ({ id: uid(w.id), projectId: uid(w.projectId), areaId: w.areaId ? uid(w.areaId) : null, service: w.service, code: w.code, name: w.code }))); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.roleAssignments).values(f.assignments.map((a: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: uid(a.id), userId: uid(a.userId), role: a.role, scopeAllProjects: a.scope.projectId === '*', scopeProjectId: a.scope.projectId === '*' ? null : uid(a.scope.projectId),
    scopeAreaId: a.scope.areaId ? uid(a.scope.areaId) : null, scopeService: a.scope.service ?? null })));
  const auths = f.authorities.filter((d: any) => !d.validTo || (new Date(d.validTo).getTime() - new Date(d.validFrom).getTime()) / 864e5 <= 366); // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.insert(schema.delegatedAuthorities).values(auths.map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: uid(d.id), ref: d.id, userId: uid(d.userId), action: d.action, scopeProjectId: uid(d.scope.projectId), scopeService: d.scope.service ?? null, scopeCategories: d.scope.categories ?? null,
    grantedBy: uid(d.grantedBy), nominatedByUser: String(d.nominatedBy).startsWith('u-') ? uid(d.nominatedBy) : null, nominatedByOrg: String(d.nominatedBy).startsWith('org-') ? uid(d.nominatedBy) : null,
    status: d.revokedAt ? 'revoked' : 'active', validFrom: d.validFrom, validTo: d.validTo, revokedAt: d.revokedAt ? new Date(d.revokedAt) : null, revokedBy: d.revokedAt ? uid(d.revokedBy ?? d.grantedBy) : null })));
  return { skippedAuthorities: f.authorities.length - auths.length };
}
