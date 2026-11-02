/*
 * RGS Client Portal — Stage 1 access model (reference implementation).
 *
 * Pure functions, no DOM. The same rules are meant to be ported to the
 * server (API middleware + database row-level security). Running them in
 * the browser, as this prototype does, demonstrates the logic only: it is
 * NOT a security boundary.
 *
 * Decision order for can():
 *   1. account active
 *   2. action known
 *   3. organisation boundary (customer users only see their own org's projects)
 *   4. a role assignment that grants the action AND whose scope covers the record
 *      (project -> site area/asset -> service work package)
 *   5. technical approvals additionally need an active delegated authority
 *      that covers the record. Roles alone never grant sign-off, and the
 *      portal administrator role is never eligible for one.
 */
(function (root) {
  'use strict';

  var SERVICES = ['scaffolding', 'insulation', 'waterproofing', 'fireproofing'];
  var PROJECT_TYPES = ['industrial', 'infrastructure', 'commercial', 'residential'];

  // ---- Actions -------------------------------------------------------------
  // kind: view | write | technical (needs delegated authority) | delegable (granted roles act directly;
  //       eligible roles need a dated delegation record) | admin (global)
  var ACTIONS = {
    'portfolio.view':        { kind: 'view',  module: 'projects' },
    'project.view':          { kind: 'view',  module: 'projects' },
    'project.meta.view':     { kind: 'view',  module: 'projects' },
    'package.view':          { kind: 'view',  module: 'packages' },
    'package.update':        { kind: 'write', module: 'packages' },
    'photo.upload':          { kind: 'write', module: 'packages' },
    'request.view':          { kind: 'view',  module: 'requests' },
    'request.create':        { kind: 'write', module: 'requests' },
    'request.respond':       { kind: 'write', module: 'requests' },
    'instruction.view':      { kind: 'view',  module: 'instructions' },
    'instruction.issue':     { kind: 'write', module: 'instructions' },
    'instruction.acknowledge': { kind: 'write', module: 'instructions' },
    'customer.approve':      { kind: 'technical', module: 'approvals' },
    'document.view':         { kind: 'view',  module: 'documents' },
    'document.view.draft':   { kind: 'view',  module: 'documents' },
    'document.upload':       { kind: 'write', module: 'documents' },
    'document.control':      { kind: 'write', module: 'documents' },
    'document.approve':      { kind: 'technical', module: 'documents' },
    'inspection.view':       { kind: 'view',  module: 'inspections' },
    'inspection.record':     { kind: 'write', module: 'inspections' },
    'inspection.signoff':    { kind: 'technical', module: 'inspections' },
    'corrective.view':       { kind: 'view',  module: 'corrective' },
    'corrective.raise':      { kind: 'write', module: 'corrective' },
    'corrective.respond':    { kind: 'write', module: 'corrective' },
    'corrective.close':      { kind: 'technical', module: 'corrective' },
    'hse.view':              { kind: 'view',  module: 'hse' },
    'hse.record':            { kind: 'write', module: 'hse' },
    'hse.permit.approve':    { kind: 'technical', module: 'hse' },
    'commitment.view':       { kind: 'view',  module: 'commitments' },
    'commitment.manage':     { kind: 'write', module: 'commitments' },
    'handover.view':         { kind: 'view',  module: 'handover' },
    'handover.prepare':      { kind: 'write', module: 'handover' },
    'handover.signoff':      { kind: 'technical', module: 'handover' },
    'handover.accept':       { kind: 'technical', module: 'handover' },
    'report.view':           { kind: 'view',  module: 'reports' },
    'report.export':         { kind: 'write', module: 'reports' },
    'ai.view':               { kind: 'view',  module: 'ai' },
    'ai.ask':                { kind: 'view',  module: 'ai' },
    'ai.document_check':     { kind: 'view',  module: 'ai' },
    'support.use':           { kind: 'write', module: 'support' },
    // Stage 2
    'document.acknowledge':  { kind: 'write', module: 'documents' },
    'evidence.upload':       { kind: 'write', module: 'packages' },
    'inspection.customer_signoff': { kind: 'technical', module: 'inspections' },
    'activity.internal.view': { kind: 'view', module: 'projects' },
    // Stage 3: requests, internal notes, controlled instructions
    'request.triage':        { kind: 'write', module: 'requests' },
    'request.note.view':     { kind: 'view',  module: 'requests' },
    'request.note.write':    { kind: 'write', module: 'requests' },
    'request.verify':        { kind: 'write', module: 'requests' },
    'request.acknowledge':   { kind: 'write', module: 'requests' },
    'request.cancel':        { kind: 'write', module: 'requests' },
    'request.edit':          { kind: 'write', module: 'requests' },
    'instruction.create':    { kind: 'write', module: 'instructions' },
    'instruction.revise':    { kind: 'write', module: 'instructions' },
    'instruction.cancel':    { kind: 'write', module: 'instructions' },
    'instruction.review':    { kind: 'write', module: 'instructions' },
    'instruction.authorise': { kind: 'technical', module: 'instructions' },
    'instruction.execute':   { kind: 'write', module: 'instructions' },
    'instruction.view.internal': { kind: 'view', module: 'instructions' },
    // Stage 4: document control and evidence
    'document.review':       { kind: 'write', module: 'documents' },   // record a proposed review outcome when assigned as reviewer
    'document.publish':      { kind: 'delegable', module: 'documents' }, // document controllers by role; named delegates by dated delegation
    'document.comment.internal': { kind: 'view', module: 'documents' },
    'evidence.view.internal': { kind: 'view', module: 'packages' },
    // Stage 5: inspections, findings, corrective actions
    'inspection.schedule':   { kind: 'write', module: 'inspections' },
    'inspection.amend':      { kind: 'write', module: 'inspections' },  // controlled amendment after verification
    'inspection.publish':    { kind: 'write', module: 'inspections' },  // publish a summary to the customer
    'inspection.witness':    { kind: 'write', module: 'inspections' },  // customer witness, only when named as attendee
    'inspection.view.internal': { kind: 'view', module: 'inspections' },
    'template.manage':       { kind: 'write', module: 'inspections' },
    'finding.raise':         { kind: 'write', module: 'corrective' },
    'finding.manage':        { kind: 'write', module: 'corrective' },
    'finding.view.internal': { kind: 'view',  module: 'corrective' },
    'corrective.manage':     { kind: 'write', module: 'corrective' },   // assign, return, cancel, reopen
    'hse.stopwork':          { kind: 'technical', module: 'hse' },      // only by explicit delegation; never from a role title
    'hse.release':           { kind: 'technical', module: 'hse' },
    // Stage 6: progress, daily updates, commitments, dependencies, reports, handover and release
    'progress.report':       { kind: 'write', module: 'progress' },   // submit a daily update (reported progress)
    'progress.review':       { kind: 'write', module: 'progress' },   // review a daily update before publication
    'progress.publish':      { kind: 'write', module: 'progress' },   // publish a reviewed update to the customer
    'progress.verify':       { kind: 'write', module: 'progress' },   // verify a reported milestone completion
    'progress.baseline':     { kind: 'write', module: 'progress' },   // change baselines, approved weights or planned quantities (with reason)
    'dependency.view':       { kind: 'view',  module: 'progress' },
    'dependency.manage':     { kind: 'write', module: 'progress' },
    'report.prepare':        { kind: 'write', module: 'reports' },
    'report.review':         { kind: 'write', module: 'reports' },
    'report.issue':          { kind: 'write', module: 'reports' },
    'handover.review':       { kind: 'write', module: 'handover' },   // internal readiness review of a handover package
    'handover.acknowledge':  { kind: 'write', module: 'handover' },   // customer acknowledges receipt of an issued package
    'asset.release':         { kind: 'technical', module: 'handover' }, // technical release authorisation; never from a role title
    'oversight.view':        { kind: 'view',  module: 'oversight' },
    'admin.users':           { kind: 'admin', module: 'admin' },
    'admin.roles':           { kind: 'admin', module: 'admin' },
    'admin.authority.grant': { kind: 'admin', module: 'admin' },
    'admin.audit.view':      { kind: 'admin', module: 'admin' },
    'admin.settings':        { kind: 'admin', module: 'admin' }
  };

  // AI may only ever perform these, and only when the user it acts for could.
  var AI_SAFE_ACTIONS = ['project.view', 'package.view', 'document.view', 'inspection.view',
    'corrective.view', 'hse.view', 'commitment.view', 'request.view', 'instruction.view',
    'handover.view', 'report.view', 'ai.view', 'ai.ask', 'ai.document_check', 'activity.internal.view', 'request.note.view', 'instruction.view.internal', 'document.comment.internal', 'evidence.view.internal', 'inspection.view.internal', 'finding.view.internal', 'dependency.view', 'oversight.view'];

  var CUSTOMER_VIEW = ['project.view', 'package.view', 'document.view', 'inspection.view',
    'commitment.view', 'handover.view', 'report.view', 'ai.view', 'request.view',
    'instruction.view', 'corrective.view', 'support.use'];
  var STAFF_VIEW = CUSTOMER_VIEW.concat(['document.view.draft', 'hse.view', 'activity.internal.view', 'request.note.view', 'request.note.write', 'instruction.view.internal',
    'document.comment.internal', 'evidence.view.internal', 'inspection.view.internal', 'finding.view.internal', 'dependency.view']);
  var CUSTOMER_REQ = ['report.export', 'handover.acknowledge', 'inspection.witness', 'request.create', 'document.acknowledge', 'evidence.upload', 'request.acknowledge', 'request.cancel', 'request.edit'];

  // ---- Roles ---------------------------------------------------------------
  // grants: actions the role can do within its assigned scope.
  // eligible: technical actions this role MAY hold via delegated authority.
  // scopeLevel: the narrowest scope this role is normally assigned at.
  var ROLES = {
    customer_viewer: { side: 'customer', scopeLevel: 'project', grants: CUSTOMER_VIEW, eligible: [] },
    customer_requester: { side: 'customer', scopeLevel: 'project',
      grants: CUSTOMER_VIEW.concat(CUSTOMER_REQ), eligible: [] },
    customer_approver: { side: 'customer', scopeLevel: 'project',
      grants: CUSTOMER_VIEW.concat(CUSTOMER_REQ, ['instruction.issue', 'document.review']),
      eligible: ['customer.approve', 'handover.accept', 'inspection.customer_signoff'] },
    general_manager: { side: 'rgs', scopeLevel: 'portfolio',
      grants: STAFF_VIEW.concat(['portfolio.view', 'report.export', 'ai.ask', 'commitment.manage', 'request.triage', 'instruction.review', 'document.review', 'corrective.manage', 'finding.manage',
        'oversight.view', 'report.review', 'handover.review']),
      eligible: ['asset.release', 'handover.signoff', 'document.approve', 'instruction.authorise', 'document.publish', 'hse.stopwork', 'hse.release'] },
    operations_manager: { side: 'rgs', scopeLevel: 'project',
      grants: STAFF_VIEW.concat(['portfolio.view', 'report.export', 'ai.ask', 'commitment.manage',
        'request.respond', 'corrective.raise', 'request.triage', 'request.cancel', 'instruction.review', 'instruction.cancel', 'document.review', 'inspection.schedule', 'template.manage', 'corrective.manage', 'finding.manage', 'finding.raise',
        'oversight.view', 'progress.review', 'progress.publish', 'progress.verify', 'progress.baseline', 'dependency.manage', 'report.prepare', 'report.review', 'report.issue', 'handover.prepare', 'handover.review']),
      eligible: ['asset.release', 'handover.signoff', 'document.approve', 'instruction.authorise', 'document.publish', 'hse.stopwork', 'hse.release'] },
    project_manager: { side: 'rgs', scopeLevel: 'project',
      grants: STAFF_VIEW.concat(['request.respond', 'instruction.acknowledge', 'commitment.manage',
        'document.upload', 'handover.prepare', 'report.export', 'ai.ask', 'corrective.raise',
        'corrective.respond', 'package.update', 'request.triage', 'request.cancel', 'request.verify',
        'instruction.create', 'instruction.revise', 'instruction.cancel', 'instruction.execute', 'document.review', 'photo.upload', 'evidence.upload',
        'inspection.schedule', 'inspection.publish', 'inspection.amend', 'finding.raise', 'finding.manage', 'corrective.manage',
        'progress.report', 'progress.review', 'progress.publish', 'progress.verify', 'progress.baseline', 'dependency.manage', 'report.prepare', 'report.issue']),
      eligible: ['asset.release', 'document.approve', 'handover.signoff', 'document.publish'] },
    site_officer: { side: 'rgs', scopeLevel: 'area',
      grants: STAFF_VIEW.concat(['package.update', 'photo.upload', 'evidence.upload', 'request.respond', 'hse.record',
        'corrective.raise', 'corrective.respond', 'ai.ask', 'instruction.execute', 'inspection.record', 'finding.raise', 'progress.report']),
      eligible: [] },
    service_supervisor: { side: 'rgs', scopeLevel: 'service',
      grants: STAFF_VIEW.concat(['package.update', 'photo.upload', 'evidence.upload', 'corrective.respond', 'hse.record', 'ai.ask', 'request.respond', 'instruction.execute', 'document.review', 'inspection.record', 'finding.raise', 'progress.report', 'progress.review']),
      eligible: [] },
    qa_qc_inspector: { side: 'rgs', scopeLevel: 'project',
      grants: STAFF_VIEW.concat(['inspection.record', 'corrective.raise', 'ai.ask', 'ai.document_check', 'request.respond', 'request.verify', 'document.review', 'document.upload', 'photo.upload', 'evidence.upload',
        'inspection.schedule', 'inspection.publish', 'inspection.amend', 'template.manage', 'finding.raise', 'finding.manage', 'corrective.manage',
        'progress.verify', 'report.review', 'handover.review']),
      eligible: ['inspection.signoff', 'corrective.close'] },
    hse_officer: { side: 'rgs', scopeLevel: 'project',
      grants: STAFF_VIEW.concat(['hse.record', 'corrective.raise', 'ai.ask', 'request.respond', 'request.verify', 'document.review', 'document.upload', 'photo.upload', 'evidence.upload', 'finding.raise', 'finding.manage', 'corrective.manage']),
      eligible: ['hse.permit.approve', 'corrective.close', 'hse.stopwork', 'hse.release'] },
    document_controller: { side: 'rgs', scopeLevel: 'project',
      grants: STAFF_VIEW.concat(['document.upload', 'document.control', 'document.publish', 'ai.document_check', 'request.respond', 'report.prepare', 'handover.prepare']),
      eligible: [] },
    portal_admin: { side: 'rgs', scopeLevel: 'global',
      grants: ['project.meta.view', 'admin.users', 'admin.roles', 'admin.authority.grant',
        'admin.audit.view', 'admin.settings', 'support.use'],
      eligible: [] /* never technical sign-off */ }
  };
  var ROLE_ORDER = Object.keys(ROLES);

  // ---- Helpers ---------------------------------------------------------------
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function inWindow(rec, now) {
    var t = now.getTime();
    if (rec.validFrom && new Date(rec.validFrom).getTime() > t) return false;
    // validUntil is an exact instant with its timezone offset (e.g. 2026-12-31T23:59:00+03:00); validTo is a date
    if (rec.validUntil) { if (new Date(rec.validUntil).getTime() < t) return false; }
    else if (rec.validTo && new Date(rec.validTo).getTime() < t) return false;
    return true;
  }
  function isView(action) { return ACTIONS[action] && ACTIONS[action].kind === 'view'; }

  // Expand a resource reference to {projectId, areaId, service, customerOrgId}.
  function resolve(ctx, res) {
    if (!res) return null;
    var out = { projectId: res.projectId || null, areaId: res.areaId || null, service: res.service || null, category: res.category || null };
    if (res.packageId) {
      var wp = byId(ctx.packages, res.packageId);
      if (!wp) return { missing: 'package' };
      out.projectId = wp.projectId; out.areaId = wp.areaId; out.service = wp.service;
    }
    if (out.areaId && !out.projectId) {
      var ar = byId(ctx.areas, out.areaId);
      if (ar) out.projectId = ar.projectId;
    }
    if (out.projectId) {
      var p = byId(ctx.projects, out.projectId);
      if (!p) return { missing: 'project' };
      out.customerOrgId = p.customerOrgId;
    }
    if (out.areaId) {
      var a = byId(ctx.areas, out.areaId);
      if (!a || a.projectId !== out.projectId) return { missing: 'area' };
    }
    return out;
  }

  // Does a scope {projectId|'*', areaId?, service?} cover a resolved resource?
  function scopeCovers(scope, r, action) {
    if (!r || !r.projectId) return scope.projectId === '*';
    if (scope.projectId !== '*' && scope.projectId !== r.projectId) return false;
    if (scope.areaId) {
      if (r.areaId) { if (scope.areaId !== r.areaId) return false; }
      else if (!isView(action)) return false; // project-level writes need project-level scope
    }
    if (scope.service) {
      if (r.service) { if (scope.service !== r.service) return false; }
      else if (!isView(action)) return false;
    }
    // delegations may be limited to listed document categories
    if (scope.categories) { if (!r.category || scope.categories.indexOf(r.category) < 0) return false; }
    return true;
  }

  function deny(code, trace) { return { allowed: false, code: code, trace: trace }; }

  // ---- Main check ----------------------------------------------------------
  function can(ctx, userId, action, resource) {
    var now = ctx.now ? new Date(ctx.now) : new Date();
    var trace = [];
    var user = byId(ctx.users, userId);
    if (!user) return deny('no_user', ['Unknown user']);
    if (user.status !== 'active') return deny('inactive', ['Account is ' + user.status]);
    trace.push('Account active');
    var def = ACTIONS[action];
    if (!def) return deny('unknown_action', trace.concat('Unknown action ' + action));
    var org = byId(ctx.orgs, user.orgId);
    if (!org) return deny('no_org', trace.concat('User has no organisation'));

    var r = resolve(ctx, resource);
    if (r && r.missing) return deny('not_found', trace.concat('Record not found: ' + r.missing));

    // Organisation boundary
    if (r && r.projectId && org.kind === 'customer' && r.customerOrgId !== org.id)
      return deny('org_boundary', trace.concat('Project belongs to another organisation'));
    if (r && r.projectId) trace.push('Organisation boundary passed');

    // Role assignment + scope
    var assignments = ctx.assignments.filter(function (a) {
      return a.userId === userId && a.status !== 'revoked' && inWindow(a, now);
    });
    if (!assignments.length) return deny('no_role', trace.concat('No active role assignment'));

    var grantingRole = null, roleCapable = false;
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i], role = ROLES[a.role];
      if (!role) continue;
      if (role.side === 'customer' && org.kind !== 'customer') continue;
      if (role.side === 'rgs' && org.kind !== 'rgs') continue;
      var grants = role.grants.indexOf(action) >= 0;
      var eligible = role.eligible.indexOf(action) >= 0;
      if (!grants && !eligible) continue;
      roleCapable = true;
      if (def.kind === 'admin') { if (a.scope.projectId === '*') { grantingRole = a; break; } continue; }
      if (scopeCovers(a.scope, r, action)) { grantingRole = a; break; }
    }
    if (!roleCapable) return deny('role', trace.concat('No assigned role includes this action'));
    if (!grantingRole) return deny('scope', trace.concat('Role is not assigned to this project, area or service'));
    trace.push('Role ' + grantingRole.role + ' covers scope');

    if (def.kind === 'delegable') {
      var direct = assignments.some(function (x) { return ROLES[x.role] && ROLES[x.role].grants.indexOf(action) >= 0 && scopeCovers(x.scope, r, action); });
      if (direct) return { allowed: true, code: 'ok', via: grantingRole.role, trace: trace.concat('Granted by role') };
    }
    if (def.kind !== 'technical' && def.kind !== 'delegable') return { allowed: true, code: 'ok', via: grantingRole.role, trace: trace };

    // Technical approvals: delegated authority required
    var auths = (ctx.authorities || []).filter(function (d) {
      return d.userId === userId && d.action === action && d.status === 'active' && !d.revokedAt &&
        inWindow(d, now) && d.grantedBy !== userId;
    });
    for (var j = 0; j < auths.length; j++) {
      var d = auths[j];
      var holderRoleOk = assignments.some(function (x) {
        return ROLES[x.role] && ROLES[x.role].eligible.indexOf(action) >= 0 && scopeCovers(x.scope, r, action);
      });
      if (holderRoleOk && scopeCovers(d.scope, r, action)) {
        trace.push('Delegated authority ' + d.id + ' valid until ' + (d.validTo || 'open'));
        return { allowed: true, code: 'ok', via: grantingRole.role, authority: d.id, trace: trace };
      }
    }
    var expired = (ctx.authorities || []).some(function (d) {
      return d.userId === userId && d.action === action && !inWindow(d, now) && scopeCovers(d.scope, r, action);
    });
    return deny(expired ? 'authority_expired' : 'authority',
      trace.concat(expired ? 'Delegated authority has expired' : 'No delegated authority for this record'));
  }

  // Can the user perform the action anywhere? (drives navigation)
  function canAnywhere(ctx, userId, action) {
    var def = ACTIONS[action];
    if (!def) return false;
    if (def.kind === 'admin') return can(ctx, userId, action, null).allowed;
    for (var i = 0; i < ctx.projects.length; i++) {
      var p = ctx.projects[i];
      if (can(ctx, userId, action, { projectId: p.id }).allowed) return true;
      // narrow scopes: try packages
      var wps = ctx.packages.filter(function (w) { return w.projectId === p.id; });
      for (var k = 0; k < wps.length; k++) if (can(ctx, userId, action, { packageId: wps[k].id }).allowed) return true;
    }
    return false;
  }

  function visibleProjects(ctx, userId) {
    return ctx.projects.filter(function (p) { return can(ctx, userId, 'project.view', { projectId: p.id }).allowed; });
  }

  // ---- Delegated authority grants -----------------------------------------
  function canGrant(ctx, grantorId, grant) {
    var now = ctx.now ? new Date(ctx.now) : new Date();
    if (!can(ctx, grantorId, 'admin.authority.grant', null).allowed) return deny('grantor', ['Grantor cannot manage authority']);
    if (grant.userId === grantorId) return deny('self_grant', ['Nobody can grant authority to themselves']);
    var def = ACTIONS[grant.action];
    if (!def || def.kind !== 'technical') return deny('not_technical', ['Only technical approvals are delegated']);
    if (!grant.validTo) return deny('no_expiry', ['Authority must have an end date']);
    var days = (new Date(grant.validTo) - now) / 864e5;
    if (days > 366) return deny('too_long', ['Authority may last at most 12 months']);
    if (!grant.nominatedBy || grant.nominatedBy === grantorId)
      return deny('no_nomination', ['Needs a nomination from the responsible manager or customer approver']);
    var r = resolve(ctx, grant.scope);
    if (!r || r.missing) return deny('scope', ['Scope must name an existing project']);
    var eligible = ctx.assignments.some(function (a) {
      return a.userId === grant.userId && a.status !== 'revoked' && ROLES[a.role] &&
        ROLES[a.role].eligible.indexOf(grant.action) >= 0 && scopeCovers(a.scope, r, grant.action);
    });
    if (!eligible) return deny('ineligible', ['Recipient has no eligible role on this scope']);
    return { allowed: true, code: 'ok', trace: ['Grant is valid; it will be recorded in the audit history'] };
  }

  // ---- AI guardrail -------------------------------------------------------
  function aiCan(ctx, userId, action, resource) {
    if (AI_SAFE_ACTIONS.indexOf(action) < 0)
      return deny('ai_forbidden', ['The assistant cannot record, approve or sign off; an authorised person must']);
    var res = can(ctx, userId, action, resource);
    if (!res.allowed) return deny(res.code, res.trace.concat('Assistant inherits the user’s access only'));
    return res;
  }

  var api = {
    SERVICES: SERVICES, PROJECT_TYPES: PROJECT_TYPES, ACTIONS: ACTIONS, ROLES: ROLES, ROLE_ORDER: ROLE_ORDER,
    AI_SAFE_ACTIONS: AI_SAFE_ACTIONS, can: can, canAnywhere: canAnywhere, canGrant: canGrant, aiCan: aiCan,
    visibleProjects: visibleProjects, resolve: resolve
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RGSAccess = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
