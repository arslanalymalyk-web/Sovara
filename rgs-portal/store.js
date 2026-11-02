/*
 * RGS Client Portal — record store and derived values (Stage 2).
 *
 * One source of records for every page. Pages never store or hard-code
 * counts, statuses or percentages; they call these selectors, so the same
 * number appears everywhere.
 *
 * PROGRESS (documented for review; Stage 6)
 *   A package has a percentage only when an approved progress configuration exists for it (progressConfigs).
 *   Otherwise: "Progress method not configured" — no percentage is invented.
 *   weighted_milestones: Σ weight of VERIFIED milestones (completedAt) ÷ Σ approved weights (must total 100).
 *                        Reported completions awaiting verification never count. No partial credit.
 *   quantities:          Σ reviewed completed quantity ÷ Σ approved planned quantity, all lines in ONE unit.
 *                        Lines in different units are never combined (pct withheld, "mixed units").
 *                        Staff count reviewed (approved or published) daily updates; customers count published ones.
 *   Project progress  = Σ (package progress × package weight) ÷ Σ package weight, only when every package has a
 *                       percentage; otherwise the project shows which packages are not configured.
 *   Values are rounded to whole percent for display only; sums use unrounded values.
 *
 * COMMITMENT STATUS (derived, never stored)
 *   complete  – doneAt recorded
 *   overdue   – not complete and the current due date (revised ‖ promised) is before today
 *   at_risk   – not complete, not overdue, and a risk reason is recorded
 *   on_track  – otherwise
 * PROJECT HEALTH = worst status among its open commitments and pending customer actions
 *   (overdue > at_risk > on_track).
 *
 * VISIBILITY
 *   Every selector that takes a userId filters through RGSAccess (rbac.js):
 *   project/package/record permissions, customer-visible documents only for
 *   users without document.view.draft, internal activity only with
 *   activity.internal.view.
 */
(function (root) {
  'use strict';

  var ACTION_PERMISSION = {
    document_ack: 'document.acknowledge',
    change_approval: 'customer.approve',
    inspection_signoff: 'inspection.customer_signoff',
    customer_acceptance: 'handover.accept'
  };
  var ACTION_TYPES = Object.keys(ACTION_PERMISSION);
  var RECORD_KINDS = ['document', 'inspection', 'corrective', 'change', 'request', 'evidence', 'commitment', 'milestone', 'package'];

  function create(ds, A, cfg) {
    cfg = cfg || (typeof window !== 'undefined' && window.RGS_CONFIG) || {};
    var POLICY = cfg.policy || {};
    var now = new Date(ds.now || Date.now());
    var today = ds.now ? ds.now.slice(0, 10) : now.toISOString().slice(0, 10);
    var idx = {};
    var TABLES = ['orgs', 'projects', 'areas', 'packages', 'milestones', 'register', 'documents', 'inspections', 'correctiveActions',
     'requests', 'requestNotes', 'changes', 'commitments', 'actions', 'evidence', 'activity', 'users', 'notifications', 'files', 'audit', 'authorities', 'transmittals', 'findings', 'checklistTemplates',
     'progressConfigs', 'dailyUpdates', 'dependencies', 'reports', 'handoverPackages', 'releases'];
    // Indexes are rebuilt after every command (api.js) so every page reads the same current records.
    function reindex() {
      TABLES.forEach(function (k) {
        ds[k] = ds[k] || [];
        idx[k] = {};
        ds[k].forEach(function (r) { idx[k][r.id] = r; });
      });
      ds.documents.forEach(syncDoc);
    }
    // Document-level publication fields are derived from the revisions, never edited directly.
    function syncDoc(d) {
      var pub = d.revisions.filter(function (r) { return r.status === 'published'; })[0];
      var everPublished = d.revisions.some(function (r) { return !!r.publishedAt; });
      d.status = pub ? 'published' : (everPublished ? 'withdrawn' : 'unpublished');
      d.customerVisible = d.audience === 'customer' && everPublished;
    }
    reindex();
    var KIND_TABLE = { document: 'documents', inspection: 'inspections', corrective: 'correctiveActions', change: 'changes',
      request: 'requests', evidence: 'evidence', commitment: 'commitments', milestone: 'milestones', package: 'packages', project: 'projects', action: 'actions',
      note: 'requestNotes', notification: 'notifications', file: 'files', authority: 'authorities', area: 'areas', transmittal: 'transmittals', finding: 'findings', template: 'checklistTemplates',
      progressconfig: 'progressConfigs', dailyupdate: 'dailyUpdates', dependency: 'dependencies', report: 'reports', handoverpkg: 'handoverPackages', release: 'releases' };

    function get(kind, id) {
      if ((kind === 'action' || kind === 'actions') && /^DEC-/.test(id || '')) return virtualActions().filter(function (a) { return a.id === id; })[0] || null;
      var t = KIND_TABLE[kind] || kind; return (idx[t] && idx[t][id]) || null;
    }
    function where(t, f) { return ds[t].filter(f); }
    function round(x) { return Math.round(x); }

    // ---------- Progress (Stage 6: configurable method; see header) ----------
    function progressConfig(wpId) { return (ds.progressConfigs || []).filter(function (c) { return c.packageId === wpId && c.status === 'approved'; })[0] || null; }
    function pkgMilestones(wpId) { return where('milestones', function (m) { return m.packageId === wpId; }).sort(function (a, b) { return a.planned < b.planned ? -1 : a.planned > b.planned ? 1 : 0; }); }
    function countedUpdates(wpId, customerLens) {
      var ok = customerLens ? ['published'] : ['approved', 'published'];
      return (ds.dailyUpdates || []).filter(function (d) { return d.packageId === wpId && ok.indexOf(d.status) >= 0; });
    }
    function packageProgress(wpId, uid) {
      var ms = pkgMilestones(wpId), cfg = progressConfig(wpId), cust = !!(uid && isCustomer(uid));
      var verified = ms.filter(function (m) { return m.completedAt; });
      var out = { milestones: ms, completed: verified.length, total: ms.length, reportedOnly: ms.filter(function (m) { return m.reported && !m.completedAt; }).length,
        configured: !!cfg, method: cfg ? cfg.method : null, config: cfg, ratio: null, pct: null, reason: null, calc: null, asOf: null, lens: cust ? 'customer' : 'staff' };
      var w = idx.packages[wpId], p = w && idx.projects[w.projectId];
      if (!cfg) { out.reason = 'not_configured'; out.asOf = p ? p.reportingDate : null; return out; }
      if (cfg.method === 'weighted_milestones') {
        var total = 0, done = 0;
        ms.forEach(function (m) { total += m.weight; if (m.completedAt) done += m.weight; });
        out.calc = { kind: 'weighted', done: done, total: total, rows: ms.map(function (m) { return { id: m.id, weight: m.weight, counted: !!m.completedAt }; }) };
        var lastV = verified.map(function (m) { return (m.verifiedAt || m.completedAt).slice(0, 10); }).sort().pop();
        out.asOf = lastV || (p ? p.reportingDate : null);
        var want = PRPOL().weightTotal || 100;
        if (!ms.length || total !== want) { out.reason = 'weights_invalid'; return out; }
        out.ratio = done / total;
      } else if (cfg.method === 'quantities') {
        var lines = cfg.lines || [], units = Array.from(new Set(lines.map(function (l) { return l.unit; })));
        var ups = countedUpdates(wpId, cust);
        var rows = lines.map(function (l) {
          var doneQ = 0, from = [];
          ups.forEach(function (d) { (d.quantities || []).forEach(function (q) { if (q.lineId === l.id && q.unit === l.unit) { doneQ += +q.qty; from.push(d.id); } }); });
          return { id: l.id, description: l.description, descriptionAr: l.descriptionAr, unit: l.unit, planned: l.planned, done: doneQ, counted: Math.min(doneQ, l.planned), over: doneQ > l.planned, updates: Array.from(new Set(from)) };
        });
        out.calc = { kind: 'quantities', unit: units.length === 1 ? units[0] : null, units: units, rows: rows,
          done: rows.reduce(function (a, r) { return a + r.counted; }, 0), total: rows.reduce(function (a, r) { return a + r.planned; }, 0) };
        out.asOf = ups.map(function (d) { return d.date; }).sort().pop() || (p ? p.reportingDate : null);
        if (!lines.length) { out.reason = 'no_lines'; return out; }
        if (units.length !== 1) { out.reason = 'mixed_units'; return out; }
        out.ratio = out.calc.total ? out.calc.done / out.calc.total : null;
        if (out.ratio === null) { out.reason = 'no_lines'; return out; }
      } else { out.reason = 'not_configured'; return out; }
      out.pct = round(out.ratio * 100);
      return out;
    }
    function projectProgress(pid, uid) {
      var wps = where('packages', function (w) { return w.projectId === pid; });
      var tw = 0, acc = 0, missing = [];
      var rows = wps.map(function (w) { var p = packageProgress(w.id, uid); tw += w.weight; if (p.ratio === null) missing.push(w); else acc += p.ratio * w.weight; return { pkg: w, progress: p }; });
      var ok = !missing.length && tw > 0;
      var ratio = ok ? acc / tw : null;
      var bySvc = {};
      rows.forEach(function (r) {
        var s = bySvc[r.pkg.service] || (bySvc[r.pkg.service] = { service: r.pkg.service, weight: 0, acc: 0, missing: 0 });
        s.weight += r.pkg.weight; if (r.progress.ratio === null) s.missing++; else s.acc += r.progress.ratio * r.pkg.weight;
      });
      var services = Object.keys(bySvc).map(function (k) { var s = bySvc[k]; return { service: k, weight: s.weight, share: tw ? s.weight / tw : 0, pct: s.missing ? null : round(s.weight ? (s.acc / s.weight) * 100 : 0) }; });
      var p = idx.projects[pid];
      var asOf = rows.map(function (r) { return r.progress.asOf; }).filter(Boolean).sort().pop() || (p ? p.reportingDate : null);
      return { ratio: ratio, pct: ok ? round(ratio * 100) : null, configured: ok, missing: missing, packages: rows, services: services, totalWeight: tw, asOf: asOf };
    }
    function PRPOL() { return POLICY.progress || {}; }

    // ---------- Status derivations ----------
    function dueOf(c) { return c.revised || c.promised; }
    function commitmentStatus(c) {
      if (c.doneAt) return 'complete';
      if (dueOf(c) < today) return 'overdue';
      if (c.riskReason || (c.forecast && c.forecast > dueOf(c))) return 'at_risk';
      return 'on_track';
    }
    function actionStatus(a) {
      if (a.doneAt) return 'done';
      return a.due < today ? 'overdue' : 'pending';
    }
    function packageStatus(wpId) {
      var p = packageProgress(wpId);
      if (p.ratio === null ? (p.total && p.completed === p.total) : p.ratio >= 1) return 'complete';
      if (p.completed === 0) return 'not_started';
      return 'active';
    }
    var RANK = { on_track: 0, at_risk: 1, overdue: 2 };
    function projectHealth(pid) {
      var worst = 'on_track';
      where('commitments', function (c) { return c.projectId === pid; }).forEach(function (c) {
        var s = commitmentStatus(c); if (s !== 'complete' && RANK[s] > RANK[worst]) worst = s;
      });
      allActions().filter(function (a) { return a.projectId === pid; }).forEach(function (a) {
        if (actionStatus(a) === 'overdue' && RANK.overdue > RANK[worst]) worst = 'overdue';
      });
      return worst;
    }

    // ---------- Permission-aware visibility ----------
    function can(uid, action, res) { return A.can(ds, uid, action, res); }
    function allowed(uid, action, res) { return can(uid, action, res).allowed; }
    function user(uid) { return idx.users[uid] || null; }
    function isCustomer(uid) { var u = user(uid); var o = u && idx.orgs[u.orgId]; return !!(o && o.kind === 'customer'); }

    function visibleProjects(uid) { return ds.projects.filter(function (p) { return allowed(uid, 'project.view', { projectId: p.id }); }); }
    function visiblePackages(uid, pid) {
      return where('packages', function (w) { return (!pid || w.projectId === pid) && allowed(uid, 'package.view', { packageId: w.id }); });
    }
    function docVisible(uid, d) {
      var res = d.packageIds && d.packageIds.length ? { packageId: d.packageIds[0] } : { projectId: d.projectId };
      // a document linked to several packages is visible if any linked package is in scope
      var inScope = (d.packageIds && d.packageIds.length) ? d.packageIds.some(function (id) { return allowed(uid, 'document.view', { packageId: id }); })
        : allowed(uid, 'document.view', res);
      if (!inScope) return false;
      if (allowed(uid, 'document.view.draft', { projectId: d.projectId })) return true;
      return custDocVisible(uid, d);
    }
    // Explain why a single record is or isn't visible — used by route guards.
    function recordAccess(uid, kind, rec) {
      if (!rec) return { allowed: false, code: 'not_found', trace: ['Record not found'] };
      var pkgRes = function (id) { return { packageId: id }; };
      switch (kind) {
        case 'project': return can(uid, 'project.view', { projectId: rec.id });
        case 'package': return can(uid, 'package.view', pkgRes(rec.id));
        case 'document': {
          var base = can(uid, 'document.view', rec.packageIds && rec.packageIds.length ? pkgRes(rec.packageIds[0]) : { projectId: rec.projectId });
          if (!base.allowed && rec.packageIds && rec.packageIds.length > 1) {
            for (var i = 1; i < rec.packageIds.length; i++) { var b2 = can(uid, 'document.view', pkgRes(rec.packageIds[i])); if (b2.allowed) { base = b2; break; } }
          }
          if (!base.allowed) return base;
          if (!can(uid, 'document.view.draft', { projectId: rec.projectId }).allowed && !custDocVisible(uid, rec))
            return { allowed: false, code: 'internal_record', trace: base.trace.concat('Not issued to you') };
          return base;
        }
        case 'inspection': {
          var iv = can(uid, 'inspection.view', pkgRes(rec.packageId));
          if (!iv.allowed || rec.publishedAt) return iv;
          // unpublished inspections are internal until someone authorised publishes them
          return can(uid, 'inspection.view.internal', pkgRes(rec.packageId)).allowed ? iv : { allowed: false, code: 'internal_record', trace: iv.trace.concat('Inspection not published') };
        }
        case 'corrective': {
          var cv = can(uid, 'corrective.view', pkgRes(rec.packageId));
          if (!cv.allowed) return cv;
          var cf = rec.findingId && idx.findings[rec.findingId];
          if (cf && !cf.customerVisible && !can(uid, 'finding.view.internal', pkgRes(rec.packageId)).allowed) return { allowed: false, code: 'internal_record', trace: cv.trace.concat('Internal finding') };
          return cv;
        }
        case 'finding': {
          var fv = can(uid, 'corrective.view', pkgRes(rec.packageId));
          if (!fv.allowed || rec.customerVisible) return fv;
          return can(uid, 'finding.view.internal', pkgRes(rec.packageId)).allowed ? fv : { allowed: false, code: 'internal_record', trace: fv.trace.concat('Internal finding') };
        }
        case 'template': return isCustomer(uid) ? { allowed: false, code: 'internal_record', trace: ['Checklist templates are internal'] } : { allowed: true, code: 'ok', trace: [] };
        case 'request': {
          if (rec.status === 'draft' || rec.status === 'withdrawn') {
            if (rec.raisedBy !== uid) return { allowed: false, code: 'private_draft', trace: ['Drafts are visible only to their author'] };
            return can(uid, 'request.create', rec.packageId ? pkgRes(rec.packageId) : { projectId: rec.projectId });
          }
          return can(uid, 'request.view', rec.packageId ? pkgRes(rec.packageId) : { projectId: rec.projectId });
        }
        case 'change': {
          var c = can(uid, 'instruction.view', rec.packageIds && rec.packageIds.length ? pkgRes(rec.packageIds[0]) : { projectId: rec.projectId });
          if (!c.allowed) return c;
          // Internal until RGS review first passes; once shared, a customer keeps seeing it through later revisions.
          if (!rec.sharedWithCustomer) {
            var ci = can(uid, 'instruction.view.internal', { projectId: rec.projectId });
            if (!ci.allowed) return { allowed: false, code: 'internal_record', trace: c.trace.concat('Instruction not yet issued to the customer') };
          }
          return c;
        }
        case 'note': {
          var parent = idx.requests[rec.requestId];
          if (!parent || !canSee(uid, 'request', parent)) return { allowed: false, code: 'scope', trace: [] };
          return can(uid, 'request.note.view', parent.packageId ? pkgRes(parent.packageId) : { projectId: parent.projectId });
        }
        case 'file': return fileAccess(uid, rec);
        case 'evidence': {
          var ev = can(uid, 'package.view', pkgRes(rec.packageId));
          if (!ev.allowed) return ev;
          // evidence follows the record it supports: if that record is internal to you, so is the evidence
          if (rec.linked && rec.linked.kind !== 'evidence') { var lr = get(rec.linked.kind, rec.linked.id); if (lr && !canSee(uid, rec.linked.kind, lr)) return { allowed: false, code: 'internal_record', trace: ev.trace.concat('Linked record is internal') }; }
          if (rec.audience !== 'internal') return ev;
          var ei = can(uid, 'evidence.view.internal', pkgRes(rec.packageId));
          return ei.allowed ? ev : { allowed: false, code: 'internal_record', trace: ev.trace.concat('Internal site evidence') };
        }
        case 'transmittal': return transmittalAccess(uid, rec);
        case 'commitment': {
          var cv = can(uid, 'commitment.view', rec.packageId ? pkgRes(rec.packageId) : { projectId: rec.projectId });
          if (!cv.allowed || rec.visibility !== 'internal') return cv;
          var ci2 = can(uid, 'activity.internal.view', rec.packageId ? pkgRes(rec.packageId) : { projectId: rec.projectId });
          return ci2.allowed ? cv : { allowed: false, code: 'internal_record', trace: cv.trace.concat('Internal commitment') };
        }
        case 'dailyupdate': return dailyUpdateAccess(uid, rec);
        case 'dependency': return can(uid, 'dependency.view', { projectId: rec.projectId });
        case 'progressconfig': return can(uid, 'package.view', pkgRes(rec.packageId));
        case 'report': return reportAccess(uid, rec);
        case 'handoverpkg': return hpAccess(uid, rec);
        case 'release': {
          var rv = can(uid, 'handover.view', pkgRes(rec.packageId));
          if (!rv.allowed || !isCustomer(uid)) return rv;
          var hh = idx.handoverPackages[rec.handoverPackageId];
          return hh && hpAccess(uid, hh).allowed ? rv : { allowed: false, code: 'internal_record', trace: rv.trace.concat('Release decision on a package not issued to you') };
        }
        case 'milestone': return can(uid, 'package.view', pkgRes(rec.packageId));
        default: return { allowed: false, code: 'unknown_action', trace: [] };
      }
    }
    function canSee(uid, kind, rec) { return recordAccess(uid, kind, rec).allowed; }

    function listVisible(uid, table, kind, pid, extra) {
      return ds[table].filter(function (r) {
        var p = r.projectId || (r.packageId && idx.packages[r.packageId] ? idx.packages[r.packageId].projectId : null);
        if (pid && p !== pid) return false;
        if (extra && !extra(r)) return false;
        return canSee(uid, kind, r);
      });
    }
    function projectOf(rec) {
      if (rec.projectId) return rec.projectId;
      if (rec.packageId && idx.packages[rec.packageId]) return idx.packages[rec.packageId].projectId;
      return null;
    }

    function documents(uid, pid, pkgId) {
      return ds.documents.filter(function (d) {
        if (pid && d.projectId !== pid) return false;
        if (pkgId && (d.packageIds || []).indexOf(pkgId) < 0) return false;
        return docVisible(uid, d);
      });
    }
    // The current revision is the published one; until something is published it is the latest revision.
    function currentRev(d) { return d.revisions.filter(function (r) { return r.status === 'published'; })[0] || d.revisions[d.revisions.length - 1]; }
    function inspections(uid, pid, pkgId) { return listVisible(uid, 'inspections', 'inspection', pid, function (r) { return !pkgId || r.packageId === pkgId; }); }
    function correctives(uid, pid, pkgId) { return listVisible(uid, 'correctiveActions', 'corrective', pid, function (r) { return !pkgId || r.packageId === pkgId; }); }
    function changes(uid, pid, pkgId) { return listVisible(uid, 'changes', 'change', pid, function (r) { return !pkgId || r.packageIds.indexOf(pkgId) >= 0; }); }
    function evidence(uid, pid, pkgId) { return listVisible(uid, 'evidence', 'evidence', pid, function (r) { return !pkgId || r.packageId === pkgId; }); }
    function commitments(uid, pid, pkgId) {
      return listVisible(uid, 'commitments', 'commitment', pid, function (r) { return !pkgId || r.packageId === pkgId; })
        .sort(function (a, b) { return dueOf(a) < dueOf(b) ? -1 : 1; });
    }
    function openCorrective(r) { return r.status !== 'closed' && r.status !== 'cancelled'; }

    // ---------- Customer actions ----------
    // Each action resolves to: exact record, required permission, can/cannot with reason.
    function actionView(uid, a) {
      var rec = get(a.record.kind, a.record.id);
      var perm = ACTION_PERMISSION[a.type];
      var res = a.packageId ? { packageId: a.packageId } : { projectId: a.projectId };
      var decision = a.source === 'instruction' ? decisionCheck(uid, idx.changes[a.record.id], a.decisionType) : can(uid, perm, res);
      return { action: a, record: rec, recordKind: a.record.kind, permission: perm, status: actionStatus(a), can: decision,
        recordVisible: canSee(uid, a.record.kind, rec) };
    }
    // Actions addressed to the user's organisation, on projects they can see.
    function allActions() { return ds.actions.concat(virtualActions()); }
    function actionsFor(uid, opts) {
      opts = opts || {};
      var u = user(uid); if (!u) return [];
      return allActions().filter(function (a) {
        var p = idx.projects[a.projectId];
        if (!p || p.customerOrgId !== u.orgId) return false;
        if (opts.projectId && a.projectId !== opts.projectId) return false;
        return allowed(uid, 'project.view', { projectId: a.projectId });
      }).map(function (a) { return actionView(uid, a); })
        .filter(function (v) { return v.recordVisible; })
        .sort(function (x, y) { return x.action.due < y.action.due ? -1 : 1; });
    }
    // For RGS staff: actions awaiting the customer on a project they can see.
    function awaitingCustomer(uid, pid) {
      return allActions().filter(function (a) { return a.projectId === pid && !a.doneAt && allowed(uid, 'project.view', { projectId: pid }); })
        .map(function (a) { var v = actionView(uid, a); return v; })
        .filter(function (v) { return v.recordVisible; });
    }
    function openActions(list) { return list.filter(function (v) { return v.status !== 'done'; }); }

    // ---------- Activity ----------
    function activity(uid, opts) {
      opts = opts || {};
      var internal = function (pid) { return allowed(uid, 'activity.internal.view', { projectId: pid }); };
      return ds.activity.filter(function (e) {
        if (opts.projectId && e.projectId !== opts.projectId) return false;
        if (opts.since && e.at <= opts.since) return false;
        if (!allowed(uid, 'project.view', { projectId: e.projectId })) return false;
        if (e.visibility === 'internal' && !internal(e.projectId)) return false;
        var rec = get(e.ref.kind, e.ref.id);
        if (e.ref.kind !== 'package' && e.ref.kind !== 'milestone' && rec && !canSee(uid, e.ref.kind, rec)) return false;
        if (e.packageId && !allowed(uid, 'package.view', { packageId: e.packageId })) return false;
        return true;
      }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    }
    function sinceLastVisit(uid) { var u = user(uid); return activity(uid, { since: u && u.lastVisitAt }); }
    function lastUpdate(uid, pid) { var a = activity(uid, { projectId: pid }); return a.length ? a[0].at : null; }

    // Next committed date and who owns the next action, for a project card.
    function nextCommitment(uid, pid) {
      var open = commitments(uid, pid).filter(function (c) { return commitmentStatus(c) !== 'complete'; });
      return open.length ? open[0] : null;
    }

    // ---------- Handover requirements (derived from records) ----------
    // Requirement list needs RGS confirmation per contract; each item is computed, never typed in.
    function handover(uid, wpId) {
      var wp = idx.packages[wpId];
      var prog = packageProgress(wpId);
      var ins = ds.inspections.filter(function (i) { return i.packageId === wpId; });
      var finalInsp = ins.filter(function (i) { return i.result === 'accepted' && i.rgsSignoff; }).sort(function (a, b) { return a.performed < b.performed ? 1 : -1; })[0] || null;
      var openCA = ds.correctiveActions.filter(function (c) { return c.packageId === wpId && openCorrective(c); });
      var hoDoc = ds.documents.filter(function (d) { return d.type === 'handover_record' && (d.packageIds || []).indexOf(wpId) >= 0 && d.status === 'published'; })[0] || null;
      var accept = ds.actions.filter(function (a) { return a.packageId === wpId && a.type === 'customer_acceptance'; })[0] || null;
      var pendingSignoffs = ds.actions.filter(function (a) { return a.packageId === wpId && a.type === 'inspection_signoff' && !a.doneAt; });
      var workMs = prog.milestones.filter(function (m) { return !/handed over|handover accepted/i.test(m.name); });
      var workDone = workMs.every(function (m) { return m.completedAt; });
      var items = [
        { key: 'works', met: workDone, ref: null, detail: workMs.filter(function (m) { return m.completedAt; }).length + '/' + workMs.length },
        { key: 'inspection', met: !!finalInsp && pendingSignoffs.length === 0, ref: finalInsp ? { kind: 'inspection', id: finalInsp.id } : null },
        { key: 'corrective', met: openCA.length === 0, ref: openCA[0] ? { kind: 'corrective', id: openCA[0].id } : null, detail: String(openCA.length) },
        { key: 'record', met: !!hoDoc, ref: hoDoc ? { kind: 'document', id: hoDoc.id } : null },
        { key: 'acceptance', met: !!(accept && accept.doneAt && (accept.outcome || 'approve') === 'approve'), ref: accept ? { kind: 'action', id: accept.id } : null, pending: !!(accept && !accept.doneAt) }
      ];
      var met = items.filter(function (i) { return i.met; }).length;
      return { pkg: wp, items: items, met: met, total: items.length, pct: Math.round(met / items.length * 100), acceptance: accept ? actionView(uid, accept) : null };
    }

    // ---------- Briefing (rule-based preview; AI model arrives later) ----------
    function briefing(uid) {
      var out = [];
      var ps = visibleProjects(uid);
      ps.forEach(function (p) {
        var pr = projectProgress(p.id, uid);
        out.push({ kind: 'progress', project: p, pct: pr.pct, configured: pr.configured, packages: visiblePackages(uid, p.id).length, asOf: pr.asOf || p.reportingDate,
          evidence: [{ kind: 'project', id: p.id }] });
      });
      if (isCustomer(uid)) {
        var acts = openActions(actionsFor(uid));
        var mine = acts.filter(function (v) { return v.can.allowed; });
        if (mine.length) out.push({ kind: 'decisions', count: mine.length, first: mine[0], evidence: mine.slice(0, 3).map(function (v) { return { kind: v.recordKind, id: v.record.id }; }) });
      }
      ps.forEach(function (p) {
        commitments(uid, p.id).forEach(function (c) {
          var s = commitmentStatus(c);
          if (s === 'overdue' || s === 'at_risk') out.push({ kind: 'commitment', status: s, commitment: c, project: p, evidence: [{ kind: 'commitment', id: c.id }] });
        });
      });
      var cas = []; ps.forEach(function (p) { cas = cas.concat(correctives(uid, p.id).filter(openCorrective)); });
      if (cas.length) {
        cas.sort(function (a, b) { return a.due < b.due ? -1 : 1; });
        out.push({ kind: 'corrective', count: cas.length, first: cas[0], evidence: cas.slice(0, 3).map(function (c) { return { kind: 'corrective', id: c.id }; }) });
      }
      // every statement must rest only on records the assistant may read for this user
      return out.filter(function (s) {
        return s.evidence.every(function (ev) {
          var rec = get(ev.kind, ev.id);
          var perm = { project: 'project.view', commitment: 'commitment.view', corrective: 'corrective.view', inspection: 'inspection.view', change: 'instruction.view', document: 'document.view' }[ev.kind];
          var res = ev.kind === 'project' ? { projectId: ev.id } : rec && rec.packageId ? { packageId: rec.packageId } : { projectId: rec && (rec.projectId || projectOf(rec)) };
          return rec && A.aiCan(ds, uid, perm, res).allowed && (ev.kind === 'project' || canSee(uid, ev.kind, rec));
        });
      });
    }


    // ======================= Stage 3: requests, instructions, decisions =======================
    var INTERNAL_STATES = ['draft', 'under_review'];
    var OPEN_REQ = ['submitted', 'clarification_requested', 'in_review', 'completion_submitted', 'resolved'];
    var TERMINAL_REQ = ['closed', 'cancelled', 'superseded', 'withdrawn'];
    var DECISION_PERMISSION = { internal_review: 'instruction.review', customer_approval: 'customer.approve', execution_authorisation: 'instruction.authorise', technical_signoff: 'inspection.signoff', completion_acceptance: 'handover.accept' };
    var CUSTOMER_DECISIONS = ['customer_approval', 'completion_acceptance'];

    function reqRes(r) { return r.packageId ? { packageId: r.packageId } : { projectId: r.projectId }; }
    function fileAccess(uid, f) {
      var o = f.owner || {};
      if (o.kind === 'request') { var r = idx.requests[o.id]; return r && canSee(uid, 'request', r) ? { allowed: true, code: 'ok', trace: [] } : { allowed: false, code: 'scope', trace: ['No access to the request'] }; }
      if (o.kind === 'note') { var n = idx.requestNotes[o.id]; return n ? recordAccess(uid, 'note', n) : { allowed: false, code: 'not_found', trace: [] }; }
      if (o.kind === 'change') { var c = idx.changes[o.id]; return c ? recordAccess(uid, 'change', c) : { allowed: false, code: 'not_found', trace: [] }; }
      if (o.kind === 'draft') return o.userId === uid ? { allowed: true, code: 'ok', trace: [] } : { allowed: false, code: 'private_draft', trace: [] };
      if (o.kind === 'docrev') { var dd = idx.documents[o.docId], rv = dd && revOf(dd, o.rev); return rv ? revisionAccess(uid, dd, rv) : { allowed: false, code: 'not_found', trace: [] }; }
      if (o.kind === 'upload') {
        // unregistered upload: the uploader and the project's document controllers only
        if (o.userId === uid) return { allowed: true, code: 'ok', trace: [] };
        return can(uid, 'document.control', o.packageId ? { packageId: o.packageId } : { projectId: o.projectId });
      }
      if (o.kind === 'evidence') { var e0 = idx.evidence[o.id]; return e0 ? recordAccess(uid, 'evidence', e0) : { allowed: false, code: 'not_found', trace: [] }; }
      return { allowed: false, code: 'not_found', trace: [] };
    }


    // =====================================================================================
    // Stage 4: controlled documents, revisions, reviews, publication and evidence
    // =====================================================================================
    var DOCPOL = POLICY.documents || {};
    var OUTCOME_RANK = { accepted: 1, accepted_comments: 2, revise_resubmit: 3, rejected: 4 };
    var PUBLISHABLE = DOCPOL.publishableOutcomes || ['accepted', 'accepted_comments'];
    var REV_OPEN = ['draft', 'under_review'].concat(PUBLISHABLE);
    function revOf(d, rev) { return (d.revisions || []).filter(function (r) { return r.rev === rev; })[0] || null; }
    function pubRev(d) { return d.revisions.filter(function (r) { return r.status === 'published'; })[0] || null; }
    function latestRev(d) { return d.revisions[d.revisions.length - 1]; }
    // A revision newer than the published one that is still being worked on (draft, in review or accepted).
    function pendingRev(d) { var l = latestRev(d); return l && REV_OPEN.indexOf(l.status) >= 0 ? l : null; }
    function docRes(d) { return d.packageIds && d.packageIds.length ? { packageId: d.packageIds[0], category: d.category } : { projectId: d.projectId, category: d.category }; }
    function isStaffFor(uid, d) { return allowed(uid, 'document.view.draft', { projectId: d.projectId }); }
    // Revision-level access: staff in scope see every revision; customers only revisions that were published to them.
    function revisionAccess(uid, d, r) {
      var base = recordAccess(uid, 'document', d);
      if (!base.allowed) return base;
      if (isStaffFor(uid, d)) return base;
      if (custRevVisible(uid, d, r)) return base;
      return { allowed: false, code: 'internal_record', trace: base.trace.concat('Revision not issued to you') };
    }
    // Customers see a revision only when it was issued to them by name (transmittal recipient), when it was issued
    // to their organisation before portal transmittals existed, or while they are an assigned customer reviewer.
    function custRevVisible(uid, d, r) {
      if (d.audience !== 'customer') return false;
      if ((r.reviewers || []).indexOf(uid) >= 0 || (r.optionalReviewers || []).indexOf(uid) >= 0) return true;
      if (!r.publishedAt) return false;
      if (!r.transmittalId && !ds.transmittals.some(function (tr) { return tr.items.some(function (i) { return i.docId === d.id && i.rev === r.rev; }); })) return true; // pre-portal issue
      return ds.transmittals.some(function (tr) { return tr.recipients.indexOf(uid) >= 0 && tr.items.some(function (i) { return i.docId === d.id && i.rev === r.rev; }); });
    }
    function custDocVisible(uid, d) { return d.revisions.some(function (r) { return custRevVisible(uid, d, r); }); }
    // Customer review is switched on per project AND category; config wins over the labelled demo example.
    // Review routing per project and category. Production rules come from config; test data may supply a labelled example.
    function customerReviewSetting() {
      var conf = DOCPOL.reviewRouting || {};
      if (Object.keys(conf).length) return { example: false, label: null, projects: conf };
      if (ds.demoReviewRouting) return { example: true, label: ds.demoReviewRouting.label, projects: ds.demoReviewRouting.projects };
      return { example: false, label: null, projects: {} };
    }
    function reviewRouting(d) { var p = customerReviewSetting().projects[d.projectId] || {}; return p[d.category] || null; } // null = not configured
    function customerReviewRequired(d) { return reviewRouting(d) === 'customer_required'; }
    function visibleRevisions(uid, d) { return d.revisions.filter(function (r) { return revisionAccess(uid, d, r).allowed; }); }
    function revComments(uid, d, r) {
      if (!revisionAccess(uid, d, r).allowed) return [];
      var internal = allowed(uid, 'document.comment.internal', { projectId: d.projectId });
      return (r.comments || []).filter(function (c) { return c.visibility === 'customer' || internal; });
    }
    function revReviews(uid, d, r) { return isStaffFor(uid, d) ? (r.reviews || []) : []; }
    // Review consolidation (proposed rule): closes when every assigned reviewer has recorded an outcome; most restrictive stands.
    function reviewState(r) {
      var all = (r.reviews || []).filter(function (x) { return x.rev === r.rev; });
      var done = all.filter(function (x) { return (r.reviewers || []).indexOf(x.by) >= 0; }); // optional reviews never decide the outcome
      var pending = (r.reviewers || []).filter(function (u) { return !done.some(function (x) { return x.by === u; }); });
      var optionalPending = (r.optionalReviewers || []).filter(function (u) { return !all.some(function (x) { return x.by === u; }); });
      var worst = done.reduce(function (w, x) { return !w || OUTCOME_RANK[x.outcome] > OUTCOME_RANK[w] ? x.outcome : w; }, null);
      return { done: done, all: all, pending: pending, optionalPending: optionalPending, complete: (r.reviewers || []).length > 0 && pending.length === 0, outcome: pending.length === 0 ? worst : null };
    }
    function reviewOverdue(r) { return r.status === 'under_review' && r.reviewDue && r.reviewDue < today; }
    // Links: explicit links recorded at registration plus every record that cites the document.
    function docLinks(d) {
      var out = (d.links || []).map(function (l) { return { kind: l.kind, id: l.id, rev: null, via: 'registered' }; });
      ds.changes.forEach(function (c) { (c.docRefs || []).forEach(function (ref) { if (ref.id === d.id) out.push({ kind: 'change', id: c.id, rev: ref.rev, via: 'instruction' }); }); });
      ds.requests.forEach(function (q) { if (q.status === 'draft' || q.status === 'withdrawn') return; (q.linkedDocs || []).forEach(function (ref) { if (ref.id === d.id) out.push({ kind: 'request', id: q.id, rev: ref.rev, via: 'request' }); }); });
      ds.inspections.forEach(function (i) { if (i.basisDocId === d.id) out.push({ kind: 'inspection', id: i.id, rev: i.basisRev || null, via: 'basis' }); });
      // one row per record: a citation (with its revision) wins over a plain registration link
      var seen = {};
      return out.filter(function (l) { var k = l.kind + ':' + l.id; if (seen[k]) return false; seen[k] = 1; return true; })
        .map(function (l) { var better = out.filter(function (x) { return x.kind === l.kind && x.id === l.id && x.rev; })[0]; return better || l; });
    }
    // Records that cite a revision that is no longer current. Historical records are flagged, never rewritten.
    function revisionFlag(d, rev) {
      if (!rev) return null;
      var r = revOf(d, rev); if (!r) return { state: 'unknown' };
      if (r.status === 'superseded' || r.status === 'withdrawn') { var cur = pubRev(d); return { state: r.status, current: cur ? cur.rev : null }; }
      return null;
    }
    function supersededRefs(uid, pid) {
      var out = [];
      ds.documents.forEach(function (d) {
        if (pid && d.projectId !== pid) return;
        if (!docVisible(uid, d)) return;
        docLinks(d).forEach(function (l) {
          if (!l.rev || (l.kind !== 'change' && l.kind !== 'inspection' && l.kind !== 'request')) return;
          var f = revisionFlag(d, l.rev); if (!f) return;
          var rec = get(l.kind, l.id); if (!rec || !canSee(uid, l.kind, rec)) return;
          out.push({ doc: d, link: l, record: rec, flag: f, closed: (l.kind === 'change' && ['closed', 'cancelled', 'superseded', 'rejected'].indexOf(rec.state) >= 0) || (l.kind === 'request' && TERMINAL_REQ.indexOf(rec.status) >= 0) });
        });
      });
      return out;
    }
    function refFlagFor(docId, rev) { var d = idx.documents[docId]; return d ? revisionFlag(d, rev) : null; }
    // Document centre: one row per document, current published revision kept separate from a newer one in progress.
    function docRow(uid, d) {
      var pub = pubRev(d), pend = isStaffFor(uid, d) ? pendingRev(d) : null;
      var shown = pub || (isStaffFor(uid, d) ? latestRev(d) : visibleRevisions(uid, d).slice(-1)[0]);
      var rs = pend ? reviewState(pend) : null;
      return { doc: d, published: pub, pending: pend && pend !== pub ? pend : null, shown: shown, review: rs,
        reviewStatus: pend ? pend.status : (pub ? 'published' : (shown ? shown.status : '—')), overdue: !!(pend && reviewOverdue(pend)),
        updatedAt: d.revisions.reduce(function (m, r) { var x = r.publishedAt || r.submittedAt || (r.date + 'T00:00'); return x > m ? x : m; }, d.registeredAt || '') };
    }
    function docCentre(uid, f) {
      f = f || {};
      var q = String(f.q || '').toLowerCase().trim();
      return ds.documents.filter(function (d) { return docVisible(uid, d); }).map(function (d) { return docRow(uid, d); }).filter(function (row) {
        var d = row.doc;
        if (f.project && d.projectId !== f.project) return false;
        if (f.category && d.category !== f.category) return false;
        if (f.package && (d.packageIds || []).indexOf(f.package) < 0) return false;
        if (f.area && d.areaId !== f.area) return false;
        if (f.pub === 'published' && !row.published) return false;
        if (f.pub === 'unpublished' && (row.published || d.status === 'withdrawn')) return false;
        if (f.pub === 'withdrawn' && d.status !== 'withdrawn') return false;
        if (f.review === 'in_review' && !(row.pending && row.pending.status === 'under_review')) return false;
        if (f.review === 'overdue' && !row.overdue) return false;
        if (f.review === 'ready' && !(row.pending && PUBLISHABLE.indexOf(row.pending.status) >= 0)) return false;
        if (q && (d.number + ' ' + d.title).toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).sort(function (a, b) { return a.doc.number < b.doc.number ? -1 : 1; });
    }
    function myReviews(uid) {
      var out = [];
      ds.documents.forEach(function (d) {
        if (!docVisible(uid, d)) return;
        d.revisions.forEach(function (r) {
          var optional = (r.optionalReviewers || []).indexOf(uid) >= 0;
          if (r.status !== 'under_review' || ((r.reviewers || []).indexOf(uid) < 0 && !optional)) return;
          var rs = reviewState(r);
          out.push({ doc: d, rev: r, optional: optional, mine: optional ? rs.optionalPending.indexOf(uid) >= 0 : rs.pending.indexOf(uid) >= 0, state: rs, overdue: reviewOverdue(r) });
        });
      });
      return out.sort(function (a, b) { return (a.rev.reviewDue || '9') < (b.rev.reviewDue || '9') ? -1 : 1; });
    }
    function docControls(uid, d) {
      var res = docRes(d), staff = isStaffFor(uid, d), pend = pendingRev(d), pub = pubRev(d);
      var c = { register: false, revise: false, submit: false, review: false, publish: false, withdraw: false, comment: false, commentInternal: false, assign: false, replaceFile: false };
      if (!docVisible(uid, d)) return c;
      var up = allowed(uid, 'document.upload', res), ctl = allowed(uid, 'document.control', res);
      c.revise = staff && (up || ctl) && !pend;
      c.submit = staff && (up || ctl) && !!pend && pend.status === 'draft';
      c.replaceFile = c.submit;
      c.assign = ctl && !!pend && pend.status === 'under_review';
      var rsP = pend && reviewState(pend);
      c.review = !!pend && pend.status === 'under_review' && allowed(uid, 'document.review', res) && (rsP.pending.indexOf(uid) >= 0 || rsP.optionalPending.indexOf(uid) >= 0);
      c.reviewOptional = c.review && rsP.optionalPending.indexOf(uid) >= 0;
      c.publish = !!pend && PUBLISHABLE.indexOf(pend.status) >= 0 && d.audience === 'customer' && allowed(uid, 'document.publish', res) && !!reviewRouting(d);
      c.routingMissing = d.audience === 'customer' && !reviewRouting(d);
      c.withdraw = !!pub && allowed(uid, 'document.control', res);
      c.comment = staff;
      c.commentInternal = allowed(uid, 'document.comment.internal', { projectId: d.projectId });
      return c;
    }
    // Transmittals: staff in project scope; customers when someone in their organisation is a recipient.
    function transmittalAccess(uid, tr) {
      var p = can(uid, 'document.view', { projectId: tr.projectId });
      if (!p.allowed) return p;
      if (allowed(uid, 'document.view.draft', { projectId: tr.projectId })) return p;
      return tr.recipients.indexOf(uid) >= 0 ? p : { allowed: false, code: 'scope', trace: ['Transmittal not addressed to you'] };
    }
    function transmittals(uid, pid, docId) {
      return ds.transmittals.filter(function (tr) {
        if (pid && tr.projectId !== pid) return false;
        if (docId && !tr.items.some(function (i) { return i.docId === docId; })) return false;
        return transmittalAccess(uid, tr).allowed;
      }).sort(function (a, b) { return a.issuedAt < b.issuedAt ? 1 : -1; });
    }
    // Customer users who may receive a publication for this document.
    function audienceFor(d) {
      var p = idx.projects[d.projectId];
      return ds.users.filter(function (u) { var o = idx.orgs[u.orgId]; return o && o.kind === 'customer' && u.orgId === p.customerOrgId && u.status === 'active' && allowed(u.id, 'document.view', docRes(d)); });
    }
    function trAckState(uid, tr) {
      // each named recipient acknowledges for themselves; it records receipt only
      var ack = tr.acknowledgements.filter(function (a) { return a.userId === uid; })[0] || null;
      var canAck = !ack && tr.recipients.indexOf(uid) >= 0 && allowed(uid, 'document.acknowledge', { projectId: tr.projectId }) &&
        tr.items.every(function (i) { var d = idx.documents[i.docId], r = d && revOf(d, i.rev); return r && r.status === 'published'; });
      return { ack: ack, canAck: canAck };
    }
    function unregisteredUploads(uid, pid) {
      return ds.files.filter(function (f) { return f.owner && f.owner.kind === 'upload' && (!pid || f.owner.projectId === pid) && fileAccess(uid, f).allowed; });
    }
    function requirementSets() {
      var conf = DOCPOL.requirements || {};
      if (Object.keys(conf).length) return { example: false, label: null, sets: conf };
      if (ds.demoDocRequirements) return { example: true, label: ds.demoDocRequirements.label, sets: ds.demoDocRequirements.sets };
      return { example: false, label: null, sets: {} };
    }
    function requirementStatus(uid, pkgId) {
      var rs = requirementSets(), need = rs.sets[pkgId] || [];
      return need.map(function (cat) {
        var docs = ds.documents.filter(function (d) { return d.category === cat && (d.packageIds || []).indexOf(pkgId) >= 0 && docVisible(uid, d); });
        var pub = docs.filter(function (d) { return d.status === 'published'; });
        return { category: cat, met: pub.length > 0, docs: docs, inProgress: !pub.length && docs.length > 0 };
      });
    }
    // Deterministic checks. Each finding names the rule, the record and the responsible person.
    function docChecks(uid, pid) {
      var out = [], seenHash = {};
      var docs = ds.documents.filter(function (d) { return (!pid || d.projectId === pid) && docVisible(uid, d) && isStaffFor(uid, d); });
      docs.forEach(function (d) {
        var miss = [];
        if (!d.areaId) miss.push('area'); if (!d.ownerId) miss.push('owner'); if (!d.category) miss.push('category');
        if (!(d.packageIds || []).length && d.category !== 'report') miss.push('package');
        var pend = pendingRev(d);
        if (pend && pend.status === 'under_review' && !(pend.reviewers || []).length) miss.push('reviewers');
        if (pend && pend.status === 'draft' && !(pend.reviewers || []).length) miss.push('reviewers');
        if (d.audience === 'customer' && !reviewRouting(d) && pend) out.push({ check: 'routing_not_configured', doc: d, owner: d.ownerId });
        if (miss.length) out.push({ check: 'missing_metadata', doc: d, fields: miss, owner: d.ownerId || idx.projects[d.projectId].repId });
        if (pend && reviewOverdue(pend)) out.push({ check: 'overdue_review', doc: d, rev: pend.rev, due: pend.reviewDue, owner: reviewState(pend).pending[0] || d.ownerId, pending: reviewState(pend).pending });
        var pubs = d.revisions.filter(function (r) { return r.status === 'published'; });
        var ids = d.revisions.map(function (r) { return r.rev; });
        if (pubs.length > 1) out.push({ check: 'revision_conflict', doc: d, detail: 'two_published', owner: d.ownerId });
        if (new Set(ids).size !== ids.length) out.push({ check: 'revision_conflict', doc: d, detail: 'repeated_id', owner: d.ownerId });
        d.revisions.forEach(function (r) {
          var f = r.fileId && idx.files[r.fileId];
          if (f && f.sha256) { var k = f.sha256; if (seenHash[k] && seenHash[k].doc !== d.id) out.push({ check: 'duplicate_file', doc: d, rev: r.rev, other: seenHash[k], owner: d.ownerId }); else seenHash[k] = { doc: d.id, number: d.number, rev: r.rev }; }
          if (f && f.quarantined) out.push({ check: 'file_not_validated', doc: d, rev: r.rev, owner: d.ownerId });
        });
      });
      ds.packages.forEach(function (w) {
        if (pid && w.projectId !== pid) return;
        if (!allowed(uid, 'document.view.draft', { projectId: w.projectId })) return;
        var st = requirementStatus(uid, w.id), missing = st.filter(function (x) { return !x.met; });
        if (missing.length) out.push({ check: 'incomplete_set', pkg: w, missing: missing, example: requirementSets().example, owner: ds.users.filter(function (u) { return u.role === 'document_controller' && allowed(u.id, 'document.control', { projectId: w.projectId }); }).map(function (u) { return u.id; })[0] || null });
      });
      supersededRefs(uid, pid).forEach(function (x) { if (!isStaffFor(uid, x.doc)) return; out.push({ check: 'superseded_reference', doc: x.doc, link: x.link, record: x.record, flag: x.flag, closed: x.closed, owner: x.doc.ownerId }); });
      return out;
    }
    // Rule-based suggestions, labelled separately from deterministic checks. They point at possible inconsistencies only.
    var SVC_CODE = { scaffolding: 'SCF', insulation: 'INS', fireproofing: 'FPR', waterproofing: 'WPR' };
    var CAT_PREFIX = { drawing: 'DRW', method_statement: 'MS', specification: 'SPEC', material_submission: 'MAT', itp: 'ITP', report: 'RPT', handover_record: 'HO', inspection_record: 'IR', certificate: 'CERT' };
    function docSuggestions(uid, pid) {
      var out = [];
      ds.documents.forEach(function (d) {
        if ((pid && d.projectId !== pid) || !docVisible(uid, d) || !isStaffFor(uid, d)) return;
        var parts = d.number.split('-'), w = d.packageIds && d.packageIds[0] && idx.packages[d.packageIds[0]];
        if (CAT_PREFIX[d.category] && parts[0] !== CAT_PREFIX[d.category]) out.push({ rule: 'number_category', doc: d, evidence: { number: d.number, expected: CAT_PREFIX[d.category] } });
        if (w && SVC_CODE[w.service] && parts.length > 2 && ['SCF', 'INS', 'FPR', 'WPR'].indexOf(parts[2]) >= 0 && parts[2] !== SVC_CODE[w.service]) out.push({ rule: 'number_service', doc: d, evidence: { number: d.number, expected: SVC_CODE[w.service], pkg: w.code } });
        var styles = d.revisions.map(function (r) { return /^[A-Z]$/.test(r.rev) ? 'letter' : /^\d+$/.test(r.rev) ? 'number' : 'other'; });
        if (new Set(styles).size > 1) out.push({ rule: 'rev_style', doc: d, evidence: { revs: d.revisions.map(function (r) { return r.rev; }).join(', ') } });
        Object.keys(SVC_CODE).forEach(function (svc) {
          if (w && w.service !== svc && d.title.toLowerCase().indexOf(svc.slice(0, 7)) >= 0) out.push({ rule: 'title_service', doc: d, evidence: { word: svc, pkg: w.code } });
        });
      });
      return out;
    }
    function dcWorkspace(uid) {
      var docs = ds.documents.filter(function (d) { return docVisible(uid, d) && isStaffFor(uid, d); });
      var pendingReviews = [], overdue = [], awaitingPub = [], drafts = [];
      docs.forEach(function (d) {
        var p = pendingRev(d); if (!p) return;
        if (p.status === 'draft') drafts.push({ doc: d, rev: p });
        if (p.status === 'under_review') { pendingReviews.push({ doc: d, rev: p, state: reviewState(p) }); if (reviewOverdue(p)) overdue.push({ doc: d, rev: p, state: reviewState(p) }); }
        if (PUBLISHABLE.indexOf(p.status) >= 0 && d.audience === 'customer') awaitingPub.push({ doc: d, rev: p });
      });
      var checks = docChecks(uid, null);
      return { uploads: unregisteredUploads(uid, null), drafts: drafts, pendingReviews: pendingReviews, overdue: overdue, awaitingPub: awaitingPub,
        missing: checks.filter(function (c) { return c.check === 'missing_metadata'; }), superseded: checks.filter(function (c) { return c.check === 'superseded_reference'; }) };
    }
    function duplicateFiles(uid, sha, exceptFileId) {
      if (!sha) return [];
      var out = [];
      ds.documents.forEach(function (d) { d.revisions.forEach(function (r) { var f = r.fileId && idx.files[r.fileId]; if (f && f.id !== exceptFileId && f.sha256 === sha && docVisible(uid, d)) out.push({ kind: 'document', doc: d, rev: r.rev }); }); });
      ds.evidence.forEach(function (e) { var f = e.fileId && idx.files[e.fileId]; if (f && f.id !== exceptFileId && f.sha256 === sha && canSee(uid, 'evidence', e)) out.push({ kind: 'evidence', evidence: e }); });
      ds.files.forEach(function (f) { if (f.id !== exceptFileId && f.sha256 === sha && f.owner && f.owner.kind === 'upload' && fileAccess(uid, f).allowed) out.push({ kind: 'upload', file: f }); });
      return out;
    }

    // =====================================================================================
    // Stage 5: inspections, findings, corrective actions
    // =====================================================================================
    var INSPOL = POLICY.inspections || {}, FNPOL = POLICY.findings || {}, CAPOL = POLICY.corrective || {};
    function pkgRes(id) { return { packageId: id }; }
    var CA_OPEN = ['open', 'assigned', 'action_proposed', 'in_progress', 'ready_for_verification', 'returned', 'reopened'];
    function pkgOf(rec) { return idx.packages[rec.packageId]; }
    function template(id) { return idx.checklistTemplates[id] || null; }
    function activeVersion(tpl) { return (tpl.versions || []).filter(function (v) { return v.status === 'active'; }).slice(-1)[0] || null; }
    function templateFor(service) { return ds.checklistTemplates.filter(function (x) { return x.service === service; })[0] || null; }
    // Progress of the field assessment against the checklist snapshot held on the inspection.
    function fieldProgress(i) {
      var res = i.results || {}, items = i.items || [];
      var gaps = [], fails = [], assessed = 0;
      items.forEach(function (it) {
        var r = res[it.key];
        var v = r ? r.result : 'not_assessed';
        if (v !== 'not_assessed') assessed++;
        if (v === 'fail') fails.push(it.key);
        if (it.required && v === 'not_assessed') gaps.push({ key: it.key, why: 'not_assessed' });
        else if ((v === 'fail' || v === 'na' || (v === 'not_assessed' && !it.required)) && !(r && String(r.reason || '').trim())) gaps.push({ key: it.key, why: 'reason' });
      });
      return { total: items.length, assessed: assessed, gaps: gaps, fails: fails, complete: gaps.length === 0 };
    }
    function inspFindings(uid, i) { return ds.findings.filter(function (f) { return f.inspectionId === i.id && (!uid || canSee(uid, 'finding', f)); }); }
    function outstandingFindings(uid, i) { return inspFindings(uid, i).filter(function (f) { return f.status !== 'closed' && f.status !== 'cancelled'; }); }
    function inspectionCentre(uid, f) {
      f = f || {};
      var q = String(f.q || '').toLowerCase().trim();
      return ds.inspections.filter(function (i) {
        if (!canSee(uid, 'inspection', i)) return false;
        if (f.project && i.projectId !== f.project) return false;
        if (f.package && i.packageId !== f.package) return false;
        if (f.type && i.type !== f.type) return false;
        if (f.status && i.status !== f.status) return false;
        if (f.inspector && i.inspectorId !== f.inspector) return false;
        if (q && (i.ref + ' ' + i.title + ' ' + (i.scope || '')).toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).sort(function (a, b) { return a.planned < b.planned ? 1 : -1; });
    }
    // Flags for a proposed schedule: unmet prerequisites, withdrawn/superseded documents, clashes.
    function scheduleFlags(d) {
      var out = [];
      (d.prerequisites || []).forEach(function (p) { if (!p.met) out.push({ flag: 'prerequisite', text: p.text }); });
      (d.docRefs || []).forEach(function (ref) { var doc = idx.documents[ref.id]; var fl = doc && revisionFlag(doc, ref.rev); if (fl) out.push({ flag: 'document', doc: doc, rev: ref.rev, state: fl.state, current: fl.current }); });
      ds.inspections.forEach(function (i) {
        if (i.id === d.id || i.status === 'cancelled' || i.planned !== d.planned) return;
        if (d.inspectorId && i.inspectorId === d.inspectorId) out.push({ flag: 'inspector_clash', other: i });
        else if (d.areaId && i.areaId === d.areaId && i.packageId === d.packageId) out.push({ flag: 'area_clash', other: i });
      });
      return out;
    }
    function inspControls(uid, i) {
      var res = pkgRes(i.packageId), c = {};
      var staffIn = allowed(uid, 'inspection.view.internal', res);
      var recorder = allowed(uid, 'inspection.record', res) && (i.inspectorId === uid || (i.attendees || []).indexOf(uid) >= 0);
      c.field = recorder && (i.status === 'scheduled' || i.status === 'in_progress');
      var vchk = allowed(uid, 'inspection.signoff', res) ? can(uid, 'inspection.signoff', res) : can(uid, 'inspection.signoff', res);
      c.verifyCheck = vchk;
      c.selfVerify = !!(i.field && i.field.by === uid && !INSPOL.allowSelfVerification);
      c.verify = i.status === 'awaiting_review' && vchk.allowed && !c.selfVerify;
      c.returnField = c.verify;
      c.witness = isCustomer(uid) && (i.attendees || []).indexOf(uid) >= 0 && allowed(uid, 'inspection.witness', res) && i.status !== 'scheduled' && i.status !== 'cancelled' && !(i.witnesses || []).some(function (w) { return w.by === uid && w.rev === i.rev; });
      c.publish = staffIn && allowed(uid, 'inspection.publish', res) && !i.publishedAt;
      c.amend = staffIn && allowed(uid, 'inspection.amend', res) && i.status === 'completed';
      c.raiseFinding = staffIn && allowed(uid, 'finding.raise', res);
      c.cancel = staffIn && allowed(uid, 'inspection.schedule', res) && (i.status === 'scheduled' || i.status === 'in_progress');
      return c;
    }
    function findingsList(uid, f) {
      f = f || {};
      return ds.findings.filter(function (x) {
        if (!canSee(uid, 'finding', x)) return false;
        if (f.project && x.projectId !== f.project) return false;
        if (f.classification && x.classification !== f.classification) return false;
        if (f.severity && x.severity !== f.severity) return false;
        if (f.status === 'open' && (x.status === 'closed' || x.status === 'cancelled')) return false;
        if (f.status && f.status !== 'open' && f.status !== 'all' && x.status !== f.status) return false;
        return true;
      }).sort(function (a, b) { return a.raisedAt < b.raisedAt ? 1 : -1; });
    }
    function caOverdue(c) { return CA_OPEN.indexOf(c.status) >= 0 && c.due && c.due < today; }
    function caControls(uid, c) {
      var res = pkgRes(c.packageId), out = {};
      var owner = c.ownerId === uid && allowed(uid, 'corrective.respond', res);
      var mgr = allowed(uid, 'corrective.manage', res);
      out.assign = mgr && (c.status === 'open' || c.status === 'reopened' || c.status === 'returned' || c.status === 'assigned');
      out.propose = owner && ['assigned', 'returned', 'reopened'].indexOf(c.status) >= 0;
      out.start = owner && ['assigned', 'action_proposed', 'returned', 'reopened'].indexOf(c.status) >= 0;
      out.complete = owner && c.status === 'in_progress';
      var vchk = can(uid, 'corrective.close', res);
      out.verifyCheck = vchk;
      out.selfVerify = c.ownerId === uid && !CAPOL.allowSelfVerification;
      var rein = c.reinspectionId && idx.inspections[c.reinspectionId];
      out.reinspectionPending = !!(rein && rein.status !== 'completed');
      out.verify = c.status === 'ready_for_verification' && vchk.allowed && !out.selfVerify && !out.reinspectionPending;
      out.reinspect = mgr && c.status === 'ready_for_verification' && !c.reinspectionId;
      out.cancel = mgr && CA_OPEN.indexOf(c.status) >= 0;
      out.reopen = mgr && c.status === 'closed';
      return out;
    }
    function correctiveList(uid, f) {
      f = f || {};
      return ds.correctiveActions.filter(function (c) {
        if (!canSee(uid, 'corrective', c)) return false;
        if (f.project && c.projectId !== f.project) return false;
        if (f.status === 'open' && CA_OPEN.indexOf(c.status) < 0) return false;
        if (f.status === 'overdue' && !caOverdue(c)) return false;
        if (f.status && ['open', 'overdue', 'all'].indexOf(f.status) < 0 && c.status !== f.status) return false;
        if (f.mine && c.ownerId !== uid && c.verifierId !== uid) return false;
        return true;
      }).sort(function (a, b) { return (a.due || '9') < (b.due || '9') ? -1 : 1; });
    }
    // The chain: original inspection → finding → corrective action → reinspection → verification.
    function chainFor(uid, kind, id) {
      var root = null;
      if (kind === 'inspection') { var i0 = idx.inspections[id]; root = i0 && i0.reinspectionOf ? idx.inspections[i0.reinspectionOf] : i0; }
      if (kind === 'finding') { var f0 = idx.findings[id]; root = f0 && f0.inspectionId ? idx.inspections[f0.inspectionId] : null; if (!root && f0) return { root: null, findings: [chainFinding(uid, f0)] }; }
      if (kind === 'corrective') { var c0 = idx.correctiveActions[id], fx = c0 && idx.findings[c0.findingId]; return chainFor(uid, 'finding', fx ? fx.id : null); }
      if (!root) return { root: null, findings: [] };
      return { root: root, findings: ds.findings.filter(function (f) { return f.inspectionId === root.id; }).map(function (f) { return chainFinding(uid, f); }) };
    }
    function chainFinding(uid, f) {
      return { finding: f, visible: canSee(uid, 'finding', f), actions: (f.correctiveActionIds || []).map(function (cid) {
        var c = idx.correctiveActions[cid]; if (!c) return null;
        var rein = c.reinspectionId && idx.inspections[c.reinspectionId];
        return { action: c, visible: canSee(uid, 'corrective', c), reinspection: rein || null, reinspectionVisible: rein ? canSee(uid, 'inspection', rein) : false };
      }).filter(Boolean) };
    }
    function qaWorkspace(uid) {
      var soon = new Date(today); soon.setDate(soon.getDate() + 7); soon = soon.toISOString().slice(0, 10);
      var insp = inspectionCentre(uid, {});
      return {
        upcoming: insp.filter(function (i) { return (i.status === 'scheduled' || i.status === 'in_progress') && i.planned <= soon; }),
        pending: insp.filter(function (i) { return i.status === 'awaiting_review'; }),
        ncrs: findingsList(uid, { status: 'open' }).filter(function (f) { return f.classification === 'nonconformance'; }),
        overdueCa: correctiveList(uid, { status: 'overdue' }),
        verify: correctiveList(uid, { status: 'ready_for_verification' }),
        reinspections: insp.filter(function (i) { return i.type === 'reinspection' && i.status !== 'completed'; })
      };
    }
    function hseWorkspace(uid) {
      var mine = findingsList(uid, { status: 'open' }).filter(function (f) { return f.classification === 'hse_concern' || f.raisedBy === uid; });
      var urgent = mine.filter(function (f) { return f.classification === 'hse_concern' && (f.severity === 'high' || f.severity === 'critical'); });
      var stop = ds.authorities.filter(function (d) { return d.userId === uid && (d.action === 'hse.stopwork' || d.action === 'hse.release') && d.status === 'active' && !d.revokedAt; });
      return { assigned: mine, urgent: urgent, containment: mine.filter(function (f) { return !String(f.containment || '').trim(); }),
        escalations: mine.filter(function (f) { return (f.escalations || []).length; }), stopAuthorities: stop, escalationRules: FNPOL.escalation || {} };
    }
    // Rule-based assistance. It points at records; it never decides acceptance, release or closure.
    function aiQuality(uid, pid) {
      var fl = findingsList(uid, { project: pid || '' });
      var byClass = {}; fl.forEach(function (f) { if (f.status !== 'closed' && f.status !== 'cancelled') byClass[f.classification] = (byClass[f.classification] || 0) + 1; });
      var missing = [];
      inspectionCentre(uid, { project: pid || '' }).forEach(function (i) {
        (i.items || []).forEach(function (it) { var r = (i.results || {})[it.key]; if (r && r.result === 'fail' && !(r.evidence || []).length) missing.push({ kind: 'inspection', rec: i, item: it.key }); });
      });
      fl.forEach(function (f) { if (!(f.evidence || []).length) missing.push({ kind: 'finding', rec: f }); });
      correctiveList(uid, { project: pid || '' }).forEach(function (c) { if (c.status === 'ready_for_verification' && !(c.completion && (c.completion.evidence || []).length)) missing.push({ kind: 'corrective', rec: c }); });
      var recurring = [], seen = {};
      fl.forEach(function (a) { fl.forEach(function (b) {
        if (a.id >= b.id || a.areaId !== b.areaId) return;
        var shared = tokens(a.description).filter(function (w) { return tokens(b.description).indexOf(w) >= 0; });
        var k = a.areaId; if (!seen[k]) { seen[k] = { area: a.areaId, findings: [] }; recurring.push(seen[k]); }
        [a, b].forEach(function (x) { if (seen[k].findings.indexOf(x) < 0) seen[k].findings.push(x); });
        if (shared.length) seen[k].words = shared;
      }); });
      return { byClass: byClass, missing: missing, recurring: recurring.filter(function (r) { return r.findings.length > 1; }) };
    }
    function caSuggestion(f) {
      // a starting text only; a person edits and confirms it before anything is saved
      return { containment: f.containment || '', actionPlan: 'Correct: ' + f.description.replace(/\.$/, '') + '. Show completion with photos against ' + (f.inspectionId ? (idx.inspections[f.inspectionId] || {}).ref : 'the finding') + '.', basis: [f.ref].concat(f.inspectionId ? [(idx.inspections[f.inspectionId] || {}).ref] : []) };
    }
    function witnessAppointments(uid) { return ds.inspections.filter(function (i) { return (i.attendees || []).indexOf(uid) >= 0 && (i.status === 'scheduled' || i.status === 'in_progress') && canSee(uid, 'inspection', i); }); }

    // Who must act next on a request, derived from its status (never stored).
    function nextAction(r) {
      var p = idx.projects[r.projectId], ins = r.instructionId ? idx.changes[r.instructionId] : null;
      switch (r.status) {
        case 'draft': return { key: 'next.draft', who: r.raisedBy, party: 'customer' };
        case 'submitted': return { key: 'next.triage', who: p ? p.repId : null, party: 'rgs' };
        case 'clarification_requested': return { key: 'next.clarify', who: r.raisedBy, party: 'customer' };
        case 'in_review':
          if (ins && ['closed', 'rejected', 'cancelled', 'superseded'].indexOf(ins.state) < 0) return { key: 'next.instruction', who: ins.issuerId, party: 'rgs', ref: ins.ref, due: r.responseDue };
          return { key: 'next.respond', who: r.ownerId, party: 'rgs', due: r.responseDue };
        case 'completion_submitted': return { key: 'next.verify', who: r.verifierId, party: 'rgs' };
        case 'resolved': return { key: 'next.ack', who: r.raisedBy, party: 'customer' };
        default: return { key: 'next.none', who: null, party: null };
      }
    }
    function requestCan(uid, r, action) { return can(uid, action, reqRes(r)); }
    // Every button on the request page is decided here, so pages and commands agree.
    function requestControls(uid, r) {
      var cust = isCustomer(uid), s = r.status, owner = r.ownerId === uid;
      var c = function (a) { return requestCan(uid, r, a).allowed; };
      var open = OPEN_REQ.indexOf(s) >= 0;
      return {
        edit: cust && c('request.edit') && ['submitted', 'clarification_requested', 'in_review'].indexOf(s) >= 0,
        message: open && (cust ? c('request.create') : c('request.respond') || c('request.triage')),
        note: !cust && c('request.note.write') && s !== 'draft',
        triage: !cust && c('request.triage') && ['submitted', 'in_review', 'clarification_requested'].indexOf(s) >= 0,
        clarify: !cust && c('request.triage') && ['submitted', 'in_review'].indexOf(s) >= 0,
        escalate: !cust && (c('request.triage') || owner) && open && s !== 'resolved',
        complete: !cust && s === 'in_review' && (owner || c('request.triage')) && c('request.respond') && !(r.instructionId && idx.changes[r.instructionId] && ['closed', 'rejected', 'cancelled', 'superseded'].indexOf(idx.changes[r.instructionId].state) < 0),
        verify: !cust && s === 'completion_submitted' && r.verifierId === uid && c('request.verify') && !(r.completion && r.completion.by === uid),
        acknowledge: cust && s === 'resolved' && c('request.acknowledge'),
        reopen: (cust ? c('request.acknowledge') : c('request.triage')) && (s === 'resolved' || s === 'closed'),
        cancel: (cust ? (r.raisedBy === uid || c('request.edit')) && c('request.cancel') : c('request.cancel')) && ['submitted', 'clarification_requested', 'in_review'].indexOf(s) >= 0,
        link: !cust && c('request.triage') && s !== 'draft',
        createInstruction: !cust && c('instruction.create') && s === 'in_review' && !r.instructionId
      };
    }
    function requests(uid, pid, pkgId) { return listVisible(uid, 'requests', 'request', pid, function (r) { return (!pkgId || r.packageId === pkgId) && r.status !== 'draft' && r.status !== 'withdrawn'; }); }
    function drafts(uid) { return ds.requests.filter(function (r) { return r.status === 'draft' && r.raisedBy === uid; }).sort(function (a, b) { return (a.updatedAt || a.raisedAt) < (b.updatedAt || b.raisedAt) ? 1 : -1; }); }
    // Search covers subject, description and the customer-visible conversation only — never internal notes.
    function searchText(r) { return [r.ref, r.subject, r.description].concat((r.messages || []).map(function (m) { return m.text; })).join(' ').toLowerCase(); }
    function requestCentre(uid, f) {
      f = f || {};
      var q = (f.q || '').trim().toLowerCase();
      return requests(uid).filter(function (r) {
        if (q && searchText(r).indexOf(q) < 0) return false;
        if (f.project && r.projectId !== f.project) return false;
        if (f.package && r.packageId !== f.package) return false;
        if (f.type && r.type !== f.type) return false;
        if (f.priority && r.priority !== f.priority) return false;
        if (f.status === 'open' && OPEN_REQ.indexOf(r.status) < 0) return false;
        if (f.status === 'mine_action' && nextAction(r).who !== uid && !(nextAction(r).party === 'customer' && isCustomer(uid))) return false;
        if (f.status && ['open', 'all', 'mine_action'].indexOf(f.status) < 0 && r.status !== f.status) return false;
        if (f.owner && r.ownerId !== f.owner) return false;
        return true;
      }).sort(function (a, b) { return (a.updatedAt || a.raisedAt) < (b.updatedAt || b.raisedAt) ? 1 : -1; });
    }
    function notesFor(uid, r) {
      if (!r || !requestCan(uid, r, 'request.note.view').allowed) return [];
      return ds.requestNotes.filter(function (n) { return n.requestId === r.id; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    }
    function filesFor(uid, ids) { return (ids || []).map(function (id) { return idx.files[id]; }).filter(function (f) { return f && fileAccess(uid, f).allowed; }); }

    // ---------- Possible duplicates (rule-based, explainable; never merges or rejects) ----------
    var STOP = ('the a an and or of to for in on at is are be with from by this that please our we you it as can after before near side need needs ' +
      'new will would which what when where who used use there have has been more any all also into than then them they their about could should just only same some such very want like make made one two ' +
      'من في على إلى عن مع هذا هذه التي الذي أن هو هي تم يرجى').split(' ');
    function tokens(txt) { return Array.from(new Set(String(txt || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }))); }
    function duplicateCandidates(uid, d) {
      if (!d || !d.projectId) return [];
      var pkg = d.packageId && idx.packages[d.packageId];
      // Words that only name the location are scored as location, not as matching content.
      var locWords = [];
      [d.areaId, pkg && pkg.areaId].forEach(function (aid) { var a = aid && idx.areas[aid]; while (a) { locWords = locWords.concat(tokens([a.code, a.name, a.nameAr].join(' '))); a = a.parentId && idx.areas[a.parentId]; } });
      var tA = tokens((d.subject || '') + ' ' + (d.description || '')).filter(function (w) { return locWords.indexOf(w) < 0; });
      return requests(uid, d.projectId).filter(function (r) { return r.id !== d.id; }).map(function (r) {
        var reasons = [], score = 0, rp = r.packageId && idx.packages[r.packageId];
        if (d.packageId && r.packageId === d.packageId) { score += 3; reasons.push({ key: 'dup.samePackage', v: rp.code }); }
        else if (pkg && rp && rp.service === pkg.service) { score += 1; reasons.push({ key: 'dup.sameService', v: pkg.service }); }
        if (d.areaId && r.areaId === d.areaId) { score += 2; var ar = idx.areas[r.areaId]; reasons.push({ key: 'dup.sameArea', v: ar ? ar.code : '' }); }
        if (d.type && r.type === d.type) { score += 1; reasons.push({ key: 'dup.sameType', v: r.type }); }
        var tB = tokens(searchText(r)).filter(function (w) { return locWords.indexOf(w) < 0; }), shared = tA.filter(function (w) { return tB.indexOf(w) >= 0; });
        var jac = tA.length ? shared.length / (new Set(tA.concat(tB))).size : 0;
        score += Math.round(jac * 6 * 10) / 10;
        if (shared.length) reasons.push({ key: 'dup.words', v: shared.slice(0, 6).join(', ') });
        return { request: r, score: score, shared: shared, jac: jac, reasons: reasons };
      }).filter(function (c) { return c.score >= 4 && (c.shared.length >= 2 || (c.shared.length === 1 && c.jac >= 0.15)); }).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    }
    function exactDuplicate(d) {
      var norm = function (x) { return String(x || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
      return ds.requests.filter(function (r) {
        return r.id !== d.id && r.raisedBy === d.raisedBy && r.projectId === d.projectId && r.packageId === d.packageId && r.type === d.type &&
          OPEN_REQ.indexOf(r.status) >= 0 && norm(r.subject) === norm(d.subject) && norm(r.description) === norm(d.description);
      })[0] || null;
    }

    // ---------- Instructions ----------
    function validDecision(ins, type) {
      return (ins.decisions || []).filter(function (d) { return d.type === type && d.rev === ins.approvalRev && d.status === 'valid' && d.outcome === 'approve'; })[0] || null;
    }
    function pendingDecisions(ins) {
      if (!ins || ins.supersededBy) return [];
      if (ins.state === 'under_review') return ['internal_review'];
      if (ins.state === 'awaiting_approval') {
        if (ins.requiresCustomerApproval && !validDecision(ins, 'customer_approval')) return ['customer_approval'];
        if (!validDecision(ins, 'execution_authorisation')) return ['execution_authorisation'];
        return [];
      }
      if (ins.state === 'ready_for_verification') {
        if (!validDecision(ins, 'technical_signoff')) return ['technical_signoff'];
        if (!validDecision(ins, 'completion_acceptance')) return ['completion_acceptance'];
      }
      return [];
    }
    // Authority is checked for EVERY package the instruction touches, at the time of the decision.
    function decisionCheck(uid, ins, type) {
      if (!ins) return { allowed: false, code: 'not_found', trace: ['Instruction not found'] };
      var perm = DECISION_PERMISSION[type];
      if (!perm) return { allowed: false, code: 'unknown_action', trace: [] };
      var res = null, trace = [];
      var pk = ins.packageIds && ins.packageIds.length ? ins.packageIds : [null];
      for (var i = 0; i < pk.length; i++) {
        res = can(uid, perm, pk[i] ? { packageId: pk[i] } : { projectId: ins.projectId });
        if (!res.allowed) return res;
        trace = res.trace;
      }
      if (!POLICY.allowSelfApproval) {
        if ((type === 'internal_review' || type === 'execution_authorisation') && ins.issuerId === uid)
          return { allowed: false, code: 'self_approval', trace: trace.concat('You issued this instruction') };
        if (type === 'technical_signoff' && ins.completion && ins.completion.by === uid)
          return { allowed: false, code: 'self_approval', trace: trace.concat('You submitted the completion evidence') };
      }
      return res;
    }
    function instructionView(uid, ins) {
      var pend = pendingDecisions(ins);
      return { ins: ins, pending: pend.map(function (t) { return { type: t, check: decisionCheck(uid, ins, t), permission: DECISION_PERMISSION[t] }; }),
        decisions: (ins.decisions || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; }) };
    }
    function instructions(uid, pid) { return listVisible(uid, 'changes', 'change', pid).sort(function (a, b) { return a.raisedAt < b.raisedAt ? 1 : -1; }); }
    // Customer decisions on instructions appear alongside Stage 2 customer actions.
    function virtualActions() {
      var out = [];
      ds.changes.forEach(function (ins) {
        CUSTOMER_DECISIONS.forEach(function (type) {
          var done = (ins.decisions || []).filter(function (d) { return d.type === type && d.rev === ins.approvalRev && d.status === 'valid'; })[0];
          var pending = pendingDecisions(ins).indexOf(type) >= 0;
          if (!pending && !done) return;
          out.push({ id: 'DEC-' + ins.id + '-' + type, type: type === 'customer_approval' ? 'change_approval' : 'customer_acceptance', source: 'instruction', decisionType: type,
            projectId: ins.projectId, packageId: ins.packageIds[0] || null, record: { kind: 'change', id: ins.id }, assigneeId: null,
            due: ins.approvalDue, doneAt: done ? done.at : null, doneBy: done ? done.by : null });
        });
      });
      return out;
    }

    // ---------- Approval inbox ----------
    // Everything the user is asked to decide, with whether they may decide it now.
    function inbox(uid) {
      var u = user(uid); if (!u) return [];
      var items = [], cust = isCustomer(uid);
      instructions(uid).forEach(function (ins) {
        pendingDecisions(ins).forEach(function (type) {
          if (cust !== (CUSTOMER_DECISIONS.indexOf(type) >= 0)) return;
          var chk = decisionCheck(uid, ins, type);
          var eligibleRole = U_ELIGIBLE(uid, DECISION_PERMISSION[type]);
          if (!cust && !eligibleRole) return;
          items.push({ kind: 'instruction', type: type, record: ins, check: chk, due: ins.approvalDue, route: 'decision.chg.' + ins.id + '.' + type });
        });
      });
      if (cust) openActions(actionsFor(uid)).filter(function (v) { return v.action.source !== 'instruction'; }).forEach(function (v) {
        items.push({ kind: 'action', type: v.action.type, record: v.record, recordKind: v.recordKind, action: v.action, check: v.can, due: v.action.due, route: 'decision.act.' + v.action.id });
      });
      requests(uid).forEach(function (r) {
        if (r.status === 'completion_submitted' && r.verifierId === uid) items.push({ kind: 'request', type: 'request_verify', record: r, check: requestCan(uid, r, 'request.verify'), due: r.responseDue, route: 'req.' + r.id });
        if (cust && r.status === 'resolved' && idx.projects[r.projectId].customerOrgId === u.orgId) items.push({ kind: 'request', type: 'request_ack', record: r, check: requestCan(uid, r, 'request.acknowledge'), due: null, route: 'req.' + r.id });
      });
      // customer reviewers (only where customer review is configured) see their document reviews here too
      if (cust) myReviews(uid).filter(function (x) { return x.mine; }).forEach(function (x) {
        items.push({ kind: 'document', type: 'doc_review', record: x.doc, recordKind: 'document', check: { allowed: true, code: 'ok' }, due: x.rev.reviewDue, route: 'doc.' + x.doc.id + '.' + x.rev.rev + '.review' });
      });
      return items.sort(function (a, b) { return (a.due || '9') < (b.due || '9') ? -1 : 1; });
    }
    function U_ELIGIBLE(uid, perm) {
      return ds.assignments.some(function (a) { var R = A.ROLES[a.role]; return a.userId === uid && R && (R.eligible.indexOf(perm) >= 0 || R.grants.indexOf(perm) >= 0); });
    }
    function notifications(uid) { return ds.notifications.filter(function (n) { return n.userId === uid; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }); }
    function unread(uid) { return notifications(uid).filter(function (n) { return !n.read; }).length; }
    // AI context: only what this user may read. Internal notes are included only for users allowed to see them.
    function aiContext(uid, r) {
      if (!canSee(uid, 'request', r)) return null;
      var notes = notesFor(uid, r).map(function (n) { return { by: (user(n.by) || {}).name, at: n.at, text: n.text, internal: true }; });
      return { ref: r.ref, type: r.type, subject: r.subject, description: r.description, status: r.status,
        messages: (r.messages || []).map(function (m) { return { by: (user(m.by) || {}).name, at: m.at, text: m.text }; }), internalNotes: notes };
    }
    function authorityFor(uid, perm, res) {
      var c = can(uid, perm, res);
      var auth = c.authority ? ds.authorities.filter(function (d) { return d.id === c.authority; })[0] : null;
      return { check: c, authority: auth, audit: auth ? ds.audit.filter(function (e) { return e.record && e.record.kind === 'authority' && e.record.id === auth.id; }) : [] };
    }

    // =====================================================================================
    // Stage 6: daily updates, milestones, commitments, dependencies, reports, handover, release, oversight
    // =====================================================================================
    function staffIn(uid, res) { return !isCustomer(uid) && allowed(uid, 'project.view', res); }
    function pkgR(id) { return { packageId: id }; }
    function nameOf(uid) { var x = user(uid); return x ? x.name : ''; }

    // ---------- daily updates ----------
    function dupReviewer(wpId, authorId) {
      var w = idx.packages[wpId]; if (!w) return null;
      var sup = w.supervisorId;
      if (sup && sup !== authorId && allowed(sup, 'progress.review', pkgR(wpId))) return sup;
      var p = idx.projects[w.projectId];
      return p && p.repId !== authorId ? p.repId : null;
    }
    function dailyUpdateAccess(uid, d) {
      var c = can(uid, 'package.view', pkgR(d.packageId));
      if (!c.allowed) return c;
      if (d.status === 'draft' && d.authorId !== uid) return { allowed: false, code: 'private_draft', trace: c.trace.concat('Draft visible to its author only') };
      if (d.status === 'published') return c;
      if (isCustomer(uid)) return { allowed: false, code: 'internal_record', trace: c.trace.concat('Daily update not yet published to the customer') };
      return c;
    }
    function dupControls(uid, d) {
      var res = pkgR(d.packageId), mine = d.authorId === uid;
      return {
        edit: mine && (d.status === 'draft' || d.status === 'returned') && allowed(uid, 'progress.report', res),
        submit: mine && (d.status === 'draft' || d.status === 'returned') && allowed(uid, 'progress.report', res),
        review: d.status === 'submitted' && d.reviewerId === uid && !mine && allowed(uid, 'progress.review', res),
        reviewBlocked: d.status === 'submitted' && !(d.reviewerId === uid && !mine) ? (mine ? 'self_approval' : 'not_reviewer') : null,
        publish: d.status === 'approved' && allowed(uid, 'progress.publish', res)
      };
    }
    function dailyUpdatesList(uid, f) {
      f = f || {};
      return (ds.dailyUpdates || []).filter(function (d) {
        if (f.project && d.projectId !== f.project) return false;
        if (f.package && d.packageId !== f.package) return false;
        if (f.status && d.status !== f.status) return false;
        if (f.mine && d.authorId !== uid && d.reviewerId !== uid) return false;
        return canSee(uid, 'dailyupdate', d);
      }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.ref < b.ref ? 1 : -1); });
    }
    // ---------- milestones ----------
    function msControls(uid, m) {
      var res = pkgR(m.packageId);
      return {
        verify: !!m.reported && !m.completedAt && allowed(uid, 'progress.verify', res) && m.reported.by !== uid,
        verifySelf: !!m.reported && !m.completedAt && m.reported.by === uid,
        forecast: !m.completedAt && (allowed(uid, 'progress.review', res) || allowed(uid, 'progress.baseline', res)),
        rebaseline: allowed(uid, 'progress.baseline', res),
        report: !m.completedAt && !m.reported && allowed(uid, 'progress.report', res)
      };
    }

    // ---------- commitments ----------
    function sourceRec(src) { return src ? get(src.kind, src.id) : null; }
    function commitmentForSource(src) {
      if (!src) return null;
      return ds.commitments.filter(function (c) { return c.source && c.source.kind === src.kind && c.source.id === src.id && !c.doneAt && c.status !== 'cancelled'; })[0] || null;
    }
    function commitmentRegister(uid, f) {
      f = f || {};
      var q = String(f.q || '').toLowerCase().trim();
      return ds.commitments.filter(function (c) {
        if (!canSee(uid, 'commitment', c)) return false;
        if (f.project && c.projectId !== f.project) return false;
        if (f.party && c.party !== f.party) return false;
        if (f.source && (!c.source || c.source.kind !== f.source)) return false;
        var st = commitmentStatus(c);
        if (f.status === 'open' && st === 'complete') return false;
        if (f.status && f.status !== 'open' && f.status !== st) return false;
        if (f.mine && c.ownerId !== uid) return false;
        if (q && [c.ref, c.text, c.textAr, c.blocker, c.next].join(' ').toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).sort(function (a, b) { return dueOf(a) < dueOf(b) ? -1 : dueOf(a) > dueOf(b) ? 1 : 0; });
    }
    function cmControls(uid, c) {
      var res = c.packageId ? pkgR(c.packageId) : { projectId: c.projectId }, manage = !isCustomer(uid) && allowed(uid, 'commitment.manage', res);
      var open = !c.doneAt && c.status !== 'cancelled';
      return { reschedule: manage && open, update: open && (manage || (!isCustomer(uid) && c.ownerId === uid)), complete: open && (manage || (!isCustomer(uid) && c.ownerId === uid)), manage: manage };
    }

    // ---------- dependencies ----------
    function depNode(ref) {
      if (!ref) return null;
      if (ref.kind === 'milestone') {
        var m = idx.milestones[ref.id]; if (!m) return null;
        return { kind: 'milestone', id: m.id, rec: m, packageId: m.packageId, forecast: m.completedAt || m.forecast, done: !!m.completedAt };
      }
      if (ref.kind === 'package') {
        var w = idx.packages[ref.id]; if (!w) return null;
        var ms = pkgMilestones(w.id);
        return { kind: 'package', id: w.id, rec: w, packageId: w.id, forecast: ms.map(function (m) { return m.completedAt || m.forecast; }).sort().pop() || null, done: ms.length > 0 && ms.every(function (m) { return m.completedAt; }) };
      }
      return null;
    }
    // Deterministic rules: overdue when the resolution target has passed and the dependency is still open;
    // sequence conflict when the predecessor's forecast is later than the dependent's forecast. No schedule impact.
    function depState(d) {
      var pr = depNode(d.predecessor), de = depNode(d.dependent), flags = [];
      if (d.status === 'resolved' || d.status === 'cancelled') return { state: d.status, flags: [], pred: pr, dep: de };
      if (d.resolutionTarget && d.resolutionTarget < today) flags.push('overdue');
      if ((POLICY.dependencies || {}).flagSequenceConflict !== false && pr && de && !pr.done && pr.forecast && de.forecast && pr.forecast > de.forecast) flags.push('sequence_conflict');
      var state = flags.indexOf('overdue') >= 0 ? 'overdue' : pr && pr.done ? 'satisfied' : 'open';
      return { state: state, flags: flags, pred: pr, dep: de };
    }
    function nodeKey(ref) { return ref.kind + ':' + ref.id; }
    // Would adding predecessor -> dependent close a loop? Same node or a milestone inside the other package also counts.
    function dependencyProblem(pred, dep, exceptId) {
      var a = depNode(pred), b = depNode(dep);
      if (!a || !b) return 'not_found';
      if (nodeKey(pred) === nodeKey(dep)) return 'self_dependency';
      if ((a.kind === 'package' && b.packageId === a.id) || (b.kind === 'package' && a.packageId === b.id)) return 'self_dependency';
      var edges = {};
      (ds.dependencies || []).forEach(function (d) { if (d.id === exceptId || d.status === 'cancelled') return; (edges[nodeKey(d.predecessor)] = edges[nodeKey(d.predecessor)] || []).push(nodeKey(d.dependent)); });
      // walking from the new dependent: if we can reach the new predecessor, the new edge would create a cycle
      var target = nodeKey(pred), seen = {}, stack = [nodeKey(dep)];
      while (stack.length) {
        var k = stack.pop(); if (k === target) return 'circular_dependency';
        if (seen[k]) continue; seen[k] = 1;
        (edges[k] || []).forEach(function (n) { stack.push(n); });
      }
      return null;
    }
    function dependencyList(uid, f) {
      f = f || {};
      return (ds.dependencies || []).filter(function (d) {
        if (f.project && d.projectId !== f.project) return false;
        if (!canSee(uid, 'dependency', d)) return false;
        var s = depState(d).state;
        if (f.status === 'open' && (s === 'resolved' || s === 'cancelled')) return false;
        if (f.status === 'overdue' && s !== 'overdue') return false;
        return true;
      });
    }

    // ---------- handover readiness ----------
    function handoverSetting() {
      var conf = (POLICY.handover || {}).requirements || {};
      if (Object.keys(conf).length) return { example: false, label: null, packages: conf };
      if (ds.demoHandoverRequirements) return { example: true, label: ds.demoHandoverRequirements.label, packages: ds.demoHandoverRequirements.packages };
      return { example: false, label: null, packages: {} };
    }
    function releaseSetting() {
      var conf = (POLICY.release || {}).prerequisites || {};
      if (Object.keys(conf).length) return { example: false, label: null, packages: conf };
      if (ds.demoReleasePrerequisites) return { example: true, label: ds.demoReleasePrerequisites.label, packages: ds.demoReleasePrerequisites.packages };
      return { example: false, label: null, packages: {} };
    }
    function verifiedInspection(i) { return i.status === 'completed' && i.verification && i.verification.outcome !== 'rejected' && (i.verification.rev == null || i.verification.rev === i.rev); }
    function hpVersions(wpId) { return (ds.handoverPackages || []).filter(function (h) { return h.packageId === wpId; }).sort(function (a, b) { return (a.pkgVersion || 1) - (b.pkgVersion || 1); }); }
    function hpCurrentIssued(wpId) { return hpVersions(wpId).filter(function (h) { return h.status === 'issued'; }).slice(-1)[0] || null; }
    function pendingCustomerDecisions(wpId) {
      var out = [];
      ds.actions.forEach(function (a) { if (a.packageId === wpId && !a.doneAt && a.type !== 'customer_acceptance') out.push({ kind: 'action', id: a.id, rec: a, recKind: a.record.kind, recId: a.record.id }); });
      ds.changes.forEach(function (ch) {
        if ((ch.packageIds || []).indexOf(wpId) < 0) return;
        if (pendingDecisions(ch).some(function (t) { return CUSTOMER_DECISIONS.indexOf(t) >= 0; })) out.push({ kind: 'change', id: ch.id, rec: ch });
      });
      return out;
    }
    function readiness(uid, wpId) {
      var reqs = handoverSetting().packages[wpId] || [], w = idx.packages[wpId];
      var base = { pkg: w, configured: reqs.length > 0, example: handoverSetting().example, label: handoverSetting().label, items: [], met: 0, total: reqs.length, pct: null, blockers: [], state: 'not_configured' };
      if (!reqs.length) return base;
      function vis(kind, rec) { return !uid || canSee(uid, kind, rec); }
      function refsOf(list) { var shown = [], hidden = 0; list.forEach(function (r) { if (vis(r.kind, r.rec)) shown.push({ kind: r.kind, id: r.id, rev: r.rev }); else hidden++; }); return { refs: shown, hidden: hidden }; }
      reqs.forEach(function (rq, n) {
        var item = { key: rq.type + '-' + n, type: rq.type, req: rq, status: 'missing', refs: [], hidden: 0 }, list = [];
        if (rq.type === 'document') {
          list = ds.documents.filter(function (d) { return d.category === rq.category && (d.packageIds || []).indexOf(wpId) >= 0 && d.status === 'published'; })
            .map(function (d) { return { kind: 'document', id: d.id, rec: d, rev: pubRev(d).rev }; });
          item.status = list.length ? 'met' : 'missing';
        } else if (rq.type === 'inspection') {
          list = ds.inspections.filter(function (i) { return i.packageId === wpId && (!rq.inspectionType || i.type === rq.inspectionType) && verifiedInspection(i); })
            .map(function (i) { return { kind: 'inspection', id: i.id, rec: i, rev: i.rev }; });
          item.status = list.length ? 'met' : 'missing';
        } else if (rq.type === 'no_blocking_findings') {
          list = ds.findings.filter(function (f) { return f.packageId === wpId && f.status !== 'closed' && f.status !== 'cancelled' && (rq.classifications || []).indexOf(f.classification) >= 0; })
            .map(function (f) { return { kind: 'finding', id: f.id, rec: f }; });
          item.status = list.length ? 'blocking' : 'met';
        } else if (rq.type === 'no_open_corrective') {
          list = ds.correctiveActions.filter(function (c) { return c.packageId === wpId && openCorrective(c); }).map(function (c) { return { kind: 'corrective', id: c.id, rec: c }; });
          item.status = list.length ? 'blocking' : 'met';
        } else if (rq.type === 'customer_decisions') {
          list = pendingCustomerDecisions(wpId).map(function (x) { return x.kind === 'action' ? { kind: x.recKind, id: x.recId, rec: get(x.recKind, x.recId) || x.rec } : { kind: 'change', id: x.id, rec: x.rec }; });
          item.status = list.length ? 'blocking' : 'met';
        } else if (rq.type === 'completion_evidence') {
          var excl = rq.excludeMilestones || [];
          var lacking = pkgMilestones(wpId).filter(function (m) { return excl.indexOf(m.id) < 0 && (!m.completedAt || !(m.evidence || []).length); });
          list = lacking.map(function (m) { return { kind: 'milestone', id: m.id, rec: m }; });
          item.status = lacking.length ? 'missing' : 'met';
        } else if (rq.type === 'acceptance') {
          var hp = hpCurrentIssued(wpId);
          item.status = hp && hp.acceptance ? 'met' : 'missing';
          list = hp ? [{ kind: 'handoverpkg', id: hp.id, rec: hp }] : [];
        }
        var r = refsOf(list); item.refs = r.refs; item.hidden = r.hidden;
        base.items.push(item);
      });
      base.met = base.items.filter(function (i) { return i.status === 'met'; }).length;
      base.pct = Math.round(base.met / base.total * 100);
      base.blockers = base.items.filter(function (i) { return i.status === 'blocking'; });
      // A blocker always wins over the percentage.
      base.state = base.blockers.length ? 'blocked' : base.met === base.total ? 'ready' : 'incomplete';
      return base;
    }
    function handoverDashboard(uid, f) {
      f = f || {};
      var rows = [];
      visibleProjects(uid).forEach(function (p) {
        if (f.project && p.id !== f.project) return;
        visiblePackages(uid, p.id).forEach(function (w) {
          if (!allowed(uid, 'handover.view', pkgR(w.id))) return;
          if (f.area && w.areaId !== f.area) return;
          var r = readiness(uid, w.id);
          if (f.state && r.state !== f.state) return;
          rows.push({ project: p, pkg: w, area: idx.areas[w.areaId], readiness: r, current: hpCurrentIssued(w.id), versions: hpVersions(w.id).filter(function (h) { return canSee(uid, 'handoverpkg', h); }) });
        });
      });
      return rows;
    }
    // ---------- handover packages ----------
    function hpAccess(uid, h) {
      var c = can(uid, 'handover.view', pkgR(h.packageId));
      if (!c.allowed) return c;
      if (!isCustomer(uid)) return c;
      if ((h.status === 'issued' || h.status === 'superseded') && ((h.recipients || []).indexOf(uid) >= 0 || hpAcceptor(uid, h))) return c;
      return { allowed: false, code: 'internal_record', trace: c.trace.concat('Handover package not issued to you') };
    }
    function hpAcceptor(uid, h) { return isCustomer(uid) && allowed(uid, 'handover.accept', pkgR(h.packageId)); }
    function manifestCheck(h) {
      var items = (h.manifest || []).map(function (it) {
        var rec = get(it.kind, it.id), state = 'ok', current = null;
        if (!rec) state = 'missing';
        else if (it.kind === 'document') {
          var r = revOf(rec, it.rev), pr = pubRev(rec);
          current = pr ? pr.rev : null;
          if (!r) state = 'missing';
          else if (r.status === 'withdrawn' || (rec.status === 'withdrawn')) state = 'withdrawn';
          else if (r.status === 'superseded' || (pr && pr.rev !== it.rev)) state = 'superseded';
          else if (r.status !== 'published') state = 'not_published';
          else if (rec.audience !== 'customer') state = 'internal';
        } else if (it.kind === 'inspection') {
          current = rec.rev;
          if (!verifiedInspection(rec)) state = 'not_verified';
          else if (rec.rev !== it.rev) state = 'changed';
          else if (!rec.publishedAt) state = 'internal';
        } else if (it.kind === 'evidence') {
          current = rec.version;
          if (rec.audience === 'internal') state = 'internal';
          else if ((rec.version || 1) !== (it.version || 1)) state = 'changed';
        }
        return { item: it, rec: rec, state: state, current: current };
      });
      return { items: items, ok: items.length > 0 && items.every(function (x) { return x.state === 'ok'; }), problems: items.filter(function (x) { return x.state !== 'ok'; }) };
    }
    function hpControls(uid, h) {
      var res = pkgR(h.packageId), staff = !isCustomer(uid), prep = staff && allowed(uid, 'handover.prepare', res);
      var latest = hpVersions(h.packageId).slice(-1)[0];
      var c = {
        edit: prep && h.status === 'draft',
        submit: prep && h.status === 'draft',
        review: staff && h.status === 'in_review' && allowed(uid, 'handover.review', res) && h.preparedBy !== uid,
        reviewSelf: staff && h.status === 'in_review' && h.preparedBy === uid,
        issue: prep && h.status === 'reviewed',
        amend: prep && h.status === 'issued' && latest && latest.id === h.id,
        acknowledge: isCustomer(uid) && h.status === 'issued' && (h.recipients || []).indexOf(uid) >= 0 && !(h.acknowledgements || []).some(function (a) { return a.userId === uid; }) && allowed(uid, 'handover.acknowledge', res),
        acceptCheck: isCustomer(uid) && h.status === 'issued' && !h.acceptance ? can(uid, 'handover.accept', res) : null
      };
      c.accept = !!(c.acceptCheck && c.acceptCheck.allowed);
      return c;
    }
    // ---------- release ----------
    function releasePrereqs(uid, wpId) {
      var list = releaseSetting().packages[wpId] || [];
      var r = readiness(null, wpId), h = hpCurrentIssued(wpId);
      return list.map(function (k) {
        var met = k === 'readiness_complete' ? r.state === 'ready' : k === 'internal_review' ? !!(h && h.review && h.review.outcome === 'ready') : k === 'customer_acceptance' ? !!(h && h.acceptance) : false;
        return { key: k, met: met };
      });
    }
    function releaseCheck(uid, wpId) {
      var set = releaseSetting(), list = set.packages[wpId] || [];
      var auth = can(uid, 'asset.release', pkgR(wpId));
      var pre = list.length ? releasePrereqs(uid, wpId) : [];
      var out = { configured: list.length > 0, example: set.example, label: set.label, prereqs: pre, authority: auth, current: hpCurrentIssued(wpId) };
      out.allowed = out.configured && auth.allowed && pre.every(function (x) { return x.met; }) && !!out.current;
      out.code = !out.configured ? 'release_not_configured' : !auth.allowed ? (auth.code || 'authority') : !pre.every(function (x) { return x.met; }) ? 'prerequisites_unmet' : !out.current ? 'not_issued' : null;
      return out;
    }
    function releasesFor(uid, wpId) { return (ds.releases || []).filter(function (r) { return r.packageId === wpId && canSee(uid, 'release', r); }); }
    // A recorded decision is never deleted; when the records it rested on change it is flagged for reassessment.
    function decisionFlags(rel) {
      var out = [], h = get('handoverpkg', rel.handoverPackageId);
      if (!h || h.status === 'superseded' || h.supersededBy) out.push('package_superseded');
      if (h && !h.acceptance) out.push('acceptance_missing');
      var r = readiness(null, rel.packageId);
      if (r.configured && r.state !== 'ready') out.push('readiness_changed');
      if (h) { var mc = manifestCheck(h); if (!mc.ok) out.push('records_changed'); }
      return out;
    }
    function acceptanceFlags(h) {
      if (!h || !h.acceptance) return [];
      var out = [];
      if (h.supersededBy) out.push('package_superseded');
      if (!manifestCheck(h).ok) out.push('records_changed');
      return out;
    }

    // ---------- reports ----------
    function reportAccess(uid, r) {
      var c = can(uid, 'report.view', { projectId: r.projectId });
      if (!c.allowed) return c;
      if (!isCustomer(uid)) return c;
      var issued = (r.versions || []).some(function (v) { return v.issuedAt; });
      if (issued && (r.audience || []).indexOf(uid) >= 0) return c;
      return { allowed: false, code: 'internal_record', trace: c.trace.concat('Report not issued to you') };
    }
    function reportControls(uid, r) {
      var res = { projectId: r.projectId }, staff = !isCustomer(uid);
      var latest = (r.versions || []).slice(-1)[0];
      return {
        edit: staff && r.status === 'draft' && allowed(uid, 'report.prepare', res) && r.authorId === uid,
        submit: staff && r.status === 'draft' && allowed(uid, 'report.prepare', res) && r.authorId === uid,
        review: staff && r.status === 'in_review' && allowed(uid, 'report.review', res) && r.reviewerId === uid && r.authorId !== uid,
        reviewSelf: staff && r.status === 'in_review' && r.authorId === uid,
        issue: staff && r.status === 'approved' && allowed(uid, 'report.issue', res),
        amend: staff && r.status === 'issued' && allowed(uid, 'report.prepare', res),
        exportCheck: can(uid, 'report.export', res),
        latest: latest
      };
    }
    function reportsList(uid, f) {
      f = f || {};
      return (ds.reports || []).filter(function (r) {
        if (f.project && r.projectId !== f.project) return false;
        if (f.type && r.type !== f.type) return false;
        if (f.status && r.status !== f.status) return false;
        return canSee(uid, 'report', r);
      }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    }
    // Build a report snapshot from records. Only records EVERY member of the audience may open are included, so
    // the snapshot can be issued to any of them. Internal records never enter a customer report.
    function reportData(type, pid, opt) {
      opt = opt || {};
      var aud = (opt.audience || []).filter(function (u) { return user(u); });
      var lens = aud[0] || null;
      function vis(kind, rec) { return aud.length > 0 && aud.every(function (u) { return canSee(u, kind, rec); }); }
      var p = idx.projects[pid], from = opt.from || null, to = opt.to || today, cutoff = opt.cutoff || today;
      var inPeriod = function (d) { d = String(d || '').slice(0, 10); return d && (!from || d >= from) && d <= to && d <= cutoff; };
      var pkgs = where('packages', function (w) { return w.projectId === pid && aud.every(function (u) { return allowed(u, 'package.view', pkgR(w.id)); }); });
      var snap = { type: type, projectId: pid, projectCode: p.code, projectName: p.name, projectNameAr: p.nameAr, period: { from: from, to: to }, cutoff: cutoff, generatedAt: opt.now || today,
        audience: aud.slice(), sections: {}, records: [] };
      function rec(kind, r, extra) { snap.records.push(Object.assign({ kind: kind, id: r.id, ref: r.ref || r.number || r.code || r.id }, extra || {})); }
      if (type === 'progress') {
        var pr = projectProgress(pid, lens);
        snap.sections.project = { pct: pr.pct, configured: pr.configured, asOf: pr.asOf, missing: pr.missing.map(function (w) { return w.code; }) };
        snap.sections.packages = pkgs.map(function (w) {
          var pp = packageProgress(w.id, lens);
          rec('package', w);
          return { id: w.id, code: w.code, service: w.service, weight: w.weight, method: pp.method, pct: pp.pct, reason: pp.reason, asOf: pp.asOf,
            calc: pp.calc ? { kind: pp.calc.kind, done: pp.calc.done, total: pp.calc.total, unit: pp.calc.unit || null, units: pp.calc.units || null,
              rows: pp.calc.kind === 'quantities' ? pp.calc.rows.map(function (r) { return { id: r.id, description: r.description, descriptionAr: r.descriptionAr, unit: r.unit, planned: r.planned, done: r.done, counted: r.counted }; }) : null } : null,
            milestones: pp.milestones.filter(function (m) { return vis('milestone', m); }).map(function (m) {
              rec('milestone', m, { ref: m.name });
              return { id: m.id, name: m.name, nameAr: m.nameAr, weight: m.weight, baseline: m.planned, forecast: m.forecast, actual: m.completedAt || null, rebaselined: (m.baselineHistory || []).length };
            }) };
        });
        snap.sections.updates = (ds.dailyUpdates || []).filter(function (d) { return d.projectId === pid && inPeriod(d.date) && vis('dailyupdate', d); }).map(function (d) {
          rec('dailyupdate', d);
          var w = idx.packages[d.packageId];
          return { id: d.id, ref: d.ref, date: d.date, pkg: w.code, workDone: d.workDone, quantities: (d.quantities || []).map(function (q) { return { lineId: q.lineId, qty: q.qty, unit: q.unit }; }), next: d.next };
        });
      } else if (type === 'commitments') {
        snap.sections.commitments = ds.commitments.filter(function (c) { return c.projectId === pid && vis('commitment', c); }).sort(function (a, b) { return dueOf(a) < dueOf(b) ? -1 : 1; }).map(function (c) {
          rec('commitment', c);
          return { id: c.id, ref: c.ref, text: c.text, textAr: c.textAr, party: c.party, owner: nameOf(c.ownerId), promised: c.promised, current: dueOf(c), forecast: c.forecast || dueOf(c), status: commitmentStatus(c),
            blocker: c.blocker || '', next: c.next || '', rescheduled: (c.history || []).length, done: c.doneAt || null };
        });
      } else if (type === 'quality') {
        snap.sections.inspections = ds.inspections.filter(function (i) { return i.projectId === pid && vis('inspection', i) && inPeriod(i.performed || i.planned); }).map(function (i) {
          rec('inspection', i);
          return { id: i.id, ref: i.ref, title: i.title, type: i.type, date: i.performed || i.planned, status: i.status, outcome: i.verification ? i.verification.outcome : null, rev: i.rev };
        });
        var fs = ds.findings.filter(function (f) { return f.projectId === pid && vis('finding', f); });
        snap.sections.findings = fs.map(function (f) { rec('finding', f); return { id: f.id, ref: f.ref, classification: f.classification, severity: f.severity, status: f.status, description: f.description, target: f.targetDate }; });
        snap.sections.corrective = ds.correctiveActions.filter(function (c) { return c.projectId === pid && vis('corrective', c); }).map(function (c) {
          rec('corrective', c);
          return { id: c.id, ref: c.ref, title: c.title, status: c.status, due: c.due };
        });
      } else if (type === 'handover') {
        snap.sections.packages = pkgs.map(function (w) {
          var r = readiness(lens, w.id);
          if (!r.configured) return { id: w.id, code: w.code, service: w.service, configured: false };
          rec('package', w);
          return { id: w.id, code: w.code, service: w.service, configured: true, state: r.state, pct: r.pct, met: r.met, total: r.total,
            items: r.items.map(function (it) {
              it.refs.forEach(function (x) { var rr = get(x.kind, x.id); if (rr && vis(x.kind, rr)) rec(x.kind, rr, x.kind === 'milestone' ? { ref: rr.name } : null); });
              return { type: it.type, status: it.status, refs: it.refs.filter(function (x) { var rr = get(x.kind, x.id); return rr && vis(x.kind, rr); }), withheld: it.hidden + it.refs.filter(function (x) { var rr = get(x.kind, x.id); return !(rr && vis(x.kind, rr)); }).length,
                category: it.req.category || null, inspectionType: it.req.inspectionType || null };
            }) };
        });
      }
      return snap;
    }

    // ---------- management oversight ----------
    function oversight(uid) {
      var at = ds.now || today, ps = visibleProjects(uid).filter(function (p) { return allowed(uid, 'oversight.view', { projectId: p.id }); });
      var late = [], blockers = [], decisions = [], overdueCa = [], hoBlock = [];
      ps.forEach(function (p) {
        commitmentRegister(uid, { project: p.id }).forEach(function (c) { if (commitmentStatus(c) === 'overdue') late.push(c); });
        dependencyList(uid, { project: p.id, status: 'open' }).forEach(function (d) { blockers.push({ kind: 'dependency', rec: d, state: depState(d) }); });
        commitmentRegister(uid, { project: p.id, status: 'open' }).forEach(function (c) { if (c.blocker) blockers.push({ kind: 'commitment', rec: c }); });
        awaitingCustomer(uid, p.id).forEach(function (v) { decisions.push(v); });
        correctiveList(uid, { project: p.id, status: 'overdue' }).forEach(function (c) { overdueCa.push(c); });
        visiblePackages(uid, p.id).forEach(function (w) { var r = readiness(uid, w.id); if (r.configured && r.blockers.length) hoBlock.push({ pkg: w, readiness: r }); });
      });
      return { at: at, projects: ps, late: late, blockers: blockers, decisions: decisions, overdueCa: overdueCa, handoverBlockers: hoBlock };
    }

    // ---------- Directory ----------
    function directoryRows(uid) {
      return visibleProjects(uid).map(function (p) {
        var nc = nextCommitment(uid, p.id);
        return {
          project: p, progress: projectProgress(p.id, uid), health: projectHealth(p.id),
          services: Array.from(new Set(visiblePackages(uid, p.id).map(function (w) { return w.service; }))),
          lastUpdate: lastUpdate(uid, p.id), next: nc, nextDue: nc ? dueOf(nc) : null,
          openActions: isCustomer(uid) ? openActions(actionsFor(uid, { projectId: p.id })).length : awaitingCustomer(uid, p.id).length
        };
      });
    }
    function filterDirectory(rows, f, L) {
      f = f || {};
      var q = (f.q || '').trim().toLowerCase();
      return rows.filter(function (r) {
        var p = r.project;
        if (q && [p.name, p.nameAr, p.code, p.location, p.locationAr].join(' ').toLowerCase().indexOf(q) < 0) return false;
        if (f.service && r.services.indexOf(f.service) < 0) return false;
        if (f.type && p.type !== f.type) return false;
        if (f.location && p.location !== f.location) return false;
        if (f.status && p.status !== f.status) return false;
        if (f.health && r.health !== f.health) return false;
        return true;
      });
    }

    return {
      ds: ds, today: today, get: get, user: user, isCustomer: isCustomer, projectOf: projectOf,
      packageProgress: packageProgress, projectProgress: projectProgress, packageStatus: packageStatus,
      commitmentStatus: commitmentStatus, dueOf: dueOf, actionStatus: actionStatus, projectHealth: projectHealth,
      visibleProjects: visibleProjects, visiblePackages: visiblePackages, recordAccess: recordAccess, canSee: canSee,
      documents: documents, currentRev: currentRev, inspections: inspections, correctives: correctives, openCorrective: openCorrective,
      requests: requests, changes: changes, evidence: evidence, commitments: commitments,
      actionsFor: actionsFor, awaitingCustomer: awaitingCustomer, openActions: openActions, actionView: actionView,
      activity: activity, sinceLastVisit: sinceLastVisit, lastUpdate: lastUpdate, nextCommitment: nextCommitment,
      handover: handover, briefing: briefing, directoryRows: directoryRows, filterDirectory: filterDirectory,
      areas: function (pid) { return where('areas', function (a) { return a.projectId === pid; }); },
      register: function (wpId) { return where('register', function (r) { return r.packageId === wpId; }); },
      ACTION_PERMISSION: ACTION_PERMISSION, ACTION_TYPES: ACTION_TYPES, RECORD_KINDS: RECORD_KINDS,
      reindex: reindex, policy: POLICY, allActions: allActions, nextAction: nextAction, requestControls: requestControls, requestCan: requestCan,
      drafts: drafts, requestCentre: requestCentre, notesFor: notesFor, filesFor: filesFor, fileAccess: fileAccess,
      duplicateCandidates: duplicateCandidates, exactDuplicate: exactDuplicate, tokens: tokens,
      pendingDecisions: pendingDecisions, validDecision: validDecision, decisionCheck: decisionCheck, instructionView: instructionView, instructions: instructions,
      inbox: inbox, notifications: notifications, unread: unread, aiContext: aiContext, authorityFor: authorityFor,
      revOf: revOf, pubRev: pubRev, latestRev: latestRev, pendingRev: pendingRev, revisionAccess: revisionAccess, visibleRevisions: visibleRevisions,
      revComments: revComments, revReviews: revReviews, reviewState: reviewState, reviewOverdue: reviewOverdue, docLinks: docLinks, revisionFlag: revisionFlag, refFlagFor: refFlagFor,
      supersededRefs: supersededRefs, docRow: docRow, docCentre: docCentre, myReviews: myReviews, docControls: docControls, transmittals: transmittals, transmittalAccess: transmittalAccess,
      audienceFor: audienceFor, trAckState: trAckState, unregisteredUploads: unregisteredUploads, requirementSets: requirementSets, requirementStatus: requirementStatus,
      docChecks: docChecks, docSuggestions: docSuggestions, dcWorkspace: dcWorkspace, duplicateFiles: duplicateFiles, isStaffFor: isStaffFor, docVisible: docVisible,
      template: template, activeVersion: activeVersion, templateFor: templateFor, fieldProgress: fieldProgress, inspFindings: inspFindings, outstandingFindings: outstandingFindings,
      inspectionCentre: inspectionCentre, scheduleFlags: scheduleFlags, inspControls: inspControls, findingsList: findingsList, caOverdue: caOverdue, caControls: caControls,
      correctiveList: correctiveList, chainFor: chainFor, qaWorkspace: qaWorkspace, hseWorkspace: hseWorkspace, aiQuality: aiQuality, caSuggestion: caSuggestion,
      witnessAppointments: witnessAppointments, CA_OPEN: CA_OPEN,
      progressConfig: progressConfig, pkgMilestones: pkgMilestones, countedUpdates: countedUpdates, dupReviewer: dupReviewer, dupControls: dupControls, dailyUpdatesList: dailyUpdatesList,
      msControls: msControls, sourceRec: sourceRec, commitmentForSource: commitmentForSource, commitmentRegister: commitmentRegister, cmControls: cmControls,
      depNode: depNode, depState: depState, dependencyProblem: dependencyProblem, dependencyList: dependencyList,
      handoverSetting: handoverSetting, releaseSetting: releaseSetting, verifiedInspection: verifiedInspection, hpVersions: hpVersions, hpCurrentIssued: hpCurrentIssued,
      pendingCustomerDecisions: pendingCustomerDecisions, readiness: readiness, handoverDashboard: handoverDashboard, manifestCheck: manifestCheck, hpControls: hpControls, hpAcceptor: hpAcceptor,
      releasePrereqs: releasePrereqs, releaseCheck: releaseCheck, releasesFor: releasesFor, decisionFlags: decisionFlags, acceptanceFlags: acceptanceFlags,
      reportControls: reportControls, reportsList: reportsList, reportData: reportData, oversight: oversight, correctiveListAll: correctiveList,
      PUBLISHABLE: PUBLISHABLE, OUTCOME_RANK: OUTCOME_RANK, custRevVisible: custRevVisible, customerReviewSetting: customerReviewSetting, customerReviewRequired: customerReviewRequired, reviewRouting: reviewRouting, docRes: docRes,
      DECISION_PERMISSION: DECISION_PERMISSION, CUSTOMER_DECISIONS: CUSTOMER_DECISIONS, OPEN_REQ: OPEN_REQ, TERMINAL_REQ: TERMINAL_REQ, INTERNAL_STATES: INTERNAL_STATES
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RGSStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
