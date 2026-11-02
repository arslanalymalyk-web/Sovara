/*
 * RGS Client Portal — Stage 5 pages: inspection centre (list and calendar), scheduling, mobile field inspection,
 * inspection detail and review, findings register, corrective-action workspace, reinspection chain, QA/QC and HSE
 * workspaces, and versioned checklist templates. Changes go through api.js; reads through store.js.
 */
(function () {
  'use strict';
  var P = window.RGSPages, h = P._h, X = window.RGSPages3;
  var t = h.t, esc = h.esc, pic = h.pic, recLink = h.recLink, go = h.go, pill = h.pill, card = h.card, table = h.table, kv = h.kv,
    crumbs = h.crumbs, emptyBox = h.emptyBox, dueCell = h.dueCell, fd = h.fd, person = h.person, L = h.L, svcTag = h.svcTag;
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function API() { return U().API; }
  function me() { return U().user(); }
  function ic(n, c) { return U().ic(n, c); }
  var fdt = X.fdt, personRole = X.personRole, err = X.err;
  function POL(k) { return (ST().policy || {})[k] || {}; }
  function can(uid, a, res) { return U().A.can(U().D, uid, a, res).allowed; }
  function canAnywhere(uid, a) { return ST().visibleProjects(uid).some(function (p) { return can(uid, a, { projectId: p.id }) || ST().visiblePackages(uid, p.id).some(function (w) { return can(uid, a, { packageId: w.id }); }); }); }
  function areaName(id) { var a = id && U().byId(U().D.areas, id); return a ? a.code + ' · ' + L(a, 'name') : '—'; }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function errBox(code) { return code ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(code)) + '</span></div>' : ''; }
  function fe(errs, k, id) { return errs[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(errs[k])) + '</div>' : ''; }
  function inv(errs, k, id) { return errs[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; }

  // ---------------------------------------------------------------- vocabulary
  var ISTAT_TONE = { scheduled: 'info', in_progress: 'warn', awaiting_review: 'warn', completed: 'ok', cancelled: '' };
  function istat(s) { return pill(ISTAT_TONE[s] || '', t('istat.' + s)); }
  var RES_TONE = { pass: 'ok', fail: 'crit', na: 'plain', not_assessed: '' };
  function resPill(r) { return pill(RES_TONE[r] || '', t('ires.' + r)); }
  var CA_TONE = { open: 'info', assigned: 'info', action_proposed: 'info', in_progress: 'warn', ready_for_verification: 'warn', closed: 'ok', returned: 'crit', cancelled: '', reopened: 'crit' };
  function caPill(s) { return pill(CA_TONE[s] || '', t('castatus.' + s)); }
  var SEV_TONE = { low: 'plain', medium: 'warn', high: 'crit', critical: 'crit' };
  function sevPill(s) { return pill(SEV_TONE[s] || '', t('sev.' + s)); }
  function clsTag(c) { return '<span class="fcls fc-' + c + '">' + pic(c === 'hse_concern' ? 'hse' : c === 'nonconformance' ? 'corrective' : 'search') + esc(t('fcls.' + c)) + '</span>'; }
  function fstat(s) { return pill({ open: 'warn', action_raised: 'info', closed: 'ok', cancelled: '' }[s] || '', t('fstat.' + s)); }
  var CA_LIFE = ['open', 'assigned', 'action_proposed', 'in_progress', 'ready_for_verification', 'closed'];
  var CA_OTHER = ['returned', 'cancelled', 'reopened'];
  function lifeBar(cur) {
    var idx = CA_LIFE.indexOf(cur), ended = CA_OTHER.indexOf(cur) >= 0;
    return '<div class="lifecycle-wrap"><ol class="lifecycle' + (ended ? ' ended' : '') + '" aria-label="' + esc(t('ca.lifecycle')) + '">' + CA_LIFE.map(function (s, i) {
      var cls = i < idx ? 'done' : i === idx ? 'cur' : '';
      return '<li class="' + cls + '"' + (i === idx ? ' aria-current="step"' : '') + '><span class="dot">' + (cls === 'done' ? pic('check') : (i + 1)) + '</span><span class="lbl">' + esc(t('castatus.' + s)) + '</span></li>';
    }).join('') + '</ol><p class="field-hint">' + pill('warn', t('ins.proposed')) + ' ' + esc(t('ca.proposed')) + (ended ? ' ' + caPill(cur) : '') + '</p></div>';
  }
  function evChips(uid, ids) {
    var st = ST(), list = (ids || []).map(function (id) { return st.get('evidence', id); }).filter(function (e) { return e && st.canSee(uid, 'evidence', e); });
    return list.length ? '<span class="fchips">' + list.map(function (e) { return recLink('evidence', e.id); }).join('') + '</span>' : '';
  }

  // ---------------------------------------------------------------- upload profiles: field and corrective evidence
  // A file uploaded here becomes an evidence record linked to its inspection, finding or corrective action.
  // Each upload has its own key, so a retry never creates a second evidence record.
  function evidenceAfterUpload(ctx, item, link, caption) {
    var st = ST();
    var rec = st.get(link.kind, link.id); if (!rec) return null;
    var r = API().dispatch('evidence.upload', me().id, { idempotencyKey: 'ev-' + item.key, packageId: rec.packageId, areaId: rec.areaId, caption: caption, linked: link, fileId: item.fileId, audience: 'customer' });
    if (!r.ok) { item.status = 'failed'; item.error = 'err.' + r.code; return null; }
    item.evidenceId = r.result.id;
    return r.result.id;
  }
  // ctx = 'fieldev-<inspection id>-<item key>'; record ids may contain dashes, item keys do not
  function fieldCtx(ctx) { var rest = ctx.slice(8), n = rest.lastIndexOf('-'); return { id: rest.slice(0, n), key: rest.slice(n + 1) }; }
  X.addProfile({ prefix: 'fieldev-', single: true, capture: true, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'], max: 25 * 1048576, accept: 'image/*,application/pdf', hint: 'dlg.fileHint',
    typeError: 'dlg.err.fileType', sizeError: 'dlg.err.fileSize',
    payload: function (ctx) { var i = ST().get('inspection', fieldCtx(ctx).id); return { purpose: 'evidence', projectId: i ? i.projectId : null, packageId: i ? i.packageId : null }; },
    onDone: function (ctx, item) {
      var fc = fieldCtx(ctx), id = fc.id, key = fc.key, i = ST().get('inspection', id); if (!i) return;
      var it = i.items.filter(function (x) { return x.key === key; })[0];
      var eid = evidenceAfterUpload(ctx, item, { kind: 'inspection', id: id }, i.ref + ' · ' + (it ? it.text : key));
      if (!eid) return;
      var f = fldState(id); f.results[key] = f.results[key] || { result: 'not_assessed' };
      f.results[key].evidence = (f.results[key].evidence || []).concat([eid]); f.dirty = true; persistFld(id);
    } });
  X.addProfile({ prefix: 'caev-', single: true, capture: true, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'], max: 25 * 1048576, accept: 'image/*,application/pdf', hint: 'dlg.fileHint',
    typeError: 'dlg.err.fileType', sizeError: 'dlg.err.fileSize',
    payload: function (ctx) { var c = ST().get('corrective', ctx.slice(5)); return { purpose: 'evidence', projectId: c ? c.projectId : null, packageId: c ? c.packageId : null }; },
    onDone: function (ctx, item) { var c = ST().get('corrective', ctx.slice(5)); if (c) evidenceAfterUpload(ctx, item, { kind: 'corrective', id: c.id }, c.ref + ' · ' + t('ca.completionEvidence')); } });
  function uploadedEvidence(ctx) { return X.uploads(ctx).filter(function (i) { return i.status === 'done' && i.evidenceId; }).map(function (i) { return i.evidenceId; }); }

  // ---------------------------------------------------------------- 1. inspection centre (list + calendar)
  function icState() { var s = S(); if (!s.icf) s.icf = { view: 'list', q: '', project: '', package: '', type: '', status: '', inspector: '', month: ST().today.slice(0, 7) }; return s.icf; }
  function inspectionsPage(u) {
    var st = ST(), f = icState(), cust = st.isCustomer(u.id);
    var rows = st.inspectionCentre(u.id, f), all = st.inspectionCentre(u.id, {});
    var projects = st.visibleProjects(u.id), pkgs = [];
    projects.forEach(function (p) { if (!f.project || f.project === p.id) pkgs = pkgs.concat(st.visiblePackages(u.id, p.id)); });
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="icf.' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var inspectors = U().D.users.filter(function (x) { return all.some(function (i) { return i.inspectorId === x.id; }); });
    var tools = '<section class="card card-b ic-tools"><div class="field ic-search"><label for="ic-q">' + esc(t('dir.search')) + '</label><div class="control">' + ic('search') + '<input id="ic-q" class="input" type="search" data-live value="' + esc(f.q) + '" placeholder="' + esc(t('ic.search.ph')) + '"></div></div>' +
      sel('ic-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) +
      sel('ic-package', 'package', t('misc.package'), [['', t('f.all')]].concat(pkgs.map(function (w) { return [w.id, w.code + ' · ' + t('svc.' + w.service)]; }))) +
      sel('ic-type', 'type', t('ic.type'), [['', t('f.all')]].concat((POL('inspections').types || []).map(function (x) { return [x, t('itype.' + x)]; }))) +
      sel('ic-status', 'status', t('f.status'), [['', t('f.all')]].concat(['scheduled', 'in_progress', 'awaiting_review', 'completed', 'cancelled'].map(function (x) { return [x, t('istat.' + x)]; }))) +
      (cust ? '' : sel('ic-inspector', 'inspector', t('ic.inspector'), [['', t('f.all')]].concat(inspectors.map(function (x) { return [x.id, x.name]; })))) + '</section>';
    var head = [t('ic.id'), t('nav.projects'), t('misc.package'), t('rq.area'), t('ic.type'), t('ic.inspector'), t('ic.scheduled'), t('f.status'), t('ic.outstanding')];
    var trs = rows.map(function (i) {
      var w = st.get('package', i.packageId), p = st.get('project', i.projectId), out = st.outstandingFindings(u.id, i).length;
      return '<tr><td>' + recLink('inspection', i.id) + '<br><a ' + go('insp.' + i.id) + ' class="muted">' + esc(i.title) + '</a>' + (i.publishedAt ? '' : ' ' + pill('plain', t('misc.internal'))) + '</td><td>' + esc(p.code) + '</td><td>' + svcTag(w.service) + ' <span class="mono muted">' + esc(w.code) + '</span></td><td>' + esc(areaName(i.areaId)) + '</td>' +
        '<td>' + esc(t('itype.' + i.type)) + '</td><td>' + esc(person(i.inspectorId)) + '</td><td>' + dueCell(i.planned, i.status !== 'scheduled') + '</td><td>' + istat(i.status) + '</td><td>' + (out ? pill('warn', String(out)) : '<span class="muted">0</span>') + '</td></tr>';
    });
    var stack = '<div class="list">' + rows.map(function (i) {
      var out = st.outstandingFindings(u.id, i).length;
      return '<a class="list-row rowlink" ' + go('insp.' + i.id) + '><span class="sev ' + ({ completed: 'ok', awaiting_review: 'warn', in_progress: 'warn', scheduled: 'info' }[i.status] || '') + '"></span><span class="t"><span class="row" style="gap:6px">' + istat(i.status) + (out ? pill('warn', t('ic.findingsN', { n: out })) : '') + '</span><b>' + esc(i.title) + '</b><span><span class="mono">' + esc(i.ref) + '</span> · ' + esc(fd(i.planned)) + ' · ' + esc(person(i.inspectorId)) + '</span></span></a>';
    }).join('') + '</div>';
    var listView = rows.length ? '<div class="ic-wide">' + table(head, trs, 'ictable') + '</div><div class="ic-narrow">' + stack + '</div>' : emptyBox('inspections', t('ic.none'), t(cust ? 'ic.none.customer' : 'ic.none.d'));
    var tabs = '<div class="seg" role="tablist" aria-label="' + esc(t('ic.views')) + '"><button class="btn btn-sm" role="tab" data-pact="ic-view" data-v="list" aria-selected="' + (f.view === 'list') + '">' + ic('reports') + esc(t('dc.list')) + '</button><button class="btn btn-sm" role="tab" data-pact="ic-view" data-v="calendar" aria-selected="' + (f.view === 'calendar') + '">' + ic('calendar') + esc(t('ic.calendar')) + '</button></div>';
    var customerPanel = '';
    if (cust) {
      var appts = st.witnessAppointments(u.id), acts = st.openActions(st.actionsFor(u.id)).filter(function (v) { return v.action.type === 'inspection_signoff'; });
      customerPanel = '<div class="grid g-2">' + card(esc(t('ic.witness')) + ' <span class="pill plain num">' + appts.length + '</span>', appts.length ? '<ul class="doclist">' + appts.map(function (i) { return '<li>' + recLink('inspection', i.id) + '<span class="t"><b>' + esc(i.title) + '</b><span>' + esc(fd(i.planned)) + ' · ' + esc(areaName(i.areaId)) + '</span></span>' + istat(i.status) + '</li>'; }).join('') + '</ul>' : emptyBox('calendar', t('ic.noWitness'))) +
        card(esc(t('ic.custActions')) + ' <span class="pill plain num">' + acts.length + '</span>', acts.length ? '<div class="list">' + acts.map(function (v) { return '<div class="list-row"><span class="sev warn"></span><div class="t"><b>' + esc(h.needText(v)) + '</b><span>' + recLink('inspection', v.record.id) + ' · ' + esc(t('act.due')) + ' ' + dueCell(v.action.due) + '</span></div><div class="row-end">' + h.actionButton(u, v, true) + '</div></div>'; }).join('') + '</div>' : emptyBox('approvals', t('ic.noCustActions'))) + '</div>';
    }
    var canSchedule = !cust && canAnywhere(u.id, 'inspection.schedule');
    return crumbs([[t('nav.home'), 'home'], [t('nav.inspections'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('ic.title')) + '</h1><p>' + esc(t(cust ? 'ic.sub.customer' : 'ic.sub.staff')) + '</p></div><div class="row">' + (!cust && canAnywhere(u.id, 'inspection.view.internal') && (canAnywhere(u.id, 'inspection.schedule') || canAnywhere(u.id, 'corrective.close')) ? '<a class="btn btn-secondary" ' + go('qaqc') + '>' + esc(t('nav.qaqc')) + '</a>' : '') + (canSchedule ? '<a class="btn btn-primary" ' + go('inspnew') + '>' + pic('plus') + esc(t('ic.schedule')) + '</a>' : '') + '</div></div>' +
      '<div class="notice">' + ic('shield') + '<span>' + esc(t('ic.outcomeRule')) + (cust ? ' ' + esc(t('ic.customerRule')) : '') + '</span></div>' + customerPanel + tools +
      '<div class="row-between">' + tabs + '<p class="muted" role="status">' + esc(t('rq.count', { n: rows.length, m: all.length })) + '</p></div>' +
      (f.view === 'calendar' ? calendar(u, rows, f) : card(esc(t('ic.register')) + ' <span class="pill plain num">' + rows.length + '</span>', listView));
  }
  function calendar(u, rows, f) {
    var y = +f.month.slice(0, 4), m = +f.month.slice(5, 7) - 1, first = new Date(Date.UTC(y, m, 1)), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var lead = (first.getUTCDay() + 6) % 7; // weeks start Monday
    var lang = S().lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB';
    var title = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
    var wd = []; for (var d = 0; d < 7; d++) wd.push(new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 12 + d))));
    var cells = '';
    for (var b = 0; b < lead; b++) cells += '<div class="cal-cell blank" aria-hidden="true"></div>';
    for (var day = 1; day <= days; day++) {
      var iso = f.month + '-' + String(day).padStart(2, '0');
      var list = rows.filter(function (i) { return i.planned === iso; });
      cells += '<div class="cal-cell' + (iso === ST().today ? ' today' : '') + (list.length ? ' has' : '') + '"><span class="cal-d">' + day + '</span>' + list.map(function (i) { return '<a class="cal-item ci-' + i.status + '" ' + go('insp.' + i.id) + ' title="' + esc(i.title) + '"><span class="mono">' + esc(i.ref) + '</span><span>' + esc(t('istat.' + i.status)) + '</span></a>'; }).join('') + '</div>';
    }
    var prev = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 7);
    var agenda = rows.filter(function (i) { return i.planned.slice(0, 7) === f.month; }).sort(function (a, b) { return a.planned < b.planned ? -1 : 1; });
    return card('<span>' + esc(title) + '</span>', '<div class="card-b stack"><div class="row-between"><button class="btn btn-secondary btn-sm" data-pact="ic-month" data-v="' + prev + '">' + ic('arrow', 'flip back') + esc(t('ic.prev')) + '</button><button class="btn btn-ghost btn-sm" data-pact="ic-month" data-v="' + ST().today.slice(0, 7) + '">' + esc(t('ic.thisMonth')) + '</button><button class="btn btn-secondary btn-sm" data-pact="ic-month" data-v="' + next + '">' + esc(t('ic.next')) + ic('arrow') + '</button></div>' +
      '<div class="cal" role="grid" aria-label="' + esc(title) + '">' + wd.map(function (x) { return '<div class="cal-h" role="columnheader">' + esc(x) + '</div>'; }).join('') + cells + '</div>' +
      '<div class="cal-agenda"><h3 class="sub-h">' + esc(t('ic.agenda')) + '</h3>' + (agenda.length ? '<ul class="doclist">' + agenda.map(function (i) { return '<li>' + recLink('inspection', i.id) + '<span class="t"><b>' + esc(i.title) + '</b><span>' + esc(fd(i.planned)) + '</span></span>' + istat(i.status) + '</li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('ic.noneMonth')) + '</p>') + '</div></div>');
  }

  // ---------------------------------------------------------------- 2. schedule inspection
  function schState(reqId) {
    var s = S(), key = reqId || 'new';
    if (!s.isch || s.isch.key !== key) {
      s.isch = { key: key, values: { attendees: [], docs: [], prereq: [{ text: '', met: false }, { text: '', met: false }] }, errors: {}, idem: 'isch-' + X.rnd() };
      var r = reqId && ST().get('request', reqId);
      if (r) { var w = ST().get('package', r.packageId); s.isch.values = Object.assign(s.isch.values, { projectId: r.projectId, packageId: r.packageId, areaId: r.areaId, title: r.subject, scope: r.description }); if (w) s.isch.values.type = 'hold_point'; }
    }
    return s.isch;
  }
  function schedulePage(u, args) {
    var st = ST(), reqId = args[0] || null, r = reqId && st.get('request', reqId);
    if (reqId) { var g = h.guard(u, 'request', r); if (g) return g; }
    var sc = schState(reqId), v = sc.values, e = sc.errors;
    var projects = st.visibleProjects(u.id).filter(function (p) { return st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'inspection.schedule', { packageId: w.id }); }); });
    if (!projects.length) return U().deniedState({ code: 'role' }, null);
    if (!v.projectId && projects.length === 1) v.projectId = projects[0].id;
    var body = '<div class="field"><label for="is-project">' + esc(t('nav.projects')) + '</label><select id="is-project" class="select" data-isbind="projectId"' + (r ? ' disabled' : '') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (v.projectId === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select></div>';
    var flags = [];
    if (v.projectId) {
      var pkgs = st.visiblePackages(u.id, v.projectId).filter(function (w) { return can(u.id, 'inspection.schedule', { packageId: w.id }); });
      var w = v.packageId && st.get('package', v.packageId);
      var areas = w ? st.areas(v.projectId).filter(function (a) { return a.id === w.areaId || a.parentId === w.areaId; }) : [];
      var inspectors = w ? U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, 'inspection.record', { packageId: w.id }); }) : [];
      var attendees = w ? U().D.users.filter(function (x) { return x.status === 'active' && x.id !== v.inspectorId && can(x.id, 'inspection.view', { packageId: w.id }) && (st.isCustomer(x.id) ? can(x.id, 'inspection.witness', { packageId: w.id }) : can(x.id, 'inspection.view.internal', { packageId: w.id })); }) : [];
      var docs = st.documents(u.id, v.projectId).filter(function (d) { return !w || !(d.packageIds || []).length || d.packageIds.indexOf(w.id) >= 0; });
      var tp = w && st.templateFor(w.service), tv = tp && st.activeVersion(tp);
      body += '<div class="grid g-2"><div class="field"><label for="is-package">' + esc(t('misc.package')) + '</label><select id="is-package" class="select" data-isbind="packageId"' + inv(e, 'packageId', 'is-package') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + pkgs.map(function (x) { return '<option value="' + x.id + '"' + (v.packageId === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + t('svc.' + x.service)) + '</option>'; }).join('') + '</select>' + fe(e, 'packageId', 'is-package') + '</div>' +
        '<div class="field"><label for="is-area">' + esc(t('rq.area')) + '</label><select id="is-area" class="select" data-isbind="areaId"' + inv(e, 'areaId', 'is-area') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (v.areaId === a.id ? ' selected' : '') + '>' + esc(a.code + ' · ' + L(a, 'name')) + '</option>'; }).join('') + '</select>' + fe(e, 'areaId', 'is-area') + '</div></div>' +
        '<div class="grid g-2"><div class="field"><label for="is-type">' + esc(t('ic.type')) + '</label><select id="is-type" class="select" data-isbind="type"' + inv(e, 'type', 'is-type') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + (POL('inspections').types || []).filter(function (x) { return x !== 'reinspection'; }).map(function (x) { return '<option value="' + x + '"' + (v.type === x ? ' selected' : '') + '>' + esc(t('itype.' + x)) + '</option>'; }).join('') + '</select>' + fe(e, 'type', 'is-type') + '</div>' +
        '<div class="field"><label for="is-planned">' + esc(t('ic.plannedDate')) + '</label><input id="is-planned" type="date" class="input" min="' + st.today + '" data-isbind="planned" value="' + esc(v.planned || '') + '"' + inv(e, 'planned', 'is-planned') + '>' + fe(e, 'planned', 'is-planned') + '</div></div>' +
        '<div class="field"><label for="is-title">' + esc(t('doc.title')) + '</label><input id="is-title" class="input" data-istext="title" value="' + esc(v.title || '') + '"' + inv(e, 'title', 'is-title') + '>' + fe(e, 'title', 'is-title') + '</div>' +
        '<div class="field"><label for="is-scope">' + esc(t('ins.scope')) + '</label><textarea id="is-scope" class="textarea" rows="2" data-istext="scope"' + inv(e, 'scope', 'is-scope') + '>' + esc(v.scope || '') + '</textarea>' + fe(e, 'scope', 'is-scope') + '</div>' +
        '<div class="field"><label for="is-inspector">' + esc(t('ic.responsible')) + '</label><select id="is-inspector" class="select" data-isbind="inspectorId"' + inv(e, 'inspectorId', 'is-inspector') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + inspectors.map(function (x) { return '<option value="' + x.id + '"' + (v.inspectorId === x.id ? ' selected' : '') + '>' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select>' + fe(e, 'inspectorId', 'is-inspector') + '</div>' +
        (w ? '<fieldset class="field"><legend class="label">' + esc(t('ic.attendees')) + '</legend><div class="checks">' + attendees.map(function (x) { return '<label class="check"><input type="checkbox" data-ismulti="attendees" value="' + x.id + '"' + ((v.attendees || []).indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div><span class="field-hint">' + esc(t('ic.attendees.hint')) + '</span></fieldset>' : '') +
        '<fieldset class="field"><legend class="label">' + esc(t('ic.prereq')) + '</legend><div class="stack">' + (v.prereq || []).map(function (pr, n) { return '<div class="row prereq-row"><input class="input" data-isprereq="' + n + '" value="' + esc(pr.text) + '" aria-label="' + esc(t('ic.prereq') + ' ' + (n + 1)) + '"><label class="check"><input type="checkbox" data-isprereqmet="' + n + '"' + (pr.met ? ' checked' : '') + '> ' + esc(t('ic.met')) + '</label></div>'; }).join('') + '<button type="button" class="linkbtn" data-pact="is-addprereq">' + esc(t('ic.addPrereq')) + '</button></div></fieldset>' +
        '<fieldset class="field"><legend class="label">' + esc(t('ic.docs')) + '</legend><div class="checks">' + docs.map(function (d) { var cr = st.currentRev(d); var val = d.id + ':' + cr.rev; return '<label class="check"><input type="checkbox" data-ismulti="docs" value="' + val + '"' + ((v.docs || []).indexOf(val) >= 0 ? ' checked' : '') + '> <span class="mono">' + esc(d.number) + '</span> ' + esc(t('doc.revShort', { rev: cr.rev })) + (d.status === 'withdrawn' ? ' ' + pill('crit', t('dstatus.withdrawn')) : '') + '</label>'; }).join('') + '</div><span class="field-hint">' + esc(t('ic.docs.hint')) + '</span></fieldset>' +
        (tv ? '<div class="notice">' + ic('reports') + '<span>' + esc(t('ic.templateUsed', { name: tp.name, v: tv.version, n: tv.items.length })) + (tp.testExample ? ' ' + pill('warn', t('tpl.test')) : '') + '</span></div>' : '');
      if (w) flags = st.scheduleFlags({ id: null, packageId: w.id, areaId: v.areaId, planned: v.planned, inspectorId: v.inspectorId, prerequisites: v.prereq.filter(function (x) { return String(x.text).trim(); }), docRefs: (v.docs || []).map(function (x) { var p = x.split(':'); return { id: p[0], rev: p[1] }; }) });
      var withdrawn = (v.docs || []).map(function (x) { return st.get('document', x.split(':')[0]); }).filter(function (d) { return d && d.status === 'withdrawn'; });
      withdrawn.forEach(function (d) { flags.push({ flag: 'document', doc: d, rev: st.latestRev(d).rev, state: 'withdrawn' }); });
    }
    var flagBox = flags.length ? '<div class="dup" role="status"><h3 class="sub-h">' + ic('alert') + ' ' + esc(t('ic.flags', { n: flags.length })) + '</h3><ul class="plain">' + flags.map(function (x) {
      return '<li>' + (x.flag === 'prerequisite' ? esc(t('ic.flag.prereq', { text: x.text })) : x.flag === 'document' ? esc(t('ic.flag.doc', { ref: x.doc.number, rev: x.rev, state: t('rstat4.' + x.state) })) : esc(t('ic.flag.' + x.flag, { ref: x.other.ref, date: fd(x.other.planned) }))) + '</li>';
    }).join('') + '</ul><p class="field-hint">' + esc(t('ic.flags.hint')) + '</p></div>' : '';
    return crumbs([[t('nav.home'), 'home'], [t('nav.inspections'), 'inspections'], [t('ic.schedule'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('ic.schedule')) + '</h1><p>' + esc(t('ic.schedule.sub')) + '</p></div></div>' +
      (r ? '<div class="notice">' + ic('requests') + '<span>' + esc(t('ic.fromRequest')) + ' </span>' + recLink('request', r.id) + '</div>' : '') +
      card(esc(t('dn.details')), '<form class="card-b stack" data-form="inspnew" novalidate>' + errBox(sc.serverError) + body + flagBox +
        '<div class="dlg-actions"><a class="btn btn-secondary" ' + go(r ? 'req.' + r.id : 'inspections') + '>' + esc(t('dlg.cancel')) + '</a><button class="btn btn-primary" type="submit" id="is-submit">' + esc(t('ic.scheduleBtn')) + '</button></div></form>');
  }
  function submitSchedule() {
    var sc = S().isch, v = sc.values;
    sc.errors = {}; sc.serverError = null;
    ['packageId', 'areaId', 'type', 'planned', 'inspectorId'].forEach(function (k) { if (!v[k]) sc.errors[k] = 'wiz.err.choose'; });
    if (!v.title || v.title.trim().length < 5) sc.errors.title = 'ins.err.title';
    if (!v.scope || v.scope.trim().length < 5) sc.errors.scope = 'ins.err.scope';
    if (Object.keys(sc.errors).length) { U().render(); X.focusInvalid(); return; }
    var r = API().dispatch('inspection.schedule', me().id, { idempotencyKey: sc.idem, packageId: v.packageId, areaId: v.areaId, type: v.type, title: v.title, scope: v.scope, planned: v.planned, inspectorId: v.inspectorId,
      attendees: v.attendees, prerequisites: v.prereq, docRefs: (v.docs || []).map(function (x) { var p = x.split(':'); return { id: p[0], rev: p[1] }; }), requestId: sc.key !== 'new' ? sc.key : null });
    if (r.ok) { S().isch = null; U().toast(t('ic.scheduledToast', { ref: r.result.ref }) + (r.result.flags.length ? ' ' + t('ic.withFlags', { n: r.result.flags.length }) : '')); U().go('insp.' + r.result.id); return; }
    sc.serverError = r.code; U().render();
  }

  // ---------------------------------------------------------------- 4. mobile field inspection
  function fldKey(id) { return 'rgs.field.' + id; }
  function fldState(id) {
    var s = S(); s.fld = s.fld || {};
    if (!s.fld[id]) {
      var i = ST().get('inspection', id), stored = load(fldKey(id));
      var base = JSON.parse(JSON.stringify((i && i.results) || {}));
      s.fld[id] = stored && stored.version === (i && i.version) && stored.dirty ? { results: stored.results, dirty: true, restored: true, version: i.version } : { results: base, dirty: false, version: i ? i.version : 0 };
    }
    return s.fld[id];
  }
  function persistFld(id) { var f = S().fld[id]; save(fldKey(id), { results: f.results, dirty: f.dirty, version: f.version }); }
  function fieldPage(u, args) {
    var st = ST(), i = st.get('inspection', args[0]);
    var g = h.guard(u, 'inspection', i); if (g) return g;
    var c = st.inspControls(u.id, i);
    if (!c.field) return U().deniedState({ code: i.status === 'awaiting_review' || i.status === 'completed' ? 'internal_record' : 'role' }, null) + '<p class="field-hint">' + esc(t('fi.notOpen', { state: t('istat.' + i.status) })) + '</p><a class="btn btn-secondary" ' + go('insp.' + i.id) + '>' + esc(t('fi.toDetail')) + '</a>';
    var f = fldState(i.id), temp = Object.assign({}, i, { results: f.results }), pr = st.fieldProgress(temp);
    var gapKeys = pr.gaps.map(function (x) { return x.key; });
    var items = i.items.map(function (it, n) {
      var r = f.results[it.key] || { result: 'not_assessed' }, v = r.result || 'not_assessed', gap = gapKeys.indexOf(it.key) >= 0;
      var seg = (POL('inspections').results || ['pass', 'fail', 'na', 'not_assessed']).map(function (x) { return '<label class="segopt so-' + x + (v === x ? ' sel' : '') + '"><input type="radio" name="r-' + it.key + '" value="' + x + '" data-fres="' + it.key + '"' + (v === x ? ' checked' : '') + '><span>' + esc(t('ires.' + x)) + '</span></label>'; }).join('');
      var needReason = v === 'fail' || v === 'na' || (v === 'not_assessed' && !it.required);
      return '<li class="fitem' + (gap ? ' gap' : '') + (v === 'fail' ? ' failed' : '') + '" id="fi-' + it.key + '"><div class="fi-h"><span class="fi-n mono">' + (n + 1) + '</span><div class="t"><b>' + esc(it.text) + '</b>' +
        '<span class="muted">' + (it.spec ? esc(it.spec) + ' · ' + esc(t('fi.clause')) + ' ' + esc(it.clause) + ' · ' : '') + esc(it.criterion) + '</span>' +
        '<span class="row" style="gap:6px">' + pill(it.required ? 'info' : 'plain', t(it.required ? 'dv.required' : 'dv.optional')) + (it.evidence ? pill('plain', t('fi.evidenceNeeded', { what: it.evidence })) : '') + (it.witness ? pill('warn', it.witness) : '') + '</span></div></div>' +
        '<fieldset class="seg-res" aria-label="' + esc(t('fi.result') + ' ' + (n + 1)) + '">' + seg + '</fieldset>' +
        (gap ? '<div class="field-error">' + ic('alert') + esc(t(pr.gaps.filter(function (x) { return x.key === it.key; })[0].why === 'reason' ? 'fi.err.reason' : 'fi.err.assess')) + '</div>' : '') +
        (needReason || r.reason ? '<div class="field"><label for="fr-' + it.key + '">' + esc(t(v === 'fail' ? 'fi.reasonFail' : 'fi.reason')) + '</label><textarea id="fr-' + it.key + '" class="textarea" rows="2" data-ftext="reason" data-fkey="' + it.key + '">' + esc(r.reason || '') + '</textarea></div>' : '') +
        (it.unit ? '<div class="field fi-meas"><label for="fm-' + it.key + '">' + esc(t('fi.measurement')) + ' (' + esc(it.unit) + ')</label><input id="fm-' + it.key + '" class="input num" inputmode="decimal" data-ftext="measurement" data-fkey="' + it.key + '" value="' + esc(r.measurement || '') + '"><span class="field-hint">' + esc(t('fi.noThreshold')) + '</span></div>' : '') +
        '<div class="field"><label for="fn-' + it.key + '">' + esc(t('fi.note')) + ' ' + esc(t('dlg.optional')) + '</label><input id="fn-' + it.key + '" class="input" data-ftext="note" data-fkey="' + it.key + '" value="' + esc(r.note || '') + '"></div>' +
        evChips(u.id, r.evidence) + X.uploadControl('fieldev-' + i.id + '-' + it.key, t('fi.photo')) + '</li>';
    }).join('');
    var pct = pr.total ? Math.round(pr.assessed / pr.total * 100) : 0;
    return '<div class="field-page">' + crumbs([[t('nav.inspections'), 'inspections'], [i.ref, 'insp.' + i.id], [t('fi.title'), null]]) +
      '<div class="page-h"><div><span class="eyebrow mono">' + esc(i.ref) + ' · ' + esc(t('ins.revN', { rev: i.rev })) + '</span><h1>' + esc(i.title) + '</h1><p>' + esc(areaName(i.areaId)) + ' · ' + esc(t('fi.template', { v: i.templateVersion })) + '</p></div></div>' +
      (f.restored ? '<div class="notice">' + ic('info') + '<span>' + esc(t('fi.restored')) + '</span></div>' : '') +
      '<section class="card card-b fi-progress" aria-live="polite"><div class="row-between"><b>' + esc(t('fi.progress', { n: pr.assessed, m: pr.total })) + '</b>' + (pr.gaps.length ? pill('warn', t('fi.incomplete', { n: pr.gaps.length })) : pill('ok', t('fi.readyToSubmit'))) + '</div>' + h.bar(pct, t('fi.title')) +
      (f.dirty ? '<p class="field-hint">' + esc(t('fi.unsaved')) + '</p>' : '<p class="field-hint">' + esc(t('fi.saved')) + '</p>') + '</section>' +
      errBox(f.serverError) + '<ol class="fitems">' + items + '</ol>' +
      '<div class="fi-bar"><button type="button" class="btn btn-secondary" data-pact="fi-save">' + esc(t('fi.saveDraft')) + '</button><button type="button" class="btn btn-primary" data-pact="fi-submit"' + (pr.complete ? '' : ' aria-disabled="true"') + '>' + esc(t('fi.submit')) + '</button></div>' +
      '<p class="field-hint">' + esc(t('fi.offline')) + '</p><p class="field-hint">' + esc(t('ic.outcomeRule')) + '</p></div>';
  }
  function fieldSave(id, submit) {
    var i = ST().get('inspection', id), f = fldState(id), u = me();
    f.serverError = null;
    var r = API().dispatch('inspection.saveField', u.id, { id: id, version: i.version, results: f.results });
    if (!r.ok) { f.serverError = r.code; U().render(); return; }
    f.dirty = false; f.restored = false; f.version = ST().get('inspection', id).version; save(fldKey(id), null);
    if (!submit) { U().toast(t('fi.savedToast')); U().render(); return; }
    var i2 = ST().get('inspection', id);
    var r2 = API().dispatch('inspection.submitField', u.id, { id: id, version: i2.version });
    if (!r2.ok) { f.serverError = r2.code; U().render(); var gap = document.querySelector('.fitem.gap'); if (gap) gap.scrollIntoView({ block: 'center' }); return; }
    S().fld[id] = null; U().toast(t('fi.submitted')); U().go('insp.' + id);
  }

  // ---------------------------------------------------------------- 5. inspection detail and review
  function idState(id) { var s = S(); if (!s.idd || s.idd.id !== id) s.idd = { id: id, form: null, errors: {}, values: {} }; return s.idd; }
  function inspectionDetail(u, args) {
    var st = ST(), i = st.get('inspection', args[0]);
    var g = h.guard(u, 'inspection', i); if (g) return g;
    var c = st.inspControls(u.id, i), dd = idState(i.id), cust = st.isCustomer(u.id), staff = !cust;
    var pr = st.fieldProgress(i);
    var banner = '<div class="notice ' + (i.status === 'completed' ? '' : 'warn') + '" role="status">' + ic('shield') + '<span><b>' + esc(t('istat.' + i.status)) + '.</b> ' + esc(t('id.state.' + i.status)) + ' ' + esc(t('ic.outcomeRule')) + '</span></div>';
    var findings = st.inspFindings(u.id, i);
    var rows = i.items.map(function (it, n) {
      var r = (i.results || {})[it.key] || { result: 'not_assessed' };
      var fs = findings.filter(function (f) { return f.itemKey === it.key; });
      return '<li class="ditem r-' + r.result + '"><div class="fi-h"><span class="fi-n mono">' + (n + 1) + '</span><div class="t"><b>' + esc(it.text) + '</b><span class="muted">' + (it.spec ? esc(it.spec) + ' · ' + esc(t('fi.clause')) + ' ' + esc(it.clause) + ' · ' : '') + esc(it.criterion) + '</span></div>' + resPill(r.result) + '</div>' +
        (r.reason ? '<p class="muted">' + esc(t('fi.reason')) + ': ' + esc(r.reason) + '</p>' : '') + (r.measurement ? '<p><span class="label">' + esc(t('fi.measurement')) + '</span> <span class="num">' + esc(r.measurement + ' ' + (it.unit || '')) + '</span></p>' : '') + (r.note ? '<p class="muted">' + esc(r.note) + '</p>' : '') +
        evChips(u.id, r.evidence) + (fs.length ? '<p>' + fs.map(function (f) { return recLink('finding', f.id); }).join(' ') + '</p>' : '') +
        (staff && c.raiseFinding && r.result === 'fail' && !fs.length ? '<a class="btn btn-secondary btn-sm" ' + go('fndnew.' + i.id + '.' + it.key) + '>' + pic('flag') + esc(t('fnd.raise')) + '</a>' : '') + '</li>';
    }).join('');
    var checklist = card(esc(t('id.checklist')) + ' <span class="pill plain num">' + i.items.length + '</span>', '<div class="card-b stack"><p class="field-hint">' + esc(t('id.templateNote', { v: i.templateVersion })) + '</p>' +
      (i.status === 'in_progress' || i.status === 'scheduled' ? '<p>' + esc(t('fi.progress', { n: pr.assessed, m: pr.total })) + (pr.gaps.length ? ' ' + pill('warn', t('fi.incomplete', { n: pr.gaps.length })) : '') + '</p>' : '') + '<ol class="ditems">' + rows + '</ol></div>');
    // the four decisions, kept separate
    var cs = h.custSignoff(i);
    var decisions = card(esc(t('id.decisions')), '<ul class="droute card-b">' +
      decRow(t('id.d.field'), i.field ? esc(t('id.by', { who: person(i.field.by), date: fdt(i.field.at) })) + ' · ' + esc(t('ins.revN', { rev: i.field.rev })) : esc(t(i.status === 'in_progress' ? 'id.inField' : 'ins.notYet')), !!i.field) +
      decRow(t('id.d.verify'), i.verification ? esc(t('id.by', { who: person(i.verification.by), date: fdt(i.verification.at) })) + ' · ' + esc(t('ins.revN', { rev: i.verification.rev })) + (i.verification.authority ? ' · <span class="mono">' + esc(i.verification.authority) + '</span>' : '') + '<br>' + pill(i.verification.outcome === 'rejected' ? 'crit' : 'ok', t('vout.' + i.verification.outcome)) + (i.verification.reason ? ' <span class="muted">“' + esc(i.verification.reason) + '”</span>' : '') : esc(t(i.status === 'awaiting_review' ? 'id.awaitingVerify' : 'ins.notYet')), !!i.verification) +
      decRow(t('id.d.witness'), (i.witnesses || []).length ? i.witnesses.map(function (w) { return esc(t('id.by', { who: person(w.by), date: fdt(w.at) })) + ' · ' + esc(t('ins.revN', { rev: w.rev })); }).join('<br>') : esc(t((i.attendees || []).some(function (x) { return st.isCustomer(x); }) ? 'id.witnessInvited' : 'id.noWitness')), (i.witnesses || []).length > 0) +
      decRow(t('id.d.accept'), cs, false) + '</ul><p class="field-hint card-b">' + esc(t('id.separate')) + '</p>');
    var docs = card(esc(t('ic.docs')), (i.docRefs || []).length ? '<ul class="doclist">' + i.docRefs.map(function (ref) { var d = st.get('document', ref.id), fl = st.refFlagFor(ref.id, ref.rev); return '<li>' + recLink('document', ref.id) + '<span class="t"><b>' + esc(d ? d.title : ref.id) + '</b><span class="mono">' + esc(t('doc.revShort', { rev: ref.rev })) + '</span></span>' + (fl ? pill(fl.state === 'withdrawn' ? 'crit' : 'warn', t('dv.flag.' + fl.state, { cur: fl.current || '—' })) : '') + '</li>'; }).join('') + '</ul><p class="field-hint card-b">' + esc(t('dv.flagNote')) + '</p>' : emptyBox('documents', t('dv.noLinks')));
    var people = card(esc(t('id.participants')), '<div class="card-b stack">' + kv([[t('ic.responsible'), personRole(i.inspectorId)], [t('ic.attendees'), (i.attendees || []).filter(function (x) { return x !== i.inspectorId; }).map(personRole).join('<br>') || '—'],
      [t('ic.scheduled'), esc(fd(i.planned))], [t('ins.scope'), esc(i.scope || '')], i.requestId ? [t('ic.fromRequest'), recLink('request', i.requestId)] : null, i.reinspectionOf ? [t('id.reinspectionOf'), recLink('inspection', i.reinspectionOf)] : null,
      i.correctiveActionId ? [t('kindname.corrective'), recLink('corrective', i.correctiveActionId)] : null]) +
      ((i.prerequisites || []).length ? '<h3 class="sub-h">' + esc(t('ic.prereq')) + '</h3><ul class="plain">' + i.prerequisites.map(function (p) { return '<li>' + (p.met ? pill('ok', t('ic.met')) : pill('warn', t('ic.notMet'))) + ' ' + esc(p.text) + '</li>'; }).join('') + '</ul>' : '') + '</div>');
    var amend = (i.amendments || []).length ? card(esc(t('id.amendments')), '<ol class="revlist card-b">' + i.amendments.map(function (a) { return '<li><b>' + esc(t('ins.revN', { rev: a.rev })) + ' → ' + esc(t('ins.revN', { rev: a.rev + 1 })) + '</b><span>' + esc(a.reason) + '</span><span class="muted">' + esc(person(a.by) + ' · ' + fdt(a.at)) + (a.verification ? ' · ' + esc(t('id.prevVerified', { who: person(a.verification.by) })) : '') + '</span></li>'; }).join('') + '</ol>') : '';
    var hist = st.activity(u.id, {}).filter(function (e) { return e.ref.kind === 'inspection' && e.ref.id === i.id; });
    var histCard = card(esc(t('rd.history')), hist.length ? '<div class="card-b">' + h.timeline(u, hist, true) + '</div>' : emptyBox('reports', t('tl.none')));
    // actions
    var a = [];
    if (c.field) a.push('<a class="btn btn-primary" ' + go('field.' + i.id) + '>' + ic('inspections') + esc(t(i.status === 'scheduled' ? 'id.startField' : 'id.continueField')) + '</a>');
    if (c.verify) a.push('<button class="btn btn-primary" data-pact="id-form" data-v="verify">' + esc(t('id.f.verify')) + '</button>');
    if (c.returnField) a.push('<button class="btn btn-secondary" data-pact="id-form" data-v="return">' + esc(t('id.f.return')) + '</button>');
    if (c.witness) a.push('<button class="btn btn-primary" data-pact="id-form" data-v="witness">' + esc(t('id.f.witness')) + '</button>');
    if (c.publish) a.push('<button class="btn btn-secondary" data-pact="id-form" data-v="publish">' + esc(t('id.f.publish')) + '</button>');
    if (c.amend) a.push('<button class="btn btn-secondary" data-pact="id-form" data-v="amend">' + esc(t('id.f.amend')) + '</button>');
    if (c.raiseFinding) a.push('<a class="btn btn-secondary" ' + go('fndnew.' + i.id) + '>' + pic('flag') + esc(t('fnd.raise')) + '</a>');
    if (c.cancel) a.push('<button class="btn btn-ghost" data-pact="id-form" data-v="cancel">' + esc(t('id.f.cancel')) + '</button>');
    if (i.status === 'awaiting_review' && !c.verify && staff) a.push('<span class="why">' + esc(!c.verifyCheck.allowed ? t('reason.' + (c.verifyCheck.code || 'role')) : c.selfVerify ? t('reason.self_approval') : t('reason.role')) + '</span>');
    var acts = a.length || dd.form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + (dd.form ? inspForm(u, i, dd, c) : '') + '</div>') : '';
    var aiCard = staff ? aiInspection(u, i) : '';
    var chain = chainCard(u, 'inspection', i.id);
    var main = banner + checklist + decisions + chain + amend + histCard;
    var side = acts + people + docs + h.actionsForRecord(u, 'inspection', i.id) + aiCard;
    return h.recordShell(u, 'inspection', i, i.title, istat(i.status) + (i.publishedAt ? '' : ' ' + pill('plain', t('misc.internal'))), main, side);
  }
  function decRow(label, body, done) { return '<li class="dr ' + (done ? 'dr-done' : 'dr-later') + '"><span class="dr-dot">' + pic(done ? 'check' : 'clock') + '</span><div class="t"><b>' + esc(label) + '</b><span>' + body + '</span></div></li>'; }
  function inspForm(u, i, dd, c) {
    var f = dd.form, e = dd.errors, v = dd.values, body = '';
    var submit = function (label, danger) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="id-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(label) + '</button></div>'; };
    var reason = function (label, opt) { return '<div class="field"><label for="idf-reason">' + esc(label) + (opt ? ' ' + esc(t('dlg.optional')) : '') + '</label><textarea id="idf-reason" name="reason" class="textarea" rows="2"' + inv(e, 'reason', 'idf-reason') + '>' + esc(v.reason || '') + '</textarea>' + fe(e, 'reason', 'idf-reason') + '</div>'; };
    if (f === 'verify') {
      body = '<p class="field-hint">' + esc(t('id.verifyHint', { rev: i.rev })) + '</p><p class="field-hint">' + esc(c.verifyCheck.authority ? t('id.underAuthority', { id: c.verifyCheck.authority }) : '') + '</p><fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="choices compact">' +
        ['accepted', 'accepted_observations', 'rejected'].map(function (o) { return '<label class="choice' + (v.outcome === o ? ' sel' : '') + '"><input type="radio" name="outcome" value="' + o + '"' + (v.outcome === o ? ' checked' : '') + '><span class="t"><b>' + esc(t('vout.' + o)) + '</b></span></label>'; }).join('') + '</div>' + fe(e, 'outcome', 'idf-outcome') + '</fieldset>' +
        reason(t('dv.reason'), v.outcome === 'accepted') + '<label class="check"><input type="checkbox" name="confirm" value="1"' + inv(e, 'confirm', 'idf-confirm') + '> ' + esc(t('id.confirm', { rev: i.rev })) + '</label>' + fe(e, 'confirm', 'idf-confirm') +
        '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('id.notRelease')) + '</span></div>' + submit(t('id.f.verify'));
    } else if (f === 'return') body = reason(t('dv.reason')) + submit(t('id.f.return'));
    else if (f === 'witness') body = '<p class="field-hint">' + esc(t('id.witnessHint')) + '</p><div class="field"><label for="idf-note">' + esc(t('fi.note')) + ' ' + esc(t('dlg.optional')) + '</label><input id="idf-note" name="note" class="input"></div>' + submit(t('id.f.witness'));
    else if (f === 'publish') body = '<p class="field-hint">' + esc(t('id.publishHint')) + '</p>' + submit(t('id.f.publish'));
    else if (f === 'amend') body = '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('id.amendHint')) + '</span></div>' + reason(t('dv.reason')) + submit(t('id.f.amend'));
    else if (f === 'cancel') body = reason(t('dv.reason')) + submit(t('id.f.cancel'), true);
    return '<form class="stack rd-form" data-form="insp-' + f + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(t('id.f.' + f)) + '</h3>' + errBox(dd.serverError) + body + '</form>';
  }
  function submitInspForm(form) {
    var dd = S().idd, i = ST().get('inspection', dd.id), fdat = new FormData(form), f = form.getAttribute('data-form').slice(5), val = function (k) { return (fdat.get(k) || '').toString().trim(); };
    dd.errors = {}; dd.serverError = null; dd.values.reason = val('reason'); dd.values.outcome = val('outcome') || dd.values.outcome;
    var cmd, payload = { id: i.id, version: i.version }, toast;
    if (f === 'verify') {
      if (!val('outcome')) dd.errors.outcome = 'dv.err.outcome';
      else if (val('outcome') !== 'accepted' && val('reason').length < 5) dd.errors.reason = 'rd.err.reason';
      if (!fdat.get('confirm')) dd.errors.confirm = 'dlg.err.confirm';
      cmd = 'inspection.verify'; payload.rev = i.rev; payload.outcome = val('outcome'); payload.reason = val('reason'); toast = t('id.done.verify');
    } else if (f === 'return') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'inspection.returnField'; payload.reason = val('reason'); toast = t('id.done.return'); }
    else if (f === 'witness') { cmd = 'inspection.witness'; payload.note = val('note'); toast = t('id.done.witness'); }
    else if (f === 'publish') { cmd = 'inspection.publish'; toast = t('id.done.publish'); }
    else if (f === 'amend') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'inspection.amend'; payload.reason = val('reason'); toast = t('id.done.amend'); }
    else if (f === 'cancel') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'inspection.cancel'; payload.reason = val('reason'); toast = t('id.done.cancel'); }
    if (Object.keys(dd.errors).length) { U().render(); X.focusInvalid(); return; }
    var r = API().dispatch(cmd, me().id, payload);
    if (r.ok) { S().idd = { id: i.id, form: null, errors: {}, values: {} }; U().toast(toast); U().render(); return; }
    dd.serverError = r.code; U().render();
  }
  function aiInspection(u, i) {
    var miss = i.items.filter(function (it) { var r = (i.results || {})[it.key]; return r && r.result === 'fail' && !(r.evidence || []).length; });
    var gaps = i.items.filter(function (it) { var r = (i.results || {})[it.key]; return it.evidence && r && r.result === 'pass' && !(r.evidence || []).length; });
    if (!miss.length && !gaps.length) return '';
    return card(pic('ai') + ' ' + esc(t('ai.checks')), '<div class="card-b stack"><div class="suggest" role="note"><span class="sg-h">' + pic('ai') + esc(t('ai.suggestion')) + '</span>' +
      (miss.length ? '<p>' + esc(t('ai.failNoEvidence', { n: miss.length })) + '</p><ul class="plain">' + miss.map(function (it) { return '<li>' + esc(it.text) + '</li>'; }).join('') + '</ul>' : '') +
      (gaps.length ? '<p>' + esc(t('ai.passNoEvidence', { n: gaps.length })) + '</p><ul class="plain">' + gaps.map(function (it) { return '<li>' + esc(it.text) + ' — ' + esc(it.evidence) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="muted">' + esc(t('ai.qualityNote')) + '</p></div></div>');
  }
  // original inspection → finding → corrective action → reinspection → verification
  function chainCard(u, kind, id) {
    var st = ST(), ch = st.chainFor(u.id, kind, id);
    if (!ch.findings.length && !(ch.root && ch.root.reinspectionOf)) return '';
    var steps = function (x) {
      var f = x.finding;
      var actions = x.actions.filter(function (a) { return a.visible; }).map(function (a) {
        var c = a.action;
        return '<li class="ch-step"><span class="ch-k">' + esc(t('kindname.corrective')) + '</span>' + recLink('corrective', c.id) + ' ' + caPill(c.status) +
          (a.reinspection ? '</li><li class="ch-step"><span class="ch-k">' + esc(t('ch.reinspection')) + '</span>' + recLink('inspection', a.reinspection.id) + ' ' + (a.reinspectionVisible ? istat(a.reinspection.status) : '') : '') +
          '</li><li class="ch-step"><span class="ch-k">' + esc(t('ch.verification')) + '</span>' + (c.verification ? esc(t('id.by', { who: person(c.verification.by), date: fdt(c.verification.at) })) + (c.verification.authority ? ' · <span class="mono">' + esc(c.verification.authority) + '</span>' : '') : '<span class="muted">' + esc(t('ins.notYet')) + '</span>') + '</li>';
      }).join('');
      return '<li class="ch-step"><span class="ch-k">' + esc(t('ch.finding')) + '</span>' + recLink('finding', f.id) + ' ' + fstat(f.status) + '</li>' + actions;
    };
    return card(esc(t('ch.title')), '<div class="card-b stack"><ol class="chain">' + (ch.root ? '<li class="ch-step"><span class="ch-k">' + esc(t('ch.original')) + '</span>' + recLink('inspection', ch.root.id) + ' ' + istat(ch.root.status) + (ch.root.result ? ' ' + pill(ch.root.result === 'rejected' ? 'crit' : 'ok', t('result.' + ch.root.result)) : '') + '</li>' : '') +
      ch.findings.filter(function (x) { return x.visible; }).map(steps).join('') + '</ol><p class="field-hint">' + esc(t('ch.note')) + '</p></div>');
  }

  // ---------------------------------------------------------------- 6. findings register
  function fnState() { var s = S(); if (!s.fnf) s.fnf = { project: '', classification: '', severity: '', status: 'open' }; return s.fnf; }
  function findingsPage(u) {
    var st = ST(), f = fnState(), cust = st.isCustomer(u.id), list = st.findingsList(u.id, f), all = st.findingsList(u.id, {});
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="fnf.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var head = [t('misc.ref'), t('fnd.description'), t('fnd.class'), t('fnd.severity'), t('rq.area'), t('rq.owner'), t('fnd.target'), t('f.status'), t('kindname.corrective')].concat(cust ? [] : [t('fnd.visibility')]);
    var rows = list.map(function (x) {
      var cas = x.correctiveActionIds.map(function (id) { return st.get('corrective', id); }).filter(Boolean);
      return '<tr><td>' + recLink('finding', x.id) + '</td><td><a ' + go('fnd.' + x.id) + '>' + esc(x.description) + '</a>' + (x.inspectionId ? '<br>' + recLink('inspection', x.inspectionId) : '<br><span class="muted">' + esc(t('fnd.src.observation')) + '</span>') + '</td><td>' + clsTag(x.classification) + '</td><td>' + sevPill(x.severity) + ' <span class="muted">' + esc(t('fnd.proposed')) + '</span></td>' +
        '<td>' + esc(areaName(x.areaId)) + '</td><td>' + esc(person(x.ownerId)) + '</td><td>' + dueCell(x.targetDate, x.status === 'closed') + '</td><td>' + fstat(x.status) + '</td><td>' + (cas.map(function (c) { return recLink('corrective', c.id) + ' ' + caPill(c.status); }).join('<br>') || '—') + '</td>' + (cust ? '' : '<td>' + (x.customerVisible ? pill('info', t('fnd.custVisible')) : pill('plain', t('misc.internal'))) + '</td>') + '</tr>';
    });
    var ai = cust ? '' : aiQualityCard(u, f.project);
    var canRaise = !cust && canAnywhere(u.id, 'finding.raise');
    return crumbs([[t('nav.home'), 'home'], [t('nav.findings'), null]]) + '<div class="page-h"><div><h1>' + esc(t('fnd.title')) + '</h1><p>' + esc(t(cust ? 'fnd.sub.customer' : 'fnd.sub.staff')) + '</p></div>' + (canRaise ? '<a class="btn btn-primary" ' + go('fndnew') + '>' + pic('flag') + esc(t('fnd.raiseObs')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('fnd.rule')) + '</span></div>' +
      '<section class="card card-b act-tools">' + sel('fn-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(st.visibleProjects(u.id).map(function (p) { return [p.id, p.code]; }))) +
      sel('fn-class', 'classification', t('fnd.class'), [['', t('f.all')]].concat((POL('findings').classifications || []).map(function (x) { return [x, t('fcls.' + x)]; }))) +
      sel('fn-sev', 'severity', t('fnd.severity'), [['', t('f.all')]].concat((POL('findings').severities || []).map(function (x) { return [x, t('sev.' + x)]; }))) +
      sel('fn-status', 'status', t('f.status'), [['open', t('rq.f.open')], ['all', t('f.all')], ['closed', t('fstat.closed')]]) + '</section>' +
      '<p class="muted" role="status">' + esc(t('rq.count', { n: list.length, m: all.length })) + '</p>' +
      card(esc(t('fnd.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table(head, rows, 'fntable') : emptyBox('flag', t('fnd.none'))) + ai;
  }
  function aiQualityCard(u, pid) {
    var st = ST(), q = st.aiQuality(u.id, pid || null);
    var counts = Object.keys(q.byClass).map(function (k) { return t('fcls.' + k) + ': ' + q.byClass[k]; }).join(' · ');
    return card(pic('ai') + ' ' + esc(t('ai.quality')), '<div class="card-b stack"><div class="notice warn">' + ic('info') + '<span>' + esc(t('ai.qualityNote')) + '</span></div>' +
      '<p><b>' + esc(t('ai.openByClass')) + '</b> ' + esc(counts || '0') + '</p>' +
      '<h3 class="sub-h">' + esc(t('ai.missingEvidence')) + ' <span class="pill plain num">' + q.missing.length + '</span></h3>' + (q.missing.length ? '<ul class="doclist">' + q.missing.map(function (m) { return '<li>' + recLink(m.kind, m.rec.id) + '<span class="t"><span>' + esc(t('ai.miss.' + m.kind)) + (m.item ? ' · ' + esc(m.item) : '') + '</span></span></li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('chk.clear')) + '</p>') +
      '<h3 class="sub-h">' + esc(t('ai.recurring')) + '</h3>' + (q.recurring.length ? '<ul class="doclist">' + q.recurring.map(function (r) { return '<li><span class="t"><b>' + esc(areaName(r.area)) + '</b><span>' + r.findings.map(function (f) { return recLink('finding', f.id); }).join(' ') + (r.words ? ' · ' + esc(t('dup.words', { v: r.words.join(', ') })) : '') + '</span></span></li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('chk.clear')) + '</p>') + '</div>');
  }
  function fnNewState(key) { var s = S(); if (!s.fnn || s.fnn.key !== key) s.fnn = { key: key, values: { classification: '', severity: '', evidence: [], customerVisible: false }, errors: {}, idem: 'fn-' + X.rnd() }; return s.fnn; }
  function findingNew(u, args) {
    var st = ST(), i = args[0] && st.get('inspection', args[0]), key = args.join('.') || 'obs';
    if (args[0]) { var g = h.guard(u, 'inspection', i); if (g) return g; }
    var fn = fnNewState(key), v = fn.values, e = fn.errors;
    if (i) { v.packageId = i.packageId; v.areaId = v.areaId || i.areaId; v.inspectionId = i.id; v.itemKey = args[1] || v.itemKey || ''; if (!v.description && v.itemKey) { var it = i.items.filter(function (x) { return x.key === v.itemKey; })[0], rr = (i.results || {})[v.itemKey]; v.description = (it ? it.text : '') + (rr && rr.reason ? ' — ' + rr.reason : ''); if (rr) v.evidence = (rr.evidence || []).slice(); } }
    var pkgs = []; st.visibleProjects(u.id).forEach(function (p) { pkgs = pkgs.concat(st.visiblePackages(u.id, p.id).filter(function (w) { return can(u.id, 'finding.raise', { packageId: w.id }); })); });
    if (!pkgs.length) return U().deniedState({ code: 'role' }, null);
    var w = v.packageId && st.get('package', v.packageId);
    var areas = w ? st.areas(w.projectId).filter(function (a) { return a.id === w.areaId || a.parentId === w.areaId; }) : [];
    var owners = w ? U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, 'corrective.respond', { packageId: w.id }); }) : [];
    var evs = w ? st.evidence(u.id, null, w.id) : [];
    var body = (i ? '<div class="notice">' + ic('inspections') + '<span>' + esc(t('fnd.fromInspection')) + ' </span>' + recLink('inspection', i.id) + (v.itemKey ? ' · ' + esc(v.itemKey) : '') + '</div>' :
      '<div class="field"><label for="fn-package">' + esc(t('misc.package')) + '</label><select id="fn-package" class="select" data-fnbind="packageId"' + inv(e, 'packageId', 'fn-package') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + pkgs.map(function (x) { return '<option value="' + x.id + '"' + (v.packageId === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + t('svc.' + x.service)) + '</option>'; }).join('') + '</select>' + fe(e, 'packageId', 'fn-package') + '</div>') +
      (w ? '<div class="field"><label for="fn-area">' + esc(t('rq.area')) + '</label><select id="fn-area" class="select" data-fnbind="areaId"' + inv(e, 'areaId', 'fn-area') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (v.areaId === a.id ? ' selected' : '') + '>' + esc(a.code + ' · ' + L(a, 'name')) + '</option>'; }).join('') + '</select>' + fe(e, 'areaId', 'fn-area') + '</div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('fnd.class')) + '</legend><div class="choices compact">' + (POL('findings').classifications || []).map(function (x) { return '<label class="choice' + (v.classification === x ? ' sel' : '') + '"><input type="radio" name="classification" value="' + x + '" data-fnbind="classification"' + (v.classification === x ? ' checked' : '') + '><span class="t"><b>' + esc(t('fcls.' + x)) + '</b><span class="muted">' + esc(t('fcls.' + x + '.d')) + '</span></span></label>'; }).join('') + '</div>' + fe(e, 'classification', 'fn-class') + '<span class="field-hint">' + esc(t('fnd.classesProposed')) + '</span></fieldset>' +
        '<div class="grid g-2"><div class="field"><label for="fn-sev">' + esc(t('fnd.severity')) + '</label><select id="fn-sev" class="select" data-fnbind="severity"' + inv(e, 'severity', 'fn-sev') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + (POL('findings').severities || []).map(function (x) { return '<option value="' + x + '"' + (v.severity === x ? ' selected' : '') + '>' + esc(t('sev.' + x)) + '</option>'; }).join('') + '</select><span class="field-hint">' + esc(t('fnd.sevProposed')) + '</span>' + fe(e, 'severity', 'fn-sev') + '</div>' +
        '<div class="field"><label for="fn-target">' + esc(t('fnd.target')) + '</label><input id="fn-target" type="date" class="input" min="' + st.today + '" data-fnbind="targetDate" value="' + esc(v.targetDate || '') + '"' + inv(e, 'targetDate', 'fn-target') + '>' + fe(e, 'targetDate', 'fn-target') + '</div></div>' +
        '<div class="field"><label for="fn-desc">' + esc(t('fnd.description')) + '</label><textarea id="fn-desc" class="textarea" rows="3" data-fntext="description"' + inv(e, 'description', 'fn-desc') + '>' + esc(v.description || '') + '</textarea>' + fe(e, 'description', 'fn-desc') + '</div>' +
        '<div class="field"><label for="fn-cont">' + esc(t('fnd.containment')) + '</label><textarea id="fn-cont" class="textarea" rows="2" data-fntext="containment">' + esc(v.containment || '') + '</textarea><span class="field-hint">' + esc(t('fnd.containment.hint')) + '</span></div>' +
        '<div class="field"><label for="fn-owner">' + esc(t('rq.owner')) + '</label><select id="fn-owner" class="select" data-fnbind="ownerId"' + inv(e, 'ownerId', 'fn-owner') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + owners.map(function (x) { return '<option value="' + x.id + '"' + (v.ownerId === x.id ? ' selected' : '') + '>' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select>' + fe(e, 'ownerId', 'fn-owner') + '</div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('fnd.evidence')) + '</legend><div class="checks">' + (evs.length ? evs.map(function (x) { return '<label class="check"><input type="checkbox" data-fnmulti="evidence" value="' + x.id + '"' + ((v.evidence || []).indexOf(x.id) >= 0 ? ' checked' : '') + '> <span class="mono">' + esc(x.ref) + '</span> ' + esc(x.caption) + '</label>'; }).join('') : '<span class="muted">' + esc(t('ev.none')) + '</span>') + '</div></fieldset>' +
        '<label class="check"><input type="checkbox" data-fnbind="customerVisible" value="1"' + (v.customerVisible ? ' checked' : '') + '> ' + esc(t('fnd.showCustomer')) + '</label><p class="field-hint">' + esc(t('fnd.visibility.hint')) + '</p>' : '');
    return crumbs([[t('nav.home'), 'home'], [t('nav.findings'), 'findings'], [t('fnd.raise'), null]]) + '<div class="page-h"><div><h1>' + esc(t(i ? 'fnd.raise' : 'fnd.raiseObs')) + '</h1><p>' + esc(t('fnd.raise.sub')) + '</p></div></div>' +
      card(esc(t('dn.details')), '<form class="card-b stack" data-form="fndnew" novalidate>' + errBox(fn.serverError) + body + '<div class="dlg-actions"><a class="btn btn-secondary" ' + go(i ? 'insp.' + i.id : 'findings') + '>' + esc(t('dlg.cancel')) + '</a><button class="btn btn-primary" type="submit">' + esc(t('fnd.save')) + '</button></div></form>');
  }
  function submitFinding() {
    var fn = S().fnn, v = fn.values;
    fn.errors = {}; fn.serverError = null;
    ['packageId', 'areaId', 'classification', 'severity', 'ownerId', 'targetDate'].forEach(function (k) { if (!v[k]) fn.errors[k] = 'wiz.err.choose'; });
    if (!v.description || v.description.trim().length < 10) fn.errors.description = 'wiz.err.description';
    if (Object.keys(fn.errors).length) { U().render(); X.focusInvalid(); return; }
    var r = API().dispatch('finding.raise', me().id, { idempotencyKey: fn.idem, packageId: v.packageId, areaId: v.areaId, inspectionId: v.inspectionId || null, itemKey: v.itemKey || null, classification: v.classification, severity: v.severity,
      description: v.description, containment: v.containment, ownerId: v.ownerId, targetDate: v.targetDate, evidence: v.evidence, customerVisible: !!v.customerVisible });
    if (r.ok) { S().fnn = null; U().toast(t('fnd.saved', { ref: r.result.ref })); U().go('fnd.' + r.result.id); return; }
    fn.serverError = r.code; U().render();
  }
  function fdState(id) { var s = S(); if (!s.fdd || s.fdd.id !== id) s.fdd = { id: id, form: null, errors: {}, values: {} }; return s.fdd; }
  function findingDetail(u, args) {
    var st = ST(), f = st.get('finding', args[0]);
    var g = h.guard(u, 'finding', f); if (g) return g;
    var dd = fdState(f.id), cust = st.isCustomer(u.id), res = { packageId: f.packageId };
    var mgr = !cust && can(u.id, 'finding.manage', res), caMgr = !cust && can(u.id, 'corrective.manage', res);
    var cas = f.correctiveActionIds.map(function (id) { return st.get('corrective', id); }).filter(function (c) { return c && st.canSee(u.id, 'corrective', c); });
    var main = card(esc(t('rec.details')), '<div class="card-b stack"><p class="lead">' + esc(f.description) + '</p>' + kv([[t('fnd.class'), clsTag(f.classification)], [t('fnd.severity'), sevPill(f.severity) + ' <span class="muted">' + esc(t('fnd.proposed')) + '</span>'],
      [t('f.status'), fstat(f.status)], [t('fnd.source'), f.inspectionId ? recLink('inspection', f.inspectionId) + (f.itemKey ? ' · ' + esc(f.itemKey) : '') : esc(t('fnd.src.observation'))], [t('rq.area'), esc(areaName(f.areaId))],
      [t('rq.owner'), personRole(f.ownerId)], [t('fnd.target'), dueCell(f.targetDate, f.status === 'closed')], [t('fnd.raisedBy'), esc(person(f.raisedBy) + ' · ' + fdt(f.raisedAt))], cust ? null : [t('fnd.visibility'), f.customerVisible ? pill('info', t('fnd.custVisible')) : pill('plain', t('misc.internal'))]]) +
      '<h3 class="sub-h">' + esc(t('fnd.containment')) + '</h3><p>' + (f.containment ? esc(f.containment) : '<span class="late">' + esc(t('fnd.noContainment')) + '</span>') + '</p>' +
      '<h3 class="sub-h">' + esc(t('fnd.evidence')) + '</h3>' + (evChips(u.id, f.evidence) || '<p class="muted">' + esc(t('ev.none')) + '</p>') +
      ((f.escalations || []).length && !cust ? '<h3 class="sub-h">' + esc(t('fnd.escalations')) + '</h3><ul class="plain">' + f.escalations.map(function (x) { return '<li>' + esc(t('fnd.escalatedTo', { who: person(x.to), by: person(x.by), date: fdt(x.at) })) + ' — “' + esc(x.reason) + '”</li>'; }).join('') + '</ul>' : '') + '</div>');
    var caCard = card(esc(t('fnd.actions')), cas.length ? '<div class="list">' + cas.map(function (c) { return '<a class="list-row rowlink" ' + go('ca.' + c.id) + '><span class="sev ' + (st.caOverdue(c) ? 'crit' : c.status === 'closed' ? 'ok' : 'warn') + '"></span><span class="t"><span class="row" style="gap:6px">' + caPill(c.status) + '</span><b>' + esc(c.title) + '</b><span><span class="mono">' + esc(c.ref) + '</span> · ' + esc(person(c.ownerId)) + ' · ' + esc(t('act.due')) + ' ' + dueCell(c.due, c.status === 'closed') + '</span></span></a>'; }).join('') + '</div>' : emptyBox('corrective', t('fnd.noActions')));
    var a = [];
    if (caMgr && f.status !== 'closed' && f.status !== 'cancelled') a.push('<button class="btn btn-primary" data-pact="fd-form" data-v="action">' + esc(t('fnd.f.action')) + '</button>');
    if (mgr) a.push('<button class="btn btn-secondary" data-pact="fd-form" data-v="visibility">' + esc(t('fnd.f.visibility')) + '</button>');
    if (mgr) a.push('<button class="btn btn-secondary" data-pact="fd-form" data-v="escalate">' + esc(t('fnd.f.escalate')) + '</button>');
    if (mgr && f.status !== 'closed') a.push('<button class="btn btn-ghost" data-pact="fd-form" data-v="close">' + esc(t('fnd.f.close')) + '</button>');
    var acts = a.length ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + (dd.form ? findingForm(u, f, dd) : '') + '</div>') : '';
    var esc2 = !cust ? escalationNote() : '';
    return h.recordShell(u, 'finding', f, f.ref + ' — ' + t('fcls.' + f.classification), fstat(f.status), main + chainCard(u, 'finding', f.id), acts + caCard + esc2);
  }
  function escalationNote() {
    var rules = POL('findings').escalation || {};
    return '<section class="card card-b"><p class="field-hint">' + esc(Object.keys(rules).length ? t('fnd.escRules') : t('fnd.escNone')) + '</p></section>';
  }
  function findingForm(u, f, dd) {
    var e = dd.errors, v = dd.values, body = '', st = ST(), res = { packageId: f.packageId };
    var submit = function (label) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="fd-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn btn-primary" type="submit">' + esc(label) + '</button></div>'; };
    var reason = '<div class="field"><label for="ff-reason">' + esc(t('dv.reason')) + '</label><textarea id="ff-reason" name="reason" class="textarea" rows="2"' + inv(e, 'reason', 'ff-reason') + '>' + esc(v.reason || '') + '</textarea>' + fe(e, 'reason', 'ff-reason') + '</div>';
    if (dd.form === 'action') {
      var owners = U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, 'corrective.respond', res); });
      var verifiers = U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, 'corrective.close', res); });
      body = '<div class="grid g-2"><div class="field"><label for="ff-owner">' + esc(t('rq.owner')) + '</label><select id="ff-owner" name="ownerId" class="select">' + owners.map(function (x) { return '<option value="' + x.id + '"' + ((v.ownerId || f.ownerId) === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="ff-ver">' + esc(t('ca.verifier')) + '</label><select id="ff-ver" name="verifierId" class="select"' + inv(e, 'verifierId', 'ff-ver') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + verifiers.map(function (x) { return '<option value="' + x.id + '"' + (v.verifierId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select><span class="field-hint">' + esc(t('ca.verifier.hint')) + '</span>' + fe(e, 'verifierId', 'ff-ver') + '</div></div>' +
        '<div class="field"><label for="ff-due">' + esc(t('act.due')) + '</label><input id="ff-due" name="due" type="date" class="input" min="' + st.today + '" value="' + esc(v.due || f.targetDate || '') + '"' + inv(e, 'due', 'ff-due') + '>' + fe(e, 'due', 'ff-due') + '</div>' +
        '<div class="field"><label for="ff-plan">' + esc(t('ca.plan')) + '</label><textarea id="ff-plan" name="actionPlan" class="textarea" rows="3">' + esc(v.actionPlan || '') + '</textarea></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-pact="fd-ai">' + pic('ai') + esc(t('ai.draftCa')) + '</button>' + (v.aiBasis ? '<p class="field-hint">' + esc(t('ai.draftBasis', { refs: v.aiBasis })) + '</p>' : '') + submit(t('fnd.f.action'));
    } else if (dd.form === 'visibility') body = '<label class="check"><input type="checkbox" name="customerVisible" value="1"' + (f.customerVisible ? ' checked' : '') + '> ' + esc(t('fnd.showCustomer')) + '</label>' + reason + submit(t('fnd.f.visibility'));
    else if (dd.form === 'escalate') {
      var to = U().D.users.filter(function (x) { return x.id !== u.id && x.status === 'active' && can(x.id, 'finding.manage', res); });
      body = '<div class="field"><label for="ff-to">' + esc(t('rd.escalate.to')) + '</label><select id="ff-to" name="toId" class="select"' + inv(e, 'toId', 'ff-to') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + to.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select>' + fe(e, 'toId', 'ff-to') + '</div>' + reason + '<p class="field-hint">' + esc(t('fnd.escNone')) + '</p>' + submit(t('fnd.f.escalate'));
    } else if (dd.form === 'close') body = '<p class="field-hint">' + esc(t('fnd.closeHint')) + '</p>' + reason + submit(t('fnd.f.close'));
    return '<form class="stack rd-form" data-form="fnd-' + dd.form + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(t('fnd.f.' + dd.form)) + '</h3>' + errBox(dd.serverError) + body + '</form>';
  }
  function submitFindingForm(form) {
    var dd = S().fdd, f = ST().get('finding', dd.id), fdat = new FormData(form), k = form.getAttribute('data-form').slice(4), val = function (x) { return (fdat.get(x) || '').toString().trim(); };
    dd.errors = {}; dd.serverError = null; Array.from(fdat.keys()).forEach(function (x) { dd.values[x] = val(x); });
    var cmd, payload, toast;
    if (k === 'action') { if (!val('verifierId')) dd.errors.verifierId = 'tri.err.verifier'; if (!val('due')) dd.errors.due = 'err.due_required'; cmd = 'corrective.create'; payload = { findingId: f.id, ownerId: val('ownerId'), verifierId: val('verifierId'), due: val('due'), actionPlan: val('actionPlan'), idempotencyKey: dd.caKey || (dd.caKey = 'ca-' + X.rnd()) }; toast = t('fnd.done.action'); }
    else if (k === 'visibility') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'finding.setVisibility'; payload = { id: f.id, version: f.version, customerVisible: !!fdat.get('customerVisible'), reason: val('reason') }; toast = t('fnd.done.visibility'); }
    else if (k === 'escalate') { if (!val('toId')) dd.errors.toId = 'tri.err.owner'; if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'finding.escalate'; payload = { id: f.id, toId: val('toId'), reason: val('reason') }; toast = t('rd.escalated'); }
    else if (k === 'close') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'finding.close'; payload = { id: f.id, version: f.version, reason: val('reason') }; toast = t('fnd.done.close'); }
    if (Object.keys(dd.errors).length) { U().render(); X.focusInvalid(); return; }
    var r = API().dispatch(cmd, me().id, payload);
    if (r.ok) { S().fdd = { id: f.id, form: null, errors: {}, values: {} }; U().toast(toast); if (cmd === 'corrective.create') { U().go('ca.' + r.result.id); return; } U().render(); return; }
    dd.serverError = r.code; U().render();
  }

  // ---------------------------------------------------------------- 7. corrective-action workspace
  function caState() { var s = S(); if (!s.caf) s.caf = { project: '', status: 'open', mine: false }; return s.caf; }
  function correctivePage(u) {
    var st = ST(), f = caState(), cust = st.isCustomer(u.id), list = st.correctiveList(u.id, f), all = st.correctiveList(u.id, {});
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="caf.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(f[key]) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var rows = list.map(function (c) { var fx = st.get('finding', c.findingId);
      return '<tr><td>' + recLink('corrective', c.id) + '</td><td><a ' + go('ca.' + c.id) + '>' + esc(c.title) + '</a></td><td>' + (fx ? recLink('finding', fx.id) : '—') + '</td><td>' + esc(person(c.ownerId)) + '</td><td>' + esc(person(c.verifierId)) + '</td><td>' + dueCell(c.due, c.status === 'closed' || c.status === 'cancelled') + '</td><td>' + caPill(c.status) + (st.caOverdue(c) ? ' ' + pill('crit', t('astatus.overdue')) : '') + '</td><td>' + (c.reinspectionId ? recLink('inspection', c.reinspectionId) : '—') + '</td></tr>'; });
    return crumbs([[t('nav.home'), 'home'], [t('nav.corrective'), null]]) + '<div class="page-h"><div><h1>' + esc(t('ca.pageTitle')) + '</h1><p>' + esc(t(cust ? 'ca.sub.customer' : 'ca.sub.staff')) + '</p></div></div>' +
      '<section class="card card-b">' + lifeBar('') + '<div class="notice">' + ic('shield') + '<span>' + esc(t('ca.rule')) + '</span></div></section>' +
      '<section class="card card-b act-tools">' + sel('ca-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(st.visibleProjects(u.id).map(function (p) { return [p.id, p.code]; }))) +
      sel('ca-status', 'status', t('f.status'), [['open', t('rq.f.open')], ['overdue', t('astatus.overdue')], ['ready_for_verification', t('castatus.ready_for_verification')], ['closed', t('castatus.closed')], ['all', t('f.all')]]) +
      (cust ? '' : '<label class="check"><input type="checkbox" data-pbind="caf.mine"' + (f.mine ? ' checked' : '') + '> ' + esc(t('ca.mine')) + '</label>') + '</section>' +
      '<p class="muted" role="status">' + esc(t('rq.count', { n: list.length, m: all.length })) + '</p>' +
      card(esc(t('ca.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('misc.ref'), t('doc.title'), t('ch.finding'), t('rq.owner'), t('ca.verifier'), t('act.due'), t('f.status'), t('ch.reinspection')], rows, 'catable') : emptyBox('corrective', t('ca.none')));
  }
  function cdState(id) { var s = S(); if (!s.cdd || s.cdd.id !== id) s.cdd = { id: id, form: null, errors: {}, values: {} }; return s.cdd; }
  function correctiveDetail(u, args) {
    var st = ST(), c = st.get('corrective', args[0]);
    var g = h.guard(u, 'corrective', c); if (g) return g;
    var dd = cdState(c.id), x = st.caControls(u.id, c), cust = st.isCustomer(u.id), f = st.get('finding', c.findingId);
    var rein = c.reinspectionId && st.get('inspection', c.reinspectionId);
    var main = '<section class="card card-b">' + lifeBar(c.status) + '</section>' +
      card(esc(t('rec.details')), '<div class="card-b stack">' + kv([[t('ch.finding'), f ? recLink('finding', f.id) + ' ' + esc(f.description) : '—'], [t('rq.owner'), personRole(c.ownerId)], [t('ca.verifier'), c.verifierId ? personRole(c.verifierId) : '—'],
        [t('act.due'), dueCell(c.due, c.status === 'closed') + (st.caOverdue(c) ? ' ' + pill('crit', t('astatus.overdue')) : '')], [t('fnd.containment'), esc(c.containment || '—')], [t('ca.cause'), esc(c.cause || '—')], [t('ca.plan'), esc(c.actionPlan || '—')],
        c.sourceInspectionId ? [t('ch.original'), recLink('inspection', c.sourceInspectionId)] : null, rein ? [t('ch.reinspection'), recLink('inspection', rein.id) + ' ' + istat(rein.status)] : null]) + '</div>') +
      (c.completion ? card(esc(t('ca.completion')), '<div class="card-b stack">' + kv([[t('ins.completedBy'), personRole(c.completion.by) + ' · ' + esc(fdt(c.completion.at))], [t('rd.complete.summary'), esc(c.completion.note)], [t('ca.completionEvidence'), evChips(u.id, c.completion.evidence) || '—']]) + '</div>') : '') +
      card(esc(t('ca.decisions')), '<div class="card-b stack">' + ((c.decisions || []).length ? '<ul class="plain">' + c.decisions.map(function (d) { return '<li>' + pill(d.outcome === 'confirmed' ? 'ok' : 'crit', t('caout.' + d.outcome)) + ' ' + esc(t('id.by', { who: person(d.by), date: fdt(d.at) })) + (d.authority ? ' · <span class="mono">' + esc(d.authority) + '</span>' : '') + (d.reason ? ' — “' + esc(d.reason) + '”' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('ca.noDecisions')) + '</p>') +
        '<h3 class="sub-h">' + esc(t('rd.history')) + '</h3><ol class="revlist">' + c.history.slice().reverse().map(function (hh) { return '<li><b>' + (hh.from ? esc(t('castatus.' + hh.from)) + ' → ' : '') + esc(t('castatus.' + hh.to)) + '</b><span class="muted">' + esc(person(hh.by) + ' · ' + fdt(hh.at)) + '</span>' + (hh.reason ? '<span>' + esc(hh.reason) + '</span>' : '') + '</li>'; }).join('') + '</ol></div>') + chainCard(u, 'corrective', c.id);
    var a = [];
    if (x.assign) a.push('<button class="btn btn-secondary" data-pact="cd-form" data-v="assign">' + esc(t('ca.f.assign')) + '</button>');
    if (x.propose) a.push('<button class="btn btn-primary" data-pact="cd-form" data-v="propose">' + esc(t('ca.f.propose')) + '</button>');
    if (x.start) a.push('<button class="btn btn-secondary" data-pact="cd-cmd" data-v="start">' + esc(t('ca.f.start')) + '</button>');
    if (x.complete) a.push('<button class="btn btn-primary" data-pact="cd-form" data-v="complete">' + esc(t('ca.f.complete')) + '</button>');
    if (x.reinspect) a.push('<button class="btn btn-secondary" data-pact="cd-form" data-v="reinspect">' + esc(t('ca.f.reinspect')) + '</button>');
    if (x.verify) a.push('<button class="btn btn-primary" data-pact="cd-form" data-v="verify">' + esc(t('ca.f.verify')) + '</button>');
    if (x.reopen) a.push('<button class="btn btn-secondary" data-pact="cd-form" data-v="reopen">' + esc(t('ca.f.reopen')) + '</button>');
    if (x.cancel) a.push('<button class="btn btn-ghost" data-pact="cd-form" data-v="cancel">' + esc(t('ca.f.cancel')) + '</button>');
    if (c.status === 'ready_for_verification' && !x.verify && !cust) a.push('<span class="why">' + esc(x.selfVerify && x.verifyCheck.allowed ? t('ca.why.self') : x.reinspectionPending ? t('ca.why.rein') : t('reason.' + (x.verifyCheck.code || 'role'))) + '</span>');
    var acts = a.length || dd.form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + errBox(!dd.form && dd.serverError) + (dd.form ? caForm(u, c, dd, x) : '') + '<p class="field-hint">' + esc(t('ca.notInspection')) + '</p></div>') : '';
    return h.recordShell(u, 'corrective', c, c.title, caPill(c.status), main, acts);
  }
  function caForm(u, c, dd, x) {
    var e = dd.errors, v = dd.values, body = '', st = ST(), res = { packageId: c.packageId };
    var submit = function (label, danger) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="cd-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(label) + '</button></div>'; };
    var area = function (name, label, val) { return '<div class="field"><label for="cf-' + name + '">' + esc(label) + '</label><textarea id="cf-' + name + '" name="' + name + '" class="textarea" rows="2"' + inv(e, name, 'cf-' + name) + '>' + esc(v[name] != null ? v[name] : (val || '')) + '</textarea>' + fe(e, name, 'cf-' + name) + '</div>'; };
    if (dd.form === 'assign') {
      var owners = U().D.users.filter(function (y) { return y.status === 'active' && can(y.id, 'corrective.respond', res); });
      var vers = U().D.users.filter(function (y) { return y.status === 'active' && can(y.id, 'corrective.close', res); });
      body = '<div class="field"><label for="cf-owner">' + esc(t('rq.owner')) + '</label><select id="cf-owner" name="ownerId" class="select">' + owners.map(function (y) { return '<option value="' + y.id + '"' + (c.ownerId === y.id ? ' selected' : '') + '>' + esc(y.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="cf-ver">' + esc(t('ca.verifier')) + '</label><select id="cf-ver" name="verifierId" class="select">' + vers.map(function (y) { return '<option value="' + y.id + '"' + (c.verifierId === y.id ? ' selected' : '') + '>' + esc(y.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="cf-due">' + esc(t('act.due')) + '</label><input id="cf-due" name="due" type="date" class="input" min="' + st.today + '" value="' + esc(c.due || '') + '"></div>' + area('reason', t('dv.reason') + ' ' + t('dlg.optional')) + submit(t('ca.f.assign'));
    } else if (dd.form === 'propose') body = area('containment', t('fnd.containment'), c.containment) + area('cause', t('ca.cause'), c.cause) + area('actionPlan', t('ca.plan'), c.actionPlan) + submit(t('ca.f.propose'));
    else if (dd.form === 'complete') body = area('note', t('rd.complete.summary')) + X.uploadControl('caev-' + c.id, t('ca.completionEvidence')) + fe(e, 'evidence', 'cf-ev') + submit(t('ca.f.complete'));
    else if (dd.form === 'reinspect') {
      var insps = U().D.users.filter(function (y) { return y.status === 'active' && can(y.id, 'inspection.record', res); });
      body = '<p class="field-hint">' + esc(t('ca.reinspectHint')) + '</p><div class="field"><label for="cf-planned">' + esc(t('ic.plannedDate')) + '</label><input id="cf-planned" name="planned" type="date" class="input" min="' + st.today + '"' + inv(e, 'planned', 'cf-planned') + '>' + fe(e, 'planned', 'cf-planned') + '</div>' +
        '<div class="field"><label for="cf-insp">' + esc(t('ic.responsible')) + '</label><select id="cf-insp" name="inspectorId" class="select">' + insps.map(function (y) { return '<option value="' + y.id + '">' + esc(y.name + ' · ' + t('role.' + y.role)) + '</option>'; }).join('') + '</select></div>' + submit(t('ca.f.reinspect'));
    } else if (dd.form === 'verify') body = '<p class="field-hint">' + esc(t('ca.verifyHint')) + (x.verifyCheck.authority ? ' ' + esc(t('id.underAuthority', { id: x.verifyCheck.authority })) : '') + '</p><fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="row"><label class="check"><input type="radio" name="outcome" value="confirm"' + (v.outcome !== 'return' ? ' checked' : '') + '> ' + esc(t('ca.confirmClose')) + '</label><label class="check"><input type="radio" name="outcome" value="return"' + (v.outcome === 'return' ? ' checked' : '') + '> ' + esc(t('ca.returnOwner')) + '</label></div></fieldset>' + area('reason', t('rd.verify.reason')) + submit(t('ca.f.verify'));
    else if (dd.form === 'reopen') body = '<p class="field-hint">' + esc(t('ca.reopenHint')) + '</p>' + area('reason', t('dv.reason')) + submit(t('ca.f.reopen'));
    else if (dd.form === 'cancel') body = area('reason', t('dv.reason')) + submit(t('ca.f.cancel'), true);
    return '<form class="stack rd-form" data-form="ca-' + dd.form + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(t('ca.f.' + dd.form)) + '</h3>' + errBox(dd.serverError) + body + '</form>';
  }
  function submitCaForm(form) {
    var dd = S().cdd, c = ST().get('corrective', dd.id), fdat = new FormData(form), k = form.getAttribute('data-form').slice(3), val = function (x) { return (fdat.get(x) || '').toString().trim(); };
    dd.errors = {}; dd.serverError = null; Array.from(fdat.keys()).forEach(function (x) { dd.values[x] = val(x); });
    var cmd = 'corrective.' + k, payload = { id: c.id, version: c.version }, toast = t('ca.done.' + k);
    if (k === 'assign') { payload.ownerId = val('ownerId'); payload.verifierId = val('verifierId'); payload.due = val('due'); payload.reason = val('reason'); }
    if (k === 'propose') { if (val('cause').length < 5) dd.errors.cause = 'rd.err.reason'; if (val('actionPlan').length < 5) dd.errors.actionPlan = 'rd.err.reason'; payload.cause = val('cause'); payload.actionPlan = val('actionPlan'); payload.containment = val('containment'); }
    if (k === 'complete') { if (val('note').length < 5) dd.errors.note = 'rd.err.reason'; var ev = uploadedEvidence('caev-' + c.id); if (X.uploadsBusy('caev-' + c.id)) dd.errors.evidence = 'up.err.busy'; else if (X.uploadsFailed('caev-' + c.id)) dd.errors.evidence = 'up.err.failedPending'; else if (!ev.length) dd.errors.evidence = 'ca.err.evidence'; payload.note = val('note'); payload.evidence = ev; }
    if (k === 'reinspect') { if (!val('planned')) dd.errors.planned = 'err.due_required'; payload.planned = val('planned'); payload.inspectorId = val('inspectorId'); payload.idempotencyKey = dd.rk || (dd.rk = 'rein-' + X.rnd()); }
    if (k === 'verify') { payload.outcome = val('outcome') || 'confirm'; if (payload.outcome === 'return' && val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; payload.reason = val('reason'); }
    if (k === 'reopen' || k === 'cancel') { if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; payload.reason = val('reason'); }
    if (Object.keys(dd.errors).length) { U().render(); X.focusInvalid(); return; }
    var r = API().dispatch(cmd, me().id, payload);
    if (r.ok) { if (S().uploads) delete S().uploads['caev-' + c.id]; S().cdd = { id: c.id, form: null, errors: {}, values: {} }; U().toast(toast); U().render(); return; }
    dd.serverError = r.code; U().render();
  }

  // ---------------------------------------------------------------- 9. QA/QC and HSE workspaces
  function qaPage(u) {
    var st = ST(), ws = st.qaWorkspace(u.id);
    var iRow = function (i) { return '<a class="list-row rowlink" ' + go('insp.' + i.id) + '><span class="sev ' + (i.status === 'awaiting_review' ? 'warn' : 'info') + '"></span><span class="t"><span class="row" style="gap:6px">' + istat(i.status) + '</span><b>' + esc(i.title) + '</b><span><span class="mono">' + esc(i.ref) + '</span> · ' + esc(fd(i.planned)) + ' · ' + esc(person(i.inspectorId)) + '</span></span></a>'; };
    var fRow = function (f) { return '<a class="list-row rowlink" ' + go('fnd.' + f.id) + '><span class="sev ' + (f.severity === 'high' || f.severity === 'critical' ? 'crit' : 'warn') + '"></span><span class="t"><span class="row" style="gap:6px">' + clsTag(f.classification) + sevPill(f.severity) + '</span><b>' + esc(f.description) + '</b><span class="mono">' + esc(f.ref) + '</span></span></a>'; };
    var cRow = function (c) { return '<a class="list-row rowlink" ' + go('ca.' + c.id) + '><span class="sev ' + (st.caOverdue(c) ? 'crit' : 'warn') + '"></span><span class="t"><span class="row" style="gap:6px">' + caPill(c.status) + '</span><b>' + esc(c.title) + '</b><span><span class="mono">' + esc(c.ref) + '</span> · ' + esc(person(c.ownerId)) + ' · ' + dueCell(c.due) + '</span></span></a>'; };
    var sec = function (k, list, fn) { return card(esc(t(k)) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? '<div class="list">' + list.map(fn).join('') + '</div>' : emptyBox('check', t('tri.empty'))); };
    return crumbs([[t('nav.home'), 'home'], [t('nav.qaqc'), null]]) + '<div class="page-h"><div><h1>' + esc(t('qa.wsTitle')) + '</h1><p>' + esc(t('qa.sub')) + '</p></div><div class="row"><a class="btn btn-secondary" ' + go('checklists') + '>' + esc(t('nav.checklists')) + '</a>' + (canAnywhere(u.id, 'inspection.schedule') ? '<a class="btn btn-primary" ' + go('inspnew') + '>' + pic('plus') + esc(t('ic.schedule')) + '</a>' : '') + '</div></div>' +
      '<div class="grid g-home"><div class="grid">' + sec('qa.pending', ws.pending, iRow) + sec('qa.upcoming', ws.upcoming, iRow) + sec('qa.reinspections', ws.reinspections, iRow) + '</div><div class="grid">' + sec('qa.verify', ws.verify, cRow) + sec('qa.overdue', ws.overdueCa, cRow) + sec('qa.ncrs', ws.ncrs, fRow) + '</div></div>' + aiQualityCard(u, null);
  }
  function hsePage(u) {
    var st = ST(), ws = st.hseWorkspace(u.id);
    var fRow = function (f) { return '<a class="list-row rowlink" ' + go('fnd.' + f.id) + '><span class="sev ' + (f.severity === 'high' || f.severity === 'critical' ? 'crit' : 'warn') + '"></span><span class="t"><span class="row" style="gap:6px">' + clsTag(f.classification) + sevPill(f.severity) + (f.customerVisible ? '' : pill('plain', t('misc.internal'))) + '</span><b>' + esc(f.description) + '</b><span><span class="mono">' + esc(f.ref) + '</span> · ' + esc(person(f.ownerId)) + '</span>' + (f.containment ? '<span class="muted">' + esc(t('fnd.containment')) + ': ' + esc(f.containment) + '</span>' : '') + '</span></a>'; };
    var sec = function (k, list) { return card(esc(t(k)) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? '<div class="list">' + list.map(fRow).join('') + '</div>' : emptyBox('hse', t('tri.empty'))); };
    var auth = card(esc(t('hse.authority')), '<div class="card-b stack">' + (ws.stopAuthorities.length ? '<ul class="plain">' + ws.stopAuthorities.map(function (d) { return '<li><span class="mono">' + esc(d.id) + '</span> · ' + esc(U().actLabel(d.action)) + '</li>'; }).join('') + '</ul>' : '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('hse.noAuthority')) + '</span></div>') + '<p class="field-hint">' + esc(t('hse.authorityRule')) + '</p>' +
      '<p class="field-hint">' + esc(Object.keys(ws.escalationRules).length ? t('fnd.escRules') : t('fnd.escNone')) + '</p></div>');
    return crumbs([[t('nav.home'), 'home'], [t('nav.hse'), null]]) + '<div class="page-h"><div><h1>' + esc(t('hse.title')) + '</h1><p>' + esc(t('hse.sub')) + '</p></div>' + (canAnywhere(u.id, 'finding.raise') ? '<a class="btn btn-primary" ' + go('fndnew') + '>' + pic('flag') + esc(t('fnd.raiseObs')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('hse.internalRule')) + '</span></div>' +
      '<div class="grid g-home"><div class="grid">' + sec('hse.urgent', ws.urgent) + sec('hse.assigned', ws.assigned) + '</div><div class="grid">' + auth + sec('hse.containment', ws.containment) + sec('hse.escalations', ws.escalations) + '</div></div>';
  }

  // ---------------------------------------------------------------- 3. checklist templates
  function templatesPage(u) {
    var st = ST(), list = U().D.checklistTemplates;
    return crumbs([[t('nav.home'), 'home'], [t('nav.checklists'), null]]) + '<div class="page-h"><div><h1>' + esc(t('tpl.title')) + '</h1><p>' + esc(t('tpl.sub')) + '</p></div></div>' +
      '<div class="notice warn">' + ic('info') + '<span>' + esc(t('tpl.rule')) + '</span></div>' +
      card(esc(t('tpl.list')), '<div class="list">' + list.map(function (tp) { var av = st.activeVersion(tp), dr = tp.versions.filter(function (v) { return v.status === 'draft'; })[0];
        return '<a class="list-row rowlink" ' + go('tpl.' + tp.id) + '><span class="sev ok"></span><span class="t"><span class="row" style="gap:6px">' + svcTag(tp.service) + (tp.testExample ? pill('warn', t('tpl.test')) : '') + (dr ? pill('info', t('tpl.draftOpen')) : '') + '</span><b>' + esc(tp.name) + '</b><span>' + esc(t('tpl.activeV', { v: av ? av.version : '—', n: av ? av.items.length : 0 })) + ' · ' + esc(t('tpl.versionsN', { n: tp.versions.length })) + '</span></span></a>'; }).join('') + '</div>');
  }
  function tState(id) { var s = S(); if (!s.tpe || s.tpe.id !== id) s.tpe = { id: id, items: null, errors: {} }; return s.tpe; }
  function templateDetail(u, args) {
    var st = ST(), tp = st.get('template', args[0]);
    var g = h.guard(u, 'template', tp); if (g) return g;
    var manage = canAnywhere(u.id, 'template.manage'), te = tState(tp.id), draft = tp.versions.filter(function (v) { return v.status === 'draft'; })[0];
    var versions = tp.versions.slice().reverse().map(function (v) {
      var used = U().D.inspections.filter(function (i) { return i.templateId === tp.id && i.templateVersion === v.version; }).length;
      return '<details class="explain"' + (v.status === 'active' ? ' open' : '') + '><summary><b>' + esc(t('tpl.v', { v: v.version })) + '</b> ' + pill(v.status === 'active' ? 'ok' : v.status === 'draft' ? 'info' : 'plain', t('tplst.' + v.status)) + ' <span class="muted">' + esc(v.note || '') + ' · ' + esc(t('tpl.usedBy', { n: used })) + '</span></summary>' + itemsTable(v.items) + '</details>';
    }).join('');
    var editor = '';
    if (manage && draft) {
      var items = te.items || JSON.parse(JSON.stringify(draft.items));
      te.items = items;
      editor = card(esc(t('tpl.editDraft', { v: draft.version })), '<form class="card-b stack" data-form="tpl-items" novalidate>' + errBox(te.serverError) + '<ol class="tpl-items">' + items.map(function (it, n) {
        var f = function (k, label, wide) { return '<div class="field' + (wide ? ' wide' : '') + '"><label for="ti-' + n + '-' + k + '">' + esc(label) + '</label><input id="ti-' + n + '-' + k + '" class="input" data-titem="' + n + '" data-tk="' + k + '" value="' + esc(it[k] || '') + '"></div>'; };
        return '<li class="tpl-item"><div class="row-between"><b class="mono">' + esc(it.key) + '</b><button type="button" class="btn btn-ghost btn-sm" data-pact="tpl-del" data-v="' + n + '" aria-label="' + esc(t('up.remove') + ' ' + it.key) + '">' + pic('x') + '</button></div><div class="tpl-grid">' +
          f('text', t('tpl.f.text'), true) + f('spec', t('tpl.f.spec')) + f('clause', t('tpl.f.clause')) + f('evidence', t('tpl.f.evidence')) + f('unit', t('tpl.f.unit')) + f('criterion', t('tpl.f.criterion'), true) + f('witness', t('tpl.f.witness')) +
          '<label class="check"><input type="checkbox" data-titem="' + n + '" data-tk="required"' + (it.required !== false ? ' checked' : '') + '> ' + esc(t('dv.required')) + '</label></div></li>';
      }).join('') + '</ol><button type="button" class="btn btn-secondary btn-sm" data-pact="tpl-add">' + pic('plus') + esc(t('tpl.addItem')) + '</button><p class="field-hint">' + esc(t('tpl.noThresholds')) + '</p>' +
        '<div class="dlg-actions"><button class="btn btn-secondary" type="submit">' + esc(t('tpl.saveDraft')) + '</button><button type="button" class="btn btn-primary" data-pact="tpl-activate">' + esc(t('tpl.activate')) + '</button></div></form>');
    }
    var start = manage && !draft ? '<form class="card card-b stack" data-form="tpl-new" novalidate><div class="field"><label for="tpl-note">' + esc(t('tpl.newNote')) + '</label><input id="tpl-note" name="note" class="input"></div>' + errBox(te.serverError) + '<div class="dlg-actions"><button class="btn btn-primary" type="submit">' + esc(t('tpl.newVersion')) + '</button></div></form>' : '';
    return crumbs([[t('nav.home'), 'home'], [t('nav.checklists'), 'checklists'], [tp.name, null]]) + '<div class="page-h"><div><span class="eyebrow">' + svcTag(tp.service) + '</span><h1>' + esc(tp.name) + '</h1><p>' + esc(tp.label || '') + '</p></div></div>' +
      '<div class="notice">' + ic('shield') + '<span>' + esc(t('tpl.historyRule')) + '</span></div>' + editor + start + card(esc(t('tpl.versions')), '<div class="card-b stack">' + versions + '</div>');
  }
  function itemsTable(items) {
    return '<ol class="ditems">' + items.map(function (it) { return '<li class="ditem"><div class="t"><b>' + esc(it.text) + '</b> ' + pill(it.required ? 'info' : 'plain', t(it.required ? 'dv.required' : 'dv.optional')) + '<span class="muted">' + esc([it.spec, it.spec ? t('fi.clause') + ' ' + it.clause : '', it.evidence, it.unit ? t('fi.measurement') + ' (' + it.unit + ')' : '', it.witness].filter(Boolean).join(' · ')) + '</span><span class="muted">' + esc(it.criterion) + '</span></div></li>'; }).join('') + '</ol>';
  }
  function syncTpl(form) {
    var te = S().tpe; if (!te || !te.items) return;
    form.querySelectorAll('[data-titem]').forEach(function (el) { var n = +el.getAttribute('data-titem'), k = el.getAttribute('data-tk'); if (!te.items[n]) return; te.items[n][k] = el.type === 'checkbox' ? el.checked : el.value; });
  }

  // ---------------------------------------------------------------- events
  function onAct(act, el, ev) {
    var v = el.getAttribute('data-v'), s = S();
    switch (act) {
      case 'ic-view': icState().view = v; U().render(); return true;
      case 'ic-month': icState().month = v; U().render(); return true;
      case 'is-addprereq': snapSched(); s.isch.values.prereq.push({ text: '', met: false }); U().render(); return true;
      case 'fi-save': fieldSave((location.hash || '').slice(1).split('.')[1], false); return true;
      case 'fi-submit': fieldSave((location.hash || '').slice(1).split('.')[1], true); return true;
      case 'id-form': { var d = s.idd; d.form = v || null; d.errors = {}; d.values = {}; d.serverError = null; U().render(); var fh = document.querySelector('.rd-form h3'); if (fh) fh.focus(); return true; }
      case 'fd-form': { var d2 = s.fdd; d2.form = v || null; d2.errors = {}; d2.values = {}; d2.serverError = null; U().render(); var fh2 = document.querySelector('.rd-form h3'); if (fh2) fh2.focus(); return true; }
      case 'fd-ai': { var f = ST().get('finding', s.fdd.id), sg = ST().caSuggestion(f), form = el.form; Array.from(form.elements).forEach(function (x) { if (x.name) s.fdd.values[x.name] = x.value; }); s.fdd.values.actionPlan = sg.actionPlan; s.fdd.values.aiBasis = sg.basis.join(', '); U().render(); var ta = document.getElementById('ff-plan'); if (ta) ta.focus(); return true; }
      case 'cd-form': { var d3 = s.cdd; d3.form = v || null; d3.errors = {}; d3.values = {}; d3.serverError = null; U().render(); var fh3 = document.querySelector('.rd-form h3'); if (fh3) fh3.focus(); return true; }
      case 'cd-cmd': { var c = ST().get('corrective', s.cdd.id); var r = API().dispatch('corrective.' + v, me().id, { id: c.id, version: c.version }); if (r.ok) U().toast(t('ca.done.' + v)); else s.cdd.serverError = r.code; U().render(); return true; }
      case 'tpl-add': { var fm = document.querySelector('form[data-form=tpl-items]'); if (fm) syncTpl(fm); var te = s.tpe; te.items.push({ key: 'x' + (te.items.length + 1) + X.rnd().slice(0, 3), text: '', spec: '', clause: 'To be confirmed', evidence: '', unit: '', criterion: '', witness: '', required: true }); U().render(); return true; }
      case 'tpl-del': { var fm2 = document.querySelector('form[data-form=tpl-items]'); if (fm2) syncTpl(fm2); s.tpe.items.splice(+v, 1); U().render(); return true; }
      case 'tpl-activate': {
        var fm3 = document.querySelector('form[data-form=tpl-items]'); if (fm3) syncTpl(fm3);
        var tp = ST().get('template', s.tpe.id), r1 = API().dispatch('template.saveItems', me().id, { id: tp.id, tversion: tp.version, items: s.tpe.items });
        if (!r1.ok) { s.tpe.serverError = r1.code; U().render(); return true; }
        var tp2 = ST().get('template', tp.id), r2 = API().dispatch('template.activate', me().id, { id: tp.id, tversion: tp2.version });
        if (r2.ok) { s.tpe = null; U().toast(t('tpl.activated', { v: r2.result.version })); } else s.tpe.serverError = r2.code;
        U().render(); return true;
      }
    }
    return false;
  }
  function snapSched() {
    var sc = S().isch; if (!sc) return;
    document.querySelectorAll('[data-istext]').forEach(function (el) { sc.values[el.getAttribute('data-istext')] = el.value; });
    document.querySelectorAll('[data-isprereq]').forEach(function (el) { var n = +el.getAttribute('data-isprereq'); if (sc.values.prereq[n]) sc.values.prereq[n].text = el.value; });
  }
  function onChange(el) {
    var s = S();
    if (el.hasAttribute('data-upctx') && /^fieldev-/.test(el.getAttribute('data-upctx'))) { snapField(); return false; }
    var b = el.getAttribute('data-isbind');
    if (b && s.isch) { snapSched(); s.isch.values[b] = el.value; if (b === 'projectId') { s.isch.values.packageId = ''; s.isch.values.areaId = ''; s.isch.values.inspectorId = ''; s.isch.values.attendees = []; s.isch.values.docs = []; } if (b === 'packageId') { s.isch.values.areaId = ''; s.isch.values.inspectorId = ''; } U().render(); var a = document.getElementById(el.id); if (a) a.focus(); return true; }
    var m = el.getAttribute('data-ismulti');
    if (m && s.isch) { snapSched(); var arr = (s.isch.values[m] || []).filter(function (x) { return x !== el.value; }); if (el.checked) arr.push(el.value); s.isch.values[m] = arr; U().render(); var a2 = document.querySelector('[data-ismulti="' + m + '"][value="' + el.value + '"]'); if (a2) a2.focus(); return true; }
    if (el.hasAttribute('data-isprereqmet') && s.isch) { snapSched(); s.isch.values.prereq[+el.getAttribute('data-isprereqmet')].met = el.checked; U().render(); return true; }
    if ((el.hasAttribute('data-istext') || el.hasAttribute('data-isprereq')) && s.isch) { snapSched(); U().render(); return true; }
    var fr = el.getAttribute('data-fres');
    if (fr) { var id = (location.hash || '').slice(1).split('.')[1], f = fldState(id); snapField(); f.results[fr] = Object.assign({}, f.results[fr] || {}, { result: el.value }); f.dirty = true; persistFld(id); U().render(); var again = document.querySelector('[data-fres="' + fr + '"][value="' + el.value + '"]'); if (again) again.focus(); return true; }
    if (el.hasAttribute('data-ftext')) { snapField(); setTimeout(function () { var a = document.activeElement && document.activeElement.id; U().render(); var e2 = a && document.getElementById(a); if (e2) e2.focus(); }, 0); return true; }
    var fb = el.getAttribute('data-fnbind');
    if (fb && s.fnn) { snapFinding(); s.fnn.values[fb] = el.type === 'checkbox' ? el.checked : el.value; if (fb === 'packageId') { s.fnn.values.areaId = ''; s.fnn.values.ownerId = ''; s.fnn.values.evidence = []; } U().render(); var a3 = document.getElementById(el.id) || document.querySelector('[data-fnbind="' + fb + '"][value="' + el.value + '"]'); if (a3) a3.focus(); return true; }
    var fm = el.getAttribute('data-fnmulti');
    if (fm && s.fnn) { var ar2 = (s.fnn.values[fm] || []).filter(function (x) { return x !== el.value; }); if (el.checked) ar2.push(el.value); s.fnn.values[fm] = ar2; return true; }
    if (el.hasAttribute('data-fntext') && s.fnn) { s.fnn.values[el.getAttribute('data-fntext')] = el.value; return true; }
    if (el.form && el.form.getAttribute('data-form') === 'insp-verify' && el.name === 'outcome' && s.idd) { s.idd.values.outcome = el.value; var rs = document.getElementById('idf-reason'); if (rs) s.idd.values.reason = rs.value; U().render(); var o = document.querySelector('input[name=outcome][value="' + el.value + '"]'); if (o) o.focus(); return true; }
    if (el.hasAttribute('data-titem')) { var fm4 = el.form; if (fm4) syncTpl(fm4); return true; }
    return false;
  }
  function snapField() {
    var id = (location.hash || '').slice(1).split('.')[1]; if (!S().fld || !S().fld[id]) return;
    var f = S().fld[id], changed = false;
    document.querySelectorAll('[data-ftext]').forEach(function (el) { var k = el.getAttribute('data-fkey'), p = el.getAttribute('data-ftext'); f.results[k] = f.results[k] || { result: 'not_assessed' }; if ((f.results[k][p] || '') !== el.value) { f.results[k][p] = el.value; changed = true; } });
    if (changed) { f.dirty = true; persistFld(id); }
  }
  function snapFinding() { var fn = S().fnn; if (!fn) return; document.querySelectorAll('[data-fntext]').forEach(function (el) { fn.values[el.getAttribute('data-fntext')] = el.value; }); }
  function onInput(el) {
    if (el.id === 'ic-q') { icState().q = el.value; var c = el.selectionStart; U().render(); var a = document.getElementById('ic-q'); if (a) { a.focus(); try { a.setSelectionRange(c, c); } catch (e) {} } return true; }
    return false;
  }
  function onSubmit(form) {
    var f = form.getAttribute('data-form');
    if (f === 'inspnew') { snapSched(); submitSchedule(); return true; }
    if (/^insp-/.test(f)) { submitInspForm(form); return true; }
    if (f === 'fndnew') { snapFinding(); submitFinding(); return true; }
    if (/^fnd-/.test(f)) { submitFindingForm(form); return true; }
    if (/^ca-/.test(f)) { submitCaForm(form); return true; }
    if (f === 'tpl-new') { var tp = ST().get('template', S().tpe ? S().tpe.id : (location.hash || '').slice(1).split('.')[1]), note = (new FormData(form).get('note') || '').toString(); var r = API().dispatch('template.draft', me().id, { id: tp.id, tversion: tp.version, note: note }); if (r.ok) { S().tpe = null; U().toast(t('tpl.draftCreated', { v: r.result.version })); } else { tState(tp.id).serverError = r.code; } U().render(); return true; }
    if (f === 'tpl-items') { syncTpl(form); var te = S().tpe, tp2 = ST().get('template', te.id), r2 = API().dispatch('template.saveItems', me().id, { id: tp2.id, tversion: tp2.version, items: te.items }); if (r2.ok) { te.items = null; te.serverError = null; U().toast(t('tpl.saved')); } else te.serverError = r2.code; U().render(); return true; }
    return false;
  }

  P.extend({
    bases: { insp: inspectionDetail, inspnew: schedulePage, field: fieldPage, fnd: findingDetail, fndnew: findingNew, ca: correctiveDetail, tpl: templateDetail },
    modules: { inspections: inspectionsPage, findings: findingsPage, corrective: correctivePage, qaqc: qaPage, hse: hsePage, checklists: templatesPage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit
  });
})();
