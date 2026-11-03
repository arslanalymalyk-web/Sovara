/**
 * Administration and support commands. A port of the prototype's `admin.*` and `support.*` commands (rgs-portal/api.js):
 * same rules, same error codes, now enforced on the server inside a transaction with row-level security and an audit entry.
 */
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { ROLES, canGrant } from '@/lib/rbac';
import { riyadhDate } from '@/lib/calendar';
import { CommandError, need } from './errors';
import { runCommand, type CommandContext, type Db } from './command';

const text = (v: unknown) => String(v ?? '').trim();
const isUniqueViolation = (e: unknown) => /23505|duplicate key|unique/i.test(String((e as { code?: string; cause?: { code?: string; message?: string }; message?: string })?.code ?? '') + String((e as { cause?: { code?: string; message?: string } })?.cause?.code ?? '') + String((e as Error)?.message ?? '') + String((e as { cause?: { message?: string } })?.cause?.message ?? ''));

function scopeFor(c: CommandContext, role: string, orgId: string, projectId?: string) {
  const def = ROLES[role]; need(def, 'role_required');
  const org = c.snapshot.orgs.find((o) => o.id === orgId); need(org, 'org_required');
  need((def.side === 'rgs') === (org.kind === 'rgs'), 'role_org_mismatch');
  if (def.scopeLevel === 'global') return { allProjects: true as const, projectId: null };
  const pr = c.snapshot.projects.find((p) => p.id === projectId); need(pr, 'project_required');
  if (org.kind === 'customer') need(pr.customerOrgId === org.id, 'project_org_mismatch');
  return { allProjects: false as const, projectId: pr.id };
}

// ---- Users -----------------------------------------------------------------------------------------------------------------
export interface InviteInput { name: string; email: string; orgId: string; role: string; projectId?: string }
export function inviteUser(db: Db, actor: string, p: InviteInput) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    const name = text(p.name), email = text(p.email).toLowerCase();
    need(name.length >= 2, 'name_required');
    need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'email_invalid');
    need(!c.snapshot.users.some((u) => u.email.toLowerCase() === email), 'email_taken');
    const scope = scopeFor(c, p.role, p.orgId, p.projectId);
    let id: string;
    try {
      [{ id }] = (await c.tx.insert(schema.users).values({ orgId: p.orgId, email, name, status: 'invited' }).returning({ id: schema.users.id })) as [{ id: string }];
    } catch (e) { if (isUniqueViolation(e)) throw new CommandError('email_taken'); throw e; }
    await c.tx.insert(schema.roleAssignments).values({ userId: id, role: p.role, scopeAllProjects: scope.allProjects, scopeProjectId: scope.projectId, createdBy: c.actor });
    await c.audit({ action: 'admin.user.invite', recordKind: 'user', recordId: id, detail: { role: p.role, org: p.orgId, scope: scope.allProjects ? '*' : scope.projectId } });
    return { id };
  });
}

export function setUserStatus(db: Db, actor: string, p: { id: string; status: 'active' | 'suspended'; reason?: string }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    const u = c.snapshot.users.find((x) => x.id === p.id); need(u, 'not_found', { kind: 'user', id: p.id });
    need(p.id !== c.actor, 'self_action');
    need(p.status === 'active' || p.status === 'suspended', 'bad_status');
    need(u.status !== p.status, 'bad_state');
    const reason = text(p.reason);
    if (p.status === 'suspended') need(reason.length >= 5, 'reason_required');
    await c.tx.update(schema.users).set({ status: p.status, statusReason: reason || null, statusAt: c.now, statusBy: c.actor, updatedAt: c.now }).where(eq(schema.users.id, p.id));
    await c.audit({ action: 'admin.user.status', recordKind: 'user', recordId: p.id, reason, detail: { from: u.status, to: p.status } });
    return { status: p.status };
  });
}

export function setUserRole(db: Db, actor: string, p: { id: string; role: string; projectId?: string; reason: string }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    const u = c.snapshot.users.find((x) => x.id === p.id); need(u, 'not_found', { kind: 'user', id: p.id });
    need(p.id !== c.actor, 'self_action');
    const reason = text(p.reason); need(reason.length >= 5, 'reason_required');
    const scope = scopeFor(c, p.role, u.orgId, p.projectId);
    const old = c.snapshot.assignments.filter((a) => a.userId === u.id && a.status !== 'revoked');
    await c.tx.update(schema.roleAssignments).set({ status: 'revoked', revokedAt: c.now, revokedBy: c.actor }).where(and(eq(schema.roleAssignments.userId, u.id), sql`${schema.roleAssignments.status} <> 'revoked'`));
    await c.tx.insert(schema.roleAssignments).values({ userId: u.id, role: p.role, scopeAllProjects: scope.allProjects, scopeProjectId: scope.projectId, createdBy: c.actor });
    const eligible = ROLES[p.role]!.eligible;
    const inert = c.snapshot.authorities.filter((d) => d.userId === u.id && d.status === 'active' && !d.revokedAt && !eligible.includes(d.action)).map((d) => d.ref);
    await c.audit({ action: 'admin.user.role', recordKind: 'user', recordId: u.id, reason, detail: { from: old.map((a) => a.role), to: p.role, authoritiesNoLongerUsable: inert } });
    return { role: p.role, inert };
  });
}

// ---- Delegated authority ---------------------------------------------------------------------------------------------------
export interface GrantInput { userId: string; action: string; projectId: string; validFrom?: string; validTo: string; nominatedBy: string }
export function grantAuthority(db: Db, actor: string, p: GrantInput) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.authority.grant', null);
    const holder = c.snapshot.users.find((u) => u.id === p.userId); need(holder, 'not_found', { kind: 'user', id: p.userId });
    need(p.projectId, 'project_required');
    const from = (p.validFrom ?? riyadhDate(c.now)).slice(0, 10), to = text(p.validTo).slice(0, 10);
    need(/^\d{4}-\d{2}-\d{2}$/.test(to), 'no_expiry'); need(from <= to, 'dates_order');
    const nominatedByUser = c.snapshot.users.some((u) => u.id === p.nominatedBy), nominatedByOrg = c.snapshot.orgs.some((o) => o.id === p.nominatedBy);
    need(p.nominatedBy && (nominatedByUser || nominatedByOrg), 'no_nomination');
    const d = canGrant(c.ctx, actor, { userId: p.userId, action: p.action, scope: { projectId: p.projectId }, validTo: to, nominatedBy: p.nominatedBy });
    need(d.allowed, d.code || 'forbidden', { trace: d.trace });
    need(!c.snapshot.authorities.some((a) => a.userId === p.userId && a.action === p.action && a.status === 'active' && !a.revokedAt && a.projectId === p.projectId && a.validTo >= from), 'authority_exists');
    const ref = ((await c.tx.execute(sql`select app_next_ref('authority') as ref`)) as unknown as { rows: { ref: string }[] }).rows[0]!.ref;
    const [row] = await c.tx.insert(schema.delegatedAuthorities).values({
      ref, userId: p.userId, action: p.action, scopeProjectId: p.projectId, grantedBy: c.actor, grantedAt: c.now,
      nominatedByUser: nominatedByUser ? p.nominatedBy : null, nominatedByOrg: nominatedByOrg ? p.nominatedBy : null, validFrom: from, validTo: to,
    }).returning({ id: schema.delegatedAuthorities.id });
    await c.audit({ action: 'authority.grant', recordKind: 'authority', recordId: row!.id, detail: { ref, holder: p.userId, permission: p.action, project: p.projectId, validFrom: from, validTo: to, nominatedBy: p.nominatedBy } });
    return { id: row!.id, ref };
  });
}

export function revokeAuthority(db: Db, actor: string, p: { id: string; reason: string }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.authority.grant', null);
    const d = c.snapshot.authorities.find((x) => x.id === p.id); need(d, 'not_found', { kind: 'authority', id: p.id });
    need(d.status === 'active' && !d.revokedAt, 'bad_state');
    const reason = text(p.reason); need(reason.length >= 5, 'reason_required');
    await c.tx.update(schema.delegatedAuthorities).set({ status: 'revoked', revokedAt: c.now, revokedBy: c.actor, revokeReason: reason }).where(eq(schema.delegatedAuthorities.id, p.id));
    await c.audit({ action: 'admin.authority.revoke', recordKind: 'authority', recordId: p.id, reason, detail: { ref: d.ref, holder: d.userId, permission: d.action } });
    return { id: p.id };
  });
}

// ---- Organisations ---------------------------------------------------------------------------------------------------------
export function createOrganisation(db: Db, actor: string, p: { name: string; nameAr?: string }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    const name = text(p.name); need(name.length >= 2, 'name_required');
    let id: string;
    try { [{ id }] = (await c.tx.insert(schema.organisations).values({ kind: 'customer', name, nameAr: text(p.nameAr) || name }).returning({ id: schema.organisations.id })) as [{ id: string }]; }
    catch (e) { if (isUniqueViolation(e)) throw new CommandError('org_taken'); throw e; }
    await c.audit({ action: 'admin.org.create', recordKind: 'org', recordId: id, detail: { name } });
    return { id };
  });
}
export function updateOrganisation(db: Db, actor: string, p: { id: string; name: string; nameAr?: string }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    need(c.snapshot.orgs.some((o) => o.id === p.id), 'not_found', { kind: 'org', id: p.id });
    const name = text(p.name); need(name.length >= 2, 'name_required');
    try { await c.tx.update(schema.organisations).set({ name, nameAr: text(p.nameAr) || name, updatedAt: c.now }).where(eq(schema.organisations.id, p.id)); }
    catch (e) { if (isUniqueViolation(e)) throw new CommandError('org_taken'); throw e; }
    await c.audit({ action: 'admin.org.update', recordKind: 'org', recordId: p.id, detail: { name } });
    return { id: p.id };
  });
}

// ---- Support ---------------------------------------------------------------------------------------------------------------
export const SUPPORT_CATEGORIES = ['access', 'data', 'report', 'other'] as const;
export function requestSupport(db: Db, actor: string, p: { category: string; subject: string; message: string }) {
  return runCommand(db, actor, async (c) => {
    c.allowAnywhere('support.use');
    const subject = text(p.subject), message = text(p.message);
    need(subject.length >= 3, 'subject_required'); need(message.length >= 10, 'message_required');
    need((SUPPORT_CATEGORIES as readonly string[]).includes(p.category), 'category_required');
    const ref = ((await c.tx.execute(sql`select app_next_ref('support') as ref`)) as unknown as { rows: { ref: string }[] }).rows[0]!.ref;
    const [row] = await c.tx.insert(schema.supportRequests).values({ ref, userId: c.actor, category: p.category, subject, message }).returning({ id: schema.supportRequests.id });
    await c.audit({ action: 'support.request', recordKind: 'support', recordId: row!.id, detail: { ref, category: p.category } });
    return { id: row!.id, ref };
  });
}

export function replySupport(db: Db, actor: string, p: { id: string; message: string }) {
  return runCommand(db, actor, async (c) => {
    // row-level security already hides other people's requests from a non-administrator
    const [tk] = await c.tx.select().from(schema.supportRequests).where(eq(schema.supportRequests.id, p.id));
    need(tk, 'not_found', { kind: 'support', id: p.id });
    const staff = (() => { try { c.allow('admin.users', null); return true; } catch { return false; } })();
    need(staff || tk.userId === c.actor, 'forbidden');
    const message = text(p.message); need(message.length >= 2, 'message_required');
    await c.tx.insert(schema.supportReplies).values({ requestId: tk.id, authorId: c.actor, staff, body: message });
    const status = staff && tk.status === 'open' ? 'in_progress' : !staff && tk.status === 'resolved' ? 'open' : tk.status;
    await c.tx.update(schema.supportRequests).set({ status, resolvedAt: status === 'resolved' ? tk.resolvedAt : null, version: tk.version + 1, updatedAt: c.now }).where(eq(schema.supportRequests.id, tk.id));
    await c.audit({ action: 'support.reply', recordKind: 'support', recordId: tk.id, detail: { ref: tk.ref, staff } });
    return { status };
  });
}

export function setSupportStatus(db: Db, actor: string, p: { id: string; status: 'open' | 'in_progress' | 'resolved' }) {
  return runCommand(db, actor, async (c) => {
    c.allow('admin.users', null);
    const [tk] = await c.tx.select().from(schema.supportRequests).where(eq(schema.supportRequests.id, p.id));
    need(tk, 'not_found', { kind: 'support', id: p.id });
    need(['open', 'in_progress', 'resolved'].includes(p.status), 'bad_status'); need(tk.status !== p.status, 'bad_state');
    await c.tx.update(schema.supportRequests).set({ status: p.status, resolvedAt: p.status === 'resolved' ? c.now : null, version: tk.version + 1, updatedAt: c.now }).where(eq(schema.supportRequests.id, tk.id));
    await c.audit({ action: 'support.status', recordKind: 'support', recordId: tk.id, detail: { ref: tk.ref, from: tk.status, to: p.status } });
    return { status: p.status };
  });
}
