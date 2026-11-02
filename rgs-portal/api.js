/*
 * RGS Client Portal — command layer (Stage 3).
 *
 * Every change to requests, notes, instructions and decisions goes through dispatch(). It is written the
 * way a server endpoint would be: it re-checks permissions and authority at the moment of the command,
 * enforces the state machine, rejects stale versions (optimistic concurrency), replays idempotency keys,
 * rolls back on any failure, writes the audit trail and creates notifications only for people who can open
 * the linked record.
 *
 * IN THIS PROTOTYPE IT RUNS IN THE BROWSER. That makes it a faithful reference implementation and test
 * target, not a security boundary: a user with developer tools could bypass it. Production must run the
 * same rules on the server, with the database enforcing row-level access.
 */
(function (root) {
  'use strict';

  var REQUEST_TYPES = ['info', 'document', 'inspection', 'site_issue', 'scope_change', 'handover_support'];
  var PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  var FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
  var MAX_FILE = 25 * 1048576;
  var MUTABLE = ['milestones', 'progressConfigs', 'dailyUpdates', 'dependencies', 'reports', 'handoverPackages', 'releases', 'requests', 'requestNotes', 'changes', 'commitments', 'actions', 'notifications', 'files', 'audit', 'activity', 'idempotency', 'documents', 'transmittals', 'evidence', 'inspections', 'findings', 'correctiveActions', 'checklistTemplates', 'users', 'assignments', 'authorities', 'supportTickets'];
  // Stage 4: document files. Types are checked against the declared MIME type AND the file's first bytes.
  var DOC_FILE_TYPES = FILE_TYPES.concat(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/vnd.dwg']);
  var SIGNATURES = { 'application/pdf': ['25504446'], 'image/png': ['89504e47'], 'image/jpeg': ['ffd8ff'], 'image/webp': ['52494646'], 'image/heic': ['@4:66747970'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504b0304'], 'image/vnd.dwg': ['41433130'] };
  function signatureOk(type, head) {
    var sig = SIGNATURES[type]; if (!sig || !head) return null;
    head = String(head).toLowerCase();
    return sig.some(function (x) { if (x.charAt(0) === '@') { var at = +x.slice(1, x.indexOf(':')) * 2; return head.slice(at, at + x.length - x.indexOf(':') - 1) === x.slice(x.indexOf(':') + 1); } return head.indexOf(x) === 0; });
  }
  var TERMINAL_INS = ['closed', 'rejected', 'cancelled', 'superseded'];
  var OPEN_INS_REVISE = ['awaiting_approval', 'authorised', 'in_progress', 'ready_for_verification'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // Timestamps in Saudi time (UTC+3), the same form the records use.
  function ksaStamp(d) { var k = new Date(d.getTime() + 3 * 3600e3); return k.getUTCFullYear() + '-' + pad(k.getUTCMonth() + 1) + '-' + pad(k.getUTCDate()) + 'T' + pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()); }

  function createApi(ds, A, ST, opts) {
    opts = opts || {};
    var POLICY = ST.policy || {};
    var clock = opts.clock || function () { return ksaStamp(new Date()); };
    var persist = opts.persist || function () {};
    var counter = 0;
    MUTABLE.forEach(function (k) { if (!ds[k]) ds[k] = k === 'idempotency' ? {} : []; });

    function uid(prefix) { counter++; return prefix + '-' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
    function fail(code, detail) { var e = new Error(code); e.code = code; e.detail = detail || null; throw e; }
    function need(cond, code, detail) { if (!cond) fail(code, detail); }
    function text(v, min, code) { v = String(v == null ? '' : v).trim(); need(v.length >= (min || 1), code || 'text_required'); return v; }
    function get(kind, id) { var r = ST.get(kind, id); need(r, 'not_found', { kind: kind, id: id }); return r; }
    function checkVersion(rec, v) { need(v != null, 'version_required'); need(rec.version === v, 'stale', { current: rec.version, sent: v }); }
    function bump(rec, now) { rec.version = (rec.version || 0) + 1; rec.updatedAt = now; }
    function allow(actor, action, res) { var c = A.can(ds, actor, action, res); need(c.allowed, c.code || 'forbidden', { action: action, trace: c.trace }); return c; }
    function reqRes(r) { return r.packageId ? { packageId: r.packageId } : { projectId: r.projectId }; }
    function proj(pid) { return get('project', pid); }
    function pcode(pid) { return pid.toUpperCase(); }
    function nextRef(prefix, pid, table) {
      var re = new RegExp('^' + prefix + '-' + pcode(pid) + '-(\\d+)$'), max = 0;
      ds[table].forEach(function (r) { var m = re.exec(r.ref || ''); if (m) max = Math.max(max, +m[1]); });
      return prefix + '-' + pcode(pid) + '-' + String(max + 1).padStart(3, '0');
    }
    function usersWith(pred) { return ds.users.filter(pred).map(function (u) { return u.id; }); }
    function onProject(pid, role) { return usersWith(function (u) { return ds.assignments.some(function (a) { return a.userId === u.id && a.role === role && (a.scope.projectId === pid || a.scope.projectId === '*'); }); }); }
    function canDecide(ins, type) { return usersWith(function (u) { return ST.decisionCheck(u.id, ins, type).allowed; }); }
    function sameJSON(a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); }

    // ---------- transaction helpers ----------
    function tx(actor, now) {
      return {
        actor: actor, now: now, audits: [], acts: [], notes: [],
        audit: function (action, record, rev, reason, detail) { this.audits.push({ action: action, record: record, rev: rev, reason: reason || '', detail: detail || null }); },
        activity: function (kind, rec, visibility, extra) { this.acts.push({ kind: kind, rec: rec, visibility: visibility, extra: extra || {} }); },
        notify: function (userIds, kind, record, route, vars) { this.notes.push({ userIds: userIds, kind: kind, record: record, route: route, vars: vars || {} }); }
      };
    }
    function commit(t) {
      ST.reindex();
      t.audits.forEach(function (a) { ds.audit.push({ id: uid('au'), at: t.now, actor: t.actor, action: a.action, record: a.record, rev: a.rev, reason: a.reason, detail: a.detail }); });
      t.acts.forEach(function (e) {
        var r = e.rec.record, pid = r.projectId, pkg = r.packageId || (r.packageIds && r.packageIds[0]) || null;
        ds.activity.push(Object.assign({ id: uid('e'), at: t.now, projectId: pid, packageId: pkg, actor: t.actor, kind: e.kind, ref: { kind: e.rec.kind, id: r.id }, visibility: e.visibility }, e.extra));
      });
      ST.reindex();
      // A notification is created only for a recipient who can open the record it links to.
      t.notes.forEach(function (n) {
        var seen = {};
        (n.userIds || []).forEach(function (u) {
          if (!u || u === t.actor || seen[u]) return; seen[u] = 1;
          if (!ST.canSee(u, n.record.kind, n.record.rec)) return;
          ds.notifications.push({ id: uid('nt'), userId: u, at: t.now, kind: n.kind, route: n.route, record: { kind: n.record.kind, id: n.record.rec.id }, vars: n.vars, read: false });
        });
      });
      ST.reindex();
    }
    function snapshot() { var o = {}; MUTABLE.forEach(function (k) { o[k] = ds[k]; }); return JSON.parse(JSON.stringify(o)); }
    function restore(snap) { MUTABLE.forEach(function (k) { ds[k] = snap[k]; }); ST.reindex(); }

    // ---------- dispatch ----------
    function dispatch(cmd, actor, payload) {
      payload = payload || {};
      var h = H[cmd];
      if (!h) return { ok: false, code: 'unknown_command' };
      var key = payload.idempotencyKey;
      if (key && ds.idempotency[key]) {
        var prior = ds.idempotency[key];
        if (prior.actor !== actor || prior.cmd !== cmd) return { ok: false, code: 'idempotency_conflict' };
        return Object.assign({ replayed: true }, prior.response);
      }
      var u = ST.user(actor);
      if (!u || u.status !== 'active') return { ok: false, code: 'inactive' };
      var before = snapshot(), now = clock(), t = tx(actor, now);
      try {
        var result = h(actor, payload, t, now);
        commit(t);
        var response = { ok: true, result: result };
        if (key) ds.idempotency[key] = { actor: actor, cmd: cmd, at: now, response: response };
        try { persist(snapshot()); } catch (e) { /* persistence is best-effort in the prototype */ }
        return response;
      } catch (e) {
        restore(before); // all-or-nothing
        if (e && e.code) return { ok: false, code: e.code, detail: e.detail };
        throw e;
      }
    }

    // ---------- shared request helpers ----------
    function controls(actor, r) { return ST.requestControls(actor, r); }
    function addMessage(r, actor, now, txt, files) { var m = { id: uid('m'), at: now, by: actor, text: txt, attachments: files || [] }; r.messages.push(m); return m; }
    function moveFiles(ids, actor, owner) {
      (ids || []).forEach(function (fid) {
        var f = ST.get('file', fid); need(f, 'file_missing', { id: fid });
        need(ST.fileAccess(actor, f).allowed, 'file_forbidden', { id: fid });
        f.owner = owner;
      });
      return ids || [];
    }
    function rgsLead(r) { return r.ownerId || proj(r.projectId).repId; }
    function recReq(r) { return { kind: 'request', rec: r, record: r }; }
    function recIns(i) { return { kind: 'change', rec: i, record: i }; }
    function validArea(pkg, areaId) {
      var a = ST.get('areas', areaId); if (!a) return false;
      if (a.projectId !== pkg.projectId) return false;
      return a.id === pkg.areaId || a.parentId === pkg.areaId || (ST.get('areas', pkg.areaId) || {}).parentId === a.id;
    }
    function responseCommitment(r) { return ds.commitments.filter(function (c) { return c.requestId === r.id; })[0] || null; }

    var H = {};

    // ===================== Requests =====================
    H['request.saveDraft'] = function (actor, p, t, now) {
      var f = p.fields || {}, d;
      if (p.draftId) {
        d = get('request', p.draftId);
        need(d.status === 'draft' && d.raisedBy === actor, 'not_draft_owner');
        if (p.version != null) checkVersion(d, p.version);
      } else {
        d = { id: uid('r'), ref: null, status: 'draft', raisedBy: actor, raisedAt: now, version: 0, submitKey: uid('k'), projectId: null, packageId: null, areaId: null, type: null,
          priority: 'normal', subject: '', description: '', neededBy: null, attachments: [], messages: [], revisions: [], related: [], escalations: [], linkedDocs: [],
          duplicateReview: { outcome: 'none' }, triaged: false, ownerId: null, verifierId: null, verificationRequired: false, responseDue: null, instructionId: null,
          resolution: null, completion: null, verification: null, acknowledgement: null, step: 'project' };
        ds.requests.push(d);
      }
      ['projectId', 'packageId', 'areaId', 'type', 'priority', 'subject', 'description', 'neededBy', 'step'].forEach(function (k) { if (k in f) d[k] = f[k] === '' ? null : f[k]; });
      if ('projectId' in f && !('packageId' in f)) { d.packageId = null; d.areaId = null; }
      if ('packageId' in f && !('areaId' in f)) d.areaId = null;
      if (d.projectId) allow(actor, 'request.create', { projectId: d.projectId });
      if (d.packageId) { var w = get('package', d.packageId); need(w.projectId === d.projectId, 'package_mismatch'); allow(actor, 'request.create', { packageId: w.id }); }
      if (d.areaId) need(d.packageId && validArea(get('package', d.packageId), d.areaId), 'area_mismatch');
      if (d.type) need(REQUEST_TYPES.indexOf(d.type) >= 0, 'bad_type');
      if (d.priority) need(PRIORITIES.indexOf(d.priority) >= 0, 'bad_priority');
      if ('attachments' in f) d.attachments = moveFiles(f.attachments, actor, { kind: 'draft', userId: actor, draftId: d.id });
      bump(d, now);
      return { id: d.id, version: d.version, submitKey: d.submitKey };
    };
    H['request.deleteDraft'] = function (actor, p, t) {
      var d = get('request', p.draftId);
      need(d.status === 'draft' && d.raisedBy === actor, 'not_draft_owner');
      ds.requests.splice(ds.requests.indexOf(d), 1);
      ds.files = ds.files.filter(function (f) { return !(f.owner && f.owner.kind === 'draft' && f.owner.draftId === d.id); });
      return { id: d.id };
    };
    H['request.submit'] = function (actor, p, t, now) {
      var d = get('request', p.draftId);
      need(d.status === 'draft' && d.raisedBy === actor, 'not_draft_owner');
      need(d.projectId, 'missing_project'); need(d.packageId, 'missing_package'); need(d.areaId, 'missing_area');
      need(REQUEST_TYPES.indexOf(d.type) >= 0, 'missing_type');
      need(String(d.subject || '').trim().length >= 3, 'missing_subject');
      need(String(d.description || '').trim().length >= 10, 'missing_description');
      allow(actor, 'request.create', { packageId: d.packageId });
      need(validArea(get('package', d.packageId), d.areaId), 'area_mismatch');
      var exact = ST.exactDuplicate(d);
      need(!exact, 'exact_duplicate', exact ? { id: exact.id, ref: exact.ref } : null);
      var cands = ST.duplicateCandidates(actor, d), dr = p.duplicateReview || {};
      if (cands.length) need(dr.outcome === 'continued' && String(dr.reason || '').trim().length >= 5, 'needs_duplicate_review', { candidates: cands.map(function (c) { return c.request.id; }) });
      d.ref = nextRef('CR', d.projectId, 'requests');
      d.status = 'submitted'; d.raisedAt = now; d.triaged = false;
      d.subject = String(d.subject).trim(); d.description = String(d.description).trim();
      d.verificationRequired = (POLICY.verificationRequired || []).indexOf(d.type) >= 0;
      d.attachments = moveFiles(d.attachments, actor, { kind: 'request', id: d.id });
      d.messages = [{ id: uid('m'), at: now, by: actor, text: d.description, attachments: d.attachments.slice() }];
      d.revisions = [{ rev: 1, at: now, by: actor, subject: d.subject, description: d.description, reason: 'Submitted' }];
      d.duplicateReview = cands.length ? { outcome: 'continued', reason: String(dr.reason).trim(), candidates: cands.map(function (c) { return c.request.id; }), by: actor, at: now } : { outcome: 'none' };
      d.related = cands.map(function (c) { return { id: c.request.id, relation: 'possible_duplicate', by: actor, at: now }; });
      delete d.step;
      bump(d, now);
      t.audit('request.submit', { kind: 'request', id: d.id }, 1, '', { duplicateReview: d.duplicateReview.outcome });
      t.activity('req_created', recReq(d), 'customer');
      t.notify([proj(d.projectId).repId], 'req_submitted', recReq(d), 'req.' + d.id, { ref: d.ref });
      return { id: d.id, ref: d.ref };
    };
    H['request.addInfo'] = function (actor, p, t, now) {
      var d = get('request', p.draftId), r = get('request', p.targetId);
      need(d.status === 'draft' && d.raisedBy === actor, 'not_draft_owner');
      need(ST.canSee(actor, 'request', r), 'scope');
      need(controls(actor, r).message, 'cannot_message');
      var body = text([d.subject, d.description].filter(Boolean).join('\n\n'), 5, 'missing_description');
      var files = moveFiles(d.attachments, actor, { kind: 'request', id: r.id });
      r.attachments = r.attachments.concat(files);
      addMessage(r, actor, now, body, files);
      if (r.status === 'clarification_requested') r.status = r.triaged ? 'in_review' : 'submitted';
      bump(r, now);
      d.status = 'withdrawn'; d.withdrawnInto = r.id; d.attachments = []; bump(d, now);
      t.audit('request.addInfo', { kind: 'request', id: r.id }, null, 'Information added from a new draft instead of a separate request');
      t.activity('req_message', recReq(r), 'customer');
      t.notify([rgsLead(r)], 'req_message', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { id: r.id, ref: r.ref };
    };
    H['request.edit'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).edit, 'cannot_edit');
      var reason = text(p.reason, 5, 'reason_required');
      var subject = text(p.subject, 3, 'missing_subject'), desc = text(p.description, 10, 'missing_description');
      need(subject !== r.subject || desc !== r.description, 'no_change');
      var rev = r.revisions.length + 1;
      r.revisions.push({ rev: rev, at: now, by: actor, subject: subject, description: desc, reason: reason });
      r.subject = subject; r.description = desc;
      bump(r, now);
      t.audit('request.edit', { kind: 'request', id: r.id }, rev, reason);
      t.activity('req_revised', recReq(r), 'customer', { rev: String(rev) });
      t.notify([rgsLead(r)], 'req_revised', recReq(r), 'req.' + r.id, { ref: r.ref, rev: rev });
      return { rev: rev };
    };
    H['request.message'] = function (actor, p, t, now) {
      var r = get('request', p.id);
      need(controls(actor, r).message, 'cannot_message');
      var body = text(p.text, 2, 'text_required');
      var files = moveFiles(p.attachments, actor, { kind: 'request', id: r.id });
      r.attachments = r.attachments.concat(files);
      addMessage(r, actor, now, body, files);
      var cust = ST.isCustomer(actor);
      if (cust && r.status === 'clarification_requested') r.status = r.triaged ? 'in_review' : 'submitted';
      bump(r, now);
      t.audit('request.message', { kind: 'request', id: r.id });
      t.activity('req_message', recReq(r), 'customer');
      t.notify(cust ? [rgsLead(r)] : [r.raisedBy], 'req_message', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { status: r.status };
    };
    H['request.note'] = function (actor, p, t, now) {
      var r = get('request', p.id);
      need(controls(actor, r).note, 'cannot_note');
      var n = { id: uid('n'), requestId: r.id, at: now, by: actor, text: text(p.text, 2, 'text_required'), attachments: [] };
      ds.requestNotes.push(n); ST.reindex();
      n.attachments = moveFiles(p.attachments, actor, { kind: 'note', id: n.id });
      t.audit('request.note', { kind: 'note', id: n.id }, null, '', { requestId: r.id });
      t.activity('note_added', recReq(r), 'internal');
      t.notify([r.ownerId, proj(r.projectId).repId], 'note_added', { kind: 'note', rec: n }, 'req.' + r.id, { ref: r.ref });
      return { id: n.id };
    };
    H['request.triage'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).triage, 'cannot_triage');
      need(REQUEST_TYPES.indexOf(p.type) >= 0, 'bad_type');
      need(PRIORITIES.indexOf(p.priority) >= 0, 'bad_priority');
      need(p.ownerId, 'owner_required');
      need(A.can(ds, p.ownerId, 'request.respond', reqRes(r)).allowed, 'owner_not_eligible');
      need(p.responseDue && /^\d{4}-\d{2}-\d{2}$/.test(p.responseDue), 'due_required');
      need(p.responseDue >= ST.today, 'due_in_past');
      var verify = (POLICY.verificationRequired || []).indexOf(p.type) >= 0;
      if (verify) {
        need(p.verifierId, 'verifier_required');
        need(p.verifierId !== p.ownerId, 'verifier_is_owner');
        need(A.can(ds, p.verifierId, 'request.verify', reqRes(r)).allowed, 'verifier_not_eligible');
      }
      var changed = { type: r.type !== p.type, owner: r.ownerId !== p.ownerId, due: r.responseDue !== p.responseDue };
      r.type = p.type; r.priority = p.priority; r.ownerId = p.ownerId; r.verifierId = verify ? p.verifierId : null; r.verificationRequired = verify;
      r.routedRole = (POLICY.routing || {})[p.type] || null;
      var prevDue = r.responseDue; r.responseDue = p.responseDue;
      if (r.status === 'submitted' || r.status === 'clarification_requested') r.status = 'in_review';
      r.triaged = true;
      if (p.message && String(p.message).trim()) addMessage(r, actor, now, String(p.message).trim());
      var c = responseCommitment(r);
      if (!c) {
        c = { id: uid('c'), ref: nextRef('C', r.projectId, 'commitments'), projectId: r.projectId, packageId: r.packageId, requestId: r.id, party: 'rgs', ownerId: r.ownerId,
          text: 'Respond to request ' + r.ref, textAr: 'الرد على الطلب ' + r.ref, promised: r.responseDue, revised: null, doneAt: null, riskReason: null };
        ds.commitments.push(c);
      } else { c.ownerId = r.ownerId; if (prevDue && prevDue !== r.responseDue) c.revised = r.responseDue; }
      bump(r, now);
      t.audit('request.triage', { kind: 'request', id: r.id }, null, '', { type: r.type, priority: r.priority, owner: r.ownerId, verifier: r.verifierId, responseDue: r.responseDue, routedRole: r.routedRole, ownerMatchesRouting: (ST.user(r.ownerId) || {}).role === r.routedRole });
      t.activity('req_triaged', recReq(r), 'customer');
      if (changed.owner) t.notify([r.ownerId], 'req_assigned', recReq(r), 'req.' + r.id, { ref: r.ref, date: r.responseDue });
      t.notify([r.raisedBy], 'req_accepted', recReq(r), 'req.' + r.id, { ref: r.ref, date: r.responseDue });
      return { status: r.status, commitment: c.ref };
    };
    H['request.clarify'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).clarify, 'cannot_clarify');
      addMessage(r, actor, now, text(p.message, 5, 'message_required'));
      r.status = 'clarification_requested';
      bump(r, now);
      t.audit('request.clarify', { kind: 'request', id: r.id });
      t.activity('req_clarify', recReq(r), 'customer');
      t.notify([r.raisedBy], 'req_clarify', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { status: r.status };
    };
    H['request.escalate'] = function (actor, p, t, now) {
      var r = get('request', p.id);
      need(controls(actor, r).escalate, 'cannot_escalate');
      need(p.toId && p.toId !== actor, 'escalation_target_required');
      need(A.can(ds, p.toId, 'request.triage', reqRes(r)).allowed, 'escalation_target_not_eligible');
      var reason = text(p.reason, 5, 'reason_required');
      r.escalations.push({ at: now, by: actor, to: p.toId, reason: reason }); r.escalatedTo = p.toId;
      bump(r, now);
      t.audit('request.escalate', { kind: 'request', id: r.id }, null, reason, { to: p.toId });
      t.activity('req_escalated', recReq(r), 'internal');
      t.notify([p.toId], 'req_escalated', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { to: p.toId };
    };
    H['request.complete'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).complete, 'cannot_complete');
      var summary = text(p.summary, 5, 'summary_required');
      var files = moveFiles(p.attachments, actor, { kind: 'request', id: r.id });
      r.attachments = r.attachments.concat(files);
      r.completion = { at: now, by: actor, summary: summary, attachments: files };
      addMessage(r, actor, now, summary, files);
      var c = responseCommitment(r); if (c && !c.doneAt) c.doneAt = now;
      if (r.verificationRequired) {
        need(r.verifierId, 'verifier_required');
        r.status = 'completion_submitted';
        t.notify([r.verifierId], 'req_verify', recReq(r), 'req.' + r.id, { ref: r.ref });
      } else {
        r.status = 'resolved'; r.resolution = { at: now, by: actor, summary: summary };
        t.notify([r.raisedBy], 'req_resolved', recReq(r), 'req.' + r.id, { ref: r.ref });
      }
      bump(r, now);
      t.audit('request.complete', { kind: 'request', id: r.id }, null, '', { verificationRequired: r.verificationRequired });
      t.activity('req_completed', recReq(r), 'customer');
      return { status: r.status };
    };
    H['request.verify'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      if (r.completion && r.completion.by === actor) fail('self_approval');
      need(controls(actor, r).verify, r.verifierId !== actor ? 'not_designated_verifier' : 'cannot_verify');
      need(p.outcome === 'confirm' || p.outcome === 'return', 'bad_outcome');
      var reason = p.outcome === 'return' ? text(p.reason, 5, 'reason_required') : String(p.reason || '').trim();
      r.verificationHistory = (r.verificationHistory || []).concat([{ at: now, by: actor, outcome: p.outcome, reason: reason }]);
      if (p.outcome === 'confirm') {
        r.verification = { at: now, by: actor, outcome: 'confirm', reason: reason };
        r.status = 'resolved'; r.resolution = { at: now, by: r.completion.by, summary: r.completion.summary };
        t.notify([r.raisedBy, r.ownerId], 'req_resolved', recReq(r), 'req.' + r.id, { ref: r.ref });
      } else {
        r.status = 'in_review';
        t.notify([r.ownerId], 'req_verify_returned', recReq(r), 'req.' + r.id, { ref: r.ref });
      }
      bump(r, now);
      t.audit('request.verify', { kind: 'request', id: r.id }, null, reason, { outcome: p.outcome });
      t.activity(p.outcome === 'confirm' ? 'req_verified' : 'req_verify_returned', recReq(r), 'customer');
      return { status: r.status };
    };
    H['request.acknowledge'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).acknowledge, 'cannot_acknowledge');
      r.acknowledgement = { at: now, by: actor, comment: String(p.comment || '').trim() };
      r.status = 'closed';
      bump(r, now);
      t.audit('request.acknowledge', { kind: 'request', id: r.id });
      t.activity('req_closed', recReq(r), 'customer');
      t.notify([rgsLead(r)], 'req_closed', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { status: r.status };
    };
    H['request.reopen'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).reopen, 'cannot_reopen');
      var reason = text(p.reason, 5, 'reason_required');
      r.reopens = (r.reopens || []).concat([{ at: now, by: actor, from: r.status, reason: reason, priorResolution: r.resolution, priorCompletion: r.completion, priorAck: r.acknowledgement }]);
      r.status = 'in_review'; r.resolution = null; r.completion = null; r.verification = null; r.acknowledgement = null;
      addMessage(r, actor, now, reason);
      bump(r, now);
      t.audit('request.reopen', { kind: 'request', id: r.id }, null, reason);
      t.activity('req_reopened', recReq(r), 'customer');
      t.notify([rgsLead(r), r.raisedBy], 'req_reopened', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { status: r.status };
    };
    H['request.cancel'] = function (actor, p, t, now) {
      var r = get('request', p.id); checkVersion(r, p.version);
      need(controls(actor, r).cancel, 'cannot_cancel');
      var reason = text(p.reason, 5, 'reason_required');
      r.cancellation = { at: now, by: actor, reason: reason, from: r.status };
      r.status = 'cancelled';
      var c = responseCommitment(r); if (c && !c.doneAt) { c.doneAt = now; c.withdrawn = true; }
      bump(r, now);
      t.audit('request.cancel', { kind: 'request', id: r.id }, null, reason);
      t.activity('req_cancelled', recReq(r), 'customer');
      t.notify([rgsLead(r), r.raisedBy], 'req_cancelled', recReq(r), 'req.' + r.id, { ref: r.ref });
      return { status: r.status };
    };
    // Human decision only: link related requests, or mark one superseded by another. Nothing is merged or deleted.
    H['request.link'] = function (actor, p, t, now) {
      var r = get('request', p.id), o = get('request', p.otherId);
      need(r.id !== o.id, 'same_request');
      need(controls(actor, r).link && ST.canSee(actor, 'request', o), 'cannot_link');
      need(p.relation === 'related' || p.relation === 'superseded_by', 'bad_relation');
      var reason = text(p.reason, 5, 'reason_required');
      r.related.push({ id: o.id, relation: p.relation, by: actor, at: now, reason: reason });
      o.related.push({ id: r.id, relation: p.relation === 'superseded_by' ? 'supersedes' : 'related', by: actor, at: now, reason: reason });
      if (p.relation === 'superseded_by') {
        need(ST.OPEN_REQ.indexOf(r.status) >= 0, 'not_open');
        r.status = 'superseded'; r.supersededBy = o.id;
        var c = responseCommitment(r); if (c && !c.doneAt) { c.doneAt = now; c.withdrawn = true; }
      }
      bump(r, now); bump(o, now);
      t.audit('request.link', { kind: 'request', id: r.id }, null, reason, { other: o.id, relation: p.relation });
      t.activity(p.relation === 'superseded_by' ? 'req_superseded' : 'req_linked', recReq(r), 'customer', { otherRef: o.ref });
      t.notify([r.raisedBy], p.relation === 'superseded_by' ? 'req_superseded' : 'req_linked', recReq(r), 'req.' + r.id, { ref: r.ref, other: o.ref });
      return { status: r.status };
    };

    // ===================== Controlled instructions =====================
    function insFields(src) {
      return { scope: src.scope, areaIds: src.areaIds, dependencies: src.dependencies, scheduleImpact: src.scheduleImpact, docRefs: src.docRefs, packageIds: src.packageIds };
    }
    function validateIns(actor, f, pid) {
      need(f.packageIds && f.packageIds.length, 'packages_required');
      f.packageIds.forEach(function (id) { var w = get('package', id); need(w.projectId === pid, 'package_mismatch'); allow(actor, 'instruction.create', { packageId: id }); });
      (f.areaIds || []).forEach(function (id) { var a = ST.get('areas', id); need(a && a.projectId === pid, 'area_mismatch'); });
      need(f.scheduleImpact && Number.isInteger(+f.scheduleImpact.days) && +f.scheduleImpact.days >= 0, 'schedule_impact_required');
      (f.docRefs || []).forEach(function (d) { var doc = get('document', d.id); need(doc.projectId === pid, 'document_mismatch'); });
    }
    H['instruction.create'] = function (actor, p, t, now) {
      var r = p.requestId ? get('request', p.requestId) : null;
      var pid = r ? r.projectId : p.projectId; proj(pid);
      if (r) need(controls(actor, r).createInstruction, 'cannot_create_instruction');
      var f = { packageIds: p.packageIds || (r ? [r.packageId] : []), areaIds: p.areaIds || (r ? [r.areaId] : []), scope: text(p.scope, 10, 'scope_required'),
        dependencies: (p.dependencies || []).map(function (x) { return String(x).trim(); }).filter(Boolean), scheduleImpact: { days: +((p.scheduleImpact || {}).days), note: String((p.scheduleImpact || {}).note || '').trim() },
        docRefs: p.docRefs || [] };
      validateIns(actor, f, pid);
      var ins = Object.assign({ id: uid('ch'), ref: nextRef('CH', pid, 'changes'), projectId: pid, requestId: r ? r.id : null, title: text(p.title, 5, 'title_required'),
        state: 'draft', rev: 0, approvalRev: 0, version: 0, issuerId: actor, requiresCustomerApproval: p.requiresCustomerApproval !== false, approvalDue: p.approvalDue || null,
        raisedAt: now, summary: String(p.summary || '').trim(), decisions: [], completion: null, supersededBy: null, supersedes: p._supersedes || null, cancelReason: null }, f);
      ins.revisions = [Object.assign({ rev: 0, at: now, by: actor, material: true, reason: p._supersedes ? 'Replaces ' + get('change', p._supersedes).ref : 'Initial issue' }, JSON.parse(JSON.stringify(f)))];
      bump(ins, now);
      ds.changes.push(ins);
      if (r) { r.instructionId = ins.id; addMessage(r, actor, now, 'RGS is preparing a controlled instruction for this request. You will be asked to approve it before any work starts.'); bump(r, now); }
      t.audit('instruction.create', { kind: 'change', id: ins.id }, 0, '', { requestId: ins.requestId });
      t.activity('chg_draft', recIns(ins), 'internal', { rev: '0' });
      return { id: ins.id, ref: ins.ref };
    };
    H['instruction.submitReview'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(ins.state === 'draft' && !ins.supersededBy, 'bad_state');
      ins.packageIds.forEach(function (id) { allow(actor, 'instruction.revise', { packageId: id }); });
      ins.state = 'under_review'; bump(ins, now);
      t.audit('instruction.submitReview', { kind: 'change', id: ins.id }, ins.rev);
      t.activity('chg_review', recIns(ins), 'internal', { rev: String(ins.rev) });
      t.notify(canDecide(ins, 'internal_review'), 'chg_review', recIns(ins), 'decision.chg.' + ins.id + '.internal_review', { ref: ins.ref });
      return { state: ins.state };
    };
    H['instruction.revise'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(TERMINAL_INS.indexOf(ins.state) < 0 && !ins.supersededBy, 'not_open');
      ins.packageIds.forEach(function (id) { allow(actor, 'instruction.revise', { packageId: id }); });
      var reason = text(p.reason, 5, 'reason_required'), f = p.fields || {};
      var next = insFields(ins);
      Object.keys(next).forEach(function (k) { if (k in f) next[k] = f[k]; });
      if ('scheduleImpact' in f) next.scheduleImpact = { days: +f.scheduleImpact.days, note: String(f.scheduleImpact.note || '').trim() };
      if ('scope' in f) next.scope = text(f.scope, 10, 'scope_required');
      validateIns(actor, next, ins.projectId);
      var material = Object.keys(next).some(function (k) { return !sameJSON(next[k], ins[k]); });
      var wording = ('title' in f && f.title !== ins.title) || ('summary' in f && f.summary !== ins.summary);
      need(material || wording, 'no_change');
      var prevState = ins.state;
      Object.assign(ins, next);
      if ('title' in f) ins.title = text(f.title, 5, 'title_required');
      if ('summary' in f) ins.summary = String(f.summary || '').trim();
      ins.rev += 1;
      ins.revisions.push(Object.assign({ rev: ins.rev, at: now, by: actor, material: material, reason: reason }, JSON.parse(JSON.stringify(next))));
      var invalidated = [];
      if (material) {
        // A material change needs renewed review and approval; earlier decisions stay on record as outdated.
        ins.approvalRev = ins.rev;
        ins.decisions.forEach(function (d) { if (d.status === 'valid' && d.rev < ins.approvalRev) { d.status = 'outdated'; invalidated.push(d.by); } });
        if (OPEN_INS_REVISE.indexOf(prevState) >= 0 || prevState === 'under_review') ins.state = 'under_review';
      }
      bump(ins, now);
      t.audit('instruction.revise', { kind: 'change', id: ins.id }, ins.rev, reason, { material: material, from: prevState, to: ins.state });
      t.activity('chg_revised', recIns(ins), ins.sharedWithCustomer ? 'customer' : 'internal', { rev: String(ins.rev) });
      if (material) {
        t.notify(invalidated, 'chg_revised', recIns(ins), 'chg.' + ins.id, { ref: ins.ref, rev: ins.rev });
        t.notify(canDecide(ins, 'internal_review'), 'chg_review', recIns(ins), 'decision.chg.' + ins.id + '.internal_review', { ref: ins.ref });
      }
      return { rev: ins.rev, material: material, state: ins.state, invalidated: invalidated.length };
    };
    H['instruction.decide'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(TERMINAL_INS.indexOf(ins.state) < 0 && !ins.supersededBy, 'not_open');
      need(p.rev === ins.approvalRev, 'outdated_revision', { current: ins.approvalRev, sent: p.rev });
      need(ST.pendingDecisions(ins).indexOf(p.type) >= 0, 'not_pending');
      var chk = ST.decisionCheck(actor, ins, p.type);
      need(chk.allowed, chk.code || 'forbidden', { trace: chk.trace });
      need(['approve', 'reject', 'return'].indexOf(p.outcome) >= 0, 'bad_outcome');
      var reason = p.outcome === 'approve' ? String(p.reason || '').trim() : text(p.reason, 5, 'reason_required');
      var d = { id: uid('dc'), type: p.type, rev: ins.approvalRev, outcome: p.outcome, by: actor, at: now, reason: reason, authority: chk.authority || null, status: 'valid' };
      ins.decisions.push(d);
      var from = ins.state, issuer = ins.issuerId, notify = [], nkind = 'chg_decided';
      if (p.outcome === 'reject') { ins.state = 'rejected'; notify = [issuer]; }
      else if (p.outcome === 'return') {
        d.status = 'returned';
        ins.state = (p.type === 'technical_signoff' || p.type === 'completion_acceptance') ? 'in_progress' : 'draft';
        notify = [issuer];
      } else {
        switch (p.type) {
          case 'internal_review': ins.state = 'awaiting_approval'; ins.sharedWithCustomer = true; break;
          case 'customer_approval': break;
          case 'execution_authorisation': ins.state = 'authorised'; notify = [issuer]; break;
          case 'technical_signoff': break;
          case 'completion_acceptance': ins.state = 'closed'; notify = [issuer]; break;
        }
      }
      bump(ins, now);
      ST.reindex();
      // tell whoever decides next
      var nextTypes = ST.pendingDecisions(ins);
      nextTypes.forEach(function (nt) { t.notify(canDecide(ins, nt).concat(nt === 'customer_approval' || nt === 'completion_acceptance' ? onProject(ins.projectId, 'customer_approver') : []), 'chg_pending', recIns(ins), 'decision.chg.' + ins.id + '.' + nt, { ref: ins.ref, type: nt }); });
      if (notify.length) t.notify(notify, nkind, recIns(ins), 'chg.' + ins.id, { ref: ins.ref, type: p.type, outcome: p.outcome });
      var cust = ST.CUSTOMER_DECISIONS.indexOf(p.type) >= 0;
      t.audit('instruction.decide', { kind: 'change', id: ins.id }, ins.approvalRev, reason, { type: p.type, outcome: p.outcome, authority: d.authority, from: from, to: ins.state });
      t.activity('chg_decision', recIns(ins), p.type === 'internal_review' ? 'internal' : 'customer', { rev: String(ins.approvalRev), decisionType: p.type, outcome: p.outcome });
      return { state: ins.state, decision: d.id, authority: d.authority, customer: cust };
    };
    H['instruction.start'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(!ins.supersededBy && ins.state === 'authorised', 'not_authorised');
      ins.packageIds.forEach(function (id) { allow(actor, 'instruction.execute', { packageId: id }); });
      ins.state = 'in_progress'; ins.startedAt = now; ins.startedBy = actor; bump(ins, now);
      t.audit('instruction.start', { kind: 'change', id: ins.id }, ins.approvalRev);
      t.activity('chg_started', recIns(ins), 'customer', { rev: String(ins.approvalRev) });
      return { state: ins.state };
    };
    H['instruction.completeWork'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(!ins.supersededBy && ins.state === 'in_progress', 'bad_state');
      ins.packageIds.forEach(function (id) { allow(actor, 'instruction.execute', { packageId: id }); });
      var note = text(p.note, 5, 'summary_required');
      var files = moveFiles(p.attachments, actor, { kind: 'change', id: ins.id });
      if (ins.completion) ins.completionHistory = (ins.completionHistory || []).concat([ins.completion]);
      ins.completion = { at: now, by: actor, note: note, attachments: files };
      ins.state = 'ready_for_verification'; bump(ins, now);
      ST.reindex();
      t.audit('instruction.completeWork', { kind: 'change', id: ins.id }, ins.approvalRev, note);
      t.activity('chg_completed', recIns(ins), 'customer', { rev: String(ins.approvalRev) });
      t.notify(canDecide(ins, 'technical_signoff'), 'chg_pending', recIns(ins), 'decision.chg.' + ins.id + '.technical_signoff', { ref: ins.ref, type: 'technical_signoff' });
      return { state: ins.state };
    };
    H['instruction.cancel'] = function (actor, p, t, now) {
      var ins = get('change', p.id); checkVersion(ins, p.version);
      need(TERMINAL_INS.indexOf(ins.state) < 0, 'not_open');
      ins.packageIds.forEach(function (id) { allow(actor, 'instruction.cancel', { packageId: id }); });
      ins.cancelReason = text(p.reason, 5, 'reason_required'); ins.state = 'cancelled'; bump(ins, now);
      t.audit('instruction.cancel', { kind: 'change', id: ins.id }, ins.rev, ins.cancelReason);
      t.activity('chg_cancelled', recIns(ins), ins.sharedWithCustomer ? 'customer' : 'internal');
      return { state: ins.state };
    };
    H['instruction.supersede'] = function (actor, p, t, now) {
      var old = get('change', p.id); checkVersion(old, p.version);
      need(['draft', 'under_review', 'awaiting_approval', 'authorised', 'in_progress'].indexOf(old.state) >= 0 && !old.supersededBy, 'not_open');
      var reason = text(p.reason, 5, 'reason_required');
      var created = H['instruction.create'](actor, Object.assign({ projectId: old.projectId, title: old.title, scope: old.scope, summary: old.summary, packageIds: old.packageIds, areaIds: old.areaIds,
        dependencies: old.dependencies, scheduleImpact: old.scheduleImpact, docRefs: old.docRefs, requiresCustomerApproval: old.requiresCustomerApproval, approvalDue: old.approvalDue, _supersedes: old.id }, p.fields || {}), t, now);
      var neu = ST.get('change', created.id) || ds.changes[ds.changes.length - 1];
      neu.requestId = old.requestId;
      old.state = 'superseded'; old.supersededBy = neu.id; old.supersedeReason = reason; bump(old, now);
      if (old.requestId) { var r = ST.get('request', old.requestId); if (r) { r.instructionId = neu.id; bump(r, now); } }
      t.audit('instruction.supersede', { kind: 'change', id: old.id }, old.rev, reason, { replacement: neu.id });
      t.activity('chg_superseded', recIns(old), old.sharedWithCustomer ? 'customer' : 'internal', { otherRef: neu.ref });
      return { id: neu.id, ref: neu.ref };
    };

    // ===================== Stage 2 customer actions, now recorded =====================
    H['action.decide'] = function (actor, p, t, now) {
      var a = ST.get('action', p.actionId); need(a && a.source !== 'instruction', 'not_found');
      need(!a.doneAt, 'already_decided');
      if (p.version != null) checkVersion(a, p.version);
      var perm = ST.ACTION_PERMISSION[a.type], res = a.packageId ? { packageId: a.packageId } : { projectId: a.projectId };
      var chk = A.can(ds, actor, perm, res); need(chk.allowed, chk.code, { trace: chk.trace });
      var outcomes = a.type === 'document_ack' ? ['approve'] : ['approve', 'reject', 'return'];
      need(outcomes.indexOf(p.outcome) >= 0, 'bad_outcome');
      var reason = p.outcome === 'approve' ? String(p.reason || '').trim() : text(p.reason, 5, 'reason_required');
      a.doneAt = now; a.doneBy = actor; a.outcome = p.outcome; a.reason = reason; a.authority = chk.authority || null; bump(a, now);
      // a document acknowledgement raised by a transmittal also records receipt on that transmittal
      if (a.transmittalId) { var trx = ST.get('transmittal', a.transmittalId); if (trx && trx.recipients.indexOf(actor) >= 0 && !trx.acknowledgements.some(function (k) { return k.userId === actor; })) { trx.acknowledgements.push({ userId: actor, at: now }); bump(trx, now); } }
      t.audit('action.decide', { kind: 'action', id: a.id }, null, reason, { type: a.type, outcome: p.outcome, authority: a.authority });
      t.activity('action_decided', { kind: a.record.kind, rec: ST.get(a.record.kind, a.record.id), record: Object.assign({}, ST.get(a.record.kind, a.record.id), { projectId: a.projectId, packageId: a.packageId }) }, 'customer', { actionType: a.type, outcome: p.outcome });
      t.notify([proj(a.projectId).repId], 'action_decided', { kind: a.record.kind, rec: ST.get(a.record.kind, a.record.id) }, routeFor(a.record), { ref: a.id, type: a.type, outcome: p.outcome });
      return { outcome: p.outcome, authority: a.authority };
    };
    function routeFor(rec) { return ({ document: 'doc.', inspection: 'insp.', change: 'chg.' })[rec.kind] + rec.id; }

    // ===================== Files =====================
    // Called after the upload itself succeeds. Stores metadata only in this prototype (no private storage yet).
    // Called after the upload itself succeeds. Stores metadata only in this prototype (no private storage yet).
    // purpose: request (default) | document | evidence. The first bytes are checked against the declared type;
    // a mismatch is quarantined and can never be submitted or published. There is NO malware scanner here.
    H['file.register'] = function (actor, p, t, now) {
      var purpose = p.purpose || 'request';
      var types = purpose === 'document' ? DOC_FILE_TYPES : FILE_TYPES;
      var max = purpose === 'document' ? ((POLICY.documents || {}).maxFileMB || 50) * 1048576 : purpose === 'evidence' ? ((POLICY.evidence || {}).maxFileMB || 25) * 1048576 : MAX_FILE;
      need(types.indexOf(p.type) >= 0, 'file_type'); need(p.size > 0 && p.size <= max, 'file_size');
      if (purpose === 'document') need(A.can(ds, actor, 'document.upload', p.packageId ? { packageId: p.packageId } : { projectId: p.projectId }).allowed || A.can(ds, actor, 'document.control', { projectId: p.projectId }).allowed, 'forbidden');
      var sig = signatureOk(p.type, p.head);
      var f = { id: uid('f'), name: String(p.name).slice(0, 180), size: p.size, type: p.type, sha256: p.sha256 || null, uploadedBy: actor, at: now,
        owner: purpose === 'request' ? { kind: 'draft', userId: actor, draftId: p.draftId || null } : { kind: 'upload', userId: actor, projectId: p.projectId || null, packageId: p.packageId || null, purpose: purpose },
        validation: sig === true ? 'ok' : sig === false ? 'mismatch' : 'unchecked', scan: 'not_available', quarantined: sig === false };
      ds.files.push(f);
      t.audit('file.upload', { kind: 'file', id: f.id }, null, '', { name: f.name, sha256: f.sha256, validation: f.validation });
      return { id: f.id, validation: f.validation, quarantined: f.quarantined, duplicates: ST.duplicateFiles ? ST.duplicateFiles(actor, f.sha256, f.id).length : 0 };
    };
    // Authorised download: access is checked on every open and the download is written to the audit trail.
    H['file.download'] = function (actor, p, t) {
      var f = get('file', p.fileId);
      var acc = ST.fileAccess(actor, f); need(acc.allowed, acc.code || 'forbidden');
      t.audit('file.download', { kind: 'file', id: f.id }, null, '', { owner: f.owner });
      return { id: f.id, name: f.name, type: f.type };
    };

    // ===================== Stage 4: controlled documents =====================
    var DOCPOL = POLICY.documents || {};
    var OUTCOMES = DOCPOL.reviewOutcomes || ['accepted', 'accepted_comments', 'revise_resubmit', 'rejected'];
    var PUBLISHABLE = DOCPOL.publishableOutcomes || ['accepted', 'accepted_comments'];
    var PURPOSES = DOCPOL.transmittalPurposes || ['for_information', 'for_review', 'for_construction', 'for_acceptance'];
    var REV_OPEN = ['draft', 'under_review'].concat(PUBLISHABLE);
    function recDoc(d) { return { kind: 'document', rec: d, record: d }; }
    function docRes(d) { return ST.docRes(d); }
    function revOf(d, rev) { var r = ST.revOf(d, rev); need(r, 'not_found', { rev: rev }); return r; }
    function canUpload(actor, d) { return A.can(ds, actor, 'document.upload', docRes(d)).allowed || A.can(ds, actor, 'document.control', docRes(d)).allowed; }
    // Takes an uploaded file into a document revision: the file must be the actor's own unattached upload, and validated.
    function takeFile(actor, fileId, d, rev, opts) {
      var f = get('file', fileId);
      need(f.owner && f.owner.kind === 'upload' && (f.owner.userId === actor || A.can(ds, actor, 'document.control', { projectId: d.projectId }).allowed), 'file_forbidden');
      need(!f.owner.projectId || f.owner.projectId === d.projectId, 'file_forbidden');
      // the same content cannot be issued twice as different revisions of one document
      d.revisions.forEach(function (r) { var o = r.fileId && ST.get('file', r.fileId); need(!(o && o.sha256 && o.sha256 === f.sha256), 'same_content', { rev: r.rev }); });
      var dups = ST.duplicateFiles(actor, f.sha256, f.id).filter(function (x) { return x.kind !== 'document' || x.doc.id !== d.id; });
      if (dups.length) need(opts && String(opts.duplicateReason || '').trim().length >= 5, 'duplicate_file', { count: dups.length });
      f.owner = { kind: 'docrev', docId: d.id, rev: rev };
      return f;
    }
    // Customer reviewers are allowed only where customer review is configured for this project AND category,
    // and then at least one required reviewer must be from the customer.
    function checkReviewers(list, d, optional) {
      var custOn = ST.customerReviewRequired(d);
      (list || []).forEach(function (u) {
        need(A.can(ds, u, 'document.review', docRes(d)).allowed, 'reviewer_not_eligible', { user: u });
        if (ST.isCustomer(u)) need(custOn, 'customer_review_not_configured', { user: u });
      });
      if (!optional && custOn) need((list || []).some(function (u) { return ST.isCustomer(u); }), 'customer_reviewer_required');
    }
    function setOptional(r, d, list) {
      list = (list || []).filter(function (u) { return r.reviewers.indexOf(u) < 0; });
      checkReviewers(list, d, true);
      r.optionalReviewers = list;
    }
    function dcOf(d) { return d.ownerId || proj(d.projectId).repId; }

    H['document.register'] = function (actor, p, t, now) {
      var pid = p.projectId; proj(pid);
      var pkgs = p.packageIds || [];
      pkgs.forEach(function (id) { need(get('package', id).projectId === pid, 'package_mismatch'); });
      var res = pkgs.length ? { packageId: pkgs[0] } : { projectId: pid };
      need(A.can(ds, actor, 'document.upload', res).allowed || A.can(ds, actor, 'document.control', res).allowed, 'forbidden');
      var number = text(p.number, 3, 'missing_number').toUpperCase(), title = text(p.title, 3, 'missing_title');
      // Document identity is the number within the project, never the file name.
      need(!ds.documents.some(function (d) { return d.projectId === pid && d.number.toUpperCase() === number; }), 'number_exists');
      need((DOCPOL.categories || []).indexOf(p.category) >= 0, 'bad_category');
      var rev = text(p.rev, 1, 'missing_rev');
      if (p.areaId) { var a = get('areas', p.areaId); need(a.projectId === pid, 'area_mismatch'); }
      need(p.ownerId, 'owner_required'); need(A.can(ds, p.ownerId, 'document.control', { projectId: pid }).allowed, 'owner_not_eligible');
      need(p.audience === 'customer' || p.audience === 'internal', 'bad_audience');
      (p.links || []).forEach(function (l) { var r = get(l.kind, l.id); need(ST.projectOf(r) === pid || r.projectId === pid, 'link_mismatch'); });
      need(p.fileId, 'file_required');
      var d = { id: uid('d'), number: number, title: title, type: p.category, category: p.category, projectId: pid, packageIds: pkgs, areaId: p.areaId || null, source: 'rgs',
        ownerId: p.ownerId, audience: p.audience, links: (p.links || []).map(function (l) { return { kind: l.kind, id: l.id }; }), version: 1, registeredAt: now, registeredBy: actor, revisions: [] };
      ds.documents.push(d);
      var r = { rev: rev, date: now.slice(0, 10), status: 'draft', by: actor, note: String(p.note || '').trim(), fileId: null, submittedAt: null, submittedBy: null,
        reviewers: [], optionalReviewers: [], reviewDue: null, reviews: [], comments: [], publishedAt: null, publishedBy: null, transmittalId: null, withdrawn: null };
      d.revisions.push(r);
      var f = takeFile(actor, p.fileId, d, rev, p);
      r.fileId = f.id;
      ST.reindex();
      if (p.submit) submitRev(actor, d, r, p.reviewers, p.reviewDue, t, now, p.optionalReviewers);
      else if ((p.reviewers || []).length) { checkReviewers(p.reviewers, d); r.reviewers = p.reviewers.slice(); r.reviewDue = p.reviewDue || null; setOptional(r, d, p.optionalReviewers); }
      t.audit('document.register', { kind: 'document', id: d.id }, rev, '', { number: number, file: f.id, sha256: f.sha256 });
      t.activity('doc_registered', recDoc(d), 'internal', { rev: rev });
      return { id: d.id, number: number, rev: rev, status: r.status };
    };
    function submitRev(actor, d, r, reviewers, due, t, now, optional) {
      need(r.status === 'draft', 'bad_state');
      need(r.fileId, 'file_required');
      var f = get('file', r.fileId); need(!f.quarantined && f.validation === 'ok', 'file_not_validated');
      reviewers = reviewers && reviewers.length ? reviewers : r.reviewers;
      need(reviewers && reviewers.length, 'reviewers_required');
      checkReviewers(reviewers, d);
      need(due, 'due_required'); need(due >= ST.today, 'due_in_past');
      r.reviewers = reviewers.slice(); r.reviewDue = due; r.status = 'under_review'; r.submittedAt = now; r.submittedBy = actor;
      if (optional) setOptional(r, d, optional);
      t.notify(r.reviewers.concat(r.optionalReviewers || []), 'doc_review', recDoc(d), 'doc.' + d.id + '.' + r.rev, { ref: d.number, rev: r.rev, date: due });
      t.audit('document.submit', { kind: 'document', id: d.id }, r.rev, '', { reviewers: r.reviewers, due: due });
      t.activity('doc_submitted', recDoc(d), 'internal', { rev: r.rev });
    }
    H['document.submitReview'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      need(canUpload(actor, d), 'forbidden');
      var r = revOf(d, p.rev);
      submitRev(actor, d, r, p.reviewers, p.reviewDue, t, now, p.optionalReviewers);
      bump(d, now);
      return { status: r.status };
    };
    // A new revision is always a new record with its own file and review. It never replaces the published revision.
    H['document.addRevision'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      need(canUpload(actor, d), 'forbidden');
      need(!d.revisions.some(function (r) { return REV_OPEN.indexOf(r.status) >= 0; }), 'revision_in_progress');
      var rev = text(p.rev, 1, 'missing_rev');
      need(!d.revisions.some(function (r) { return r.rev.toUpperCase() === rev.toUpperCase(); }), 'rev_exists');
      var r = { rev: rev, date: now.slice(0, 10), status: 'draft', by: actor, note: text(p.note, 3, 'reason_required'), fileId: null, submittedAt: null, submittedBy: null,
        reviewers: [], optionalReviewers: [], reviewDue: null, reviews: [], comments: [], publishedAt: null, publishedBy: null, transmittalId: null, withdrawn: null };
      d.revisions.push(r);
      r.fileId = takeFile(actor, p.fileId, d, rev, p).id;
      if (p.submit) submitRev(actor, d, r, p.reviewers, p.reviewDue, t, now, p.optionalReviewers);
      bump(d, now);
      t.audit('document.addRevision', { kind: 'document', id: d.id }, rev, r.note, { file: r.fileId });
      t.activity('doc_revision', recDoc(d), 'internal', { rev: rev });
      return { rev: rev, status: r.status };
    };
    // Files can be swapped only on a revision nobody has reviewed yet. Submitted and published files are locked.
    H['document.replaceFile'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      need(canUpload(actor, d), 'forbidden');
      var r = revOf(d, p.rev);
      need(r.status === 'draft' && !r.submittedAt, 'file_locked');
      var old = r.fileId && ST.get('file', r.fileId);
      r.fileId = takeFile(actor, p.fileId, d, r.rev, p).id;
      if (old) old.owner = { kind: 'docrev_replaced', docId: d.id, rev: r.rev, replacedAt: now };
      bump(d, now);
      t.audit('document.replaceFile', { kind: 'document', id: d.id }, r.rev, String(p.reason || ''), { from: old ? old.id : null, to: r.fileId });
      return { fileId: r.fileId };
    };
    H['document.assignReviewers'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      allow(actor, 'document.control', docRes(d));
      var r = revOf(d, p.rev); need(r.status === 'under_review' || r.status === 'draft', 'bad_state');
      need((p.reviewers || []).length, 'reviewers_required'); checkReviewers(p.reviewers, d);
      var added = p.reviewers.filter(function (u) { return r.reviewers.indexOf(u) < 0; });
      r.reviewers = r.reviewers.concat(added);
      if (p.optionalReviewers) { var optAdded = p.optionalReviewers.filter(function (u) { return (r.optionalReviewers || []).indexOf(u) < 0 && r.reviewers.indexOf(u) < 0; }); setOptional(r, d, (r.optionalReviewers || []).concat(optAdded)); added = added.concat(optAdded); }
      if (p.reviewDue) { need(p.reviewDue >= ST.today, 'due_in_past'); r.reviewDue = p.reviewDue; }
      bump(d, now);
      if (r.status === 'under_review') t.notify(added, 'doc_review', recDoc(d), 'doc.' + d.id + '.' + r.rev, { ref: d.number, rev: r.rev, date: r.reviewDue });
      t.audit('document.assignReviewers', { kind: 'document', id: d.id }, r.rev, '', { added: added, due: r.reviewDue });
      return { reviewers: r.reviewers };
    };
    // A reviewer records a PROPOSED outcome. Acceptance of a document never authorises work.
    H['document.review'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      var r = revOf(d, p.rev);
      need(r.status === 'under_review', 'not_open');
      need(r.reviewers.indexOf(actor) >= 0 || (r.optionalReviewers || []).indexOf(actor) >= 0, 'not_reviewer');
      allow(actor, 'document.review', docRes(d));
      need(!r.reviews.some(function (x) { return x.by === actor && x.rev === r.rev; }), 'already_decided');
      need(OUTCOMES.indexOf(p.outcome) >= 0, 'bad_outcome');
      var reason = p.outcome === 'accepted' ? String(p.reason || '').trim() : text(p.reason, 5, 'reason_required');
      r.reviews.push({ by: actor, at: now, rev: r.rev, outcome: p.outcome, reason: reason, required: r.reviewers.indexOf(actor) >= 0 });
      if (ST.isCustomer(actor)) need(!p.comment || p.commentVisibility !== 'internal', 'forbidden');
      if (p.comment && String(p.comment).trim()) addComment(actor, d, r, p.comment, p.commentVisibility, now);
      var rs = ST.reviewState(r);
      if (rs.complete) {
        r.status = rs.outcome;
        t.notify([dcOf(d), r.submittedBy], 'doc_review_done', recDoc(d), 'doc.' + d.id + '.' + r.rev, { ref: d.number, rev: r.rev, outcome: r.status });
      }
      bump(d, now);
      t.audit('document.review', { kind: 'document', id: d.id }, r.rev, reason, { outcome: p.outcome, complete: rs.complete });
      t.activity('doc_reviewed', recDoc(d), 'internal', { rev: r.rev, outcome: p.outcome });
      return { status: r.status, complete: rs.complete };
    };
    function addComment(actor, d, r, txt, vis, now) {
      vis = vis === 'internal' ? 'internal' : 'customer';
      if (vis === 'internal') need(A.can(ds, actor, 'document.comment.internal', { projectId: d.projectId }).allowed, 'forbidden');
      var c = { id: uid('dcm'), by: actor, at: now, text: text(txt, 2, 'text_required'), visibility: vis };
      r.comments.push(c); return c;
    }
    H['document.comment'] = function (actor, p, t, now) {
      var d = get('document', p.id);
      need(A.can(ds, actor, 'document.view.draft', { projectId: d.projectId }).allowed && ST.docVisible(actor, d), 'forbidden');
      var r = revOf(d, p.rev);
      var c = addComment(actor, d, r, p.text, p.visibility, now);
      bump(d, now);
      t.audit('document.comment', { kind: 'document', id: d.id }, r.rev, '', { visibility: c.visibility });
      return { id: c.id };
    };
    // Publish an accepted revision to named customer recipients. Creates the transmittal and portal deliveries.
    H['document.publish'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      var pubChk = allow(actor, 'document.publish', docRes(d));
      var r = revOf(d, p.rev);
      need(PUBLISHABLE.indexOf(r.status) >= 0, 'not_accepted');
      need(d.audience === 'customer', 'internal_document');
      // an unconfigured routing rule blocks issuance; it never silently skips customer review
      need(ST.reviewRouting(d), 'review_routing_not_configured');
      if (ST.customerReviewRequired(d)) need(r.reviews.some(function (x) { return x.rev === r.rev && ST.isCustomer(x.by) && (x.required !== false); }), 'customer_review_missing');
      var f = r.fileId && ST.get('file', r.fileId);
      need(!r.fileId || (f && !f.quarantined && f.validation === 'ok'), 'file_not_validated');
      need(r.fileId || p.allowNoFile, 'file_required'); // fixtures carry no files; real registrations always have one
      need(PURPOSES.indexOf(p.purpose) >= 0, 'bad_purpose');
      var eligible = ST.audienceFor(d).map(function (u) { return u.id; });
      var recipients = (p.recipients || []).filter(function (u, i, a) { return a.indexOf(u) === i; });
      need(recipients.length, 'recipients_required');
      recipients.forEach(function (u) { need(eligible.indexOf(u) >= 0, 'recipient_not_eligible', { user: u }); });
      var prev = ST.pubRev(d);
      if (prev) { need(String(p.reason || '').trim().length >= 5, 'reason_required'); prev.status = 'superseded'; prev.supersededAt = now; prev.supersededBy = r.rev; }
      r.status = 'published'; r.publishedAt = now; r.publishedBy = actor;
      var tr = { id: uid('tr'), ref: nextRef('TR', d.projectId, 'transmittals'), projectId: d.projectId, issuedAt: now, issuedBy: actor, purpose: p.purpose, note: String(p.note || '').trim(),
        items: [{ docId: d.id, number: d.number, rev: r.rev }], recipients: recipients, version: 1,
        deliveries: recipients.map(function (u) { return { userId: u, at: now, channel: 'portal' }; }), acknowledgements: [] };
      ds.transmittals.push(tr);
      r.transmittalId = tr.id;
      bump(d, now); ST.reindex();
      // acknowledgement request (receipt only, never approval) for the customer organisation
      // reminder only (calendar days); an unanswered acknowledgement never implies acceptance
      var due = new Date(now.slice(0, 10) + 'T00:00:00Z'); due.setUTCDate(due.getUTCDate() + ((DOCPOL.acknowledgeReminderDays) || 7));
      tr.reminderAt = due.toISOString().slice(0, 10); tr.authority = pubChk.authority || null;
      ds.actions.push({ id: 'ACT-' + uid('').slice(1, 8).toUpperCase(), type: 'document_ack', projectId: d.projectId, packageId: d.packageIds[0] || null, record: { kind: 'document', id: d.id },
        assigneeId: null, due: due.toISOString().slice(0, 10), createdAt: now, doneAt: null, doneBy: null, transmittalId: tr.id, rev: r.rev, version: 1 });
      t.notify(recipients, 'doc_published', recDoc(d), 'tr.' + tr.id, { ref: d.number, rev: r.rev, tr: tr.ref });
      t.audit('document.publish', { kind: 'document', id: d.id }, r.rev, String(p.reason || ''), { transmittal: tr.ref, recipients: recipients, purpose: p.purpose, supersedes: prev ? prev.rev : null, authority: tr.authority });
      t.activity('doc_published', recDoc(d), 'customer', { rev: r.rev, otherRef: tr.ref });
      return { transmittalId: tr.id, ref: tr.ref, superseded: prev ? prev.rev : null };
    };
    // Withdrawal leaves the document with no current revision until an authorised replacement is published.
    H['document.withdraw'] = function (actor, p, t, now) {
      var d = get('document', p.id); checkVersion(d, p.version);
      allow(actor, 'document.control', docRes(d));
      var r = revOf(d, p.rev); need(r.status === 'published', 'not_published');
      var reason = text(p.reason, 5, 'reason_required');
      r.status = 'withdrawn'; r.withdrawn = { at: now, by: actor, reason: reason };
      bump(d, now); ST.reindex();
      var tellUsers = [];
      ds.transmittals.forEach(function (tr) { if (tr.items.some(function (i) { return i.docId === d.id && i.rev === r.rev; })) tellUsers = tellUsers.concat(tr.recipients); });
      t.notify(tellUsers, 'doc_withdrawn', recDoc(d), 'doc.' + d.id, { ref: d.number, rev: r.rev });
      t.audit('document.withdraw', { kind: 'document', id: d.id }, r.rev, reason);
      t.activity('doc_withdrawn', recDoc(d), d.audience === 'customer' ? 'customer' : 'internal', { rev: r.rev });
      return { status: d.status };
    };
    // Acknowledgement records receipt by the customer organisation. It is not approval of the content.
    H['transmittal.acknowledge'] = function (actor, p, t, now) {
      var tr = get('transmittal', p.id);
      var st = ST.trAckState(actor, tr); need(st.canAck, st.ack ? 'already_acknowledged' : 'cannot_acknowledge');
      // acknowledgement is per named recipient and records receipt only
      tr.acknowledgements.push({ userId: actor, at: now }); bump(tr, now);
      ds.actions.forEach(function (a) { if (a.transmittalId === tr.id && !a.doneAt) { a.doneAt = now; a.doneBy = actor; a.outcome = 'approve'; bump(a, now); } });
      var d = ST.get('document', tr.items[0].docId);
      t.notify([tr.issuedBy, d ? dcOf(d) : null], 'tr_ack', { kind: 'transmittal', rec: tr }, 'tr.' + tr.id, { tr: tr.ref });
      t.audit('transmittal.acknowledge', { kind: 'transmittal', id: tr.id }, null, '');
      if (d) t.activity('tr_ack', recDoc(d), 'customer', { otherRef: tr.ref, rev: tr.items[0].rev });
      return { ack: true };
    };

    // ===================== Stage 4: site evidence =====================
    H['evidence.upload'] = function (actor, p, t, now) {
      var w = get('package', p.packageId);
      need(A.can(ds, actor, 'evidence.upload', { packageId: w.id }).allowed || A.can(ds, actor, 'photo.upload', { packageId: w.id }).allowed, 'forbidden');
      var a = get('areas', p.areaId); need(a.projectId === w.projectId, 'area_mismatch');
      if (p.linked) { var lr = get(p.linked.kind, p.linked.id); need(ST.canSee(actor, p.linked.kind, lr) && ST.projectOf(lr) === w.projectId, 'link_mismatch'); }
      var caption = text(p.caption, 5, 'caption_required');
      var stated = p.capturedAt ? String(p.capturedAt).slice(0, 16) : null;
      if (stated) need(stated.slice(0, 10) <= now.slice(0, 10), 'capture_in_future');
      var f = get('file', p.fileId);
      need(f.owner && f.owner.kind === 'upload' && f.owner.userId === actor, 'file_forbidden');
      need(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'].indexOf(f.type) >= 0, 'file_type');
      need(!f.quarantined, 'file_not_validated');
      var cust = ST.isCustomer(actor);
      var e = { id: uid('ev'), ref: nextRef('PH', w.projectId, 'evidence').replace(/-(\d{3})$/, function (m, n) { return '-0' + n; }), projectId: w.projectId, packageId: w.id, areaId: a.id,
        caption: caption, linked: p.linked || null, capturedAt: stated, capturedAtSource: stated ? 'stated' : 'none', capturedBy: actor,
        uploadedBy: actor, uploadedAt: now, audience: cust ? 'customer' : (p.audience === 'internal' ? 'internal' : 'customer'), fileId: f.id, file: { id: f.id }, versions: [], version: 1 };
      f.owner = { kind: 'evidence', id: e.id };
      ds.evidence.push(e);
      t.audit('evidence.upload', { kind: 'evidence', id: e.id }, null, '', { sha256: f.sha256, stated: stated });
      t.activity('ev_uploaded', { kind: 'evidence', rec: e, record: e }, e.audience === 'internal' ? 'internal' : 'customer', {});
      return { id: e.id, ref: e.ref };
    };
    // An edited copy (for example an annotated photo) is added beside the original, which is never replaced.
    H['evidence.addVersion'] = function (actor, p, t, now) {
      var e = get('evidence', p.id); checkVersion(e, p.version);
      need(e.uploadedBy === actor || A.can(ds, actor, 'photo.upload', { packageId: e.packageId }).allowed, 'forbidden');
      var f = get('file', p.fileId);
      need(f.owner && f.owner.kind === 'upload' && f.owner.userId === actor && !f.quarantined, 'file_forbidden');
      f.owner = { kind: 'evidence', id: e.id };
      e.versions.push({ fileId: f.id, by: actor, at: now, note: text(p.note, 3, 'reason_required'), derivedFrom: e.fileId });
      bump(e, now);
      t.audit('evidence.addVersion', { kind: 'evidence', id: e.id }, null, e.versions[e.versions.length - 1].note, { file: f.id, original: e.fileId });
      return { versions: e.versions.length };
    };

    // ===================== Stage 5: inspections =====================
    var INSPOL = POLICY.inspections || {}, FNPOL = POLICY.findings || {}, CAPOL = POLICY.corrective || {};
    var RESULTS = INSPOL.results || ['pass', 'fail', 'na', 'not_assessed'];
    function recI(i) { return { kind: 'inspection', rec: i, record: i }; }
    function recF(f) { return { kind: 'finding', rec: f, record: f }; }
    function recC(c) { return { kind: 'corrective', rec: c, record: c }; }
    function ref4(prefix, pid, table) {
      var re = new RegExp('^' + prefix + '-' + pcode(pid) + '-(\\d+)$'), max = 0;
      ds[table].forEach(function (r) { var m = re.exec(r.ref || ''); if (m) max = Math.max(max, +m[1]); });
      return prefix + '-' + pcode(pid) + '-' + String(max + 1).padStart(prefix === 'INS' ? 4 : 3, '0');
    }
    function pres(id) { return { packageId: id }; }
    function staffVerifiers(pkgId) { return usersWith(function (u) { return A.can(ds, u.id, 'inspection.signoff', pres(pkgId)).allowed; }); }
    function snapshotItems(service, version) {
      var tp = ST.templateFor(service); need(tp, 'template_missing');
      var v = version ? tp.versions.filter(function (x) { return x.version === version; })[0] : ST.activeVersion(tp);
      need(v && (v.status === 'active' || version), 'template_missing');
      return { templateId: tp.id, templateVersion: v.version, items: JSON.parse(JSON.stringify(v.items)) };
    }
    H['inspection.schedule'] = function (actor, p, t, now) {
      var w = get('package', p.packageId); allow(actor, 'inspection.schedule', pres(w.id));
      var a = get('areas', p.areaId); need(a.projectId === w.projectId, 'area_mismatch');
      need((INSPOL.types || []).indexOf(p.type) >= 0, 'bad_type');
      var title = text(p.title, 5, 'missing_title'), scope = text(p.scope, 5, 'missing_scope');
      need(p.planned, 'due_required'); need(p.planned >= ST.today, 'due_in_past');
      need(p.inspectorId && A.can(ds, p.inspectorId, 'inspection.record', pres(w.id)).allowed, 'inspector_not_eligible');
      (p.attendees || []).forEach(function (u) { need(ST.user(u) && A.can(ds, u, 'inspection.view', pres(w.id)).allowed, 'attendee_not_eligible', { user: u }); });
      (p.docRefs || []).forEach(function (ref) { var d = get('document', ref.id); need(d.projectId === w.projectId && ST.revOf(d, ref.rev), 'document_mismatch'); });
      var req = null;
      if (p.requestId) { req = get('request', p.requestId); need(req.projectId === w.projectId && ST.canSee(actor, 'request', req), 'link_mismatch'); }
      var snap = snapshotItems(w.service);
      var i = { id: uid('i'), ref: ref4('INS', w.projectId, 'inspections'), projectId: w.projectId, packageId: w.id, areaId: a.id, title: title, type: p.type, scope: scope,
        planned: p.planned, performed: null, inspectorId: p.inspectorId, result: null, rgsSignoff: null, customerSignoffRequired: !!p.customerSignoffRequired,
        basisDocId: (p.docRefs || [])[0] ? p.docRefs[0].id : null, basisRev: (p.docRefs || [])[0] ? p.docRefs[0].rev : null, docRefs: (p.docRefs || []).map(function (x) { return { id: x.id, rev: x.rev }; }),
        templateId: snap.templateId, templateVersion: snap.templateVersion, items: snap.items,
        attendees: [p.inspectorId].concat((p.attendees || []).filter(function (u) { return u !== p.inspectorId; })),
        prerequisites: (p.prerequisites || []).filter(function (x) { return String(x.text || '').trim(); }).map(function (x) { return { text: String(x.text).trim(), met: !!x.met }; }),
        requestId: req ? req.id : null, reinspectionOf: p.reinspectionOf || null, correctiveActionId: p.correctiveActionId || null,
        results: {}, field: null, verification: null, status: 'scheduled', rev: 1, amendments: [], witnesses: [], version: 1, publishedAt: null, publishedBy: null, createdBy: actor, createdAt: now };
      ds.inspections.push(i);
      if (req) { req.linkedInspections = (req.linkedInspections || []).concat([i.id]); bump(req, now); }
      ST.reindex();
      var flags = ST.scheduleFlags(i);
      t.notify(i.attendees.filter(function (u) { return !ST.isCustomer(u); }), 'insp_scheduled', recI(i), 'insp.' + i.id, { ref: i.ref, date: i.planned });
      t.audit('inspection.schedule', { kind: 'inspection', id: i.id }, 1, '', { template: i.templateId + ' v' + i.templateVersion, flags: flags.map(function (f) { return f.flag; }), request: i.requestId });
      t.activity('insp_scheduled', recI(i), 'internal', { rev: '1' });
      return { id: i.id, ref: i.ref, flags: flags };
    };
    function needControl(actor, i, k) {
      var c = ST.inspControls(actor, i);
      var code = 'forbidden';
      if (k === 'verify') code = i.status !== 'awaiting_review' ? 'bad_state' : !c.verifyCheck.allowed ? (c.verifyCheck.code || 'forbidden') : c.selfVerify ? 'self_approval' : 'forbidden';
      need(c[k], code); return c;
    }
    // Field results are saved as a draft as often as needed; nothing is submitted until submitField.
    H['inspection.saveField'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'field');
      var keys = i.items.map(function (x) { return x.key; });
      Object.keys(p.results || {}).forEach(function (k) {
        need(keys.indexOf(k) >= 0, 'bad_item');
        var r = p.results[k]; need(RESULTS.indexOf(r.result) >= 0, 'bad_outcome');
        (r.evidence || []).forEach(function (eid) { var e = get('evidence', eid); need(e.linked && e.linked.kind === 'inspection' && e.linked.id === i.id, 'link_mismatch'); });
        i.results[k] = { result: r.result, reason: String(r.reason || '').trim(), note: String(r.note || '').trim(), measurement: r.measurement === '' || r.measurement == null ? null : String(r.measurement), evidence: (r.evidence || []).slice() };
      });
      if (i.status === 'scheduled') i.status = 'in_progress';
      bump(i, now);
      t.audit('inspection.saveField', { kind: 'inspection', id: i.id }, i.rev, '', { items: Object.keys(p.results || {}) });
      return { status: i.status, progress: ST.fieldProgress(i) };
    };
    H['inspection.submitField'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'field');
      var pr = ST.fieldProgress(i);
      need(pr.complete, 'items_incomplete', { gaps: pr.gaps });
      i.status = 'awaiting_review'; i.field = { by: actor, at: now, rev: i.rev }; i.performed = now.slice(0, 10);
      bump(i, now);
      t.notify(staffVerifiers(i.packageId), 'insp_review', recI(i), 'insp.' + i.id, { ref: i.ref });
      t.audit('inspection.submitField', { kind: 'inspection', id: i.id }, i.rev, '', { fails: pr.fails });
      t.activity('insp_field', recI(i), 'internal', { rev: String(i.rev) });
      return { status: i.status, fails: pr.fails };
    };
    // Technical verification by an authorised verifier (delegated authority by service). It is not release or acceptance.
    H['inspection.verify'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version);
      need(p.rev === i.rev, 'outdated_revision');
      var c = needControl(actor, i, 'verify');
      need(['accepted', 'accepted_observations', 'rejected'].indexOf(p.outcome) >= 0, 'bad_outcome');
      var reason = p.outcome === 'accepted' ? String(p.reason || '').trim() : text(p.reason, 5, 'reason_required');
      i.verification = { by: actor, at: now, authority: c.verifyCheck.authority || null, rev: i.rev, outcome: p.outcome, reason: reason };
      i.rgsSignoff = { by: actor, at: now.slice(0, 10), authority: c.verifyCheck.authority || null };
      i.result = { accepted: 'accepted', accepted_observations: 'observations', rejected: 'rejected' }[p.outcome];
      i.status = 'completed';
      bump(i, now);
      t.notify([i.createdBy, i.field && i.field.by], 'insp_verified', recI(i), 'insp.' + i.id, { ref: i.ref, outcome: p.outcome });
      t.audit('inspection.verify', { kind: 'inspection', id: i.id }, i.rev, reason, { outcome: p.outcome, authority: i.verification.authority });
      t.activity('insp_verified', recI(i), i.publishedAt ? 'customer' : 'internal', { rev: String(i.rev), outcome: p.outcome });
      return { status: i.status, authority: i.verification.authority };
    };
    H['inspection.returnField'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'returnField');
      var reason = text(p.reason, 5, 'reason_required');
      i.status = 'in_progress'; i.field = null; bump(i, now);
      t.notify(i.attendees.filter(function (u) { return !ST.isCustomer(u); }), 'insp_returned', recI(i), 'insp.' + i.id, { ref: i.ref });
      t.audit('inspection.returnField', { kind: 'inspection', id: i.id }, i.rev, reason);
      return { status: i.status };
    };
    // Customer witnessing records presence only. It is not acceptance and releases nothing.
    H['inspection.witness'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'witness');
      i.witnesses.push({ by: actor, at: now, rev: i.rev, note: String(p.note || '').trim() }); bump(i, now);
      t.audit('inspection.witness', { kind: 'inspection', id: i.id }, i.rev, String(p.note || ''));
      t.activity('insp_witnessed', recI(i), 'customer', { rev: String(i.rev) });
      return { witnesses: i.witnesses.length };
    };
    H['inspection.publish'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'publish');
      i.publishedAt = now; i.publishedBy = actor; bump(i, now); ST.reindex();
      t.notify(i.attendees.filter(function (u) { return ST.isCustomer(u); }), 'insp_published', recI(i), 'insp.' + i.id, { ref: i.ref });
      t.audit('inspection.publish', { kind: 'inspection', id: i.id }, i.rev);
      t.activity('insp_published', recI(i), 'customer', { rev: String(i.rev) });
      return { publishedAt: now };
    };
    // A change after verification is a controlled amendment: the verified record is kept and review starts again.
    H['inspection.amend'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'amend');
      var reason = text(p.reason, 5, 'reason_required');
      i.amendments.push({ rev: i.rev, at: now, by: actor, reason: reason, results: JSON.parse(JSON.stringify(i.results)), field: i.field, verification: i.verification, result: i.result });
      i.rev += 1; i.status = 'in_progress'; i.field = null; i.verification = null; i.rgsSignoff = null; i.result = null;
      bump(i, now);
      t.notify(i.attendees.filter(function (u) { return !ST.isCustomer(u); }), 'insp_amended', recI(i), 'insp.' + i.id, { ref: i.ref, rev: i.rev });
      t.audit('inspection.amend', { kind: 'inspection', id: i.id }, i.rev, reason);
      t.activity('insp_amended', recI(i), i.publishedAt ? 'customer' : 'internal', { rev: String(i.rev) });
      return { rev: i.rev };
    };
    H['inspection.cancel'] = function (actor, p, t, now) {
      var i = get('inspection', p.id); checkVersion(i, p.version); needControl(actor, i, 'cancel');
      var reason = text(p.reason, 5, 'reason_required');
      i.status = 'cancelled'; i.cancelReason = reason; bump(i, now);
      t.audit('inspection.cancel', { kind: 'inspection', id: i.id }, i.rev, reason);
      return { status: i.status };
    };
    // ===================== Stage 5: checklist templates =====================
    function canTemplates(actor) { return ds.projects.some(function (p) { return A.can(ds, actor, 'template.manage', { projectId: p.id }).allowed; }); }
    H['template.draft'] = function (actor, p, t, now) {
      need(canTemplates(actor), 'forbidden');
      var tp = get('template', p.id); checkVersion(tp, p.tversion == null ? tp.version : p.tversion);
      need(!tp.versions.some(function (v) { return v.status === 'draft'; }), 'draft_exists');
      var base = ST.activeVersion(tp);
      var nv = { version: Math.max.apply(null, tp.versions.map(function (v) { return v.version; })) + 1, status: 'draft', createdAt: now, createdBy: actor, activatedAt: null, note: text(p.note, 3, 'reason_required'), items: JSON.parse(JSON.stringify(base ? base.items : [])) };
      tp.versions.push(nv); bump(tp, now);
      t.audit('template.draft', { kind: 'template', id: tp.id }, nv.version, nv.note);
      return { version: nv.version };
    };
    H['template.saveItems'] = function (actor, p, t, now) {
      need(canTemplates(actor), 'forbidden');
      var tp = get('template', p.id); checkVersion(tp, p.tversion);
      var v = tp.versions.filter(function (x) { return x.status === 'draft'; })[0]; need(v, 'not_open');
      var keys = {};
      need((p.items || []).length, 'items_required');
      v.items = p.items.map(function (it, n) {
        var key = String(it.key || ('x' + (n + 1))).trim(); need(!keys[key], 'bad_item'); keys[key] = 1;
        return { key: key, text: text(it.text, 3, 'missing_title'), spec: String(it.spec || '').trim(), clause: String(it.clause || '').trim() || 'To be confirmed', evidence: String(it.evidence || '').trim(),
          unit: String(it.unit || '').trim() || null, criterion: String(it.criterion || '').trim() || 'Project-approved criterion to be entered from the referenced document', witness: String(it.witness || '').trim(), required: it.required !== false };
      });
      bump(tp, now);
      t.audit('template.saveItems', { kind: 'template', id: tp.id }, v.version, '', { items: v.items.length });
      return { items: v.items.length };
    };
    // Activating a version never touches inspections already created; they keep their own snapshot.
    H['template.activate'] = function (actor, p, t, now) {
      need(canTemplates(actor), 'forbidden');
      var tp = get('template', p.id); checkVersion(tp, p.tversion);
      var v = tp.versions.filter(function (x) { return x.status === 'draft'; })[0]; need(v, 'not_open');
      tp.versions.forEach(function (x) { if (x.status === 'active') x.status = 'superseded'; });
      v.status = 'active'; v.activatedAt = now; v.activatedBy = actor; bump(tp, now);
      t.audit('template.activate', { kind: 'template', id: tp.id }, v.version, v.note);
      return { version: v.version };
    };
    // ===================== Stage 5: findings =====================
    H['finding.raise'] = function (actor, p, t, now) {
      var w = get('package', p.packageId); allow(actor, 'finding.raise', pres(w.id));
      var a = get('areas', p.areaId); need(a.projectId === w.projectId, 'area_mismatch');
      var ins = null;
      if (p.inspectionId) { ins = get('inspection', p.inspectionId); need(ins.packageId === w.id && ST.canSee(actor, 'inspection', ins), 'link_mismatch'); if (p.itemKey) need(ins.items.some(function (x) { return x.key === p.itemKey; }), 'bad_item'); }
      need((FNPOL.classifications || []).indexOf(p.classification) >= 0, 'bad_type');
      need((FNPOL.severities || []).indexOf(p.severity) >= 0, 'bad_priority');
      var desc = text(p.description, 10, 'missing_description');
      need(p.ownerId && A.can(ds, p.ownerId, 'corrective.respond', pres(w.id)).allowed, 'owner_not_eligible');
      need(p.targetDate && p.targetDate >= ST.today, 'due_in_past');
      (p.evidence || []).forEach(function (eid) { var e = get('evidence', eid); need(ST.canSee(actor, 'evidence', e) && e.packageId === w.id, 'link_mismatch'); });
      var f = { id: uid('f'), ref: ref4('FN', w.projectId, 'findings'), projectId: w.projectId, packageId: w.id, areaId: a.id, inspectionId: ins ? ins.id : null, itemKey: p.itemKey || null,
        source: ins ? 'inspection' : 'observation', classification: p.classification, severity: p.severity, description: desc, evidence: (p.evidence || []).slice(), ownerId: p.ownerId, targetDate: p.targetDate,
        containment: String(p.containment || '').trim(), customerVisible: !!p.customerVisible, status: 'open', correctiveActionIds: [], raisedBy: actor, raisedAt: now, escalations: [], version: 1 };
      ds.findings.push(f); ST.reindex();
      t.notify([f.ownerId], 'finding_raised', recF(f), 'fnd.' + f.id, { ref: f.ref });
      t.audit('finding.raise', { kind: 'finding', id: f.id }, null, '', { classification: f.classification, severity: f.severity, customerVisible: f.customerVisible, inspection: f.inspectionId });
      t.activity('finding_raised', recF(f), f.customerVisible ? 'customer' : 'internal', {});
      return { id: f.id, ref: f.ref };
    };
    H['finding.setVisibility'] = function (actor, p, t, now) {
      var f = get('finding', p.id); checkVersion(f, p.version); allow(actor, 'finding.manage', pres(f.packageId));
      var reason = text(p.reason, 5, 'reason_required'); f.customerVisible = !!p.customerVisible; bump(f, now);
      t.audit('finding.setVisibility', { kind: 'finding', id: f.id }, null, reason, { customerVisible: f.customerVisible });
      return { customerVisible: f.customerVisible };
    };
    H['finding.escalate'] = function (actor, p, t, now) {
      var f = get('finding', p.id); allow(actor, 'finding.manage', pres(f.packageId));
      need(p.toId && p.toId !== actor && A.can(ds, p.toId, 'finding.manage', pres(f.packageId)).allowed, 'escalation_target_not_eligible');
      var reason = text(p.reason, 5, 'reason_required');
      f.escalations.push({ to: p.toId, by: actor, at: now, reason: reason }); bump(f, now);
      t.notify([p.toId], 'finding_escalated', recF(f), 'fnd.' + f.id, { ref: f.ref });
      t.audit('finding.escalate', { kind: 'finding', id: f.id }, null, reason, { to: p.toId });
      return { escalations: f.escalations.length };
    };
    H['finding.close'] = function (actor, p, t, now) {
      var f = get('finding', p.id); checkVersion(f, p.version); allow(actor, 'finding.manage', pres(f.packageId));
      var reason = text(p.reason, 5, 'reason_required');
      need(f.correctiveActionIds.every(function (id) { var c = ST.get('corrective', id); return !c || c.status === 'closed' || c.status === 'cancelled'; }), 'actions_open');
      f.status = 'closed'; f.closedAt = now; f.closedBy = actor; f.closeReason = reason; bump(f, now);
      t.audit('finding.close', { kind: 'finding', id: f.id }, null, reason);
      return { status: f.status };
    };
    // ===================== Stage 5: corrective actions =====================
    function caMove(c, to, actor, now, reason) { c.history.push({ at: now, by: actor, from: c.status, to: to, reason: reason || '' }); c.status = to; bump(c, now); }
    function caNeed(actor, c, k) {
      var x = ST.caControls(actor, c), code = 'forbidden';
      if (k === 'verify') code = c.status !== 'ready_for_verification' ? 'bad_state' : !x.verifyCheck.allowed ? (x.verifyCheck.code || 'forbidden') : x.selfVerify ? 'self_approval' : x.reinspectionPending ? 'reinspection_pending' : 'forbidden';
      need(x[k], code); return x;
    }
    function verifierOk(uid, pkgId) { var R = ds.assignments.filter(function (a) { return a.userId === uid; }).map(function (a) { return A.ROLES[a.role]; }); return R.some(function (r) { return r && (r.eligible.indexOf('corrective.close') >= 0); }) && A.can(ds, uid, 'corrective.view', pres(pkgId)).allowed; }
    H['corrective.create'] = function (actor, p, t, now) {
      var f = get('finding', p.findingId); allow(actor, 'corrective.manage', pres(f.packageId));
      need(f.status !== 'closed' && f.status !== 'cancelled', 'not_open');
      var owner = p.ownerId || f.ownerId; need(A.can(ds, owner, 'corrective.respond', pres(f.packageId)).allowed, 'owner_not_eligible');
      need(p.verifierId && p.verifierId !== owner && verifierOk(p.verifierId, f.packageId), 'verifier_not_eligible');
      need(p.due && p.due >= ST.today, 'due_in_past');
      var c = { id: uid('ca'), ref: ref4('CA', f.projectId, 'correctiveActions'), projectId: f.projectId, packageId: f.packageId, areaId: f.areaId, title: text(p.title || f.description, 5, 'missing_title'),
        sourceInspectionId: f.inspectionId, findingId: f.id, raisedBy: actor, raisedAt: now.slice(0, 10), ownerId: owner, verifierId: p.verifierId, due: p.due, status: 'open', closedAt: null, verifiedBy: null,
        containment: f.containment, cause: '', actionPlan: String(p.actionPlan || '').trim(), completion: null, reinspectionId: null, verification: null, decisions: [], history: [], version: 0 };
      ds.correctiveActions.push(c);
      caMove(c, 'open', actor, now, 'Raised from ' + f.ref);
      caMove(c, 'assigned', actor, now, 'Assigned to ' + (ST.user(owner) || {}).name);
      f.correctiveActionIds.push(c.id); f.status = 'action_raised'; bump(f, now); ST.reindex();
      t.notify([owner], 'ca_assigned', recC(c), 'ca.' + c.id, { ref: c.ref, date: c.due });
      t.audit('corrective.create', { kind: 'corrective', id: c.id }, null, '', { finding: f.id, owner: owner, verifier: c.verifierId });
      t.activity('ca_raised', recC(c), f.customerVisible ? 'customer' : 'internal', {});
      return { id: c.id, ref: c.ref };
    };
    H['corrective.assign'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'assign');
      need(A.can(ds, p.ownerId, 'corrective.respond', pres(c.packageId)).allowed, 'owner_not_eligible');
      if (p.verifierId) { need(p.verifierId !== p.ownerId && verifierOk(p.verifierId, c.packageId), 'verifier_not_eligible'); c.verifierId = p.verifierId; }
      need(c.verifierId !== p.ownerId, 'verifier_is_owner');
      if (p.due) { need(p.due >= ST.today, 'due_in_past'); c.due = p.due; }
      c.ownerId = p.ownerId; caMove(c, 'assigned', actor, now, String(p.reason || ''));
      t.notify([c.ownerId], 'ca_assigned', recC(c), 'ca.' + c.id, { ref: c.ref, date: c.due });
      t.audit('corrective.assign', { kind: 'corrective', id: c.id }, null, String(p.reason || ''), { owner: c.ownerId });
      return { status: c.status };
    };
    H['corrective.propose'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'propose');
      c.cause = text(p.cause, 5, 'reason_required'); c.actionPlan = text(p.actionPlan, 5, 'reason_required');
      if (p.containment != null) c.containment = String(p.containment).trim();
      caMove(c, 'action_proposed', actor, now, c.actionPlan);
      t.audit('corrective.propose', { kind: 'corrective', id: c.id }, null, c.actionPlan);
      return { status: c.status };
    };
    H['corrective.start'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'start');
      caMove(c, 'in_progress', actor, now, String(p.reason || ''));
      t.audit('corrective.start', { kind: 'corrective', id: c.id });
      t.activity('ca_updated', recC(c), 'customer', {});
      return { status: c.status };
    };
    H['corrective.complete'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'complete');
      var note = text(p.note, 5, 'reason_required');
      (p.evidence || []).forEach(function (eid) { var e = get('evidence', eid); need(e.packageId === c.packageId, 'link_mismatch'); });
      need((p.evidence || []).length, 'evidence_required');
      c.completion = { by: actor, at: now, note: note, evidence: p.evidence.slice() };
      caMove(c, 'ready_for_verification', actor, now, note);
      t.notify([c.verifierId], 'ca_ready', recC(c), 'ca.' + c.id, { ref: c.ref });
      t.audit('corrective.complete', { kind: 'corrective', id: c.id }, null, note, { evidence: p.evidence });
      t.activity('ca_updated', recC(c), 'customer', {});
      return { status: c.status };
    };
    // Reinspection: a NEW inspection linked to the original. The original inspection is never changed.
    H['corrective.reinspect'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'reinspect');
      var f = get('finding', c.findingId), orig = f.inspectionId ? get('inspection', f.inspectionId) : null;
      var res = H['inspection.schedule'](actor, { packageId: c.packageId, areaId: c.areaId, type: 'reinspection', title: 'Re-inspection for ' + c.ref + (orig ? ' (' + orig.ref + ')' : ''),
        scope: text(p.scope || c.title, 5, 'missing_scope'), planned: p.planned, inspectorId: p.inspectorId, attendees: p.attendees || [], docRefs: orig ? orig.docRefs : [], reinspectionOf: orig ? orig.id : null, correctiveActionId: c.id }, t, now);
      c.reinspectionId = res.id; bump(c, now);
      c.history.push({ at: now, by: actor, from: c.status, to: c.status, reason: 'Re-inspection ' + res.ref + ' scheduled' });
      t.audit('corrective.reinspect', { kind: 'corrective', id: c.id }, null, '', { reinspection: res.id });
      return { inspectionId: res.id, ref: res.ref };
    };
    H['corrective.verify'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version);
      var x = caNeed(actor, c, 'verify');
      need(p.outcome === 'confirm' || p.outcome === 'return', 'bad_outcome');
      var reason = p.outcome === 'confirm' ? String(p.reason || '').trim() : text(p.reason, 5, 'reason_required');
      var d = { by: actor, at: now, authority: x.verifyCheck.authority || null, outcome: p.outcome === 'confirm' ? 'confirmed' : 'returned', reason: reason };
      c.decisions.push(d);
      if (p.outcome === 'confirm') {
        c.verification = d; c.verifiedBy = actor; c.closedAt = now.slice(0, 10);
        caMove(c, 'closed', actor, now, reason || 'Verified');
        var f = ST.get('finding', c.findingId);
        if (f && f.correctiveActionIds.every(function (id) { var o = ST.get('corrective', id); return o.status === 'closed' || o.status === 'cancelled'; })) { f.status = 'closed'; f.closedAt = now; f.closedBy = actor; bump(f, now); }
        t.notify([c.ownerId, f && f.raisedBy], 'ca_closed', recC(c), 'ca.' + c.id, { ref: c.ref });
      } else {
        caMove(c, 'returned', actor, now, reason);
        t.notify([c.ownerId], 'ca_returned', recC(c), 'ca.' + c.id, { ref: c.ref });
      }
      t.audit('corrective.verify', { kind: 'corrective', id: c.id }, null, reason, { outcome: d.outcome, authority: d.authority });
      t.activity(p.outcome === 'confirm' ? 'ca_closed' : 'ca_updated', recC(c), 'customer', {});
      return { status: c.status, authority: d.authority };
    };
    H['corrective.cancel'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'cancel');
      caMove(c, 'cancelled', actor, now, text(p.reason, 5, 'reason_required'));
      t.audit('corrective.cancel', { kind: 'corrective', id: c.id }, null, p.reason);
      return { status: c.status };
    };
    // Reopening keeps every earlier decision; the previous verification is kept in decisions and history.
    H['corrective.reopen'] = function (actor, p, t, now) {
      var c = get('corrective', p.id); checkVersion(c, p.version); caNeed(actor, c, 'reopen');
      var reason = text(p.reason, 5, 'reason_required');
      c.verification = null; c.verifiedBy = null; c.closedAt = null;
      caMove(c, 'reopened', actor, now, reason);
      var f = ST.get('finding', c.findingId); if (f && f.status === 'closed') { f.status = 'action_raised'; bump(f, now); }
      t.notify([c.ownerId], 'ca_reopened', recC(c), 'ca.' + c.id, { ref: c.ref });
      t.audit('corrective.reopen', { kind: 'corrective', id: c.id }, null, reason);
      return { status: c.status };
    };
    // =====================================================================================
    // Stage 6: daily updates, milestones, progress settings, commitments, dependencies, reports, handover, release
    // =====================================================================================
    function pr6(w) { return { packageId: w.id || w }; }
    function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
    function rec6(kind, r) { return { kind: kind, rec: r, record: r }; }
    function today() { return ST.today; }

    // ---------- daily updates ----------
    function dupFields(actor, w, p, existing) {
      var a = get('areas', p.areaId || w.areaId); need(a.projectId === w.projectId, 'area_mismatch');
      var cfg = ST.progressConfig(w.id), seen = {};
      var qs = (p.quantities || []).filter(function (q) { return q && (q.lineId || q.qty !== '' && q.qty != null); }).map(function (q) {
        need(cfg && cfg.method === 'quantities', 'quantities_not_configured');
        var line = (cfg.lines || []).filter(function (l) { return l.id === q.lineId; })[0];
        need(line, 'bad_line', { lineId: q.lineId });
        need(!seen[q.lineId], 'duplicate_line', { lineId: q.lineId }); seen[q.lineId] = 1;
        var n = Number(q.qty); need(isFinite(n) && n > 0, 'bad_quantity', { lineId: q.lineId });
        need(String(q.unit || line.unit) === line.unit, 'unit_mismatch', { lineId: q.lineId, expected: line.unit, got: q.unit });
        return { lineId: line.id, qty: n, unit: line.unit };
      });
      var ms = (p.milestoneIds || []).map(function (id) {
        var m = get('milestone', id); need(m.packageId === w.id, 'link_mismatch'); need(!m.completedAt, 'milestone_complete'); return m.id;
      });
      (p.evidence || []).forEach(function (eid) { var e = get('evidence', eid); need(e.packageId === w.id, 'link_mismatch'); });
      need(!p.date || isDate(p.date), 'bad_date');
      var date = p.date || today(); need(date <= today(), 'date_in_future');
      return { areaId: a.id, date: date, workDone: String(p.workDone || '').trim(), quantities: qs, milestoneIds: ms, evidence: (p.evidence || []).slice(), blockers: String(p.blockers || '').trim(), next: String(p.next || '').trim() };
    }
    H['dailyupdate.save'] = function (actor, p, t, now) {
      var d;
      if (p.id) {
        d = get('dailyupdate', p.id); checkVersion(d, p.version);
        need(d.authorId === actor && (d.status === 'draft' || d.status === 'returned'), 'bad_state');
        var w0 = get('package', d.packageId); allow(actor, 'progress.report', pr6(w0));
        Object.assign(d, dupFields(actor, w0, Object.assign({ areaId: d.areaId }, p), d)); bump(d, now);
      } else {
        var w = get('package', p.packageId); allow(actor, 'progress.report', pr6(w));
        d = Object.assign({ id: uid('du'), ref: nextRef('DU', w.projectId, 'dailyUpdates').replace(/-(\d{3})$/, function (m, n) { return '-0' + n; }), projectId: w.projectId, packageId: w.id,
          authorId: actor, reviewerId: null, status: 'draft', submittedAt: null, review: null, publishedAt: null, publishedBy: null, history: [], createdAt: now, version: 1 }, dupFields(actor, w, p));
        ds.dailyUpdates.push(d);
      }
      t.audit('dailyupdate.save', { kind: 'dailyupdate', id: d.id }, null, '');
      return { id: d.id, ref: d.ref, version: d.version };
    };
    H['dailyupdate.submit'] = function (actor, p, t, now) {
      var d = get('dailyupdate', p.id); checkVersion(d, p.version);
      need(d.authorId === actor && (d.status === 'draft' || d.status === 'returned'), 'bad_state');
      allow(actor, 'progress.report', pr6(d.packageId));
      need(d.workDone.length >= 5, 'work_required');
      var rv = ST.dupReviewer(d.packageId, actor); need(rv, 'no_reviewer');
      d.reviewerId = rv; d.status = 'submitted'; d.submittedAt = now; d.history.push({ at: now, by: actor, to: 'submitted' });
      // a reported milestone completion is recorded as REPORTED only; verification is a separate step
      d.milestoneIds.forEach(function (id) { var m = ST.get('milestone', id); if (!m.reported) { m.reported = { by: actor, at: now, updateId: d.id }; bump(m, now); } });
      bump(d, now);
      t.notify([rv], 'dup_review', rec6('dailyupdate', d), 'dup.' + d.id, { ref: d.ref });
      t.audit('dailyupdate.submit', { kind: 'dailyupdate', id: d.id }, null, '', { reviewer: rv, quantities: d.quantities });
      return { id: d.id, reviewerId: rv };
    };
    H['dailyupdate.review'] = function (actor, p, t, now) {
      var d = get('dailyupdate', p.id); checkVersion(d, p.version);
      need(d.status === 'submitted', 'bad_state');
      need(d.authorId !== actor, 'self_approval');
      need(d.reviewerId === actor, 'not_reviewer');
      allow(actor, 'progress.review', pr6(d.packageId));
      need(p.outcome === 'approved' || p.outcome === 'returned', 'bad_outcome');
      var reason = String(p.reason || '').trim();
      if (p.outcome === 'returned') {
        need(reason.length >= 5, 'reason_required');
        d.milestoneIds.forEach(function (id) { var m = ST.get('milestone', id); if (m.reported && m.reported.updateId === d.id && !m.completedAt) { m.reported = null; bump(m, now); } });
      } else {
        // no double counting: the reviewed total for a line can never pass its approved planned quantity
        var pp = ST.packageProgress(d.packageId);
        d.quantities.forEach(function (q) {
          var row = pp.calc && pp.calc.rows ? pp.calc.rows.filter(function (r) { return r.id === q.lineId; })[0] : null;
          need(row, 'bad_line', { lineId: q.lineId });
          need(row.done + q.qty <= row.planned, 'exceeds_planned', { lineId: q.lineId, planned: row.planned, done: row.done, qty: q.qty });
        });
      }
      d.review = { by: actor, at: now, outcome: p.outcome, reason: reason };
      d.status = p.outcome === 'approved' ? 'approved' : 'returned';
      d.history.push({ at: now, by: actor, to: d.status, reason: reason }); bump(d, now);
      t.notify([d.authorId], p.outcome === 'approved' ? 'dup_approved' : 'dup_returned', rec6('dailyupdate', d), 'dup.' + d.id, { ref: d.ref });
      t.audit('dailyupdate.review', { kind: 'dailyupdate', id: d.id }, null, reason, { outcome: p.outcome });
      return { status: d.status };
    };
    H['dailyupdate.publish'] = function (actor, p, t, now) {
      var d = get('dailyupdate', p.id); checkVersion(d, p.version);
      need(d.status === 'approved', 'bad_state');
      allow(actor, 'progress.publish', pr6(d.packageId));
      d.status = 'published'; d.publishedAt = now; d.publishedBy = actor; d.history.push({ at: now, by: actor, to: 'published' }); bump(d, now);
      t.audit('dailyupdate.publish', { kind: 'dailyupdate', id: d.id }, null, '');
      t.activity('dup_published', rec6('dailyupdate', d), 'customer', {});
      return { status: d.status };
    };

    // ---------- milestones and progress settings ----------
    H['milestone.verify'] = function (actor, p, t, now) {
      var m = get('milestone', p.id); checkVersion(m, p.version);
      need(m.reported && !m.completedAt, 'bad_state');
      need(m.reported.by !== actor, 'self_approval');
      allow(actor, 'progress.verify', pr6(m.packageId));
      var up = m.reported.updateId ? ST.get('dailyupdate', m.reported.updateId) : null;
      var ev = (m.evidence || []).concat(up ? up.evidence : []).filter(function (x, i, a) { return a.indexOf(x) === i; });
      need(ev.length > 0, 'evidence_required');
      need(!p.date || (isDate(p.date) && p.date <= today()), 'bad_date');
      m.evidence = ev; m.completedAt = p.date || today(); m.verifiedBy = actor; m.verifiedAt = now; bump(m, now);
      t.audit('milestone.verify', { kind: 'milestone', id: m.id }, null, String(p.note || ''), { reportedBy: m.reported.by, evidence: ev });
      t.activity('ms_verified', { kind: 'milestone', rec: m, record: Object.assign({ projectId: ST.projectOf(m) }, m) }, 'customer', {});
      return { completedAt: m.completedAt };
    };
    H['milestone.forecast'] = function (actor, p, t, now) {
      var m = get('milestone', p.id); checkVersion(m, p.version);
      need(!m.completedAt, 'bad_state');
      need(A.can(ds, actor, 'progress.review', pr6(m.packageId)).allowed || A.can(ds, actor, 'progress.baseline', pr6(m.packageId)).allowed, 'forbidden');
      need(isDate(p.forecast), 'bad_date'); need(p.forecast !== m.forecast, 'no_change');
      var reason = text(p.reason, 5, 'reason_required');
      m.forecastHistory = (m.forecastHistory || []).concat([{ at: now, by: actor, from: m.forecast, to: p.forecast, reason: reason }]);
      m.forecast = p.forecast; bump(m, now);
      t.audit('milestone.forecast', { kind: 'milestone', id: m.id }, null, reason, { to: p.forecast });
      return { forecast: m.forecast };
    };
    H['milestone.rebaseline'] = function (actor, p, t, now) {
      var m = get('milestone', p.id); checkVersion(m, p.version);
      allow(actor, 'progress.baseline', pr6(m.packageId));
      need(isDate(p.planned), 'bad_date'); need(p.planned !== m.planned, 'no_change');
      var reason = text(p.reason, 5, 'reason_required');
      m.baselineHistory = (m.baselineHistory || []).concat([{ at: now, by: actor, from: m.planned, to: p.planned, reason: reason }]);
      m.planned = p.planned; bump(m, now);
      t.audit('milestone.rebaseline', { kind: 'milestone', id: m.id }, null, reason, { from: m.baselineHistory.slice(-1)[0].from, to: p.planned });
      return { planned: m.planned };
    };
    function cfgFor(actor, wpId, cversion) {
      var cfg = ST.progressConfig(wpId); need(cfg, 'progress_not_configured');
      allow(actor, 'progress.baseline', pr6(wpId));
      checkVersion(cfg, cversion);
      return cfg;
    }
    // Approved weights change only with a reason, and must still total exactly 100.
    H['progress.setWeights'] = function (actor, p, t, now) {
      var cfg = cfgFor(actor, p.packageId, p.cversion); need(cfg.method === 'weighted_milestones', 'bad_method');
      var reason = text(p.reason, 5, 'reason_required');
      var ms = ST.pkgMilestones(p.packageId), total = 0, before = {};
      ms.forEach(function (m) { var w = Number((p.weights || {})[m.id]); need(isFinite(w) && w >= 0, 'bad_weight', { id: m.id }); total += w; before[m.id] = m.weight; });
      var want = (POLICY.progress || {}).weightTotal || 100;
      need(Math.abs(total - want) < 1e-9, 'weights_total', { total: total, required: want });
      need(ms.some(function (m) { return Number(p.weights[m.id]) !== m.weight; }), 'no_change');
      ms.forEach(function (m) { m.weight = Number(p.weights[m.id]); bump(m, now); });
      cfg.history.push({ at: now, by: actor, change: 'weights', from: before, to: Object.assign({}, p.weights), reason: reason }); bump(cfg, now);
      t.audit('progress.setWeights', { kind: 'progressconfig', id: cfg.id }, null, reason, { from: before, to: p.weights });
      return { version: cfg.version };
    };
    H['progress.setPlanned'] = function (actor, p, t, now) {
      var cfg = cfgFor(actor, p.packageId, p.cversion); need(cfg.method === 'quantities', 'bad_method');
      var reason = text(p.reason, 5, 'reason_required');
      var line = cfg.lines.filter(function (l) { return l.id === p.lineId; })[0]; need(line, 'bad_line');
      var n = Number(p.planned); need(isFinite(n) && n > 0, 'bad_quantity'); need(n !== line.planned, 'no_change');
      var row = ST.packageProgress(p.packageId).calc.rows.filter(function (r) { return r.id === line.id; })[0];
      need(n >= row.done, 'below_completed', { done: row.done });
      cfg.history.push({ at: now, by: actor, change: 'planned', lineId: line.id, from: line.planned, to: n, reason: reason });
      line.planned = n; bump(cfg, now);
      t.audit('progress.setPlanned', { kind: 'progressconfig', id: cfg.id }, null, reason, { lineId: line.id, to: n });
      return { version: cfg.version };
    };
    H['progress.addLine'] = function (actor, p, t, now) {
      var cfg = cfgFor(actor, p.packageId, p.cversion); need(cfg.method === 'quantities', 'bad_method');
      var reason = text(p.reason, 5, 'reason_required');
      var n = Number(p.planned); need(isFinite(n) && n > 0, 'bad_quantity');
      // quantities in different units are never combined into one percentage
      need(String(p.unit || '') === cfg.unit, 'mixed_units', { expected: cfg.unit, got: p.unit });
      var line = { id: uid('q'), description: text(p.description, 3, 'text_required'), descriptionAr: '', planned: n, unit: cfg.unit };
      cfg.lines.push(line);
      cfg.history.push({ at: now, by: actor, change: 'line_added', lineId: line.id, from: null, to: n, reason: reason }); bump(cfg, now);
      t.audit('progress.addLine', { kind: 'progressconfig', id: cfg.id }, null, reason, { line: line });
      return { id: line.id, version: cfg.version };
    };

    // ---------- commitments ----------
    function cmRes(c) { return c.packageId ? pr6(c.packageId) : { projectId: c.projectId }; }
    H['commitment.create'] = function (actor, p, t, now) {
      var src = p.source || null, srec = null, pid = p.projectId, pkg = p.packageId || null;
      if (src) {
        srec = get(src.kind, src.id); need(ST.canSee(actor, src.kind, srec), 'link_mismatch');
        pid = ST.projectOf(srec) || srec.projectId; pkg = srec.packageId || (srec.packageIds && srec.packageIds[0]) || pkg;
        var dup = ST.commitmentForSource(src);
        need(!dup, 'duplicate_commitment', { id: dup && dup.id, ref: dup && dup.ref });
      }
      need(pid, 'missing_project');
      allow(actor, 'commitment.manage', pkg ? pr6(pkg) : { projectId: pid });
      var txt = text(p.text, 5, 'text_required');
      need(isDate(p.promised), 'due_required');
      need(p.party === 'rgs' || p.party === 'customer', 'bad_party');
      var owner = ST.user(p.ownerId); need(owner && A.can(ds, owner.id, 'commitment.view', pkg ? pr6(pkg) : { projectId: pid }).allowed, 'owner_not_eligible');
      need((p.party === 'customer') === ST.isCustomer(owner.id), 'owner_party_mismatch');
      // a commitment taken from an internal record stays internal
      var internal = p.visibility === 'internal' || (srec && ['finding', 'corrective', 'inspection', 'dailyupdate', 'dependency'].indexOf(src.kind) >= 0 && !ST.canSee(ST.ds.users.filter(function (u) { return ST.isCustomer(u.id) && A.can(ds, u.id, 'commitment.view', { projectId: pid }).allowed; }).map(function (u) { return u.id; })[0] || '-', src.kind, srec));
      var c = { id: uid('c'), ref: nextRef('C', pid, 'commitments'), projectId: pid, packageId: pkg, party: p.party, ownerId: owner.id, text: txt, textAr: '', promised: p.promised, revised: null,
        forecast: p.promised, doneAt: null, riskReason: null, source: src ? { kind: src.kind, id: src.id, rev: src.rev || null } : null, blocker: String(p.blocker || '').trim(), next: String(p.next || '').trim(),
        history: [], visibility: internal ? 'internal' : 'customer', createdBy: actor, createdAt: now, version: 1 };
      ds.commitments.push(c);
      t.audit('commitment.create', { kind: 'commitment', id: c.id }, null, '', { source: c.source });
      t.activity('cm_created', rec6('commitment', c), c.visibility === 'internal' ? 'internal' : 'customer', {});
      if (owner.id !== actor) t.notify([owner.id], 'cm_assigned', rec6('commitment', c), 'cm.' + c.id, { ref: c.ref, date: c.promised });
      return { id: c.id, ref: c.ref };
    };
    // Rescheduling never touches the original promised date; it changes the current date and records why and who.
    H['commitment.reschedule'] = function (actor, p, t, now) {
      var c = get('commitment', p.id); checkVersion(c, p.version);
      need(!c.doneAt, 'bad_state'); allow(actor, 'commitment.manage', cmRes(c));
      need(isDate(p.to), 'due_required');
      var from = ST.dueOf(c); need(p.to !== from, 'no_change');
      var reason = text(p.reason, 5, 'reason_required');
      c.history.push({ type: 'reschedule', at: now, by: actor, from: from, to: p.to, reason: reason });
      c.revised = p.to; if (!c.forecast || c.forecast < p.to || c.forecast === from) c.forecast = p.to; bump(c, now);
      t.audit('commitment.reschedule', { kind: 'commitment', id: c.id }, null, reason, { original: c.promised, from: from, to: p.to });
      t.activity('cm_rescheduled', rec6('commitment', c), c.visibility === 'internal' ? 'internal' : 'customer', { date: p.to });
      return { promised: c.promised, current: c.revised };
    };
    H['commitment.update'] = function (actor, p, t, now) {
      var c = get('commitment', p.id); checkVersion(c, p.version);
      need(!c.doneAt, 'bad_state');
      need(A.can(ds, actor, 'commitment.manage', cmRes(c)).allowed || (c.ownerId === actor && !ST.isCustomer(actor)), 'forbidden');
      var changes = {};
      if (p.forecast != null && p.forecast !== c.forecast) { need(isDate(p.forecast), 'bad_date'); changes.forecast = [c.forecast, p.forecast]; c.forecast = p.forecast; }
      if (p.blocker != null && String(p.blocker).trim() !== c.blocker) { changes.blocker = [c.blocker, String(p.blocker).trim()]; c.blocker = String(p.blocker).trim(); }
      if (p.next != null && String(p.next).trim() !== c.next) { changes.next = [c.next, String(p.next).trim()]; c.next = String(p.next).trim(); }
      need(Object.keys(changes).length, 'no_change');
      c.history.push({ type: 'update', at: now, by: actor, changes: changes, reason: String(p.reason || '').trim() }); bump(c, now);
      t.audit('commitment.update', { kind: 'commitment', id: c.id }, null, String(p.reason || ''), changes);
      return { version: c.version };
    };
    H['commitment.complete'] = function (actor, p, t, now) {
      var c = get('commitment', p.id); checkVersion(c, p.version);
      need(!c.doneAt, 'bad_state');
      need(A.can(ds, actor, 'commitment.manage', cmRes(c)).allowed || (c.ownerId === actor && !ST.isCustomer(actor)), 'forbidden');
      c.doneAt = today(); c.history.push({ type: 'complete', at: now, by: actor, reason: String(p.note || '').trim() }); bump(c, now);
      t.audit('commitment.complete', { kind: 'commitment', id: c.id }, null, String(p.note || ''));
      return { doneAt: c.doneAt };
    };


    // ---------- administration and support ----------
    var SUPPORT_CATS = ['access', 'data', 'report', 'other'];
    H['admin.user.setStatus'] = function (actor, p, t, now) {
      allow(actor, 'admin.users', null);
      var u = ST.user(p.id); need(u, 'not_found', { kind: 'user', id: p.id });
      need(p.id !== actor, 'self_action');
      need(p.status === 'active' || p.status === 'suspended', 'bad_status');
      need(u.status !== p.status, 'bad_state');
      var reason = String(p.reason || '').trim();
      if (p.status === 'suspended') need(reason.length >= 5, 'reason_required');
      var from = u.status; u.status = p.status; u.statusReason = reason || null; u.statusAt = now; u.statusBy = actor;
      t.audit('admin.user.status', { kind: 'user', id: u.id }, null, reason, { from: from, to: p.status });
      return { status: u.status };
    };
    H['admin.user.invite'] = function (actor, p, t, now) {
      allow(actor, 'admin.users', null);
      var name = String(p.name || '').trim(), email = String(p.email || '').trim().toLowerCase();
      need(name.length >= 2, 'name_required');
      need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'email_invalid');
      need(!ds.users.some(function (x) { return String(x.email).toLowerCase() === email; }), 'email_taken');
      var org = ds.orgs.filter(function (o) { return o.id === p.orgId; })[0]; need(org, 'org_required');
      var def = A.ROLES[p.role]; need(def, 'role_required');
      need((def.side === 'rgs') === (org.kind === 'rgs'), 'role_org_mismatch');
      var scope = { projectId: '*' };
      if (def.scopeLevel !== 'global') {
        var pr = ds.projects.filter(function (x) { return x.id === p.projectId; })[0]; need(pr, 'project_required');
        if (org.kind === 'customer') need(pr.customerOrgId === org.id, 'project_org_mismatch');
        scope = { projectId: pr.id };
      } else if (def.side === 'rgs' && p.role !== 'portal_admin' && p.role !== 'general_manager') { scope = { projectId: '*' }; }
      var u = { id: uid('u'), orgId: org.id, role: p.role, name: name, email: email, status: 'invited', invitedAt: now, invitedBy: actor };
      ds.users.push(u);
      ds.assignments.push({ id: uid('ra'), userId: u.id, role: p.role, scope: scope });
      t.audit('admin.user.invite', { kind: 'user', id: u.id }, null, '', { role: p.role, org: org.id, scope: scope });
      return { id: u.id };
    };
    H['admin.authority.revoke'] = function (actor, p, t, now) {
      allow(actor, 'admin.authority.grant', null);
      var d = ds.authorities.filter(function (x) { return x.id === p.id; })[0]; need(d, 'not_found', { kind: 'authority', id: p.id });
      need(d.status === 'active' && !d.revokedAt, 'bad_state');
      var reason = String(p.reason || '').trim(); need(reason.length >= 5, 'reason_required');
      d.status = 'revoked'; d.revokedAt = now; d.revokedBy = actor; d.revokeReason = reason;
      t.audit('admin.authority.revoke', { kind: 'authority', id: d.id }, null, reason, { userId: d.userId, action: d.action });
      return { id: d.id };
    };
    H['support.request'] = function (actor, p, t, now) {
      allow(actor, 'support.use', null);
      var subject = String(p.subject || '').trim(), msg = String(p.message || '').trim();
      need(subject.length >= 3, 'subject_required'); need(msg.length >= 10, 'message_required');
      need(SUPPORT_CATS.indexOf(p.category) >= 0, 'category_required');
      var mine = ds.supportTickets.filter(function (x) { return x.userId === actor; }).length;
      var tk = { id: uid('sup'), ref: 'SUP-' + String(ds.supportTickets.length + 1).padStart(4, '0'), userId: actor, category: p.category, subject: subject, message: msg, status: 'open', createdAt: now, version: 1 };
      ds.supportTickets.push(tk);
      t.audit('support.request', { kind: 'support', id: tk.id }, null, '', { category: p.category, ref: tk.ref, mine: mine + 1 });
      return { id: tk.id, ref: tk.ref };
    };

    // ---------- dependencies ----------
    function depNodeIn(ref, pid) { var n = ST.depNode(ref); need(n, 'not_found', ref); var w = ST.get('package', n.packageId); need(w && w.projectId === pid, 'link_mismatch'); return n; }
    H['dependency.create'] = function (actor, p, t, now) {
      allow(actor, 'dependency.manage', { projectId: p.projectId });
      depNodeIn(p.predecessor, p.projectId); depNodeIn(p.dependent, p.projectId);
      var prob = ST.dependencyProblem(p.predecessor, p.dependent, null); need(!prob, prob);
      need(!ds.dependencies.some(function (d) { return d.status !== 'cancelled' && d.predecessor.kind === p.predecessor.kind && d.predecessor.id === p.predecessor.id && d.dependent.kind === p.dependent.kind && d.dependent.id === p.dependent.id; }), 'duplicate_dependency');
      var owner = ST.user(p.ownerId); need(owner && !ST.isCustomer(owner.id) && A.can(ds, owner.id, 'project.view', { projectId: p.projectId }).allowed, 'owner_not_eligible');
      need(isDate(p.resolutionTarget), 'due_required');
      var d = { id: uid('dep'), ref: nextRef('DEP', p.projectId, 'dependencies'), projectId: p.projectId, predecessor: { kind: p.predecessor.kind, id: p.predecessor.id }, dependent: { kind: p.dependent.kind, id: p.dependent.id },
        blocker: text(p.blocker, 5, 'text_required'), ownerId: owner.id, resolutionTarget: p.resolutionTarget, status: 'open', resolvedAt: null, resolvedBy: null, history: [], createdBy: actor, createdAt: now, version: 1 };
      ds.dependencies.push(d);
      t.audit('dependency.create', { kind: 'dependency', id: d.id }, null, '', { predecessor: d.predecessor, dependent: d.dependent });
      if (owner.id !== actor) t.notify([owner.id], 'dep_assigned', rec6('dependency', d), 'deps', { ref: d.ref });
      return { id: d.id, ref: d.ref };
    };
    H['dependency.update'] = function (actor, p, t, now) {
      var d = get('dependency', p.id); checkVersion(d, p.version); need(d.status === 'open', 'bad_state');
      allow(actor, 'dependency.manage', { projectId: d.projectId });
      var reason = text(p.reason, 5, 'reason_required'), ch = {};
      if (p.resolutionTarget && p.resolutionTarget !== d.resolutionTarget) { need(isDate(p.resolutionTarget), 'due_required'); ch.resolutionTarget = [d.resolutionTarget, p.resolutionTarget]; d.resolutionTarget = p.resolutionTarget; }
      if (p.blocker && p.blocker.trim() !== d.blocker) { ch.blocker = [d.blocker, p.blocker.trim()]; d.blocker = p.blocker.trim(); }
      if (p.ownerId && p.ownerId !== d.ownerId) { need(ST.user(p.ownerId) && !ST.isCustomer(p.ownerId), 'owner_not_eligible'); ch.ownerId = [d.ownerId, p.ownerId]; d.ownerId = p.ownerId; }
      need(Object.keys(ch).length, 'no_change');
      d.history.push({ at: now, by: actor, changes: ch, reason: reason }); bump(d, now);
      t.audit('dependency.update', { kind: 'dependency', id: d.id }, null, reason, ch);
      return { version: d.version };
    };
    H['dependency.resolve'] = function (actor, p, t, now) {
      var d = get('dependency', p.id); checkVersion(d, p.version); need(d.status === 'open', 'bad_state');
      allow(actor, 'dependency.manage', { projectId: d.projectId });
      var reason = text(p.reason, 5, 'reason_required');
      d.status = 'resolved'; d.resolvedAt = now; d.resolvedBy = actor; d.history.push({ at: now, by: actor, changes: { status: ['open', 'resolved'] }, reason: reason }); bump(d, now);
      t.audit('dependency.resolve', { kind: 'dependency', id: d.id }, null, reason);
      return { status: d.status };
    };

    // ---------- reports ----------
    var REPORT_TYPES = (POLICY.reports || {}).types || ['progress', 'commitments', 'quality', 'handover'];
    function reportAudienceOk(pid, list) {
      var p = proj(pid);
      need((list || []).length > 0, 'audience_required');
      list.forEach(function (u) { var x = ST.user(u); need(x && x.orgId === p.customerOrgId && A.can(ds, u, 'report.view', { projectId: pid }).allowed, 'audience_not_eligible', { user: u }); });
    }
    function regen(r, now) { r.draft = { generatedAt: now, snapshot: ST.reportData(r.type, r.projectId, { audience: r.audience, from: r.period.from, to: r.period.to, cutoff: r.cutoff, now: now }) }; }
    H['report.create'] = function (actor, p, t, now) {
      proj(p.projectId); allow(actor, 'report.prepare', { projectId: p.projectId });
      need(REPORT_TYPES.indexOf(p.type) >= 0, 'bad_type');
      need(isDate(p.from) && isDate(p.to) && p.from <= p.to, 'bad_period');
      need(isDate(p.cutoff) && p.cutoff <= today() && p.cutoff >= p.from, 'bad_cutoff');
      need(p.reviewerId && p.reviewerId !== actor, 'reviewer_is_author');
      need(A.can(ds, p.reviewerId, 'report.review', { projectId: p.projectId }).allowed, 'reviewer_not_eligible');
      reportAudienceOk(p.projectId, p.audience);
      var r = { id: uid('rpt'), ref: nextRef('PR', p.projectId, 'reports'), projectId: p.projectId, type: p.type, title: String(p.title || '').trim(), period: { from: p.from, to: p.to }, cutoff: p.cutoff,
        authorId: actor, reviewerId: p.reviewerId, audience: p.audience.slice(), status: 'draft', versions: [], draft: null, review: null, history: [], createdAt: now, version: 1 };
      regen(r, now);
      ds.reports.push(r);
      t.audit('report.create', { kind: 'report', id: r.id }, null, '', { type: r.type, audience: r.audience, cutoff: r.cutoff });
      return { id: r.id, ref: r.ref };
    };
    H['report.regenerate'] = function (actor, p, t, now) {
      var r = get('report', p.id); checkVersion(r, p.version); need(r.status === 'draft' && r.authorId === actor, 'bad_state');
      allow(actor, 'report.prepare', { projectId: r.projectId });
      regen(r, now); bump(r, now);
      t.audit('report.regenerate', { kind: 'report', id: r.id }, null, '');
      return { version: r.version };
    };
    H['report.submit'] = function (actor, p, t, now) {
      var r = get('report', p.id); checkVersion(r, p.version); need(r.status === 'draft' && r.authorId === actor, 'bad_state');
      allow(actor, 'report.prepare', { projectId: r.projectId });
      r.status = 'in_review'; r.history.push({ at: now, by: actor, to: 'in_review' }); bump(r, now);
      t.notify([r.reviewerId], 'rpt_review', rec6('report', r), 'rpt.' + r.id, { ref: r.ref });
      t.audit('report.submit', { kind: 'report', id: r.id }, null, '');
      return { status: r.status };
    };
    H['report.review'] = function (actor, p, t, now) {
      var r = get('report', p.id); checkVersion(r, p.version); need(r.status === 'in_review', 'bad_state');
      need(r.authorId !== actor, 'self_approval'); need(r.reviewerId === actor, 'not_reviewer');
      allow(actor, 'report.review', { projectId: r.projectId });
      need(p.outcome === 'approve' || p.outcome === 'return', 'bad_outcome');
      var reason = String(p.reason || '').trim(); if (p.outcome === 'return') need(reason.length >= 5, 'reason_required');
      r.review = { by: actor, at: now, outcome: p.outcome, reason: reason };
      r.status = p.outcome === 'approve' ? 'approved' : 'draft'; r.history.push({ at: now, by: actor, to: r.status, reason: reason }); bump(r, now);
      t.notify([r.authorId], 'rpt_reviewed', rec6('report', r), 'rpt.' + r.id, { ref: r.ref });
      t.audit('report.review', { kind: 'report', id: r.id }, null, reason, { outcome: p.outcome });
      return { status: r.status };
    };
    // Issuing freezes the reviewed snapshot as a numbered version. Later record changes never touch it.
    H['report.issue'] = function (actor, p, t, now) {
      var r = get('report', p.id); checkVersion(r, p.version); need(r.status === 'approved' && r.draft, 'bad_state');
      allow(actor, 'report.issue', { projectId: r.projectId });
      var n = r.versions.length + 1;
      r.versions.push({ version: n, snapshot: JSON.parse(JSON.stringify(r.draft.snapshot)), generatedAt: r.draft.generatedAt, issuedAt: now, issuedBy: actor, authorId: r.authorId, reviewedBy: r.review.by, amendReason: r.amendReason || null });
      r.draft = null; r.status = 'issued'; r.amendReason = null; r.history.push({ at: now, by: actor, to: 'issued', version: n }); bump(r, now);
      t.notify(r.audience, 'rpt_issued', rec6('report', r), 'rpt.' + r.id + '.' + n, { ref: r.ref, v: n });
      t.audit('report.issue', { kind: 'report', id: r.id }, n, '', { audience: r.audience });
      t.activity('rpt_issued', rec6('report', r), 'customer', { rev: String(n) });
      return { version: n };
    };
    H['report.amend'] = function (actor, p, t, now) {
      var r = get('report', p.id); checkVersion(r, p.version); need(r.status === 'issued', 'bad_state');
      allow(actor, 'report.prepare', { projectId: r.projectId });
      var reason = text(p.reason, 5, 'reason_required');
      r.amendReason = reason; r.authorId = actor; if (r.reviewerId === actor) r.reviewerId = r.versions.slice(-1)[0].authorId !== actor ? r.versions.slice(-1)[0].authorId : r.reviewerId;
      regen(r, now); r.status = 'draft'; r.review = null; r.history.push({ at: now, by: actor, to: 'draft', reason: reason }); bump(r, now);
      t.audit('report.amend', { kind: 'report', id: r.id }, null, reason);
      return { status: r.status };
    };
    // Exports read only an issued, frozen version (customers) or the version the user may see; every export is audited.
    H['report.export'] = function (actor, p, t, now) {
      var r = get('report', p.id); need(ST.canSee(actor, 'report', r), 'forbidden');
      allow(actor, 'report.export', { projectId: r.projectId });
      need(p.format === 'csv' || p.format === 'print', 'bad_format');
      var v = r.versions.filter(function (x) { return x.version === +p.v; })[0];
      if (!v) { need(!ST.isCustomer(actor) && r.draft && p.v === 'draft', 'not_found'); }
      t.audit('report.export', { kind: 'report', id: r.id }, v ? v.version : 'draft', '', { format: p.format });
      return { snapshot: v ? v.snapshot : r.draft.snapshot, version: v ? v.version : 'draft' };
    };

    // ---------- handover packages ----------
    function manifestItems(w, items) {
      need((items || []).length > 0, 'manifest_empty');
      var seen = {};
      return items.map(function (it) {
        var key = it.kind + ':' + it.id; need(!seen[key], 'duplicate_item'); seen[key] = 1;
        var r = get(it.kind, it.id);
        if (it.kind === 'document') { need((r.packageIds || []).indexOf(w.id) >= 0 || r.projectId === w.projectId && !(r.packageIds || []).length, 'link_mismatch'); var rv = ST.revOf(r, it.rev); need(rv, 'bad_revision'); return { kind: 'document', id: r.id, rev: rv.rev }; }
        if (it.kind === 'inspection') { need(r.packageId === w.id, 'link_mismatch'); return { kind: 'inspection', id: r.id, rev: it.rev != null ? +it.rev : r.rev }; }
        if (it.kind === 'evidence') { need(r.packageId === w.id, 'link_mismatch'); return { kind: 'evidence', id: r.id, version: it.version || r.version || 1 }; }
        fail('bad_item');
      });
    }
    H['handover.create'] = function (actor, p, t, now) {
      var w = get('package', p.packageId); allow(actor, 'handover.prepare', pr6(w));
      var vs = ST.hpVersions(w.id);
      need(!vs.some(function (h) { return h.status === 'draft' || h.status === 'in_review' || h.status === 'reviewed'; }), 'draft_exists');
      var pv = (vs.length ? Math.max.apply(null, vs.map(function (x) { return x.pkgVersion || 1; })) : 0) + 1;
      // pkgVersion is the handover package version people see; version is the record's concurrency counter
      var h = { id: uid('hp'), ref: vs.length ? vs[0].ref : nextRef('HP', w.projectId, 'handoverPackages'), projectId: w.projectId, packageId: w.id, pkgVersion: pv, status: 'draft',
        title: text(p.title, 5, 'missing_title'), manifest: manifestItems(w, p.manifest), preparedBy: actor, createdAt: now, review: null, issuedAt: null, issuedBy: null, recipients: [], acknowledgements: [], acceptance: null,
        amendReason: p.amendReason || null, supersedes: vs.length ? vs[vs.length - 1].id : null, supersededBy: null, history: [{ at: now, by: actor, to: 'draft' }], version: 1 };
      ds.handoverPackages.push(h);
      t.audit('handover.create', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, p.amendReason || '', { manifest: h.manifest });
      return { id: h.id, ref: h.ref, pkgVersion: h.pkgVersion };
    };
    H['handover.saveManifest'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'draft', 'package_frozen');
      var w = get('package', h.packageId); allow(actor, 'handover.prepare', pr6(w));
      h.manifest = manifestItems(w, p.manifest); if (p.title) h.title = text(p.title, 5, 'missing_title'); bump(h, now);
      t.audit('handover.saveManifest', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, '', { manifest: h.manifest });
      return { version: h.version };
    };
    H['handover.submit'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'draft', 'bad_state');
      allow(actor, 'handover.prepare', pr6(h.packageId));
      h.status = 'in_review'; h.history.push({ at: now, by: actor, to: 'in_review' }); bump(h, now);
      t.audit('handover.submit', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, '');
      return { status: h.status };
    };
    // Internal readiness review: its own record, by someone other than the preparer.
    H['handover.review'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'in_review', 'bad_state');
      need(h.preparedBy !== actor, 'self_approval');
      allow(actor, 'handover.review', pr6(h.packageId));
      need(p.outcome === 'ready' || p.outcome === 'return', 'bad_outcome');
      var reason = String(p.reason || '').trim(); need(reason.length >= 5, 'reason_required');
      var r = ST.readiness(null, h.packageId);
      h.review = { by: actor, at: now, outcome: p.outcome, reason: reason, pkgVersion: h.pkgVersion, readiness: { state: r.state, pct: r.pct, blockers: r.blockers.map(function (b) { return b.type; }) } };
      h.status = p.outcome === 'ready' ? 'reviewed' : 'draft'; h.history.push({ at: now, by: actor, to: h.status, reason: reason }); bump(h, now);
      t.audit('handover.review', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, reason, { outcome: p.outcome, readiness: h.review.readiness });
      return { status: h.status };
    };
    // Issue freezes the manifest (exact revisions); a later change needs an amendment and a new version.
    H['handover.issue'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'reviewed', 'bad_state');
      allow(actor, 'handover.prepare', pr6(h.packageId));
      var mc = ST.manifestCheck(h);
      need(mc.ok, 'manifest_outdated', { problems: mc.problems.map(function (x) { return { kind: x.item.kind, id: x.item.id, state: x.state }; }) });
      var rcp = (p.recipients || []).filter(Boolean); need(rcp.length > 0, 'recipients_required');
      rcp.forEach(function (u) { need(ST.isCustomer(u) && A.can(ds, u, 'handover.view', pr6(h.packageId)).allowed, 'recipient_not_eligible', { user: u }); });
      ST.hpVersions(h.packageId).forEach(function (o) { if (o.id !== h.id && o.status === 'issued') { o.status = 'superseded'; o.supersededBy = h.id; o.history.push({ at: now, by: actor, to: 'superseded', reason: 'Replaced by version ' + h.pkgVersion }); bump(o, now); } });
      h.status = 'issued'; h.issuedAt = now; h.issuedBy = actor; h.recipients = rcp; h.manifest = JSON.parse(JSON.stringify(h.manifest)); h.history.push({ at: now, by: actor, to: 'issued' }); bump(h, now);
      t.notify(rcp, 'hp_issued', rec6('handoverpkg', h), 'hp.' + h.id, { ref: h.ref, v: h.pkgVersion });
      t.audit('handover.issue', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, '', { recipients: rcp, manifest: h.manifest });
      t.activity('hp_issued', rec6('handoverpkg', h), 'customer', { rev: String(h.pkgVersion) });
      return { status: h.status };
    };
    // Acknowledgement records receipt only. It never accepts the works and never releases anything.
    H['handover.acknowledge'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'issued', 'bad_state');
      need((h.recipients || []).indexOf(actor) >= 0, 'not_recipient');
      allow(actor, 'handover.acknowledge', pr6(h.packageId));
      need(!h.acknowledgements.some(function (a) { return a.userId === actor; }), 'already_done');
      h.acknowledgements.push({ userId: actor, at: now, pkgVersion: h.pkgVersion }); bump(h, now);
      t.audit('handover.acknowledge', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, '');
      t.notify([h.issuedBy, h.preparedBy], 'hp_acknowledged', rec6('handoverpkg', h), 'hp.' + h.id, { ref: h.ref, v: h.pkgVersion });
      return { acknowledged: true };
    };
    // Customer acceptance needs the assigned handover.accept authority. It is not a release.
    H['handover.accept'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'issued', 'bad_state');
      need(!h.acceptance, 'already_done');
      var c = allow(actor, 'handover.accept', pr6(h.packageId));
      var scope = text(p.scope, 5, 'scope_required');
      h.acceptance = { by: actor, at: now, authority: c.authority || null, pkgVersion: h.pkgVersion, scope: scope, conditions: String(p.conditions || '').trim(), manifest: JSON.parse(JSON.stringify(h.manifest)) };
      bump(h, now);
      t.audit('handover.accept', { kind: 'handoverpkg', id: h.id }, h.pkgVersion, scope, { authority: h.acceptance.authority, conditions: h.acceptance.conditions });
      t.activity('hp_accepted', rec6('handoverpkg', h), 'customer', { rev: String(h.pkgVersion) });
      t.notify([h.issuedBy, h.preparedBy], 'hp_accepted', rec6('handoverpkg', h), 'hp.' + h.id, { ref: h.ref, v: h.pkgVersion });
      return { accepted: true };
    };
    H['handover.amend'] = function (actor, p, t, now) {
      var h = get('handoverpkg', p.id); checkVersion(h, p.version); need(h.status === 'issued', 'bad_state');
      allow(actor, 'handover.prepare', pr6(h.packageId));
      var reason = text(p.reason, 5, 'reason_required');
      return H['handover.create'](actor, { packageId: h.packageId, title: h.title, manifest: h.manifest, amendReason: reason }, t, now);
    };

    // ---------- technical release ----------
    // Release is its own decision. It needs an explicitly assigned, valid asset.release authority AND every configured
    // prerequisite. Unconfigured prerequisites keep it unavailable. Acknowledgement or acceptance never release.
    H['release.record'] = function (actor, p, t, now) {
      var w = get('package', p.packageId);
      var chk = ST.releaseCheck(actor, w.id);
      need(chk.configured, 'release_not_configured');
      var c = A.can(ds, actor, 'asset.release', pr6(w)); need(c.allowed, c.code || 'authority', { trace: c.trace });
      var unmet = chk.prereqs.filter(function (x) { return !x.met; }).map(function (x) { return x.key; });
      need(!unmet.length, 'prerequisites_unmet', { unmet: unmet });
      var h = chk.current; need(h, 'not_issued');
      var scope = text(p.scope, 5, 'scope_required');
      var r = { id: uid('rel'), ref: nextRef('REL', w.projectId, 'releases'), projectId: w.projectId, packageId: w.id, handoverPackageId: h.id, hpVersion: h.pkgVersion, scope: scope, conditions: String(p.conditions || '').trim(),
        decidedBy: actor, at: now, authority: c.authority || null, basis: { manifest: JSON.parse(JSON.stringify(h.manifest)), acceptance: h.acceptance ? { by: h.acceptance.by, at: h.acceptance.at, pkgVersion: h.acceptance.pkgVersion } : null,
          review: h.review ? { by: h.review.by, at: h.review.at } : null, prerequisites: chk.prereqs }, status: 'recorded', history: [], version: 1 };
      ds.releases.push(r);
      t.audit('release.record', { kind: 'release', id: r.id }, h.pkgVersion, scope, { authority: r.authority, conditions: r.conditions });
      t.activity('rel_recorded', rec6('release', r), 'customer', { rev: String(h.pkgVersion) });
      return { id: r.id, ref: r.ref };
    };
    H['release.withdraw'] = function (actor, p, t, now) {
      var r = get('release', p.id); checkVersion(r, p.version); need(r.status === 'recorded', 'bad_state');
      var c = A.can(ds, actor, 'asset.release', pr6(r.packageId)); need(c.allowed, c.code || 'authority');
      var reason = text(p.reason, 5, 'reason_required');
      r.status = 'withdrawn'; r.history.push({ at: now, by: actor, to: 'withdrawn', reason: reason }); bump(r, now);
      t.audit('release.withdraw', { kind: 'release', id: r.id }, r.hpVersion, reason);
      return { status: r.status };
    };

    H['notification.read'] = function (actor, p) {
      ds.notifications.forEach(function (n) { if (n.userId === actor && (!p.id || n.id === p.id)) n.read = true; });
      return {};
    };

    return { dispatch: dispatch, snapshot: snapshot, REQUEST_TYPES: REQUEST_TYPES, PRIORITIES: PRIORITIES, FILE_TYPES: FILE_TYPES, DOC_FILE_TYPES: DOC_FILE_TYPES, MAX_FILE: MAX_FILE, MUTABLE: MUTABLE, signatureOk: signatureOk };
  }

  var api = { createApi: createApi, ksaStamp: ksaStamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RGSApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
