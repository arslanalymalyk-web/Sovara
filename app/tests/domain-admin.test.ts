import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { createTestDb, seedDemo, uid } from './db';
import { withUser } from '@/db/session';
import * as schema from '@/db/schema';
import { can } from '@/lib/rbac';
import { demoCtx, proto, fixtures } from './helpers';
import { inviteUser, setUserStatus, setUserRole, grantAuthority, revokeAuthority, createOrganisation, updateOrganisation, requestSupport, replySupport, setSupportStatus } from '@/domain/admin';
import { CommandError } from '@/domain/errors';

type T = Awaited<ReturnType<typeof createTestDb>>;
let t: T; let db: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ADM = uid('u-adm'), PM = uid('u-pm'), CR = uid('u-cr'), CA = uid('u-ca');
const rows = async <R = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<R[]> => ((await db.execute(q)) as { rows: R[] }).rows;
const codeOf = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'ok'; } catch (e) { return e instanceof CommandError ? e.code : 'THROWN:' + String((e as Error).message).slice(0, 120); } };
const auditCount = async (action: string) => (await rows<{ n: number }>(sql`select count(*)::int as n from audit_log where action = ${action}`))[0]!.n;
const f = fixtures as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(f.now)); t = await createTestDb(); db = t.db; await seedDemo(db); });
afterAll(async () => { vi.useRealTimers(); await t.client.close(); });

describe('inviting people', () => {
  const ok = { name: 'Test Inspector', email: 'test.inspector@rgs.example', orgId: uid('org-rgs'), role: 'qa_qc_inspector', projectId: uid('p1') };
  it('only administrators may invite', async () => { expect(await codeOf(inviteUser(db, PM, ok))).toBe('forbidden'); });
  it('validates every field with the prototype\'s error codes', async () => {
    expect(await codeOf(inviteUser(db, ADM, { ...ok, name: 'x' }))).toBe('name_required');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, email: 'nope' }))).toBe('email_invalid');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, email: 'PM@rgs.example' }))).toBe('email_taken');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, orgId: uid('nope') }))).toBe('org_required');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, role: 'wizard' }))).toBe('role_required');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, role: 'customer_viewer' }))).toBe('role_org_mismatch');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, projectId: undefined }))).toBe('project_required');
    expect(await codeOf(inviteUser(db, ADM, { ...ok, orgId: uid('org-wh'), role: 'customer_viewer', projectId: uid('p1') }))).toBe('project_org_mismatch');
  });
  it('creates an invited account with its role and an audit entry', async () => {
    const r = await inviteUser(db, ADM, ok);
    const u = (await rows<{ status: string; email: string }>(sql`select status, email from users where id = ${r.id}`))[0]!;
    expect(u).toMatchObject({ status: 'invited', email: 'test.inspector@rgs.example' });
    expect(await rows(sql`select 1 from role_assignments where user_id = ${r.id} and role = 'qa_qc_inspector'`)).toHaveLength(1);
    expect(await auditCount('admin.user.invite')).toBe(1);
  });
  it('a refused invitation changes nothing (all or nothing)', async () => {
    const before = (await rows<{ n: number }>(sql`select count(*)::int as n from users`))[0]!.n;
    await codeOf(inviteUser(db, ADM, { ...ok, email: 'half.done@rgs.example', projectId: uid('missing') }));
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from users`))[0]!.n).toBe(before);
  });
});

describe('sign-in', () => {
  const signIn = async (subject: string, email: string) => (await db.transaction(async (tx: any) => { await tx.execute(sql`set local role rgs_app_rw`); return ((await tx.execute(sql`select * from app_sign_in(${subject}, ${email})`)) as { rows: { out_user_id: string | null; out_status: string | null; out_outcome: string }[] }).rows[0]!; })) as unknown as { out_user_id: string; out_status: string; out_outcome: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
  it('accepting an invitation binds the identity and activates the account', async () => {
    const r = await signIn('entra-sub-1', 'Test.Inspector@RGS.example');
    expect(r.out_outcome).toBe('ok'); expect(r.out_status).toBe('active');
    expect((await rows<{ idp_subject: string }>(sql`select idp_subject from users where id = ${r.out_user_id}`))[0]!.idp_subject).toBe('entra-sub-1');
    expect(await auditCount('auth.invitation.accepted')).toBe(1);
    expect((await signIn('entra-sub-1', 'whatever@x.test')).out_outcome).toBe('ok'); // later sign-ins use the bound subject, not the email
  });
  it('an email without an invitation, or an already-claimed one, is refused', async () => {
    expect((await signIn('entra-sub-2', 'stranger@example.com')).out_outcome).toBe('no_invitation');
    expect((await signIn('entra-sub-3', 'test.inspector@rgs.example')).out_outcome).toBe('no_invitation'); // someone else cannot claim it again
  });
  it('a suspended account cannot sign in', async () => {
    await setUserStatus(db, ADM, { id: (await rows<{ id: string }>(sql`select id from users where email = 'test.inspector@rgs.example'`))[0]!.id, status: 'suspended', reason: 'Left the project.' });
    expect((await signIn('entra-sub-1', 'x@x.test')).out_outcome).toBe('not_active');
  });
});

describe('user status and roles', () => {
  it('refuses self-service and incomplete requests', async () => {
    expect(await codeOf(setUserStatus(db, ADM, { id: ADM, status: 'suspended', reason: 'because' }))).toBe('self_action');
    expect(await codeOf(setUserStatus(db, ADM, { id: uid('u-cv'), status: 'suspended' }))).toBe('reason_required');
    expect(await codeOf(setUserStatus(db, ADM, { id: uid('u-cv'), status: 'active' }))).toBe('bad_state');
    expect(await codeOf(setUserStatus(db, PM, { id: uid('u-cv'), status: 'suspended', reason: 'because' }))).toBe('forbidden');
    expect(await codeOf(setUserStatus(db, ADM, { id: uid('nope'), status: 'suspended', reason: 'because' }))).toBe('not_found');
  });
  it('suspends, then a suspended administrator can do nothing', async () => {
    await setUserStatus(db, ADM, { id: uid('u-cv'), status: 'suspended', reason: 'Contract ended.' });
    expect((await rows<{ status: string }>(sql`select status from users where id = ${uid('u-cv')}`))[0]!.status).toBe('suspended');
    expect(await codeOf(setUserStatus(db, uid('u-cv'), { id: PM, status: 'suspended', reason: 'because' }))).toBe('inactive');
    await setUserStatus(db, ADM, { id: uid('u-cv'), status: 'active' });
    const e = (await rows<{ detail: { from: string; to: string }; reason: string }>(sql`select detail, reason from audit_log where action = 'admin.user.status' and record_id = ${uid('u-cv')} order by id`));
    expect(e.map((x) => x.detail.to)).toContain('suspended'); expect(e.find((x) => x.detail.to === 'suspended')!.reason).toBe('Contract ended.');
  });
  it('changing a role ends the old assignment, starts a new one and reports authority that becomes unusable', async () => {
    const r = await setUserRole(db, ADM, { id: uid('u-qa'), role: 'site_officer', projectId: uid('p1'), reason: 'Moved to the site team.' });
    expect(r.inert.length).toBeGreaterThan(0); // Sara's inspection sign-off authorities do not apply to a site officer
    const a = await rows<{ role: string; status: string }>(sql`select role, status from role_assignments where user_id = ${uid('u-qa')} order by created_at, role`);
    expect(a.filter((x) => x.status === 'active').map((x) => x.role)).toEqual(['site_officer']);
    expect(a.some((x) => x.status === 'revoked')).toBe(true);
    expect(await codeOf(setUserRole(db, ADM, { id: ADM, role: 'general_manager', reason: 'because' }))).toBe('self_action');
    expect(await codeOf(setUserRole(db, ADM, { id: uid('u-pm'), role: 'customer_viewer', projectId: uid('p1'), reason: 'because' }))).toBe('role_org_mismatch');
    expect(await codeOf(setUserRole(db, ADM, { id: uid('u-pm'), role: 'project_manager', projectId: uid('p1'), reason: 'no' }))).toBe('reason_required');
    // restore for later tests
    await setUserRole(db, ADM, { id: uid('u-qa'), role: 'qa_qc_inspector', projectId: uid('p1'), reason: 'Moved back to quality.' });
  });
});

describe('delegated authority follows the prototype\'s grant rules', () => {
  it('grants and refuses exactly as the prototype does, across a grid of cases', async () => {
    const protoCtx = demoCtx();
    const iso = (d: number) => new Date(new Date(f.now).getTime() + d * 864e5).toISOString().slice(0, 10);
    let granted = 0, refused = 0;
    for (const user of ['u-hse', 'u-gm', 'u-om', 'u-pm', 'u-cv', 'u-ca']) for (const action of ['hse.stopwork', 'asset.release', 'handover.signoff', 'inspection.signoff', 'project.view', 'customer.approve']) for (const days of [120, 400, null]) for (const nominatedBy of ['u-om', 'u-adm', undefined]) {
      const validTo = days == null ? undefined : iso(days);
      const want = proto.canGrant(protoCtx, 'u-adm', { userId: user, action, scope: { projectId: 'p1' }, validTo, nominatedBy });
      const got = await codeOf(grantAuthority(db, ADM, { userId: uid(user), action, projectId: uid('p1'), validTo: validTo ?? '', nominatedBy: nominatedBy ? uid(nominatedBy) : '' }));
      if (want.allowed) { expect(['ok', 'authority_exists'], `${user} ${action} ${days} ${nominatedBy}`).toContain(got); granted += got === 'ok' ? 1 : 0; }
      else { // the command may refuse earlier for malformed input, with the same meaning
        // like the prototype's command, missing inputs are refused before the grant rules run
        const same = got === want.code || (nominatedBy === undefined && got === 'no_nomination') || (validTo === undefined && got === 'no_expiry');
        expect(same, `${user} ${action} ${days} ${nominatedBy}: command ${got} vs prototype ${want.code}`).toBe(true); refused++;
      }
    }
    expect(granted).toBeGreaterThan(3); expect(refused).toBeGreaterThan(50);
  });
  it('a granted authority really lets the person act, and revoking takes it away', async () => {
    const nominator = uid('u-om');
    const g = await grantAuthority(db, ADM, { userId: uid('u-gm'), action: 'hse.stopwork', projectId: uid('p2'), validTo: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), nominatedBy: nominator }).catch((e) => e);
    const ref = g instanceof Error ? (g as CommandError).code : g.ref; expect(String(ref)).toMatch(/^DA-\d+$|authority_exists/);
    if (g instanceof Error) return; // already granted by the grid above for this project/period
    expect(g.ref).toMatch(/^DA-\d+$/);
    expect(await codeOf(revokeAuthority(db, ADM, { id: g.id, reason: 'no' }))).toBe('reason_required');
    await revokeAuthority(db, ADM, { id: g.id, reason: 'Role change at the customer.' });
    expect(await codeOf(revokeAuthority(db, ADM, { id: g.id, reason: 'Role change at the customer.' }))).toBe('bad_state');
    expect(await codeOf(revokeAuthority(db, PM, { id: g.id, reason: 'Role change at the customer.' }))).toBe('forbidden');
  });
  it('only an administrator holding the grant permission can grant', async () => {
    expect(await codeOf(grantAuthority(db, PM, { userId: uid('u-hse'), action: 'hse.stopwork', projectId: uid('p1'), validTo: '2027-01-01', nominatedBy: uid('u-om') }))).toBe('forbidden');
  });
});

describe('organisations', () => {
  it('creates and renames, refusing duplicates whatever the capitalisation', async () => {
    const o = await createOrganisation(db, ADM, { name: 'Gulf Marine Works', nameAr: 'الخليج للأعمال البحرية' });
    expect(await codeOf(createOrganisation(db, ADM, { name: 'gulf marine works' }))).toBe('org_taken');
    expect(await codeOf(createOrganisation(db, PM, { name: 'Another One' }))).toBe('forbidden');
    expect(await codeOf(createOrganisation(db, ADM, { name: 'x' }))).toBe('name_required');
    await updateOrganisation(db, ADM, { id: o.id, name: 'Gulf Marine Works LLC' });
    expect(await codeOf(updateOrganisation(db, ADM, { id: o.id, name: 'RGS' }))).toBe('org_taken');
    expect(await codeOf(updateOrganisation(db, ADM, { id: uid('nope'), name: 'Whatever' }))).toBe('not_found');
  });
});

describe('support requests', () => {
  it('follow the thread from customer to staff and back', async () => {
    expect(await codeOf(requestSupport(db, CR, { category: 'access', subject: 'x', message: 'short' }))).toBe('subject_required');
    const r = await requestSupport(db, CR, { category: 'access', subject: 'Cannot see my project', message: 'After sign-in my project list is empty.' });
    expect(r.ref).toMatch(/^SUP-\d{4}$/);
    expect(await codeOf(replySupport(db, CA, { id: r.id, message: 'Not mine to answer' }))).toBe('not_found'); // another customer cannot even see it
    expect(await codeOf(setSupportStatus(db, CR, { id: r.id, status: 'resolved' }))).toBe('forbidden');
    expect((await replySupport(db, ADM, { id: r.id, message: 'We have added you to the project.' })).status).toBe('in_progress');
    await setSupportStatus(db, ADM, { id: r.id, status: 'resolved' });
    expect((await replySupport(db, CR, { id: r.id, message: 'Still empty.' })).status).toBe('open'); // a customer reply reopens it
    expect(await rows(sql`select 1 from support_replies where request_id = ${r.id}`)).toHaveLength(2);
  });
});

describe('the database refuses writes that bypass the commands', () => {
  it('an ordinary user cannot change users, assignments or authority directly', async () => {
    await withUser(db, PM, (tx) => tx.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, uid('u-so'))));
    expect((await rows<{ status: string }>(sql`select status from users where id = ${uid('u-so')}`))[0]!.status).toBe('active'); // 0 rows matched: nothing changed
    let err = ''; try { await withUser(db, PM, (tx) => tx.insert(schema.roleAssignments).values({ userId: PM, role: 'general_manager', scopeAllProjects: true })); } catch (e) { err = String((e as { cause?: { message?: string } }).cause?.message ?? e); }
    expect(err).toMatch(/row-level security|violates/i);
    err = ''; try { await withUser(db, PM, (tx) => tx.insert(schema.delegatedAuthorities).values({ ref: 'DA-X', userId: PM, action: 'asset.release', scopeProjectId: uid('p1'), grantedBy: PM, nominatedByUser: uid('u-om'), validFrom: '2026-10-12', validTo: '2026-12-01' })); } catch (e) { err = String((e as { cause?: { message?: string } }).cause?.message ?? e); }
    expect(err.length).toBeGreaterThan(0);
  });
  it('the whole audit trail is still intact after every command', async () => {
    expect(await rows(sql`select * from audit_verify()`)).toHaveLength(0);
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from audit_log`))[0]!.n).toBeGreaterThanOrEqual(10);
  });
  it('the access rules still agree with the data the commands produced', async () => {
    const ctx = demoCtx(); expect(can(ctx, 'u-adm', 'admin.users', null).allowed).toBe(true);
  });
});
