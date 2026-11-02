/**
 * Database schema (PostgreSQL). Stage 0 covers identity, projects, access and the audit trail.
 * Record tables for requests, documents, inspections and so on arrive with the stages that build them.
 *
 * Conventions: uuid primary keys, `timestamptz` instants, `date` calendar dates (Asia/Riyadh), soft deletes only,
 * every change recorded in `audit_log`. Row-level security and the append-only audit trigger live in the
 * hand-written migration `0001_security.sql` because they are not expressible here.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, bigserial } from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`);
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`);

// ---- Access model reference data (synced from the TypeScript rules at deploy time; RLS reads it) --------------------
export const actions = pgTable('actions', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  module: text('module').notNull(),
}, (t) => [check('actions_kind_ck', sql`${t.kind} in ('view','write','technical','delegable','admin')`)]);

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  side: text('side').notNull(),
  scopeLevel: text('scope_level').notNull(),
}, (t) => [check('roles_side_ck', sql`${t.side} in ('customer','rgs')`)]);

export const rolePermissions = pgTable('role_permissions', {
  role: text('role').notNull().references(() => roles.id),
  action: text('action').notNull().references(() => actions.id),
  relation: text('relation').notNull(), // 'grant' = the role may do it; 'eligible' = it may hold a delegated authority for it
}, (t) => [primaryKey({ columns: [t.role, t.action, t.relation] }), check('role_permissions_rel_ck', sql`${t.relation} in ('grant','eligible')`)]);

// ---- Organisations and people ----------------------------------------------------------------------------------------
export const organisations = pgTable('organisations', {
  id: id(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check('organisations_kind_ck', sql`${t.kind} in ('rgs','customer')`),
  check('organisations_status_ck', sql`${t.status} in ('active','suspended')`),
  uniqueIndex('organisations_name_uq').on(sql`lower(${t.name})`),
]);

export const users = pgTable('users', {
  id: id(),
  orgId: uuid('org_id').notNull().references(() => organisations.id),
  email: text('email').notNull(),
  name: text('name').notNull(),
  /** Immutable subject of the person in Microsoft Entra; the join key for sign-in. Null until the invitation is accepted. */
  idpSubject: text('idp_subject'),
  status: text('status').notNull().default('invited'),
  statusReason: text('status_reason'),
  statusAt: timestamp('status_at', { withTimezone: true }),
  statusBy: uuid('status_by'),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check('users_status_ck', sql`${t.status} in ('invited','active','suspended')`),
  check('users_language_ck', sql`${t.preferredLanguage} in ('en','ar')`),
  uniqueIndex('users_email_uq').on(sql`lower(${t.email})`),
  uniqueIndex('users_idp_subject_uq').on(t.idpSubject).where(sql`${t.idpSubject} is not null`),
  index('users_org_idx').on(t.orgId),
]);

// ---- Projects ----------------------------------------------------------------------------------------------------------
export const projects = pgTable('projects', {
  id: id(),
  code: text('code').notNull(),
  customerOrgId: uuid('customer_org_id').notNull().references(() => organisations.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  location: text('location'),
  status: text('status').notNull().default('planning'),
  plannedStart: date('planned_start'),
  plannedCompletion: date('planned_completion'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check('projects_type_ck', sql`${t.type} in ('industrial','infrastructure','commercial','residential')`),
  check('projects_status_ck', sql`${t.status} in ('planning','execution','handover','closed')`),
  check('projects_dates_ck', sql`${t.plannedCompletion} is null or ${t.plannedStart} is null or ${t.plannedCompletion} >= ${t.plannedStart}`),
  uniqueIndex('projects_code_uq').on(t.code),
  index('projects_customer_idx').on(t.customerOrgId),
]);

export const areas = pgTable('areas', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  parentId: uuid('parent_id'),
  code: text('code').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  kind: text('kind').notNull().default('area'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('areas_project_code_uq').on(t.projectId, t.code), check('areas_kind_ck', sql`${t.kind} in ('area','asset')`)]);

export const packages = pgTable('packages', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  areaId: uuid('area_id').references(() => areas.id),
  service: text('service').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  status: text('status').notNull().default('planned'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check('packages_service_ck', sql`${t.service} in ('scaffolding','insulation','waterproofing','fireproofing')`),
  uniqueIndex('packages_code_uq').on(t.code),
  index('packages_project_idx').on(t.projectId),
]);

// ---- Roles and delegated authority ------------------------------------------------------------------------------------
export const roleAssignments = pgTable('role_assignments', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').notNull().references(() => roles.id),
  /** True = all projects (the prototype's `projectId: '*'`). Otherwise `scopeProjectId` names the one project. */
  scopeAllProjects: boolean('scope_all_projects').notNull().default(false),
  scopeProjectId: uuid('scope_project_id').references(() => projects.id),
  scopeAreaId: uuid('scope_area_id').references(() => areas.id),
  scopeService: text('scope_service'),
  status: text('status').notNull().default('active'),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: createdAt(),
}, (t) => [
  check('role_assignments_status_ck', sql`${t.status} in ('active','revoked')`),
  check('role_assignments_scope_ck', sql`(${t.scopeAllProjects} and ${t.scopeProjectId} is null and ${t.scopeAreaId} is null and ${t.scopeService} is null) or (not ${t.scopeAllProjects} and ${t.scopeProjectId} is not null)`),
  check('role_assignments_service_ck', sql`${t.scopeService} is null or ${t.scopeService} in ('scaffolding','insulation','waterproofing','fireproofing')`),
  index('role_assignments_user_idx').on(t.userId),
]);

export const delegatedAuthorities = pgTable('delegated_authorities', {
  id: id(),
  ref: text('ref').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull().references(() => actions.id),
  scopeProjectId: uuid('scope_project_id').notNull().references(() => projects.id),
  scopeAreaId: uuid('scope_area_id').references(() => areas.id),
  scopeService: text('scope_service'),
  scopeCategories: text('scope_categories').array(),
  grantedBy: uuid('granted_by').notNull().references(() => users.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().default(sql`now()`),
  nominatedByUser: uuid('nominated_by_user').references(() => users.id),
  nominatedByOrg: uuid('nominated_by_org').references(() => organisations.id),
  status: text('status').notNull().default('active'),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to').notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),
  revokeReason: text('revoke_reason'),
}, (t) => [
  check('authorities_status_ck', sql`${t.status} in ('active','revoked')`),
  check('authorities_no_self_grant_ck', sql`${t.grantedBy} <> ${t.userId}`),
  check('authorities_nomination_ck', sql`(${t.nominatedByUser} is not null) <> (${t.nominatedByOrg} is not null)`),
  check('authorities_nominator_not_grantor_ck', sql`${t.nominatedByUser} is null or ${t.nominatedByUser} <> ${t.grantedBy}`),
  check('authorities_period_ck', sql`${t.validTo} >= ${t.validFrom} and ${t.validTo} - ${t.validFrom} <= 366`),
  check('authorities_revoked_ck', sql`(${t.status} = 'revoked') = (${t.revokedAt} is not null)`),
  uniqueIndex('authorities_ref_uq').on(t.ref),
  index('authorities_user_idx').on(t.userId),
]);

// ---- Audit trail (append-only, hash-chained; enforced by triggers in 0001_security.sql) -------------------------------
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().default(sql`now()`),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  recordKind: text('record_kind'),
  recordId: text('record_id'),
  reason: text('reason'),
  detail: jsonb('detail'),
  prevHash: text('prev_hash'),
  hash: text('hash').notNull().default(''),
}, (t) => [index('audit_log_at_idx').on(t.at), index('audit_log_record_idx').on(t.recordKind, t.recordId), index('audit_log_actor_idx').on(t.actorId)]);

// ---- Support requests -------------------------------------------------------------------------------------------------
export const supportRequests = pgTable('support_requests', {
  id: id(),
  ref: text('ref').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  category: text('category').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  check('support_category_ck', sql`${t.category} in ('access','data','report','other')`),
  check('support_status_ck', sql`${t.status} in ('open','in_progress','resolved')`),
  uniqueIndex('support_ref_uq').on(t.ref),
  index('support_user_idx').on(t.userId),
]);

export const supportReplies = pgTable('support_replies', {
  id: id(),
  requestId: uuid('request_id').notNull().references(() => supportRequests.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
  staff: boolean('staff').notNull().default(false),
  body: text('body').notNull(),
  createdAt: createdAt(),
}, (t) => [index('support_replies_request_idx').on(t.requestId)]);
