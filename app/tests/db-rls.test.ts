import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb, seedDemo, uid } from './db';
import { withUser } from '@/db/session';
import * as schema from '@/db/schema';
import { can, visibleProjects } from '@/lib/rbac';
import { demoCtx } from './helpers';
import { ACTIONS, ROLES } from '@/lib/rbac';

type T = Awaited<ReturnType<typeof createTestDb>>;
let t: T, db: T['db'];
const ctx = demoCtx();
const ids = async (user: string, table: string): Promise<string[]> => { const res = (await withUser(db as never, uid(user), (tx) => tx.execute(sql.raw(`select id from ${table}`)))) as unknown as { rows: { id: string }[] }; return res.rows.map((r) => String(r.id)).sort(); };
const rejects = async (p: Promise<unknown>) => { let err: unknown; try { await p; } catch (e) { err = e; } return String((err as { cause?: { message?: string }; message?: string })?.cause?.message ?? (err as Error | undefined)?.message ?? ''); };

beforeAll(async () => { t = await createTestDb(); db = t.db; await seedDemo(db); });
afterAll(async () => { await t.client.close(); });

describe('migrations and access-rule sync', () => {
  it('create the schema and load every action and role from the TypeScript rules', async () => {
    expect(t.synced).toMatchObject({ actions: Object.keys(ACTIONS).length, roles: Object.keys(ROLES).length });
    const n = (await db.execute(sql`select count(*)::int as n from role_permissions`)).rows[0] as { n: number };
    expect(n.n).toBe(t.synced.permissions);
  });
  it('syncing again changes nothing (idempotent)', async () => {
    const { syncAccessRules } = await import('@/db/sync-rbac');
    expect(await syncAccessRules(db as never)).toEqual(t.synced);
  });
});

describe('row-level security matches the TypeScript access rules', () => {
  const projectIds = ctx.projects.map((p) => p.id);
  it('every person sees exactly the projects can() allows', async () => {
    for (const u of ctx.users) {
      const want = visibleProjects(ctx, u.id).map((p) => uid(p.id)).sort();
      expect(await ids(u.id, 'projects'), `projects for ${u.id}`).toEqual(want);
    }
  });
  it('every person sees exactly the packages can() allows', async () => {
    for (const u of ctx.users) {
      const want = ctx.packages.filter((w) => can(ctx, u.id, 'package.view', { packageId: w.id }).allowed).map((w) => uid(w.id)).sort();
      expect(await ids(u.id, 'packages'), `packages for ${u.id}`).toEqual(want);
    }
  });
  it('every person sees exactly the areas can() allows', async () => {
    for (const u of ctx.users) {
      const want = ctx.areas.filter((a) => can(ctx, u.id, 'project.view', { areaId: a.id }).allowed).map((a) => uid(a.id)).sort();
      expect(await ids(u.id, 'areas'), `areas for ${u.id}`).toEqual(want);
    }
  });
  it('a customer never sees another customer organisation\'s project, even by id', async () => {
    const rows = (await withUser(db as never, uid('u-wv'), (tx) => tx.execute(sql`select id from projects where id = ${uid(projectIds[0]!)}`))) as unknown as { rows: unknown[] };
    expect(rows.rows).toHaveLength(0);
  });
  it('a suspended account sees nothing', async () => {
    await db.execute(sql`update users set status = 'suspended' where id = ${uid('u-cv')}`);
    expect(await ids('u-cv', 'projects')).toEqual([]);
    await db.execute(sql`update users set status = 'active' where id = ${uid('u-cv')}`);
    expect((await ids('u-cv', 'projects')).length).toBeGreaterThan(0);
  });
  it('the application role cannot write project data', async () => {
    expect(await rejects(withUser(db as never, uid('u-pm'), (tx) => tx.execute(sql`update projects set name = 'x'`)))).toMatch(/permission denied/i);
    expect(await rejects(withUser(db as never, uid('u-adm'), (tx) => tx.execute(sql`delete from role_assignments`)))).toMatch(/permission denied/i);
  });
  it('only administrators see everyone\'s role assignments and authorities', async () => {
    const all = (await db.execute(sql`select count(*)::int as n from role_assignments`)).rows[0] as { n: number };
    expect((await ids('u-adm', 'role_assignments')).length).toBe(all.n);
    expect((await ids('u-pm', 'role_assignments')).length).toBe(ctx.assignments.filter((a) => a.userId === 'u-pm').length);
    expect((await ids('u-cv', 'delegated_authorities')).length).toBe(0);
  });
});

describe('audit log', () => {
  const entry = (actor: string, action: string) => (tx: Parameters<Parameters<typeof withUser>[2]>[0]) => tx.insert(schema.auditLog).values({ actorId: uid(actor), action, recordKind: 'test', recordId: action, reason: 'because', detail: { n: 1 } });
  it('accepts entries made by the signed-in person and chains them', async () => {
    await withUser(db as never, uid('u-pm'), entry('u-pm', 'test.one'));
    await withUser(db as never, uid('u-pm'), entry('u-pm', 'test.two'));
    const rows = (await db.execute(sql`select id, prev_hash, hash from audit_log order by id`)).rows as { prev_hash: string | null; hash: string }[];
    expect(rows.length).toBe(2);
    expect(rows[0]!.prev_hash).toBeNull();
    expect(rows[1]!.prev_hash).toBe(rows[0]!.hash);
    expect(rows[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('refuses an entry that names a different person', async () => {
    expect(await rejects(withUser(db as never, uid('u-pm'), entry('u-so', 'test.forged')))).toMatch(/row-level security|violates/i);
  });
  it('cannot be updated, deleted or emptied, even by the owner', async () => {
    expect(await rejects(db.execute(sql`update audit_log set reason = 'edited'`))).toMatch(/append-only/);
    expect(await rejects(db.execute(sql`delete from audit_log`))).toMatch(/append-only/);
    expect(await rejects(db.execute(sql`truncate audit_log`))).toMatch(/append-only/);
  });
  it('is verifiable, and a tampered entry is found', async () => {
    expect((await db.execute(sql`select * from audit_verify()`)).rows).toHaveLength(0);
    await db.execute(sql`alter table audit_log disable trigger audit_log_no_update`);
    await db.execute(sql`update audit_log set reason = 'rewritten' where action = 'test.one'`);
    await db.execute(sql`alter table audit_log enable trigger audit_log_no_update`);
    const broken = (await db.execute(sql`select broken_id from audit_verify()`)).rows as { broken_id: number }[];
    expect(broken.length).toBeGreaterThan(0);
  });
  it('is readable only by people allowed to view it', async () => {
    expect((await ids('u-adm', 'audit_log')).length).toBe(2);
    expect(await ids('u-pm', 'audit_log')).toEqual([]);
    expect(await ids('u-cv', 'audit_log')).toEqual([]);
  });
});

describe('integrity rules in the database', () => {
  const base = { ref: 'DA-T', userId: uid('u-qa'), action: 'inspection.signoff', scopeProjectId: uid('p1'), grantedBy: uid('u-adm'), nominatedByUser: uid('u-om'), validFrom: '2026-10-01', validTo: '2026-12-01' };
  const insertAuth = (o: object) => db.insert(schema.delegatedAuthorities).values({ ...base, ...o } as never);
  it('rejects a self-granted authority', async () => { expect(await rejects(insertAuth({ ref: 'DA-T1', grantedBy: uid('u-qa') }))).toMatch(/authorities_no_self_grant_ck|check/i); });
  it('rejects an authority longer than 12 months', async () => { expect(await rejects(insertAuth({ ref: 'DA-T2', validTo: '2028-01-01' }))).toMatch(/authorities_period_ck|check/i); });
  it('rejects a nominator who is also the grantor', async () => { expect(await rejects(insertAuth({ ref: 'DA-T3', nominatedByUser: uid('u-adm') }))).toMatch(/nominator|check/i); });
  it('rejects an authority with neither or both nominators', async () => {
    expect(await rejects(insertAuth({ ref: 'DA-T4', nominatedByUser: null }))).toMatch(/nomination|check/i);
    expect(await rejects(insertAuth({ ref: 'DA-T5', nominatedByOrg: uid('org-nb') }))).toMatch(/nomination|check/i);
  });
  it('rejects an action that cannot be delegated', async () => { expect(await rejects(insertAuth({ ref: 'DA-T6', action: 'project.view' }))).toMatch(/cannot be delegated/); });
  it('accepts a valid authority', async () => { expect(await rejects(insertAuth({ ref: 'DA-T7' }))).toBe(''); });
  it('rejects a customer role for an RGS person and the reverse', async () => {
    const bad = (user: string, role: string) => db.insert(schema.roleAssignments).values({ userId: uid(user), role, scopeProjectId: uid('p1') } as never);
    expect(await rejects(bad('u-pm', 'customer_viewer'))).toMatch(/belongs to the/);
    expect(await rejects(bad('u-cv', 'project_manager'))).toMatch(/belongs to the/);
  });
  it('rejects an assignment with an ambiguous scope', async () => {
    expect(await rejects(db.insert(schema.roleAssignments).values({ userId: uid('u-pm'), role: 'project_manager', scopeAllProjects: true, scopeProjectId: uid('p1') } as never))).toMatch(/scope_ck|check/i);
    expect(await rejects(db.insert(schema.roleAssignments).values({ userId: uid('u-pm'), role: 'project_manager' } as never))).toMatch(/scope_ck|check/i);
  });
  it('rejects a second account with the same email in a different case', async () => {
    expect(await rejects(db.insert(schema.users).values({ orgId: uid('org-rgs'), email: 'PM@RGS.EXAMPLE', name: 'Dup' }))).toMatch(/users_email_uq|unique/i);
  });
  it('rejects a duplicate organisation name in a different case', async () => {
    expect(await rejects(db.insert(schema.organisations).values({ kind: 'customer', name: 'rgs' }))).toMatch(/organisations_name_uq|unique/i);
  });
});

describe('support requests', () => {
  it('are private to their author and to administrators', async () => {
    await withUser(db as never, uid('u-cr'), (tx) => tx.insert(schema.supportRequests).values({ ref: 'SUP-1', userId: uid('u-cr'), category: 'access', subject: 'Cannot sign in', message: 'The portal says my account is empty.' }));
    expect((await ids('u-cr', 'support_requests')).length).toBe(1);
    expect((await ids('u-adm', 'support_requests')).length).toBe(1);
    expect(await ids('u-ca', 'support_requests')).toEqual([]);
    expect(await ids('u-pm', 'support_requests')).toEqual([]);
  });
  it('cannot be created on behalf of someone else', async () => {
    expect(await rejects(withUser(db as never, uid('u-cr'), (tx) => tx.insert(schema.supportRequests).values({ ref: 'SUP-2', userId: uid('u-ca'), category: 'data', subject: 'Forged', message: 'This should not be accepted at all.' })))).toMatch(/row-level security|violates/i);
  });
  it('replies follow the request: visible to its author and administrators only', async () => {
    const req = (await db.execute(sql`select id from support_requests limit 1`)).rows[0] as { id: string };
    await withUser(db as never, uid('u-adm'), (tx) => tx.insert(schema.supportReplies).values({ requestId: req.id, authorId: uid('u-adm'), staff: true, body: 'We have fixed your access.' }));
    expect((await ids('u-cr', 'support_replies')).length).toBe(1);
    expect(await ids('u-ca', 'support_replies')).toEqual([]);
    expect(await rejects(withUser(db as never, uid('u-ca'), (tx) => tx.insert(schema.supportReplies).values({ requestId: req.id, authorId: uid('u-ca'), body: 'Not my request.' })))).toMatch(/row-level security|violates/i);
  });
});
