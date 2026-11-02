import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { ACTIONS, ROLES } from '@/lib/rbac';
import { actions, rolePermissions, roles } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * Makes the database's copy of the access rules equal the TypeScript rules (the single source of truth).
 * Row-level security reads these tables. Idempotent: run after every migration and on every deploy.
 */
export async function syncAccessRules(db: Db): Promise<{ actions: number; roles: number; permissions: number }> {
  return db.transaction(async (tx) => {
    const actionRows = Object.entries(ACTIONS).map(([id, d]) => ({ id, kind: d.kind, module: d.module }));
    const roleRows = Object.entries(ROLES).map(([id, d]) => ({ id, side: d.side, scopeLevel: d.scopeLevel }));
    const permRows = Object.entries(ROLES).flatMap(([role, d]) => [
      ...[...new Set(d.grants)].map((action) => ({ role, action, relation: 'grant' })),
      ...[...new Set(d.eligible)].map((action) => ({ role, action, relation: 'eligible' })),
    ]);
    await tx.insert(actions).values(actionRows).onConflictDoUpdate({ target: actions.id, set: { kind: sql`excluded.kind`, module: sql`excluded.module` } });
    await tx.insert(roles).values(roleRows).onConflictDoUpdate({ target: roles.id, set: { side: sql`excluded.side`, scopeLevel: sql`excluded.scope_level` } });
    await tx.delete(rolePermissions); // rebuilt below in the same transaction
    for (let i = 0; i < permRows.length; i += 500) await tx.insert(rolePermissions).values(permRows.slice(i, i + 500));
    return { actions: actionRows.length, roles: roleRows.length, permissions: permRows.length };
  });
}
