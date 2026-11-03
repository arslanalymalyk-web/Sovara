import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { withUser } from '@/db/session';
import * as schema from '@/db/schema';
import type { Assignment, Authority, Ctx } from '@/lib/rbac';
import { can, canAnywhere, type Decision, type Resource } from '@/lib/rbac';
import { CommandError } from './errors';

export type Db = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface Snapshot {
  orgs: { id: string; kind: 'rgs' | 'customer' }[];
  users: { id: string; orgId: string; status: string; email: string }[];
  projects: { id: string; customerOrgId: string }[];
  areas: { id: string; projectId: string }[];
  packages: { id: string; projectId: string; areaId: string | null; service: string | null }[];
  assignments: { id: string; userId: string; role: string; status: string; allProjects: boolean; projectId: string | null; areaId: string | null; service: string | null; validFrom: string | null; validUntil: string | null }[];
  authorities: { id: string; ref: string; userId: string; action: string; status: string; projectId: string; areaId: string | null; service: string | null; categories: string[] | null; grantedBy: string; revokedAt: string | null; validFrom: string; validTo: string }[];
}

/** Turns the database's authorization snapshot into the shape the access rules read. */
export function toCtx(s: Snapshot, now: Date): Ctx {
  const assignments: Assignment[] = s.assignments.map((a) => ({
    id: a.id, userId: a.userId, role: a.role, status: a.status,
    scope: a.allProjects ? { projectId: '*' } : { projectId: a.projectId ?? undefined, ...(a.areaId ? { areaId: a.areaId } : {}), ...(a.service ? { service: a.service } : {}) },
    ...(a.validFrom ? { validFrom: a.validFrom } : {}), ...(a.validUntil ? { validUntil: a.validUntil } : {}),
  }));
  const authorities: Authority[] = s.authorities.map((d) => ({
    id: d.id, userId: d.userId, action: d.action, status: d.status, grantedBy: d.grantedBy, revokedAt: d.revokedAt,
    scope: { projectId: d.projectId, ...(d.areaId ? { areaId: d.areaId } : {}), ...(d.service ? { service: d.service } : {}), ...(d.categories ? { categories: d.categories } : {}) },
    validFrom: d.validFrom, validTo: d.validTo,
  }));
  return {
    now, orgs: s.orgs, users: s.users.map((u) => ({ id: u.id, orgId: u.orgId, status: u.status })),
    projects: s.projects, areas: s.areas, packages: s.packages.map((p) => ({ ...p })), assignments, authorities,
  };
}

export interface CommandContext {
  tx: Tx; actor: string; now: Date; snapshot: Snapshot; ctx: Ctx;
  /** Refuse unless the actor may do this (the same rules as the prototype's `allow`). */
  allow(action: string, resource?: Resource | null): Decision;
  /** Refuse unless the actor holds the action somewhere (for actions with no single record, such as support). */
  allowAnywhere(action: string): void;
  /** Write the audit entry for this command. Every command must call it exactly once. */
  audit(entry: { action: string; recordKind?: string; recordId?: string; reason?: string; detail?: unknown }): Promise<void>;
}

/**
 * Runs one command as one person: one transaction (all or nothing), row-level security on, the actor's access rules checked,
 * and the audit entry written inside the same transaction. A refused command changes nothing.
 */
export async function runCommand<T>(db: Db, actor: string, fn: (c: CommandContext) => Promise<T>, clock: () => Date = () => new Date()): Promise<T> {
  return withUser(db, actor, async (tx) => {
    const now = clock();
    const snap = (await tx.execute(sql`select app_authz_snapshot() as s`)) as unknown as { rows: { s: Snapshot }[] };
    const snapshot = snap.rows[0]!.s;
    const ctx = toCtx(snapshot, now);
    const me = ctx.users.find((u) => u.id === actor);
    if (!me || me.status !== 'active') throw new CommandError('inactive');
    const c: CommandContext = {
      tx, actor, now, snapshot, ctx,
      allow(action, resource = null) {
        const d = can(ctx, actor, action, resource);
        if (!d.allowed) throw new CommandError(d.code === 'role' || d.code === 'scope' ? 'forbidden' : d.code, { action, trace: d.trace });
        return d;
      },
      allowAnywhere(action) { if (!canAnywhere(ctx, actor, action)) throw new CommandError('forbidden', { action }); },
      async audit(e) {
        await tx.insert(schema.auditLog).values({ actorId: actor, action: e.action, recordKind: e.recordKind ?? null, recordId: e.recordId ?? null, reason: e.reason ?? null, detail: (e.detail as object) ?? null });
      },
    };
    return fn(c);
  });
}
