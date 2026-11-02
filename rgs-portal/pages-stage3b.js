/*
 * RGS Client Portal — Stage 3 pages (part 2): instruction and change control, approval inbox,
 * decision page and notifications. Decisions are recorded only through api.js, which checks the
 * decider's authority, the revision and the record version at the moment of the decision.
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
  var fdt = X.fdt, personRole = X.personRole, insState = X.insState, decBadge = X.decBadge, err = X.err;

  var LIFECYCLE = ['draft', 'under_review', 'awaiting_approval', 'authorised', 'in_progress', 'ready_for_verification', 'closed'];
  var OUTCOMES = ['rejected', 'cancelled', 'superseded'];
  var DECISION_ORDER = ['internal_review', 'customer_approval', 'execution_authorisation', 'technical_signoff', 'completion_acceptance'];
  function lifecycleBar(ins) {
    var cur = LIFECYCLE.indexOf(ins ? ins.state : '');
    var out = ins && OUTCOMES.indexOf(ins.state) >= 0;
    return '<div class="lifecycle-wrap"><ol class="lifecycle' + (out ? ' ended' : '') + '" aria-label="' + esc(t('ins.lifecycle')) + '">' + LIFECYCLE.map(function (s, i) {
      var cls = !ins ? '' : i < cur ? 'done' : i === cur ? 'cur' : '';
      return '<li class="' + cls + '"' + (i === cur ? ' aria-current="step"' : '') + '><span class="dot">' + (cls === 'done' ? pic('check') : (i + 1)) + '</span><span class="lbl">' + esc(t('chstatus.' + s)) + '</span></li>';
    }).join('') + '</ol><p class="field-hint">' + pill('warn', t('ins.proposed')) + ' ' + esc(t('ins.proposed.d')) + ' ' + esc(t('ins.outcomes')) + ': ' + OUTCOMES.map(function (o) { return t('chstatus.' + o); }).join(', ') + '.</p></div>';
  }
  function docRefList(refs) {
    var st = ST(), u = me();
    if (!refs || !refs.length) return '<span class="muted">—</span>';
    return '<ul class="doclist">' + refs.map(function (ref) {
      var d = st.get('document', ref.id); if (!d) return '';
      var cur = st.currentRev(d).rev;
      return '<li>' + recLink('document', d.id) + '<span class="t"><b>' + esc(d.title) + '</b><span>' + esc(t('doc.revShort', { rev: ref.rev })) + (cur !== ref.rev ? ' · <span class="late">' + esc(t('rd.newerRev', { rev: cur })) + '</span>' : '') + '</span></span></li>';
    }).join('') + '</ul>';
  }
  function areaList(ids) { return (ids || []).map(function (id) { var a = U().byId(U().D.areas, id); return a ? '<span class="chip-l mono">' + esc(a.code) + '</span> ' + esc(L(a, 'name')) : ''; }).join(', ') || '—'; }
  function snap(ins, rev) { return ins.revisions.filter(function (r) { return r.rev === rev; })[0] || ins.revisions[ins.revisions.length - 1]; }
  function diff(a, b) {
    if (!a || !b) return [];
    var out = [];
    if (a.scope !== b.scope) out.push(['ins.scope', b.scope]);
    if (JSON.stringify(a.scheduleImpact) !== JSON.stringify(b.scheduleImpact)) out.push(['ins.schedule', t('ins.days', { n: b.scheduleImpact.days }) + (b.scheduleImpact.note ? ' · ' + b.scheduleImpact.note : '') + '  (' + t('ins.was') + ' ' + t('ins.days', { n: a.scheduleImpact.days }) + ')']);
    if (JSON.stringify(a.areaIds) !== JSON.stringify(b.areaIds)) out.push(['ins.areas', (b.areaIds || []).join(', ')]);
    if (JSON.stringify(a.dependencies) !== JSON.stringify(b.dependencies)) out.push(['ins.dependencies', (b.dependencies || []).join('; ')]);
    if (JSON.stringify(a.docRefs) !== JSON.stringify(b.docRefs)) out.push(['ins.docs', (b.docRefs || []).map(function (d) { var doc = ST().get('document', d.id); return (doc ? doc.number : d.id) + ' Rev ' + d.rev; }).join(', ')]);
    if (JSON.stringify(a.packageIds) !== JSON.stringify(b.packageIds)) out.push(['misc.package', (b.packageIds || []).join(', ')]);
    return out;
  }
  function diffList(changes) { return changes.length ? '<ul class="difflist">' + changes.map(function (c) { return '<li><b>' + esc(t(c[0])) + '</b><span>' + esc(c[1]) + '</span></li>'; }).join('') + '</ul>' : ''; }
  function revSnapshot(ins, rev) {
    var r = snap(ins, rev);
    return kv([[t('ins.scope'), '<span class="pre">' + esc(r.scope) + '</span>'], [t('ins.areas'), areaList(r.areaIds)],
      [t('ins.schedule'), esc(t('ins.days', { n: r.scheduleImpact.days })) + (r.scheduleImpact.note ? ' · ' + esc(r.scheduleImpact.note) : '')],
      [t('ins.dependencies'), (r.dependencies || []).length ? '<ul class="plain">' + r.dependencies.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '—'],
      [t('ins.docs'), docRefList(r.docRefs || ins.docRefs)]]);
  }

  // ---------------------------------------------------------------- instruction register
  function insFilter() { var s = S(); if (!s.insf) s.insf = { project: '', state: 'open' }; return s.insf; }
  function nextDecisionText(ins) {
    var p = ST().pendingDecisions(ins);
    if (!p.length) return '<span class="muted">—</span>';
    var who = U().D.users.filter(function (x) { return ST().decisionCheck(x.id, ins, p[0]).allowed; }).map(function (x) { return x.name; });
    return decBadge(p[0]) + '<br><span class="muted">' + esc(who.length ? who.join(', ') : t('ins.noEligible')) + '</span>';
  }
  function instructionsPage(u) {
    var st = ST(), f = insFilter(), all = st.instructions(u.id), cust = st.isCustomer(u.id);
    var list = all.filter(function (i) {
      if (f.project && i.projectId !== f.project) return false;
      if (f.state === 'open') return OUTCOMES.indexOf(i.state) < 0 && i.state !== 'closed';
      if (f.state && f.state !== 'all') return i.state === f.state;
      return true;
    });
    var canCreate = !cust && st.visibleProjects(u.id).some(function (p) { return st.visiblePackages(u.id, p.id).some(function (w) { return U().A.can(U().D, u.id, 'instruction.create', { packageId: w.id }).allowed; }); });
    var rows = list.map(function (i) {
      var p = st.get('project', i.projectId);
      return '<tr><td>' + recLink('change', i.id) + '</td><td><a ' + go('chg.' + i.id) + '><b>' + esc(i.title) + '</b></a></td><td>' + esc(L(p, 'name')) + '</td><td>' + i.packageIds.map(function (id) { var w = st.get('package', id); return svcTag(w.service); }).join(' ') + '</td><td>' + insState(i.state) + '</td>' +
        '<td class="mono">' + esc(t('ins.revShort', { rev: i.rev, basis: i.approvalRev })) + '</td><td>' + nextDecisionText(i) + '</td><td>' + (i.approvalDue ? dueCell(i.approvalDue, ['authorised', 'in_progress', 'ready_for_verification', 'closed'].concat(OUTCOMES).indexOf(i.state) >= 0) : '—') + '</td><td>' + esc(person(i.issuerId)) + '</td></tr>';
    });
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="insf.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    return crumbs([[t('nav.home'), 'home'], [t('nav.instructions'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('ins.title')) + '</h1><p>' + esc(t(cust ? 'ins.sub.customer' : 'ins.sub.staff')) + '</p></div>' + (canCreate ? '<a class="btn btn-primary" ' + go('newins') + '>' + pic('plus') + esc(t('ins.new')) + '</a>' : '') + '</div>' +
      '<section class="card card-b">' + lifecycleBar(null) + '<div class="notice">' + ic('shield') + '<span>' + esc(t('ins.separate')) + '</span></div></section>' +
      '<section class="card card-b act-tools">' + sel('if-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(st.visibleProjects(u.id).map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) +
      sel('if-state', 'state', t('f.status'), [['open', t('ins.f.open')], ['all', t('f.all')]].concat(LIFECYCLE.concat(OUTCOMES).map(function (s) { return [s, t('chstatus.' + s)]; }))) + '</section>' +
      card(esc(t('ins.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('misc.ref'), t('doc.title'), t('nav.projects'), t('f.service'), t('f.status'), t('ins.rev'), t('ins.nextDecision'), t('ins.approvalDue'), t('ins.issuer')], rows, 'instable') : emptyBox('instructions', t('ins.none'), t(cust ? 'ins.none.customer' : 'ins.none.d')));
  }

  // ---------------------------------------------------------------- new instruction / revise form fields
  function insFormFields(ctx, st, pid, vals, errs, opts) {
    opts = opts || {};
    var u = me(), pkgs = st.visiblePackages(u.id, pid).filter(function (w) { return U().A.can(U().D, u.id, 'instruction.create', { packageId: w.id }).allowed || (vals.packageIds || []).indexOf(w.id) >= 0; });
    var areas = st.areas(pid), docs = st.documents(u.id, pid).filter(function (d) { return d.status !== 'draft'; });
    var e = function (k, id) { return errs[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(errs[k])) + '</div>' : ''; };
    var inv = function (k, id) { return errs[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; };
    var has = function (arr, v) { return (arr || []).indexOf(v) >= 0; };
    var docSel = function (d) { return (vals.docRefs || []).some(function (r) { return r.id === d.id; }); };
    return '<div class="field"><label for="' + ctx + '-title">' + esc(t('doc.title')) + '</label><input id="' + ctx + '-title" name="title" class="input" maxlength="140" value="' + esc(vals.title || '') + '"' + inv('title', ctx + '-title') + '>' + e('title', ctx + '-title') + '</div>' +
      '<div class="field"><label for="' + ctx + '-scope">' + esc(t('ins.scope')) + '</label><textarea id="' + ctx + '-scope" name="scope" class="textarea" rows="4"' + inv('scope', ctx + '-scope') + '>' + esc(vals.scope || '') + '</textarea>' + e('scope', ctx + '-scope') + '</div>' +
      '<fieldset class="field"><legend class="label">' + esc(t('ins.packages')) + '</legend><div class="checks">' + pkgs.map(function (w) { return '<label class="check"><input type="checkbox" name="packageIds" value="' + w.id + '"' + (has(vals.packageIds, w.id) ? ' checked' : '') + '> ' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></label>'; }).join('') + '</div>' + e('packageIds', ctx + '-pk') + '</fieldset>' +
      '<fieldset class="field"><legend class="label">' + esc(t('ins.areas')) + '</legend><div class="checks">' + areas.map(function (a) { return '<label class="check"><input type="checkbox" name="areaIds" value="' + a.id + '"' + (has(vals.areaIds, a.id) ? ' checked' : '') + '> <span class="mono">' + esc(a.code) + '</span> ' + esc(L(a, 'name')) + '</label>'; }).join('') + '</div></fieldset>' +
      '<div class="field"><label for="' + ctx + '-deps">' + esc(t('ins.dependencies')) + ' ' + esc(t('dlg.optional')) + '</label><textarea id="' + ctx + '-deps" name="dependencies" class="textarea" rows="2">' + esc((vals.dependencies || []).join('\n')) + '</textarea><span class="field-hint">' + esc(t('ins.deps.hint')) + '</span></div>' +
      '<div class="grid g-2"><div class="field"><label for="' + ctx + '-days">' + esc(t('ins.scheduleDays')) + '</label><input id="' + ctx + '-days" name="days" type="number" min="0" step="1" class="input" value="' + esc(vals.scheduleImpact ? vals.scheduleImpact.days : '') + '"' + inv('days', ctx + '-days') + '>' + e('days', ctx + '-days') + '</div>' +
      '<div class="field"><label for="' + ctx + '-note">' + esc(t('ins.scheduleNote')) + '</label><input id="' + ctx + '-note" name="note" class="input" value="' + esc(vals.scheduleImpact ? vals.scheduleImpact.note : '') + '"></div></div>' +
      '<fieldset class="field"><legend class="label">' + esc(t('ins.docs')) + '</legend><div class="checks">' + docs.map(function (d) { var cr = st.currentRev(d).rev; return '<label class="check"><input type="checkbox" name="docRefs" value="' + d.id + ':' + cr + '"' + (docSel(d) ? ' checked' : '') + '> <span class="mono">' + esc(d.number) + '</span> ' + esc(t('doc.revShort', { rev: cr })) + '</label>'; }).join('') + '</div><span class="field-hint">' + esc(t('ins.docs.hint')) + '</span></fieldset>' +
      (opts.withApproval ? '<label class="check"><input type="checkbox" name="requiresCustomerApproval" value="1"' + (vals.requiresCustomerApproval !== false ? ' checked' : '') + '> ' + esc(t('ins.requiresCustomer')) + '</label>' : '') +
      '<div class="field"><label for="' + ctx + '-due">' + esc(t('ins.approvalDue')) + ' ' + esc(t('dlg.optional')) + '</label><input id="' + ctx + '-due" name="approvalDue" type="date" class="input" min="' + st.today + '" value="' + esc(vals.approvalDue || '') + '"></div>';
  }
  function readInsForm(form) {
    var fdat = new FormData(form);
    return {
      title: (fdat.get('title') || '').toString().trim(), scope: (fdat.get('scope') || '').toString().trim(), packageIds: fdat.getAll('packageIds').map(String), areaIds: fdat.getAll('areaIds').map(String),
      dependencies: (fdat.get('dependencies') || '').toString().split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      scheduleImpact: { days: fdat.get('days') === '' || fdat.get('days') == null ? NaN : +fdat.get('days'), note: (fdat.get('note') || '').toString().trim() },
      docRefs: fdat.getAll('docRefs').map(function (v) { var p = String(v).split(':'); return { id: p[0], rev: p[1] }; }),
      requiresCustomerApproval: !!fdat.get('requiresCustomerApproval'), approvalDue: (fdat.get('approvalDue') || '').toString() || null,
      reason: (fdat.get('reason') || '').toString().trim(), summary: (fdat.get('summary') || '').toString().trim(), project: (fdat.get('project') || '').toString()
    };
  }
  function validateIns(v, errs) {
    if (v.title.length < 5) errs.title = 'ins.err.title';
    if (v.scope.length < 10) errs.scope = 'ins.err.scope';
    if (!v.packageIds.length) errs.packageIds = 'ins.err.packages';
    if (!Number.isInteger(v.scheduleImpact.days) || v.scheduleImpact.days < 0) errs.days = 'ins.err.days';
  }
  function newInstruction(u, args) {
    var st = ST(), s = S(), reqId = args[0] || null, r = reqId ? st.get('request', reqId) : null;
    if (reqId) { var g = h.guard(u, 'request', r); if (g) return g; if (!st.requestControls(u.id, r).createInstruction) return U().deniedState({ code: 'role' }, null); }
    if (!s.nf || s.nf.key !== (reqId || 'new')) s.nf = { key: reqId || 'new', errors: {}, values: r ? { title: r.subject, scope: '', packageIds: [r.packageId], areaIds: [r.areaId], dependencies: [], scheduleImpact: { days: '', note: '' }, docRefs: (r.linkedDocs || []).slice(), requiresCustomerApproval: true } : { packageIds: [], areaIds: [], requiresCustomerApproval: true } };
    var nf = s.nf, pid = r ? r.projectId : (nf.values.project || '');
    var projects = st.visibleProjects(u.id).filter(function (p) { return st.visiblePackages(u.id, p.id).some(function (w) { return U().A.can(U().D, u.id, 'instruction.create', { packageId: w.id }).allowed; }); });
    if (!projects.length) return U().deniedState({ code: 'role' }, null);
    if (!pid && projects.length === 1) pid = projects[0].id;
    var body = '<form class="stack" data-form="newins" novalidate>' + (nf.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(nf.serverError)) + '</span></div>' : '') +
      (r ? '<div class="notice">' + ic('requests') + '<span>' + esc(t('ins.fromRequest')) + ' </span>' + recLink('request', r.id) + '</div>' :
        '<div class="field"><label for="nf-project">' + esc(t('nav.projects')) + '</label><select id="nf-project" name="project" class="select" data-nfproject>' + '<option value="">' + esc(t('dlg.choose')) + '</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (pid === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select></div>') +
      (pid ? insFormFields('nf', st, pid, nf.values, nf.errors, { withApproval: true }) : '') +
      '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('ins.createNote')) + '</span></div><div class="dlg-actions"><a class="btn btn-ghost" ' + go(r ? 'req.' + r.id : 'instructions') + '>' + esc(t('dlg.cancel')) + '</a><button class="btn btn-primary" type="submit"' + (pid ? '' : ' disabled') + '>' + esc(t('ins.createDraft')) + '</button></div></form>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.instructions'), 'instructions'], [t('ins.new'), null]]) + '<div class="page-h"><div><h1>' + esc(t('ins.new')) + '</h1><p>' + esc(t('ins.new.sub')) + '</p></div></div>' + card(esc(t('ins.details')), '<div class="card-b">' + body + '</div>');
  }

  // ---------------------------------------------------------------- instruction detail
  function idState(id) { var s = S(); if (!s.idv || s.idv.id !== id) s.idv = { id: id, form: null, errors: {}, values: {} }; return s.idv; }
  function decisionRow(u, ins, type) {
    var st = ST(), valid = st.validDecision(ins, type), pending = st.pendingDecisions(ins).indexOf(type) >= 0;
    var latest = (ins.decisions || []).filter(function (d) { return d.type === type && d.rev === ins.approvalRev; }).pop();
    var state, body = '';
    if (valid) { state = 'done'; body = esc(t('ins.decidedBy', { who: person(valid.by), date: fdt(valid.at) })) + (valid.authority ? ' · <span class="mono">' + esc(valid.authority) + '</span>' : '') + (valid.reason ? '<br><span class="muted">“' + esc(valid.reason) + '”</span>' : ''); }
    else if (latest && latest.outcome !== 'approve') { state = latest.outcome === 'reject' ? 'rejected' : 'returned'; body = esc(t('outcome.' + latest.outcome)) + ' · ' + esc(person(latest.by) + ' · ' + fdt(latest.at)) + '<br><span class="muted">“' + esc(latest.reason) + '”</span>'; }
    else if (pending) {
      state = 'pending';
      var chk = st.decisionCheck(u.id, ins, type);
      var who = U().D.users.filter(function (x) { return st.decisionCheck(x.id, ins, type).allowed; }).map(function (x) { return x.name; });
      body = esc(t('ins.waitingFor', { who: who.length ? who.join(', ') : t('ins.noEligible') })) + (chk.allowed ? '<br><a class="btn btn-primary btn-sm" ' + go('decision.chg.' + ins.id + '.' + type) + '>' + esc(t('ins.openDecision')) + '</a>' : '');
    } else { state = 'later'; body = '<span class="muted">' + esc(t('ins.notYet')) + '</span>'; }
    return '<li class="dr dr-' + state + '"><span class="dr-dot">' + pic(state === 'done' ? 'check' : state === 'pending' ? 'clock' : state === 'rejected' ? 'x' : 'flag') + '</span><div class="t">' + decBadge(type) + '<span>' + body + '</span></div></li>';
  }
  function instructionDetail(u, args) {
    var st = ST(), ins = st.get('change', args[0]);
    var g = h.guard(u, 'change', ins); if (g) return g;
    var p = st.get('project', ins.projectId), cust = st.isCustomer(u.id), iv = idState(ins.id);
    var types = DECISION_ORDER.filter(function (x) { return x !== 'customer_approval' || ins.requiresCustomerApproval; });
    var banners = '';
    if (ins.state === 'superseded') banners += '<div class="notice warn" role="status">' + ic('info') + '<span>' + esc(t('ins.supersededBanner')) + ' </span>' + recLink('change', ins.supersededBy) + '</div>';
    if (ins.state === 'rejected') { var rj = ins.decisions.filter(function (d) { return d.outcome === 'reject'; }).pop(); banners += '<div class="notice warn">' + ic('x') + '<span>' + esc(t('ins.rejectedBanner', { who: person(rj && rj.by), reason: rj ? rj.reason : '' })) + '</span></div>'; }
    if (ins.state === 'cancelled') banners += '<div class="notice warn">' + ic('x') + '<span>' + esc(t('ins.cancelledBanner', { reason: ins.cancelReason || '' })) + '</span></div>';
    if (ins.supersedes) banners += '<div class="notice">' + ic('info') + '<span>' + esc(t('ins.replaces')) + ' </span>' + recLink('change', ins.supersedes) + '</div>';
    var returned = ins.decisions.filter(function (d) { return d.status === 'returned' && d.rev === ins.approvalRev; }).pop();
    if (returned && ins.state === 'draft') banners += '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('ins.returnedBanner', { who: person(returned.by), reason: returned.reason })) + '</span></div>';
    if (['authorised', 'in_progress', 'ready_for_verification', 'closed'].indexOf(ins.state) < 0 && OUTCOMES.indexOf(ins.state) < 0) banners += '<div class="notice">' + ic('shield') + '<span>' + esc(t('ins.notAuthorisedYet')) + '</span></div>';
    var head = crumbs([[t('nav.home'), 'home'], [t('nav.instructions'), 'instructions'], [ins.ref, null]]) +
      '<div class="page-h"><div><span class="eyebrow"><span class="mono">' + esc(ins.ref) + '</span> · ' + esc(t('ins.revShort', { rev: ins.rev, basis: ins.approvalRev })) + '</span><h1>' + esc(ins.title) + '</h1><div class="row" style="gap:8px;margin-top:6px">' + insState(ins.state) + ins.packageIds.map(function (id) { return svcTag(st.get('package', id).service); }).join('') + '</div></div></div>' +
      '<section class="card card-b">' + lifecycleBar(ins) + '</section>' + banners;
    var scope = card(esc(t('ins.scopeImpact')), '<div class="card-b stack">' + kv([[t('nav.projects'), recLink('project', p.id) + ' ' + esc(L(p, 'name'))], [t('ins.packages'), ins.packageIds.map(function (id) { return recLink('package', id); }).join(' ')], [t('ins.areas'), areaList(ins.areaIds)],
      [t('ins.source'), ins.requestId ? recLink('request', ins.requestId) : '<span class="muted">' + esc(t('ins.noSource')) + '</span>'], [t('ins.issuer'), personRole(ins.issuerId) + ' · ' + esc(fdt(ins.raisedAt))],
      [t('ins.customerApproval'), esc(ins.requiresCustomerApproval ? t('misc.yes') : t('misc.no'))], ins.approvalDue ? [t('ins.approvalDue'), dueCell(ins.approvalDue, ['authorised', 'in_progress', 'ready_for_verification', 'closed'].indexOf(ins.state) >= 0)] : null]) +
      revSnapshot(ins, ins.rev) + (ins.summary ? '<p class="muted">' + esc(ins.summary) + '</p>' : '') + '</div>');
    var earlier = ins.decisions.filter(function (d) { return d.rev !== ins.approvalRev || d.status === 'outdated'; });
    var routing = card(esc(t('ins.routing')), '<div class="card-b stack"><p class="field-hint">' + esc(t('ins.routing.d', { basis: ins.approvalRev })) + '</p><ol class="droute">' + types.map(function (ty) { return decisionRow(u, ins, ty); }).join('') + '</ol>' +
      (earlier.length ? '<details class="explain"><summary>' + esc(t('ins.earlier', { n: earlier.length })) + '</summary><ul class="doclist">' + earlier.map(function (d) { return '<li class="outdated">' + decBadge(d.type) + '<span class="t"><b>' + esc(t('outcome.' + d.outcome)) + ' · ' + esc(t('ins.revN', { rev: d.rev })) + '</b><span>' + esc(person(d.by) + ' · ' + fdt(d.at)) + (d.reason ? ' · “' + esc(d.reason) + '”' : '') + '</span></span>' + pill('', t('dstatus2.' + d.status)) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>');
    var revs = card(esc(t('ins.revisions', { n: ins.revisions.length })), '<ol class="revlist card-b">' + ins.revisions.slice().reverse().map(function (r, i, arr) {
      var prev = ins.revisions.filter(function (x) { return x.rev === r.rev - 1; })[0];
      return '<li><span class="row" style="gap:6px"><span class="mono rev-badge' + (r.rev === ins.rev ? ' cur' : '') + '">' + esc(t('ins.revN', { rev: r.rev })) + '</span>' + pill(r.material ? 'warn' : '', t(r.material ? 'ins.material' : 'ins.minor')) + (r.rev === ins.approvalRev ? pill('brand', t('ins.basis')) : '') + '</span>' +
        '<b>' + esc(r.reason) + '</b><span class="muted">' + esc(person(r.by) + ' · ' + fdt(r.at)) + '</span>' + (prev ? diffList(diff(prev, r)) : '') + '</li>';
    }).join('') + '</ol>');
    var comp = ins.completion ? card(esc(t('ins.completion')), '<div class="card-b stack">' + kv([[t('ins.completedBy'), personRole(ins.completion.by) + ' · ' + esc(fdt(ins.completion.at))], [t('rd.complete.summary'), '<span class="pre">' + esc(ins.completion.note) + '</span>'], [t('rd.attachments'), X.fileChips(ins.completion.attachments) || '—']]) + '</div>') : '';
    // actions
    var a = [], canP = function (perm) { return ins.packageIds.every(function (id) { return U().A.can(U().D, u.id, perm, { packageId: id }).allowed; }); };
    var open = OUTCOMES.indexOf(ins.state) < 0 && ins.state !== 'closed';
    if (!cust && open) {
      if (ins.state === 'draft' && canP('instruction.revise')) a.push('<button class="btn btn-primary" data-pact="ins-cmd" data-v="submitReview">' + esc(t('ins.submitReview')) + '</button>');
      if (ins.state === 'authorised' && canP('instruction.execute')) a.push('<button class="btn btn-primary" data-pact="ins-cmd" data-v="start">' + esc(t('ins.start')) + '</button>');
      if (ins.state !== 'authorised' && ins.state !== 'in_progress' && canP('instruction.execute')) a.push('<span class="blocked"><button class="btn btn-secondary" disabled aria-describedby="why-start">' + pic('lock') + esc(t('ins.start')) + '</button><span class="why" id="why-start">' + esc(t('ins.startBlocked')) + '</span></span>');
      if (ins.state === 'in_progress' && canP('instruction.execute')) a.push('<button class="btn btn-primary" data-pact="ins-form" data-v="complete">' + esc(t('ins.completeWork')) + '</button>');
      if (canP('instruction.revise') && ['ready_for_verification'].indexOf(ins.state) < 0) a.push('<button class="btn btn-secondary" data-pact="ins-form" data-v="revise">' + esc(t('ins.revise')) + '</button>');
      if (canP('instruction.revise') && ['draft', 'under_review', 'awaiting_approval', 'authorised', 'in_progress'].indexOf(ins.state) >= 0) a.push('<button class="btn btn-secondary" data-pact="ins-form" data-v="supersede">' + esc(t('ins.supersede')) + '</button>');
      if (canP('instruction.cancel')) a.push('<button class="btn btn-ghost" data-pact="ins-form" data-v="cancel">' + esc(t('ins.cancel')) + '</button>');
    }
    st.pendingDecisions(ins).forEach(function (ty) { var c = st.decisionCheck(u.id, ins, ty); if (c.allowed) a.unshift('<a class="btn btn-primary" ' + go('decision.chg.' + ins.id + '.' + ty) + '>' + esc(t('ins.decideAs', { type: t('dtype2.' + ty) })) + '</a>'); });
    var form = iv.form ? insForm(u, ins, iv) : '';
    var actions = card(esc(t('rd.actions')), '<div class="card-b stack">' + (a.length ? '<div class="btn-stack">' + a.join('') + '</div>' : '<p class="muted">' + esc(t('rd.noActions')) + '</p>') + (iv.serverError && !iv.form ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(iv.serverError)) + '</span></div>' : '') + form + '</div>');
    var hist = st.activity(u.id, {}).filter(function (e) { return e.ref.kind === 'change' && e.ref.id === ins.id; });
    var histCard = card(esc(t('rd.history')), hist.length ? '<div class="card-b">' + h.timeline(u, hist, true) + '</div>' : emptyBox('reports', t('tl.none')));
    var auth = authorityCards(u, ins);
    return head + '<div class="grid g-home"><div class="grid">' + scope + routing + revs + comp + '</div><div class="grid">' + actions + auth + histCard + '</div></div>' +
      '<div class="row back-row"><a class="btn btn-secondary" ' + go('instructions') + '>' + ic('arrow', 'flip back') + esc(t('ins.back')) + '</a><a class="btn btn-ghost" ' + go('project.' + p.id) + '>' + esc(t('back.project')) + '</a></div>';
  }
  function authorityCards(u, ins) {
    var st = ST();
    var relevant = DECISION_ORDER.filter(function (ty) { return st.decisionCheck(u.id, ins, ty).allowed || (U().D.authorities.some(function (d) { return d.userId === u.id && d.action === st.DECISION_PERMISSION[ty]; })); });
    if (!relevant.length) return '';
    return card(esc(t('auth.yours')), '<div class="card-b stack">' + relevant.map(function (ty) {
      var perm = st.DECISION_PERMISSION[ty], res = { packageId: ins.packageIds[0] };
      return authorityBlock(u, perm, res, ty);
    }).join('') + '</div>');
  }
  function authorityBlock(u, perm, res, ty) {
    var st = ST(), af = st.authorityFor(u.id, perm, res);
    var head = '<div class="row-between">' + (ty ? decBadge(ty) : '') + (af.check.allowed ? pill('ok', t('auth.ok')) : pill('crit', t('auth.no'))) + '</div>';
    if (!af.check.allowed) return '<div class="authblk">' + head + '<p>' + esc(t('reason.' + af.check.code)) + '</p></div>';
    if (!af.authority) return '<div class="authblk">' + head + '<p>' + esc(t('auth.byRole', { role: t('role.' + me().role) })) + '</p></div>';
    var d = af.authority, pr = st.get('project', d.scope.projectId);
    return '<div class="authblk">' + head + kv([[t('auth.record'), '<span class="mono">' + esc(d.id) + '</span>'], [t('auth.permission'), esc(U().actLabel(d.action))],
      [t('auth.scope'), esc(pr.code) + (d.scope.service ? ' · ' + esc(t('svc.' + d.scope.service)) : ' · ' + esc(t('auth.allServices')))], [t('auth.valid'), esc(fd(d.validFrom) + ' – ' + (d.validUntil ? fdt(d.validUntil.slice(0, 16)) + ' ' + (d.timezone || '') : fd(d.validTo)))], d.scope.categories ? [t('auth.categories'), esc(d.scope.categories.map(function (c) { return t('dtype.' + c); }).join(', '))] : null,
        [t('auth.revocation'), d.revokedAt ? pill('crit', t('auth.revoked', { date: fdt(d.revokedAt) })) : esc(t('auth.notRevoked'))], d.testExample ? [t('auth.kind'), pill('warn', t('auth.testExample'))] : null,
      [t('auth.nominated'), esc(h.codeOf ? (/^org-/.test(d.nominatedBy) ? h.orgName(d.nominatedBy) : person(d.nominatedBy)) : d.nominatedBy)], [t('auth.granted'), esc(person(d.grantedBy) + (d.grantedAt ? ' · ' + fdt(d.grantedAt) : ''))]]) +
      (af.audit.length ? '<p class="label">' + esc(t('auth.trail')) + '</p><ul class="plain audit">' + af.audit.map(function (e) { return '<li><span class="num">' + esc(fdt(e.at)) + '</span> ' + esc(t('audit.' + e.action, { who: person(e.actor) })) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  function insForm(u, ins, iv) {
    var st = ST(), f = iv.form, e = iv.errors, body = '';
    var submit = function (label, danger) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="ins-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(label) + '</button></div>'; };
    var reason = function (label) { return '<div class="field"><label for="if-reason">' + esc(label) + '</label><textarea id="if-reason" name="reason" class="textarea" rows="2"' + (e.reason ? ' aria-invalid="true" aria-describedby="if-reason-err"' : '') + '>' + esc(iv.values.reason || '') + '</textarea>' + (e.reason ? '<div id="if-reason-err" class="field-error">' + ic('alert') + esc(t(e.reason)) + '</div>' : '') + '</div>'; };
    var vals = Object.keys(iv.values).length > 1 ? iv.values : { title: ins.title, scope: ins.scope, packageIds: ins.packageIds, areaIds: ins.areaIds, dependencies: ins.dependencies, scheduleImpact: ins.scheduleImpact, docRefs: ins.docRefs, summary: ins.summary, approvalDue: ins.approvalDue };
    if (f === 'revise') body = '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('ins.materialNote', { basis: ins.approvalRev })) + '</span></div>' + insFormFields('rv', st, ins.projectId, vals, e) +
      '<div class="field"><label for="rv-summary">' + esc(t('ins.summary')) + '</label><input id="rv-summary" name="summary" class="input" value="' + esc(vals.summary || '') + '"></div>' + reason(t('ins.reviseReason')) + submit(t('ins.revise'));
    if (f === 'supersede') body = '<p class="field-hint">' + esc(t('ins.supersedeNote')) + '</p>' + insFormFields('ss', st, ins.projectId, vals, e) + reason(t('ins.supersedeReason')) + submit(t('ins.supersede'));
    if (f === 'complete') body = '<div class="field"><label for="ic-note">' + esc(t('rd.complete.summary')) + '</label><textarea id="ic-note" name="summary" class="textarea" rows="3"' + (e.summary ? ' aria-invalid="true" aria-describedby="ic-note-err"' : '') + '>' + esc(iv.values.summary || '') + '</textarea>' + (e.summary ? '<div id="ic-note-err" class="field-error">' + ic('alert') + esc(t(e.summary)) + '</div>' : '') + '</div>' + X.uploadControl('inscomp-' + ins.id, t('rd.complete.evidence')) + '<p class="field-hint">' + esc(t('ins.completeNote')) + '</p>' + submit(t('ins.completeWork'));
    if (f === 'cancel') body = reason(t('rd.reason')) + submit(t('ins.cancel'), true);
    return '<form class="stack rd-form" data-form="ins-' + f + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(t('ins.' + (f === 'complete' ? 'completeWork' : f))) + '</h3>' + (iv.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(iv.serverError)) + '</span></div>' : '') + body + '</form>';
  }

  // ---------------------------------------------------------------- 7. approval inbox
  function inboxPage(u) {
    var st = ST(), items = st.inbox(u.id), cust = st.isCustomer(u.id), s = S();
    if (!s.inb) s.inb = { type: '' };
    var list = items.filter(function (i) { return !s.inb.type || i.type === s.inb.type; });
    var can = items.filter(function (i) { return i.check.allowed; }).length;
    var late = items.filter(function (i) { return i.due && i.due < st.today; }).length;
    var rows = list.map(function (i) {
      var rec = i.record, kind = i.kind === 'instruction' ? 'change' : i.kind === 'request' ? 'request' : i.recordKind;
      var title = rec.title || rec.subject || rec.number || rec.ref;
      var p = st.get('project', rec.projectId || (i.action && i.action.projectId));
      var rev = i.kind === 'instruction' ? t('ins.revN', { rev: rec.approvalRev }) : kind === 'document' ? t('doc.revShort', { rev: st.currentRev(rec).rev }) : '';
      var btn = i.check.allowed ? '<a class="btn btn-primary btn-sm" ' + go(i.route) + '>' + esc(t('inb.open')) + '</a>' :
        '<span class="blocked"><a class="btn btn-secondary btn-sm" ' + go(i.route) + '>' + esc(t('inb.view')) + '</a><span class="why">' + esc(t('reason.' + i.check.code)) + '</span></span>';
      return '<div class="list-row inb-row"><span class="sev ' + (i.due && i.due < st.today ? 'crit' : i.check.allowed ? 'warn' : 'info') + '"></span><div class="t">' + decBadge(i.type) + '<b>' + esc(title) + '</b><span>' + recLink(kind, rec.id) + (rev ? ' · <span class="mono">' + esc(rev) + '</span>' : '') + ' · ' + esc(p ? L(p, 'name') : '') + (i.due ? ' · ' + esc(t('act.due')) + ' ' + dueCell(i.due) : '') + '</span></div><div class="row-end">' + btn + '</div></div>';
    }).join('');
    var types = Array.from(new Set(items.map(function (i) { return i.type; })));
    var mine = U().D.authorities.filter(function (d) { return d.userId === u.id; });
    var authCard = card(esc(t('auth.yours')), mine.length ? '<div class="card-b stack">' + mine.map(function (d) {
      var live = d.status === 'active' && d.validTo >= st.today && d.validFrom <= st.today, pr = st.get('project', d.scope.projectId);
      var trail = U().D.audit.filter(function (e) { return e.record && e.record.kind === 'authority' && e.record.id === d.id; });
      return '<div class="authblk"><div class="row-between"><span class="mono">' + esc(d.id) + '</span>' + pill(live ? 'ok' : 'crit', t(live ? 'auth.active' : 'auth.expired')) + '</div>' + kv([[t('auth.permission'), esc(U().actLabel(d.action))], [t('auth.scope'), esc(pr.code) + (d.scope.service ? ' · ' + esc(t('svc.' + d.scope.service)) : ' · ' + esc(t('auth.allServices')))],
        [t('auth.valid'), esc(fd(d.validFrom) + ' – ' + (d.validUntil ? fdt(d.validUntil.slice(0, 16)) + ' ' + (d.timezone || '') : fd(d.validTo)))], d.scope.categories ? [t('auth.categories'), esc(d.scope.categories.map(function (c) { return t('dtype.' + c); }).join(', '))] : null,
        [t('auth.revocation'), d.revokedAt ? pill('crit', t('auth.revoked', { date: fdt(d.revokedAt) })) : esc(t('auth.notRevoked'))], d.testExample ? [t('auth.kind'), pill('warn', t('auth.testExample'))] : null, [t('auth.nominated'), esc(/^org-/.test(d.nominatedBy) ? h.orgName(d.nominatedBy) : person(d.nominatedBy))], [t('auth.granted'), esc(person(d.grantedBy) + (d.grantedAt ? ' · ' + fdt(d.grantedAt) : ''))]]) +
        (trail.length ? '<ul class="plain audit">' + trail.map(function (e) { return '<li><span class="num">' + esc(fdt(e.at)) + '</span> ' + esc(t('audit.' + e.action, { who: person(e.actor) })) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('') + '<p class="field-hint">' + esc(t('auth.rules')) + '</p></div>' : emptyBox('shield', t('auth.none'), t('auth.none.d')));
    return crumbs([[t('nav.home'), 'home'], [U().navLabel(U().MODULE_BY.approvals, u), null]]) +
      '<div class="page-h"><div><h1>' + esc(t(cust ? 'inb.title.customer' : 'inb.title.staff')) + '</h1><p>' + esc(t('inb.sub')) + '</p></div><div class="chips dark"><span class="chip">' + esc(t('act.sum.open', { n: items.length })) + '</span><span class="chip brand">' + esc(t('act.sum.mine', { n: can })) + '</span><span class="chip">' + esc(t('act.sum.late', { n: late })) + '</span></div></div>' +
      (types.length > 1 ? '<section class="card card-b act-tools"><div class="field"><label for="inb-type">' + esc(t('act.type')) + '</label><select id="inb-type" class="select" data-pbind="inb.type"><option value="">' + esc(t('f.all')) + '</option>' + types.map(function (x) { return '<option value="' + x + '"' + (s.inb.type === x ? ' selected' : '') + '>' + esc(t('dtype2.' + x)) + '</option>'; }).join('') + '</select></div></section>' : '') +
      '<div class="grid g-home"><div class="grid">' + card(esc(t('inb.list')) + ' <span class="pill plain num">' + list.length + '</span>', rows ? '<div class="list">' + rows + '</div>' : emptyBox('approvals', t('inb.none'), t('inb.none.d'))) + '</div><div class="grid">' + authCard + '</div></div>';
  }

  // ---------------------------------------------------------------- 7b. decision page
  function decState(key) { var s = S(); if (!s.dec || s.dec.key !== key) s.dec = { key: key, outcome: 'approve', reason: '', confirm: false, errors: {}, idem: 'dec-' + X.rnd() }; return s.dec; }
  function decisionPage(u, args) {
    var st = ST(), kind = args[0];
    if (kind === 'act') return actionDecision(u, args[1]);
    var ins = st.get('change', args[1]), type = args[2];
    var g = h.guard(u, 'change', ins); if (g) return g;
    if (!st.DECISION_PERMISSION[type]) return h.guard(u, 'change', null);
    // customers see only the decisions that belong to them; RGS internal decisions stay internal
    if (st.isCustomer(u.id) && st.CUSTOMER_DECISIONS.indexOf(type) < 0) return U().deniedState({ code: 'internal_record' }, null);
    var key = 'chg.' + ins.id + '.' + type, ds = decState(key);
    if (ds.openedVersion == null) { ds.openedVersion = ins.version; ds.openedRev = ins.approvalRev; }
    var chk = st.decisionCheck(u.id, ins, type), pending = st.pendingDecisions(ins).indexOf(type) >= 0;
    var changed = ins.version !== ds.openedVersion && !ds.result;
    var head = crumbs([[t('nav.home'), 'home'], [U().navLabel(U().MODULE_BY.approvals, u), 'approvals'], [ins.ref, 'chg.' + ins.id], [t('dtype2.' + type), null]]) +
      '<div class="page-h"><div><span class="eyebrow">' + decBadge(type) + '</span><h1>' + esc(ins.ref + ' — ' + ins.title) + '</h1><div class="row" style="gap:8px;margin-top:6px">' + insState(ins.state) + '<span class="mono rev-badge cur">' + esc(t('dec.revision', { rev: ds.openedRev })) + '</span></div></div></div>';
    var prevRev = ins.revisions.filter(function (r) { return r.rev < ds.openedRev && r.material; }).pop();
    var what = card(esc(t('dec.what', { rev: ds.openedRev })), '<div class="card-b stack">' + revSnapshot(ins, ds.openedRev) + (prevRev ? '<h3 class="sub-h">' + esc(t('dec.changes', { rev: prevRev.rev })) + '</h3>' + (diffList(diff(prevRev, snap(ins, ds.openedRev))) || '<p class="muted">' + esc(t('dec.noChanges')) + '</p>') : '') +
      ((type === 'technical_signoff' || type === 'completion_acceptance') && ins.completion ? '<h3 class="sub-h">' + esc(t('ins.completion')) + '</h3>' + kv([[t('ins.completedBy'), personRole(ins.completion.by) + ' · ' + esc(fdt(ins.completion.at))], [t('rd.complete.summary'), esc(ins.completion.note)], [t('rd.attachments'), X.fileChips(ins.completion.attachments) || '—']]) : '') + '</div>');
    var prior = ins.decisions.filter(function (d) { return d.rev === ds.openedRev && d.status === 'valid'; });
    var src = ins.requestId && st.get('request', ins.requestId);
    var evidence = card(esc(t('dec.evidence')), '<div class="card-b stack">' + kv([[t('ins.docs'), docRefList(ins.docRefs)], [t('ins.source'), src ? recLink('request', src.id) + ' ' + esc(src.subject) : '—'],
      [t('dec.prior'), prior.length ? '<ul class="plain">' + prior.map(function (d) { return '<li>' + decBadge(d.type) + ' ' + esc(person(d.by) + ' · ' + fdt(d.at)) + (d.authority ? ' · <span class="mono">' + esc(d.authority) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '—']]) + '</div>');
    var authority = card(esc(t('dec.authority')), '<div class="card-b stack">' + authorityBlock(u, st.DECISION_PERMISSION[type], { packageId: ins.packageIds[0] }, null) +
      (ins.packageIds.length > 1 ? '<p class="field-hint">' + esc(t('dec.multiPackage', { n: ins.packageIds.length })) + '</p>' : '') + (!chk.allowed ? '<p class="why">' + esc(t('reason.' + chk.code)) + '</p>' : '') + '</div>');
    var cons = card(esc(t('dec.consequences')), '<ul class="cons card-b">' + ['approve', 'reject', 'return'].map(function (o) { return '<li class="c-' + o + '"><b>' + esc(t('outcome.' + o)) + '</b><span>' + esc(t('cons.' + type + '.' + o)) + '</span></li>'; }).join('') + '</ul>');
    var form;
    if (ds.result) form = resultPanel(u, ds.result, 'chg.' + ins.id);
    else if (!pending) form = '<div class="notice" role="status">' + ic('info') + '<span>' + esc(t('dec.notPending', { state: t('chstatus.' + ins.state) })) + '</span></div><a class="btn btn-secondary" ' + go('chg.' + ins.id) + '>' + esc(t('dec.toInstruction')) + '</a>';
    else if (!chk.allowed) form = '<div class="notice warn" role="status">' + ic('lock') + '<span>' + esc(t('dec.cannot')) + ' ' + esc(t('reason.' + chk.code)) + '</span></div>';
    else form = decisionForm(ds, ['approve', 'reject', 'return'], ds.openedRev);
    var stale = changed ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('dec.changed', { rev: ins.approvalRev })) + '</span><button class="btn btn-secondary btn-sm" data-pact="dec-reload">' + esc(t('dec.reload')) + '</button></div>' : '';
    return head + stale + '<div class="grid g-home"><div class="grid">' + what + evidence + '</div><div class="grid">' + card(esc(t('dec.yourDecision')), '<div class="card-b stack">' + form + '</div>', '', 'dec-card') + authority + cons + '</div></div>';
  }
  function decisionForm(ds, outcomes, rev) {
    var e = ds.errors;
    return '<form class="stack" data-form="decide" novalidate>' + (ds.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(ds.serverError)) + '</span></div>' : '') +
      '<fieldset class="field"><legend class="label">' + esc(t('dlg.decision')) + '</legend><div class="choices compact">' + outcomes.map(function (o) {
        return '<label class="choice' + (ds.outcome === o ? ' sel' : '') + '"><input type="radio" name="outcome" value="' + o + '" data-decbind="outcome"' + (ds.outcome === o ? ' checked' : '') + '><span class="t"><b>' + esc(t(outcomes.length === 1 ? 'dec.ack' : 'outcome.' + o)) + '</b></span></label>';
      }).join('') + '</div></fieldset>' +
      '<div class="field"><label for="dec-reason">' + esc(t(ds.outcome === 'approve' ? 'dlg.comment' : 'dlg.reason')) + '</label><textarea id="dec-reason" name="reason" class="textarea" rows="3"' + (e.reason ? ' aria-invalid="true" aria-describedby="dec-reason-err"' : '') + '>' + esc(ds.reason) + '</textarea>' + (e.reason ? '<div id="dec-reason-err" class="field-error">' + ic('alert') + esc(t(e.reason)) + '</div>' : '') + '</div>' +
      '<label class="check"><input type="checkbox" id="dec-confirm" name="confirm" value="1"' + (ds.confirm ? ' checked' : '') + (e.confirm ? ' aria-invalid="true" aria-describedby="dec-confirm-err"' : '') + '> ' + esc(t('dec.confirm', { rev: rev })) + '</label>' + (e.confirm ? '<div id="dec-confirm-err" class="field-error">' + ic('alert') + esc(t(e.confirm)) + '</div>' : '') +
      '<p class="field-hint">' + esc(t('dec.recheck')) + '</p><div class="dlg-actions"><button class="btn btn-primary" type="submit" id="dec-submit"' + (ds.busy ? ' aria-disabled="true"' : '') + '>' + (ds.busy ? '<span class="spin" aria-hidden="true"></span>' + esc(t('dec.recording')) : esc(t('dec.record'))) + '</button></div></form>';
  }
  function resultPanel(u, res, backRoute) {
    return '<div class="dec-result" role="status"><span class="ok-mark">' + pic('check') + '</span><h3>' + esc(t('dec.recorded')) + '</h3>' + kv([[t('dlg.decision'), esc(t('outcome.' + res.outcome))], [t('dec.by'), esc(person(u.id) + ' · ' + fdt(res.at))],
      [t('dlg.authority'), res.authority ? '<span class="mono">' + esc(res.authority) + '</span>' : esc(t('dlg.roleGrant'))], res.rev != null ? [t('ins.rev'), esc(t('ins.revN', { rev: res.rev }))] : null, res.state ? [t('f.status'), insState(res.state)] : null]) +
      '<div class="row"><a class="btn btn-primary" ' + go(backRoute) + '>' + esc(t('dec.toRecord')) + '</a><a class="btn btn-secondary" ' + go('approvals') + '>' + esc(t('dec.toInbox')) + '</a></div></div>';
  }
  function actionDecision(u, id) {
    var st = ST(), a = st.get('action', id);
    if (!a) return h.guard(u, 'change', null);
    if (a.source === 'instruction') { return decisionPage(u, ['chg', a.record.id, a.decisionType]); }
    var v = st.actionView(u.id, a);
    if (!v.recordVisible) return U().deniedState({ code: 'scope' }, null);
    var rec = v.record, kind = v.recordKind, ds = decState('act.' + id);
    var outcomes = a.type === 'document_ack' ? ['approve'] : ['approve', 'reject', 'return'];
    var perm = st.ACTION_PERMISSION[a.type], res = a.packageId ? { packageId: a.packageId } : { projectId: a.projectId };
    var recBody = kind === 'document' ? kv([[t('doc.number'), recLink('document', rec.id)], [t('doc.title'), esc(rec.title)], [t('doc.rev'), esc(st.currentRev(rec).rev + ' · ' + fd(st.currentRev(rec).date))], [t('f.status'), h.sp('doc', rec.status, 'dstatus')]]) :
      kind === 'inspection' ? kv([[t('misc.ref'), recLink('inspection', rec.id)], [t('insp.title'), esc(rec.title)], [t('insp.result'), h.sp('result', rec.result || 'scheduled', 'result')], [t('insp.rgs'), rec.rgsSignoff ? esc(person(rec.rgsSignoff.by) + ' · ' + fd(rec.rgsSignoff.at)) : '—'], [t('insp.basis'), rec.basisDocId ? recLink('document', rec.basisDocId) : '—']]) : '';
    var head = crumbs([[t('nav.home'), 'home'], [U().navLabel(U().MODULE_BY.approvals, u), 'approvals'], [h.needText(v), null]]) +
      '<div class="page-h"><div><span class="eyebrow">' + decBadge(a.type) + '</span><h1>' + esc(h.needText(v)) + '</h1><div class="row" style="gap:8px;margin-top:6px">' + h.sp('action', v.status, 'astatus') + '</div></div></div>';
    var form = ds.result ? resultPanel(u, ds.result, h.routeOf(kind, rec.id)) : v.status === 'done' ? '<div class="notice">' + ic('check') + '<span>' + esc(t('dec.alreadyDone', { who: person(a.doneBy), date: fdt(a.doneAt) })) + '</span></div>' :
      !v.can.allowed ? '<div class="notice warn">' + ic('lock') + '<span>' + esc(h.whyNot(u, v)) + '</span></div>' : decisionForm(ds, outcomes, kind === 'document' ? st.currentRev(rec).rev : '');
    var cons = card(esc(t('dec.consequences')), '<ul class="cons card-b">' + outcomes.map(function (o) { return '<li class="c-' + o + '"><b>' + esc(t(outcomes.length === 1 ? 'dec.ack' : 'outcome.' + o)) + '</b><span>' + esc(t('cons.' + a.type + '.' + o)) + '</span></li>'; }).join('') + '</ul>');
    return head + '<div class="grid g-home"><div class="grid">' + card(esc(t('dec.whatRecord')), '<div class="card-b">' + recBody + '</div>') + '</div><div class="grid">' + card(esc(t('dec.yourDecision')), '<div class="card-b stack">' + form + '</div>', '', 'dec-card') +
      card(esc(t('dec.authority')), '<div class="card-b">' + authorityBlock(u, perm, res, null) + '</div>') + cons + '</div></div>';
  }
  function submitDecision(form) {
    var s = S(), ds = s.dec, u = me(), fdat = new FormData(form);
    if (ds.busy) return; // a second click while recording does nothing; the idempotency key covers retries
    ds.outcome = (fdat.get('outcome') || 'approve').toString(); ds.reason = (fdat.get('reason') || '').toString(); ds.confirm = !!fdat.get('confirm');
    ds.errors = {}; ds.serverError = null;
    if (ds.outcome !== 'approve' && ds.reason.trim().length < 5) ds.errors.reason = 'dlg.err.reason';
    if (!ds.confirm) ds.errors.confirm = 'dlg.err.confirm';
    if (Object.keys(ds.errors).length) { U().render(); X.focusInvalid(); return; }
    ds.busy = true; U().render();
    setTimeout(function () {
      var parts = ds.key.split('.'), r;
      if (parts[0] === 'act') r = API().dispatch('action.decide', u.id, { actionId: parts[1], outcome: ds.outcome, reason: ds.reason, idempotencyKey: ds.idem });
      else r = API().dispatch('instruction.decide', u.id, { id: parts[1], type: parts[2], version: ds.openedVersion, rev: ds.openedRev, outcome: ds.outcome, reason: ds.reason, idempotencyKey: ds.idem });
      ds.busy = false;
      if (r.ok) { ds.result = { outcome: ds.outcome, at: window.RGSApi.ksaStamp(new Date()), authority: r.result.authority, rev: parts[0] === 'act' ? null : ds.openedRev, state: r.result.state }; U().toast(t('dec.recorded')); }
      else ds.serverError = r.code;
      U().render();
      var c = document.querySelector('#dec-card h2'); if (c) c.focus();
    }, 350);
  }

  // ---------------------------------------------------------------- notifications
  function notificationsPage(u) {
    var st = ST(), list = st.notifications(u.id);
    var rows = list.map(function (n) {
      var v = Object.assign({}, n.vars); if (v.type) v.type = t('dtype2.' + v.type); if (v.outcome) v.outcome = t('outcome.' + v.outcome); if (v.date) v.date = fd(v.date);
      return '<div class="list-row nt-row' + (n.read ? '' : ' unread') + '"><span class="sev ' + (n.read ? '' : 'warn') + '"></span><div class="t"><b>' + esc(t('nt.' + n.kind, v)) + '</b><span class="muted num">' + esc(fdt(n.at)) + '</span></div><div class="row-end"><a class="btn btn-secondary btn-sm" href="#' + n.route + '" data-pact="nt-open" data-v="' + n.id + '" data-r="' + n.route + '">' + esc(t('inb.open')) + '</a></div></div>';
    }).join('');
    return crumbs([[t('nav.home'), 'home'], [t('top.notifications'), null]]) + '<div class="page-h"><div><h1>' + esc(t('top.notifications')) + '</h1><p>' + esc(t('nt.sub')) + '</p></div>' + (list.some(function (n) { return !n.read; }) ? '<button class="btn btn-secondary" data-pact="nt-all">' + esc(t('nt.markAll')) + '</button>' : '') + '</div>' +
      card(esc(t('nt.list')) + ' <span class="pill plain num">' + st.unread(u.id) + ' ' + esc(t('nt.unread')) + '</span>', rows ? '<div class="list">' + rows + '</div>' : emptyBox('bell', t('nt.none'), t('nt.none.d'))) + '<p class="field-hint">' + esc(t('nt.rule')) + '</p>';
  }

  // ---------------------------------------------------------------- events
  function onAct(act, el, ev) {
    var s = S(), v = el.getAttribute('data-v');
    if (act === 'ins-form') { var iv = s.idv; iv.form = v || null; iv.errors = {}; iv.values = {}; iv.serverError = null; U().render(); var fh = document.querySelector('.rd-form h3'); if (fh) fh.focus(); return true; }
    if (act === 'ins-cmd') {
      var ins = ST().get('change', s.idv.id);
      X.run('instruction.' + v, { id: ins.id, version: ins.version }, { toast: t('ins.done.' + v), fail: function (r) { s.idv.serverError = r.code; } });
      return true;
    }
    if (act === 'dec-reload') { var d = s.dec; s.dec = null; U().render(); return true; }
    if (act === 'nt-open') { ev.preventDefault(); API().dispatch('notification.read', me().id, { id: v }); U().go(el.getAttribute('data-r')); return true; }
    if (act === 'nt-all') { API().dispatch('notification.read', me().id, {}); U().render(); return true; }
    return false;
  }
  function onChange(el) {
    var s = S();
    if (el.hasAttribute('data-decbind') && s.dec) { s.dec.outcome = el.value; var ta = document.getElementById('dec-reason'); if (ta) s.dec.reason = ta.value; var cb = document.getElementById('dec-confirm'); if (cb) s.dec.confirm = cb.checked; U().render(); var again = document.querySelector('[data-decbind][value="' + el.value + '"]'); if (again) again.focus(); return true; }
    if (el.hasAttribute('data-nfproject') && s.nf) { s.nf.values.project = el.value; s.nf.values.packageIds = []; s.nf.values.areaIds = []; s.nf.values.docRefs = []; U().render(); var p = document.getElementById('nf-project'); if (p) p.focus(); return true; }
    return false;
  }
  function onInput(el) {
    var s = S();
    if (s.dec && el.id === 'dec-reason') { s.dec.reason = el.value; return true; }
    return false;
  }
  function onSubmit(form) {
    var f = form.getAttribute('data-form'), s = S(), u = me();
    if (f === 'decide') { submitDecision(form); return true; }
    if (f === 'newins') {
      var nf = s.nf, v = readInsForm(form);
      nf.values = Object.assign({}, nf.values, v); nf.errors = {}; nf.serverError = null;
      validateIns(v, nf.errors);
      if (Object.keys(nf.errors).length) { U().render(); X.focusInvalid(); return true; }
      var reqId = nf.key === 'new' ? null : nf.key;
      X.run('instruction.create', { requestId: reqId, projectId: reqId ? null : v.project, title: v.title, scope: v.scope, packageIds: v.packageIds, areaIds: v.areaIds, dependencies: v.dependencies, scheduleImpact: v.scheduleImpact, docRefs: v.docRefs, requiresCustomerApproval: v.requiresCustomerApproval, approvalDue: v.approvalDue }, {
        noRender: true, ok: function (res) { s.nf = null; U().toast(t('ins.created', { ref: res.ref })); U().go('chg.' + res.id); }, fail: function (r) { nf.serverError = r.code; U().render(); }
      });
      return true;
    }
    if (/^ins-/.test(f)) {
      var iv = s.idv, ins = ST().get('change', iv.id), val = readInsForm(form), cmd, payload = { id: ins.id, version: ins.version };
      iv.values = val; iv.errors = {}; iv.serverError = null;
      if (f === 'ins-revise' || f === 'ins-supersede') {
        validateIns(val, iv.errors);
        if (val.reason.length < 5) iv.errors.reason = 'rd.err.reason';
        if (Object.keys(iv.errors).length) { U().render(); X.focusInvalid(); return true; }
        var fields = { title: val.title, scope: val.scope, packageIds: val.packageIds, areaIds: val.areaIds, dependencies: val.dependencies, scheduleImpact: val.scheduleImpact, docRefs: val.docRefs };
        if (f === 'ins-revise') { fields.summary = val.summary; cmd = 'instruction.revise'; payload.fields = fields; payload.reason = val.reason; }
        else { cmd = 'instruction.supersede'; payload.fields = fields; payload.reason = val.reason; }
      } else if (f === 'ins-complete') {
        if (val.summary.length < 5) { iv.errors.summary = 'rd.err.reason'; U().render(); X.focusInvalid(); return true; }
        if (X.uploadsBusy('inscomp-' + ins.id) || X.uploadsFailed('inscomp-' + ins.id)) { iv.errors.summary = 'up.err.failedPending'; U().render(); return true; }
        cmd = 'instruction.completeWork'; payload.note = val.summary; payload.attachments = X.doneFileIds('inscomp-' + ins.id);
      } else if (f === 'ins-cancel') {
        if (val.reason.length < 5) { iv.errors.reason = 'rd.err.reason'; U().render(); X.focusInvalid(); return true; }
        cmd = 'instruction.cancel'; payload.reason = val.reason;
      }
      X.run(cmd, payload, {
        noRender: true,
        ok: function (res) {
          s.idv = { id: ins.id, form: null, errors: {}, values: {} };
          if (cmd === 'instruction.supersede') { U().toast(t('ins.done.supersede', { ref: res.ref })); U().go('chg.' + res.id); return; }
          U().toast(cmd === 'instruction.revise' ? t(res.material ? 'ins.done.reviseMaterial' : 'ins.done.reviseMinor', { rev: res.rev }) : t('ins.done.' + f.slice(4)));
          U().render();
        },
        fail: function (r) { iv.serverError = r.code; U().render(); }
      });
      return true;
    }
    return false;
  }

  P.extend({
    bases: { chg: instructionDetail, newins: newInstruction, decision: decisionPage },
    modules: { instructions: instructionsPage, approvals: inboxPage, notifications: notificationsPage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit
  });
})();
