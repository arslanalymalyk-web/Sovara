/**
 * Access model: roles, scopes, delegated authority.
 *
 * This is the server-side port of the prototype's `rgs-portal/rbac.js`, which is the executable specification.
 * The rule tables are generated from it (`data.generated.ts`); the decision logic below is a direct port and is
 * checked against the prototype on every combination of user, action and resource (tests/rbac-parity.test.ts).
 *
 * Decision order for `can()`:
 *   1. account active  2. action known  3. organisation boundary
 *   4. a role assignment that grants the action and whose scope covers the record
 *   5. technical approvals additionally need an active delegated authority that covers the record.
 *      A role alone never grants sign-off, and the portal administrator is never eligible for one.
 */
import { ACTION_DEFS, ROLE_DEFS, ROLE_ORDER, AI_SAFE_ACTIONS, SERVICES, PROJECT_TYPES } from './data.generated';

export { ROLE_ORDER, AI_SAFE_ACTIONS, SERVICES, PROJECT_TYPES };
export type ActionKind = 'view' | 'write' | 'technical' | 'delegable' | 'admin';
export type ActionId = keyof typeof ACTION_DEFS;
export type RoleId = keyof typeof ROLE_DEFS;
export const ACTIONS: Record<string, { kind: ActionKind; module: string }> = ACTION_DEFS;
interface RoleDef { side: 'customer' | 'rgs'; scopeLevel: string; grants: readonly string[]; eligible: readonly string[] }
export const ROLES: Record<string, RoleDef> = ROLE_DEFS;

export interface Scope { projectId?: string; areaId?: string; service?: string; categories?: readonly string[] }
export interface Org { id: string; kind: 'rgs' | 'customer' }
export interface User { id: string; orgId: string; status: string }
export interface Project { id: string; customerOrgId: string }
export interface Area { id: string; projectId: string }
export interface Pkg { id: string; projectId: string; areaId?: string | null; service?: string | null }
export interface Assignment { id?: string; userId: string; role: string; scope: Scope; status?: string; validFrom?: string; validTo?: string; validUntil?: string }
export interface Authority { id: string; userId: string; action: string; scope: Scope; status: string; grantedBy?: string; revokedAt?: string | null; validFrom?: string; validTo?: string; validUntil?: string }

/** Everything `can()` needs to see. In production this is loaded per request for one user; in tests it is a whole dataset. */
export interface Ctx {
  now?: string | Date;
  orgs: Org[]; users: User[]; projects: Project[]; areas: Area[]; packages: Pkg[];
  assignments: Assignment[]; authorities?: Authority[];
}
export interface Resource { projectId?: string | null; areaId?: string | null; packageId?: string | null; service?: string | null; category?: string | null }
export interface Decision { allowed: boolean; code: string; trace: string[]; via?: string; authority?: string }

interface Resolved { projectId: string | null; areaId: string | null; service: string | null; category: string | null; customerOrgId?: string; missing?: string }

function byId<T extends { id: string }>(list: T[], id: string | null | undefined): T | null {
  if (id == null) return null;
  for (const x of list) if (x.id === id) return x;
  return null;
}
function inWindow(rec: { validFrom?: string; validTo?: string; validUntil?: string }, now: Date): boolean {
  const t = now.getTime();
  if (rec.validFrom && new Date(rec.validFrom).getTime() > t) return false;
  // validUntil is an exact instant with its timezone offset; validTo is a date
  if (rec.validUntil) { if (new Date(rec.validUntil).getTime() < t) return false; }
  else if (rec.validTo && new Date(rec.validTo).getTime() < t) return false;
  return true;
}
function isView(action: string): boolean { return ACTIONS[action]?.kind === 'view'; }
const deny = (code: string, trace: string[]): Decision => ({ allowed: false, code, trace });

/** Expand a resource reference to project, area, service and owning organisation. */
export function resolve(ctx: Ctx, res: Resource | null | undefined): Resolved | null {
  if (!res) return null;
  const out: Resolved = { projectId: res.projectId || null, areaId: res.areaId || null, service: res.service || null, category: res.category || null };
  if (res.packageId) {
    const wp = byId(ctx.packages, res.packageId);
    if (!wp) return { ...out, missing: 'package' };
    out.projectId = wp.projectId; out.areaId = wp.areaId ?? null; out.service = wp.service ?? null;
  }
  if (out.areaId && !out.projectId) {
    const ar = byId(ctx.areas, out.areaId);
    if (ar) out.projectId = ar.projectId;
  }
  if (out.projectId) {
    const p = byId(ctx.projects, out.projectId);
    if (!p) return { ...out, missing: 'project' };
    out.customerOrgId = p.customerOrgId;
  }
  if (out.areaId) {
    const a = byId(ctx.areas, out.areaId);
    if (!a || a.projectId !== out.projectId) return { ...out, missing: 'area' };
  }
  return out;
}

/** Does a scope cover a resolved resource? Project-level writes need project-level scope. */
export function scopeCovers(scope: Scope, r: Resolved | null, action: string): boolean {
  if (!r || !r.projectId) return scope.projectId === '*';
  if (scope.projectId !== '*' && scope.projectId !== r.projectId) return false;
  if (scope.areaId) {
    if (r.areaId) { if (scope.areaId !== r.areaId) return false; }
    else if (!isView(action)) return false;
  }
  if (scope.service) {
    if (r.service) { if (scope.service !== r.service) return false; }
    else if (!isView(action)) return false;
  }
  if (scope.categories) { if (!r.category || !scope.categories.includes(r.category)) return false; }
  return true;
}

export function can(ctx: Ctx, userId: string, action: string, resource?: Resource | null): Decision {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const trace: string[] = [];
  const user = byId(ctx.users, userId);
  if (!user) return deny('no_user', ['Unknown user']);
  if (user.status !== 'active') return deny('inactive', ['Account is ' + user.status]);
  trace.push('Account active');
  const def = ACTIONS[action];
  if (!def) return deny('unknown_action', trace.concat('Unknown action ' + action));
  const org = byId(ctx.orgs, user.orgId);
  if (!org) return deny('no_org', trace.concat('User has no organisation'));

  const r = resolve(ctx, resource);
  if (r && r.missing) return deny('not_found', trace.concat('Record not found: ' + r.missing));

  if (r && r.projectId && org.kind === 'customer' && r.customerOrgId !== org.id)
    return deny('org_boundary', trace.concat('Project belongs to another organisation'));
  if (r && r.projectId) trace.push('Organisation boundary passed');

  const assignments = ctx.assignments.filter((a) => a.userId === userId && a.status !== 'revoked' && inWindow(a, now));
  if (!assignments.length) return deny('no_role', trace.concat('No active role assignment'));

  let grantingRole: Assignment | null = null, roleCapable = false;
  for (const a of assignments) {
    const role = ROLES[a.role];
    if (!role) continue;
    if (role.side === 'customer' && org.kind !== 'customer') continue;
    if (role.side === 'rgs' && org.kind !== 'rgs') continue;
    const grants = role.grants.includes(action);
    const eligible = role.eligible.includes(action);
    if (!grants && !eligible) continue;
    roleCapable = true;
    if (def.kind === 'admin') { if (a.scope.projectId === '*') { grantingRole = a; break; } continue; }
    if (scopeCovers(a.scope, r, action)) { grantingRole = a; break; }
  }
  if (!roleCapable) return deny('role', trace.concat('No assigned role includes this action'));
  if (!grantingRole) return deny('scope', trace.concat('Role is not assigned to this project, area or service'));
  trace.push('Role ' + grantingRole.role + ' covers scope');

  if (def.kind === 'delegable') {
    const direct = assignments.some((x) => ROLES[x.role] && ROLES[x.role]!.grants.includes(action) && scopeCovers(x.scope, r, action));
    if (direct) return { allowed: true, code: 'ok', via: grantingRole.role, trace: trace.concat('Granted by role') };
  }
  if (def.kind !== 'technical' && def.kind !== 'delegable') return { allowed: true, code: 'ok', via: grantingRole.role, trace };

  // Technical approvals: a delegated authority is required.
  const auths = (ctx.authorities ?? []).filter((d) => d.userId === userId && d.action === action && d.status === 'active' && !d.revokedAt && inWindow(d, now) && d.grantedBy !== userId);
  for (const d of auths) {
    const holderRoleOk = assignments.some((x) => ROLES[x.role] && ROLES[x.role]!.eligible.includes(action) && scopeCovers(x.scope, r, action));
    if (holderRoleOk && scopeCovers(d.scope, r, action)) {
      trace.push('Delegated authority ' + d.id + ' valid until ' + (d.validTo || 'open'));
      return { allowed: true, code: 'ok', via: grantingRole.role, authority: d.id, trace };
    }
  }
  const expired = (ctx.authorities ?? []).some((d) => d.userId === userId && d.action === action && !inWindow(d, now) && scopeCovers(d.scope, r, action));
  return deny(expired ? 'authority_expired' : 'authority', trace.concat(expired ? 'Delegated authority has expired' : 'No delegated authority for this record'));
}

/** Can the user perform the action anywhere? Drives navigation. */
export function canAnywhere(ctx: Ctx, userId: string, action: string): boolean {
  const def = ACTIONS[action];
  if (!def) return false;
  if (def.kind === 'admin') return can(ctx, userId, action, null).allowed;
  for (const p of ctx.projects) {
    if (can(ctx, userId, action, { projectId: p.id }).allowed) return true;
    for (const w of ctx.packages.filter((x) => x.projectId === p.id)) if (can(ctx, userId, action, { packageId: w.id }).allowed) return true;
  }
  return false;
}

export function visibleProjects(ctx: Ctx, userId: string): Project[] {
  return ctx.projects.filter((p) => can(ctx, userId, 'project.view', { projectId: p.id }).allowed);
}

export interface Grant { userId: string; action: string; scope: Scope; validTo?: string; nominatedBy?: string }

/** Can this administrator grant this delegated authority? Nobody grants to themselves; at most 12 months; needs a nomination. */
export function canGrant(ctx: Ctx, grantorId: string, grant: Grant): Decision {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  if (!can(ctx, grantorId, 'admin.authority.grant', null).allowed) return deny('grantor', ['Grantor cannot manage authority']);
  if (grant.userId === grantorId) return deny('self_grant', ['Nobody can grant authority to themselves']);
  const def = ACTIONS[grant.action];
  if (!def || def.kind !== 'technical') return deny('not_technical', ['Only technical approvals are delegated']);
  if (!grant.validTo) return deny('no_expiry', ['Authority must have an end date']);
  const days = (new Date(grant.validTo).getTime() - now.getTime()) / 864e5;
  if (days > 366) return deny('too_long', ['Authority may last at most 12 months']);
  if (!grant.nominatedBy || grant.nominatedBy === grantorId) return deny('no_nomination', ['Needs a nomination from the responsible manager or customer approver']);
  const r = resolve(ctx, grant.scope);
  if (!r || r.missing) return deny('scope', ['Scope must name an existing project']);
  const eligible = ctx.assignments.some((a) => a.userId === grant.userId && a.status !== 'revoked' && ROLES[a.role] && ROLES[a.role]!.eligible.includes(grant.action) && scopeCovers(a.scope, r, grant.action));
  if (!eligible) return deny('ineligible', ['Recipient has no eligible role on this scope']);
  return { allowed: true, code: 'ok', trace: ['Grant is valid; it will be recorded in the audit history'] };
}

/** The assistant may only ever read, and only what the user it acts for could. */
export function aiCan(ctx: Ctx, userId: string, action: string, resource?: Resource | null): Decision {
  if (!(AI_SAFE_ACTIONS as readonly string[]).includes(action)) return deny('ai_forbidden', ['The assistant cannot record, approve or sign off; an authorised person must']);
  const res = can(ctx, userId, action, resource);
  if (!res.allowed) return deny(res.code, res.trace.concat('Assistant inherits the user’s access only'));
  return res;
}
