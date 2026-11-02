/*
 * RGS Client Portal — Stage 6 pages (part 2): commitments register, dependencies, report centre, handover readiness,
 * handover packages, acceptance and technical release, management oversight; plus the Stage 6 event wiring.
 */
(function () {
  'use strict';
  var P = window.RGSPages, h = P._h, X = window.RGSPages3, G = window.RGSPages6;
  var t = h.t, esc = h.esc, pic = h.pic, recLink = h.recLink, go = h.go, pill = h.pill, card = h.card, table = h.table, kv = h.kv,
    crumbs = h.crumbs, emptyBox = h.emptyBox, dueCell = h.dueCell, fd = h.fd, person = h.person, L = h.L, svcTag = h.svcTag, bar = h.bar;
  var F = G.F, openForm = G.openForm, isOpen = G.isOpen, val = G.val, input = G.input, select = G.select, formWrap = G.formWrap, opener = G.opener, run = G.run, need = G.need, invalid = G.invalid, errBox = G.errBox;
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function API() { return U().API; }
  function me() { return U().user(); }
  function ic(n, c) { return U().ic(n, c); }
  var fdt = X.fdt, personRole = X.personRole, err = X.err;
  var can = G.can, canAnywhere = G.canAnywhere, num = G.num, decRow = G.decRow, areaName = G.areaName, pkgCode = G.pkgCode;
  function ensure(key) { if (!isOpen(key)) { openForm(key); F().idem = key + '-' + X.rnd(); } return F(); }
  function sel(state, id, key, label, opts) {
    var f = S()[state];
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="' + state + '.' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(f[key]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function projOpts(u) { return ST().visibleProjects(u.id).map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }); }
  function srcLabel(c) { return c.source ? recLink(c.source.kind, c.source.id) + (c.source.rev ? ' <span class="mono muted">' + esc(t('doc.revShort', { rev: c.source.rev })) + '</span>' : '') : '<span class="muted">' + esc(t('cm.noSource')) + '</span>'; }

  // =====================================================================================================
  // 3. COMMITMENTS
  // =====================================================================================================
  function commitmentsPage(u) {
    var st = ST(), s = S(); if (!s.cmf) s.cmf = { project: '', status: 'open', party: '', source: '', mine: false, q: '' };
    var f = s.cmf, list = st.commitmentRegister(u.id, f), all = st.commitmentRegister(u.id, {}), cust = st.isCustomer(u.id);
    var rows = list.map(function (c) {
      var stt = st.commitmentStatus(c), cur = st.dueOf(c), moved = (c.history || []).filter(function (x) { return x.type === 'reschedule'; }).length;
      return '<tr><td>' + recLink('commitment', c.id) + (c.visibility === 'internal' ? '<br>' + pill('plain', t('misc.internal')) : '') + '</td><td><a ' + go('cm.' + c.id) + '>' + esc(L(c, 'text')) + '</a><br><span class="muted">' + esc(st.get('project', c.projectId).code) + (c.packageId ? ' · ' + esc(pkgCode(c.packageId)) : '') + '</span></td>' +
        '<td>' + srcLabel(c) + '</td><td>' + esc(person(c.ownerId)) + '<br><span class="muted">' + esc(t('com.party.' + c.party)) + '</span></td><td>' + esc(fd(c.promised)) + '</td><td>' + dueCell(cur, stt === 'complete') + (moved ? '<br>' + pill('plain', t('cm.rescheduledN', { n: moved })) : '') + '</td>' +
        '<td>' + esc(fd(c.forecast || cur)) + '</td><td>' + G.cmPill(stt) + '</td><td>' + esc(c.blocker || '—') + '</td><td>' + esc(c.next || '—') + '</td></tr>';
    });
    var narrow = '<div class="list">' + list.map(function (c) { var stt = st.commitmentStatus(c); return '<a class="list-row rowlink" ' + go('cm.' + c.id) + '><span class="sev ' + ({ complete: 'ok', on_track: 'info', at_risk: 'warn', overdue: 'crit' }[stt]) + '"></span><span class="t"><span class="row" style="gap:6px">' + G.cmPill(stt) + '</span><b>' + esc(L(c, 'text')) + '</b><span><span class="mono">' + esc(c.ref) + '</span> · ' + esc(person(c.ownerId)) + ' · ' + esc(fd(st.dueOf(c))) + '</span>' + (c.blocker ? '<span class="late">' + esc(c.blocker) + '</span>' : '') + '</span></a>'; }).join('') + '</div>';
    var canNew = !cust && canAnywhere(u.id, 'commitment.manage');
    return crumbs([[t('nav.home'), 'home'], [t('nav.commitments'), null]]) + '<div class="page-h"><div><h1>' + esc(t('cm.title')) + '</h1><p>' + esc(t(cust ? 'cm.sub.customer' : 'cm.sub.staff')) + '</p></div>' + (canNew ? '<a class="btn btn-primary" ' + go('cmnew') + '>' + pic('plus') + esc(t('cm.new')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('cm.rule')) + '</span></div>' +
      '<section class="card card-b ic-tools"><div class="field ic-search"><label for="cm-q">' + esc(t('dir.search')) + '</label><div class="control">' + ic('search') + '<input id="cm-q" class="input" type="search" data-live value="' + esc(f.q) + '"></div></div>' +
      sel('cmf', 'cm-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projOpts(u))) +
      sel('cmf', 'cm-status', 'status', t('f.status'), [['open', t('rq.f.open')], ['', t('f.all')], ['overdue', t('cstatus.overdue')], ['at_risk', t('cstatus.at_risk')], ['on_track', t('cstatus.on_track')], ['complete', t('cstatus.complete')]]) +
      sel('cmf', 'cm-party', 'party', t('com.party'), [['', t('f.all')], ['rgs', t('com.party.rgs')], ['customer', t('com.party.customer')]]) +
      sel('cmf', 'cm-source', 'source', t('cm.source'), [['', t('f.all')]].concat(['request', 'change', 'document', 'inspection', 'corrective', 'finding', 'milestone'].map(function (k) { return [k, t('kindname.' + k)]; }))) +
      (cust ? '' : '<label class="check"><input type="checkbox" data-pbind="cmf.mine"' + (f.mine ? ' checked' : '') + '> ' + esc(t('ca.mine')) + '</label>') + '</section>' +
      '<p class="muted" role="status">' + esc(t('rq.count', { n: list.length, m: all.length })) + '</p>' +
      card(esc(t('cm.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? '<div class="ic-wide">' + table([t('misc.ref'), t('com.text'), t('cm.source'), t('com.owner'), t('cm.promised'), t('cm.current'), t('cm.forecast'), t('f.status'), t('cm.blocker'), t('cm.next')], rows, 'cmtable') + '</div><div class="ic-narrow">' + narrow + '</div>' : emptyBox('commitments', t('com.none'))) + G.stamp();
  }
  var SRC_KINDS = ['request', 'change', 'document', 'inspection', 'corrective', 'finding', 'milestone'];
  function sourceOptions(u, pid, kind) {
    var st = ST();
    if (!pid || !kind) return [];
    if (kind === 'request') return st.requests(u.id, pid).filter(function (r) { return st.OPEN_REQ.indexOf(r.status) >= 0; }).map(function (r) { return [r.id, r.ref + ' · ' + r.subject]; });
    if (kind === 'change') return st.changes(u.id, pid).filter(function (c) { return ['closed', 'rejected', 'cancelled', 'superseded'].indexOf(c.state) < 0; }).map(function (c) { return [c.id, c.ref + ' · ' + L(c, 'title')]; });
    if (kind === 'document') return st.documents(u.id, pid).filter(function (d) { var p = st.pendingRev(d); return p && p.status === 'under_review'; }).map(function (d) { return [d.id + ':' + st.pendingRev(d).rev, d.number + ' ' + t('doc.revShort', { rev: st.pendingRev(d).rev }) + ' · ' + d.title]; });
    if (kind === 'inspection') return st.inspections(u.id, pid).filter(function (i) { return i.status === 'scheduled' || i.status === 'in_progress' || i.status === 'awaiting_review'; }).map(function (i) { return [i.id, i.ref + ' · ' + i.title]; });
    if (kind === 'corrective') return st.correctives(u.id, pid).filter(st.openCorrective).map(function (c) { return [c.id, c.ref + ' · ' + c.title]; });
    if (kind === 'finding') return st.findingsList(u.id, { project: pid, status: 'open' }).map(function (f) { return [f.id, f.ref + ' · ' + f.description]; });
    if (kind === 'milestone') { var out = []; st.visiblePackages(u.id, pid).forEach(function (w) { st.pkgMilestones(w.id).filter(function (m) { return !m.completedAt; }).forEach(function (m) { out.push([m.id, w.code + ' · ' + L(m, 'name')]); }); }); return out; }
    return [];
  }
  function cmNewPage(u, args) {
    var st = ST();
    if (st.isCustomer(u.id) || !canAnywhere(u.id, 'commitment.manage')) return U().deniedState({ code: 'role' }, null);
    var f = ensure('cmnew');
    if (args[0] && !f.values.kind) { f.values.kind = args[0]; f.values.source = args.slice(1).join(':'); var r0 = st.get(args[0] === 'document' ? 'document' : args[0], args[1]); if (r0) f.values.projectId = st.projectOf(r0) || r0.projectId; }
    var pid = val('projectId'), kind = val('kind'), srcVal = val('source');
    var opts = sourceOptions(u, pid, kind);
    var src = srcVal && kind ? { kind: kind, id: srcVal.split(':')[0], rev: srcVal.split(':')[1] || null } : null;
    var dup = src && st.commitmentForSource(src);
    var owners = pid ? U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, 'commitment.view', { projectId: pid }) && (val('party', 'rgs') === 'customer' ? st.isCustomer(x.id) : !st.isCustomer(x.id)); }) : [];
    var body = select('projectId', t('nav.projects'), st.visibleProjects(u.id).filter(function (p) { return can(u.id, 'commitment.manage', { projectId: p.id }) || st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'commitment.manage', { packageId: w.id }); }); }).map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }), { live: true }) +
      '<div class="grid g-2">' + select('kind', t('cm.sourceKind'), SRC_KINDS.map(function (k) { return [k, t('kindname.' + k)]; }), { live: true, hint: t('cm.sourceHint') }) + select('source', t('cm.source'), opts, { live: true }) + '</div>' +
      (dup ? '<div class="dup" role="alert"><b>' + ic('alert') + ' ' + esc(t('cm.dupExists')) + '</b><p>' + recLink('commitment', dup.id) + ' ' + esc(L(dup, 'text')) + '</p><p class="field-hint">' + esc(t('cm.dupHint')) + '</p></div>' : '') +
      input('text', t('com.text'), 'text') + '<div class="grid g-2">' + select('party', t('com.party'), [['rgs', t('com.party.rgs')], ['customer', t('com.party.customer')]], { live: true, blank: false, value: 'rgs' }) + select('ownerId', t('com.owner'), owners.map(function (x) { return [x.id, x.name + ' · ' + t('role.' + x.role)]; })) + '</div>' +
      input('promised', t('cm.promised'), 'date', { min: st.today }) + input('next', t('cm.next'), 'text', { optional: true }) + input('blocker', t('cm.blocker'), 'text', { optional: true });
    return crumbs([[t('nav.home'), 'home'], [t('nav.commitments'), 'commitments'], [t('cm.new'), null]]) + '<div class="page-h"><div><h1>' + esc(t('cm.new')) + '</h1><p>' + esc(t('cm.newSub')) + '</p></div></div>' +
      card(esc(t('rec.details')), '<div class="card-b">' + formWrap('cmnew', t('cm.new'), body, t('cm.create')) + '</div>');
  }
  function commitmentDetail(u, args) {
    var st = ST(), c = st.get('commitment', args[0]);
    var g = h.guard(u, 'commitment', c); if (g) return g;
    var x = st.cmControls(u.id, c), stt = st.commitmentStatus(c), cust = st.isCustomer(u.id);
    var main = card(esc(t('rec.details')), '<div class="card-b stack"><p class="lead">' + esc(L(c, 'text')) + '</p>' + kv([[t('cm.source'), srcLabel(c)], [t('nav.projects'), recLink('project', c.projectId)], c.packageId ? [t('misc.package'), recLink('package', c.packageId)] : null,
      [t('com.owner'), personRole(c.ownerId)], [t('com.party'), esc(t('com.party.' + c.party))], [t('cm.promised'), esc(fd(c.promised)) + ' <span class="muted">' + esc(t('cm.originalKept')) + '</span>'], [t('cm.current'), dueCell(st.dueOf(c), stt === 'complete')],
      [t('cm.forecast'), esc(fd(c.forecast || st.dueOf(c)))], [t('f.status'), G.cmPill(stt)], [t('cm.blocker'), esc(c.blocker || '—')], [t('cm.next'), esc(c.next || '—')], c.doneAt ? [t('cm.done'), esc(fd(c.doneAt))] : null,
      cust ? null : [t('fnd.visibility'), c.visibility === 'internal' ? pill('plain', t('misc.internal')) : pill('info', t('fnd.custVisible'))]]) + '</div>');
    var hist = (c.history || []).slice().reverse().map(function (hh) {
      var what = hh.type === 'reschedule' ? t('cm.h.reschedule', { from: fd(hh.from), to: fd(hh.to) }) : hh.type === 'complete' ? t('cm.h.complete') : t('cm.h.update', { fields: Object.keys(hh.changes || {}).map(function (k) { return t('cm.f.' + k); }).join(', ') });
      return '<li><b>' + esc(what) + '</b><span class="muted">' + esc(person(hh.by) + ' · ' + fdt(hh.at)) + '</span>' + (hh.reason ? '<span>' + esc(hh.reason) + '</span>' : '') + '</li>';
    }).join('');
    var histCard = card(esc(t('cm.history')), hist ? '<ol class="revlist card-b">' + hist + '</ol>' : emptyBox('commitments', t('cm.noHistory')));
    var a = [], form = '';
    if (x.reschedule) a.push(opener('cm-reschedule.' + c.id, t('cm.f.reschedule'), true));
    if (x.update) a.push(opener('cm-update.' + c.id, t('cm.f.updateBtn')));
    if (x.complete) a.push(opener('cm-complete.' + c.id, t('cm.f.complete')));
    if (isOpen('cm-reschedule.' + c.id)) form = formWrap(F().key, t('cm.f.reschedule'), '<p class="field-hint">' + esc(t('cm.rescheduleHint', { date: fd(c.promised) })) + '</p>' + input('to', t('cm.newDate'), 'date', { value: st.dueOf(c) }) + input('reason', t('dv.reason'), 'textarea'), t('cm.f.reschedule'));
    if (isOpen('cm-update.' + c.id)) form = formWrap(F().key, t('cm.f.updateBtn'), input('forecast', t('cm.forecast'), 'date', { value: c.forecast || st.dueOf(c) }) + input('blocker', t('cm.blocker'), 'text', { value: c.blocker, optional: true }) + input('next', t('cm.next'), 'text', { value: c.next, optional: true }) + input('reason', t('dv.reason'), 'text', { optional: true }), t('cm.f.updateBtn'));
    if (isOpen('cm-complete.' + c.id)) form = formWrap(F().key, t('cm.f.complete'), input('note', t('fi.note'), 'text', { optional: true }), t('cm.f.complete'));
    var side = a.length || form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + form + '</div>') : '';
    return h.recordShell(u, 'commitment', c, L(c, 'text'), G.cmPill(stt), main + histCard, side);
  }

  // =====================================================================================================
  // 4. DEPENDENCIES
  // =====================================================================================================
  function depsPage(u, args) {
    var st = ST(), s = S(), projects = st.visibleProjects(u.id).filter(function (p) { return can(u.id, 'dependency.view', { projectId: p.id }); });
    if (!projects.length) return U().deniedState({ code: 'role' }, null);
    if (!s.depf) s.depf = { project: projects[0].id, status: 'open' };
    if (args && args[0] && projects.some(function (p) { return p.id === args[0]; })) s.depf.project = args[0];
    var f = s.depf, p = st.get('project', f.project), list = st.dependencyList(u.id, f);
    var manage = can(u.id, 'dependency.manage', { projectId: p.id });
    var rows = list.map(function (d) {
      var ds = st.depState(d), fl = ds.flags.map(function (x) { return pill(x === 'overdue' ? 'crit' : 'warn', t('depfl.' + x)); }).join(' ');
      var acts = manage && d.status === 'open' ? '<div class="btn-stack">' + opener('dep-update.' + d.id, t('dep.f.update')) + opener('dep-resolve.' + d.id, t('dep.f.resolve')) + '</div>' : '';
      var form = '';
      if (isOpen('dep-update.' + d.id)) form = formWrap(F().key, t('dep.f.update'), '<div class="grid g-2">' + input('resolutionTarget', t('dep.target'), 'date', { value: d.resolutionTarget }) + select('ownerId', t('com.owner'), staffOn(p.id), { value: d.ownerId }) + '</div>' + input('blocker', t('dep.blocker'), 'text', { value: d.blocker }) + input('reason', t('dv.reason'), 'textarea'), t('dep.f.update'));
      if (isOpen('dep-resolve.' + d.id)) form = formWrap(F().key, t('dep.f.resolve'), input('reason', t('dv.reason'), 'textarea'), t('dep.f.resolve'));
      return '<tr><td class="mono">' + esc(d.ref) + '</td><td>' + nodeCell(ds.pred) + '</td><td>' + nodeCell(ds.dep) + '</td><td>' + esc(d.blocker) + '</td><td>' + esc(person(d.ownerId)) + '</td><td>' + dueCell(d.resolutionTarget, d.status !== 'open') + '</td><td>' + G.depPill(ds.state) + (fl ? '<br>' + fl : '') + '</td><td>' + acts + '</td></tr>' +
        (form ? '<tr class="formrow"><td colspan="8">' + form + '</td></tr>' : '');
    });
    var nodes = [];
    st.visiblePackages(u.id, p.id).forEach(function (w) { nodes.push(['package:' + w.id, w.code + ' · ' + t('svc.' + w.service)]); st.pkgMilestones(w.id).forEach(function (m) { nodes.push(['milestone:' + m.id, w.code + ' · ' + L(m, 'name')]); }); });
    var createCard = manage ? card(esc(t('dep.new')), '<div class="card-b">' + (isOpen('depnew.' + p.id) ? formWrap(F().key, t('dep.new'), '<div class="grid g-2">' + select('pred', t('dep.predecessor'), nodes) + select('dep', t('dep.dependent'), nodes) + '</div>' + input('blocker', t('dep.blocker'), 'text') + '<div class="grid g-2">' + select('ownerId', t('com.owner'), staffOn(p.id)) + input('resolutionTarget', t('dep.target'), 'date') + '</div><p class="field-hint">' + esc(t('dep.cycleRule')) + '</p>', t('dep.create')) : opener('depnew.' + p.id, t('dep.new'), true)) + '</div>') : '';
    var pairs = {};
    list.forEach(function (d) { var a = d.predecessor.kind === 'package' ? d.predecessor.id : (st.get('milestone', d.predecessor.id) || {}).packageId, b = d.dependent.kind === 'package' ? d.dependent.id : (st.get('milestone', d.dependent.id) || {}).packageId; var k = a + '>' + b; pairs[k] = (pairs[k] || 0) + 1; });
    var rel = Object.keys(pairs).map(function (k) { var ab = k.split('>'); return '<li><span class="mono">' + esc(pkgCode(ab[0])) + '</span> → <span class="mono">' + esc(pkgCode(ab[1])) + '</span> <span class="muted">(' + pairs[k] + ')</span></li>'; }).join('');
    return crumbs([[t('nav.home'), 'home'], [t('nav.dependencies'), null]]) + '<div class="page-h"><div><h1>' + esc(t('dep.title')) + '</h1><p>' + esc(t('dep.sub')) + '</p></div></div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('dep.rules')) + '</span></div>' +
      '<section class="card card-b act-tools">' + sel('depf', 'dep-project', 'project', t('nav.projects'), projects.map(function (x) { return [x.id, x.code + ' · ' + L(x, 'name')]; })) + sel('depf', 'dep-status', 'status', t('f.status'), [['open', t('rq.f.open')], ['overdue', t('depst.overdue')], ['', t('f.all')]]) + '</section>' +
      card(esc(t('dep.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('misc.ref'), t('dep.predecessor'), t('dep.dependent'), t('dep.blocker'), t('com.owner'), t('dep.target'), t('f.status'), ''], rows, 'deptable') : emptyBox('link', t('dep.none'))) +
      '<div class="grid g-2">' + card(esc(t('dep.relations')), rel ? '<ul class="plain card-b">' + rel + '</ul>' : emptyBox('link', t('dep.none'))) + createCard + '</div>' + G.stamp();
  }
  function nodeCell(n) {
    if (!n) return '—';
    return (n.kind === 'milestone' ? recLink('milestone', n.id) : recLink('package', n.id)) + '<br><span class="muted">' + esc(G.nodeLabel({ kind: n.kind, id: n.id })) + '</span><br><span class="muted">' + esc(n.done ? t('dep.done') : t('dep.forecastOn', { date: fd(n.forecast) })) + '</span>';
  }
  function staffOn(pid) { return U().D.users.filter(function (x) { return x.status === 'active' && !ST().isCustomer(x.id) && can(x.id, 'project.view', { projectId: pid }); }).map(function (x) { return [x.id, x.name + ' · ' + t('role.' + x.role)]; }); }

  // =====================================================================================================
  // 5. REPORT CENTRE
  // =====================================================================================================
  function reportsPage(u) {
    var st = ST(), s = S(); if (!s.rptf) s.rptf = { project: '', type: '' };
    var f = s.rptf, list = st.reportsList(u.id, f), cust = st.isCustomer(u.id);
    var rows = list.map(function (r) {
      var latest = r.versions.slice(-1)[0];
      return '<tr><td><a ' + go('rpt.' + r.id) + ' class="mono">' + esc(r.ref) + '</a></td><td><b>' + esc(r.title || t('rtype6.' + r.type)) + '</b><br><span class="muted">' + esc(t('rtype6.' + r.type)) + '</span></td><td>' + esc(st.get('project', r.projectId).code) + '</td>' +
        '<td>' + esc(fd(r.period.from) + ' – ' + fd(r.period.to)) + '</td><td>' + esc(fd(r.cutoff)) + '</td><td>' + (cust ? pill('ok', t('rpt.versionN', { v: latest.version })) : G.rptPill(r.status)) + '</td><td>' + (latest ? esc(t('rpt.versionN', { v: latest.version })) + '<br><span class="muted">' + esc(fdt(latest.issuedAt)) + '</span>' : '—') + '</td>' +
        (cust ? '' : '<td>' + esc(person(r.authorId)) + '</td><td class="num">' + r.audience.length + '</td>') + '</tr>';
    });
    var legacy = [];
    st.visibleProjects(u.id).forEach(function (p) { st.documents(u.id, p.id).filter(function (d) { return d.category === 'report' || d.type === 'report'; }).forEach(function (d) { legacy.push(d); }); });
    var canNew = !cust && canAnywhere(u.id, 'report.prepare');
    return crumbs([[t('nav.home'), 'home'], [t('nav.reports'), null]]) + '<div class="page-h"><div><h1>' + esc(t('rpt.title')) + '</h1><p>' + esc(t(cust ? 'rpt.sub.customer' : 'rpt.sub.staff')) + '</p></div>' + (canNew ? '<a class="btn btn-primary" ' + go('rptnew') + '>' + pic('plus') + esc(t('rpt.new')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('shield') + '<span>' + esc(t('rpt.rule')) + '</span></div>' +
      '<section class="card card-b act-tools">' + sel('rptf', 'rpt-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projOpts(u))) + sel('rptf', 'rpt-type', 'type', t('rpt.type'), [['', t('f.all')]].concat(((ST().policy.reports || {}).types || []).map(function (x) { return [x, t('rtype6.' + x)]; }))) + '</section>' +
      card(esc(t('rpt.directory')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('misc.ref'), t('rpt.report'), t('nav.projects'), t('rpt.period'), t('rpt.cutoff'), t('f.status'), t('rpt.latest')].concat(cust ? [] : [t('rpt.author'), t('rpt.audience')]), rows, 'rpttable') : emptyBox('reports', t(cust ? 'rpt.none.customer' : 'rpt.none'))) +
      card(esc(t('rpt.legacy')), legacy.length ? '<ul class="doclist">' + legacy.map(function (d) { return '<li>' + recLink('document', d.id) + '<span class="t"><b>' + esc(d.title) + '</b><span>' + esc(t('rpt.legacyNote')) + '</span></span></li>'; }).join('') + '</ul>' : emptyBox('reports', t('rpt.noLegacy')));
  }
  function audienceFor(pid) {
    var p = ST().get('project', pid); if (!p) return [];
    return U().D.users.filter(function (x) { return x.status === 'active' && x.orgId === p.customerOrgId && can(x.id, 'report.view', { projectId: pid }); });
  }
  function reportNew(u) {
    var st = ST();
    if (st.isCustomer(u.id) || !canAnywhere(u.id, 'report.prepare')) return U().deniedState({ code: 'role' }, null);
    ensure('rptnew');
    var projects = st.visibleProjects(u.id).filter(function (p) { return can(u.id, 'report.prepare', { projectId: p.id }); });
    if (!val('projectId') && projects.length === 1) F().values.projectId = projects[0].id;
    var pid = val('projectId'), aud = pid ? audienceFor(pid) : [], chosen = F().values.aud || [];
    var reviewers = pid ? U().D.users.filter(function (x) { return x.id !== u.id && x.status === 'active' && can(x.id, 'report.review', { projectId: pid }); }) : [];
    var body = '<div class="grid g-2">' + select('type', t('rpt.type'), ((st.policy.reports || {}).types || []).map(function (x) { return [x, t('rtype6.' + x)]; })) + select('projectId', t('nav.projects'), projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }), { live: true }) + '</div>' +
      input('title', t('doc.title'), 'text', { optional: true }) +
      '<div class="grid g-3">' + input('from', t('rpt.from'), 'date', { max: st.today }) + input('to', t('rpt.to'), 'date', { max: st.today, value: st.today }) + input('cutoff', t('rpt.cutoff'), 'date', { max: st.today, value: st.today, hint: t('rpt.cutoffHint') }) + '</div>' +
      select('reviewerId', t('rpt.reviewer'), reviewers.map(function (x) { return [x.id, x.name + ' · ' + t('role.' + x.role)]; }), { hint: t('rpt.reviewerHint') }) +
      '<fieldset class="field"><legend class="label">' + esc(t('rpt.audience')) + '</legend><div class="checks">' + (aud.length ? aud.map(function (x) { return '<label class="check"><input type="checkbox" name="aud" value="' + x.id + '"' + (chosen.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') : '<span class="muted">' + esc(t(pid ? 'rpt.noAudience' : 'rpt.chooseProject')) + '</span>') + '</div>' +
      (F().errors.aud ? '<div class="field-error">' + ic('alert') + esc(t(F().errors.aud)) + '</div>' : '') + '<span class="field-hint">' + esc(t('rpt.audienceHint')) + '</span></fieldset>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.reports'), 'reports'], [t('rpt.new'), null]]) + '<div class="page-h"><div><h1>' + esc(t('rpt.builder')) + '</h1><p>' + esc(t('rpt.builderSub')) + '</p></div></div>' +
      card(esc(t('rec.details')), '<div class="card-b">' + formWrap('rptnew', t('rpt.builder'), body, t('rpt.generate')) + '</div>');
  }
  function versionOf(u, r, arg) {
    var cust = ST().isCustomer(u.id);
    if (arg === 'draft' && !cust && r.draft) return { v: 'draft', snap: r.draft.snapshot, meta: { generatedAt: r.draft.generatedAt } };
    var n = arg ? +arg : null, list = r.versions;
    var v = (n ? list.filter(function (x) { return x.version === n; })[0] : null) || (!cust && r.draft && !n ? null : list.slice(-1)[0]);
    if (!v && r.draft && !cust) return { v: 'draft', snap: r.draft.snapshot, meta: { generatedAt: r.draft.generatedAt } };
    return v ? { v: v.version, snap: v.snapshot, meta: v } : null;
  }
  function reportDetail(u, args) {
    var st = ST(), r = st.get('report', args[0]);
    var g = h.guard(u, 'report', r); if (g) return g;
    var cust = st.isCustomer(u.id), c = st.reportControls(u.id, r), cur = versionOf(u, r, args[1]);
    var tabs = (!cust && r.draft ? '<a class="revtab' + (cur && cur.v === 'draft' ? ' cur' : '') + '" ' + go('rpt.' + r.id + '.draft') + '><span class="mono">' + esc(t('rpt.draft')) + '</span><span>' + esc(t('rptst.' + r.status)) + '</span></a>' : '') +
      r.versions.slice().reverse().map(function (v) { return '<a class="revtab rs-published' + (cur && cur.v === v.version ? ' cur' : '') + '" ' + go('rpt.' + r.id + '.' + v.version) + '><span class="mono">v' + v.version + '</span><span>' + esc(fd(v.issuedAt)) + '</span></a>'; }).join('');
    var banner = cur && cur.v === 'draft' ? '<div class="revbanner draft"><b class="rb-state">' + esc(t('rpt.draftBanner')) + '</b><span>' + esc(t('rpt.draftBanner.d')) + '</span></div>' :
      cur ? '<div class="revbanner"><b class="rb-state">' + esc(t('rpt.issuedBanner', { v: cur.v })) + '</b><span>' + esc(t('rpt.issuedBanner.d', { date: fdt(cur.meta.issuedAt), who: person(cur.meta.issuedBy) })) + '</span></div>' : '';
    var body = cur ? renderSnapshot(u, cur.snap) : emptyBox('reports', t('rpt.noVersion'));
    var meta = card(esc(t('rpt.meta')), '<div class="card-b">' + kv([[t('rpt.type'), esc(t('rtype6.' + r.type))], [t('rpt.period'), esc(fd(r.period.from) + ' – ' + fd(r.period.to))], [t('rpt.cutoff'), esc(fd(r.cutoff))],
      [t('rpt.generated'), esc(cur ? fdt(cur.v === 'draft' ? cur.meta.generatedAt : cur.meta.generatedAt) : '—')], [t('rpt.author'), personRole(cur && cur.meta.authorId || r.authorId)], [t('rpt.reviewer'), personRole(cur && cur.meta.reviewedBy || r.reviewerId)],
      [t('rpt.audience'), r.audience.map(function (x) { return esc(person(x)); }).join(', ')], cur && cur.meta.amendReason ? [t('rpt.amendReason'), esc(cur.meta.amendReason)] : null]) + '</div>');
    var a = [], form = '';
    if (c.edit) a.push(opener('rpt-regen.' + r.id, t('rpt.f.regen')));
    if (c.submit) a.push(opener('rpt-submit.' + r.id, t('rpt.f.submit'), true));
    if (c.review) a.push(opener('rpt-review.' + r.id, t('rpt.f.review'), true));
    if (c.reviewSelf) a.push('<span class="why">' + esc(t('rpt.why.self', { who: person(r.reviewerId) })) + '</span>');
    if (c.issue) a.push(opener('rpt-issue.' + r.id, t('rpt.f.issue'), true));
    if (c.amend) a.push(opener('rpt-amend.' + r.id, t('rpt.f.amend')));
    if (isOpen('rpt-regen.' + r.id)) form = formWrap(F().key, t('rpt.f.regen'), '<p class="field-hint">' + esc(t('rpt.regenHint')) + '</p>', t('rpt.f.regen'));
    if (isOpen('rpt-submit.' + r.id)) form = formWrap(F().key, t('rpt.f.submit'), '<p class="field-hint">' + esc(t('rpt.submitHint', { who: person(r.reviewerId) })) + '</p>', t('rpt.f.submit'));
    if (isOpen('rpt-review.' + r.id)) form = formWrap(F().key, t('rpt.f.review'), '<fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="row">' + ['approve', 'return'].map(function (o) { return '<label class="check"><input type="radio" name="outcome" value="' + o + '"' + (val('outcome', 'approve') === o ? ' checked' : '') + '> ' + esc(t('rpt.o.' + o)) + '</label>'; }).join('') + '</div></fieldset>' + input('reason', t('dv.reason'), 'textarea', { optional: true }), t('rpt.f.review'));
    if (isOpen('rpt-issue.' + r.id)) form = formWrap(F().key, t('rpt.f.issue'), '<p class="field-hint">' + esc(t('rpt.issueHint', { n: r.audience.length })) + '</p>', t('rpt.f.issue'));
    if (isOpen('rpt-amend.' + r.id)) form = formWrap(F().key, t('rpt.f.amend'), '<p class="field-hint">' + esc(t('rpt.amendHint')) + '</p>' + input('reason', t('dv.reason'), 'textarea'), t('rpt.f.amend'));
    var exp = '';
    if (cur) {
      var ok = c.exportCheck.allowed;
      exp = card(esc(t('rpt.export')), '<div class="card-b stack">' + (ok ? '<div class="btn-stack"><button class="btn btn-secondary" data-pact="rpt-csv" data-v="' + r.id + '|' + cur.v + '">' + pic('download') + esc(t('rpt.csv')) + '</button><a class="btn btn-secondary" ' + go('rptprint.' + r.id + '.' + cur.v) + '>' + pic('documents') + esc(t('rpt.pdf')) + '</a></div>' :
        '<p class="why">' + esc(t('reason.' + (c.exportCheck.code || 'role'))) + '</p>') + '<p class="field-hint">' + esc(t('rpt.exportNote')) + '</p></div>');
    }
    var side = (a.length || form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + errBox(!form && F().serverError) + form + '</div>') : '') + meta + exp;
    return h.recordShell(u, 'report', r, r.title || t('rtype6.' + r.type) + ' · ' + st.get('project', r.projectId).code, cust ? '' : G.rptPill(r.status),
      '<nav class="revnav" aria-label="' + esc(t('rpt.versions')) + '">' + tabs + '</nav>' + banner + body, side);
  }
  // ---- snapshot rendering (also used for print). Every chart states its unit, date and records.
  function hbar(label, pct, note) {
    return '<li class="hb"><span class="hb-l">' + label + '</span><span class="hb-t"><i style="width:' + (pct == null ? 0 : Math.max(0, Math.min(100, pct))) + '%"></i></span><span class="hb-v num">' + (pct == null ? esc(t('pg.notConfiguredShort')) : pct + '%') + '</span>' + (note ? '<span class="hb-n">' + note + '</span>' : '') + '</li>';
  }
  function renderSnapshot(u, s) {
    var st = ST(), sec = s.sections, out = '';
    var head = '<div class="snap-h"><b>' + esc(t('rtype6.' + s.type)) + ' — ' + esc(s.projectCode) + ' · ' + esc(S().lang === 'ar' ? s.projectNameAr : s.projectName) + '</b><span>' + esc(t('rpt.snapMeta', { from: fd(s.period.from), to: fd(s.period.to), cutoff: fd(s.cutoff), gen: fdt(s.generatedAt) })) + '</span></div>';
    if (s.type === 'progress') {
      out += card(esc(t('rpt.s.progress')), '<div class="card-b stack"><p class="big-num"><b class="num">' + (sec.project.pct == null ? esc(t('pg.notConfiguredShort')) : sec.project.pct + '%') + '</b> <span class="muted">' + esc(t('rpt.projectAsOf', { date: fd(sec.project.asOf) })) + '</span></p>' +
        (sec.project.configured ? '' : '<p class="field-hint">' + esc(t('pg.projectNc', { list: sec.project.missing.join(', ') })) + '</p>') +
        '<figure class="hchart"><figcaption>' + esc(t('rpt.chartProgress', { date: fd(sec.project.asOf) })) + '</figcaption><ul>' + sec.packages.map(function (p) {
          var note = p.calc ? (p.calc.kind === 'quantities' ? esc(t('rpt.qtyNote', { done: num(p.calc.done), total: num(p.calc.total), unit: p.calc.unit || (p.calc.units || []).join('/') })) : esc(t('rpt.wNote', { done: p.calc.done, total: p.calc.total }))) : esc(t('pg.notConfigured'));
          return hbar('<span class="mono">' + esc(p.code) + '</span> ' + esc(t('svc.' + p.service)), p.pct, note + ' · ' + esc(t('pg.asOf', { date: fd(p.asOf) })));
        }).join('') + '</ul><p class="field-hint">' + esc(t('rpt.chartUnit')) + '</p></figure></div>');
      out += card(esc(t('pkgsec.milestones')), table([t('misc.package'), t('ms.name'), t('pg.baseline'), t('ms.forecast'), t('pg.verified')], [].concat.apply([], sec.packages.map(function (p) { return p.milestones.map(function (m) { return '<tr><td class="mono">' + esc(p.code) + '</td><td>' + esc(S().lang === 'ar' ? m.nameAr || m.name : m.name) + (m.rebaselined ? ' ' + pill('plain', t('pg.rebaselined', { n: m.rebaselined })) : '') + '</td><td>' + esc(fd(m.baseline)) + '</td><td>' + esc(fd(m.forecast)) + '</td><td>' + (m.actual ? pill('ok', fd(m.actual)) : '—') + '</td></tr>'; }); })), 'snaptable'));
      out += card(esc(t('rpt.s.updates')) + ' <span class="pill plain num">' + sec.updates.length + '</span>', sec.updates.length ? table([t('misc.ref'), t('du.date'), t('misc.package'), t('du.work'), t('du.quantities')], sec.updates.map(function (d) { return '<tr><td class="mono">' + esc(d.ref) + '</td><td>' + esc(fd(d.date)) + '</td><td class="mono">' + esc(d.pkg) + '</td><td>' + esc(d.workDone) + '</td><td>' + (d.quantities.map(function (q) { return num(q.qty) + ' ' + esc(q.unit); }).join(', ') || '—') + '</td></tr>'; }), 'snaptable') : emptyBox('reports', t('rpt.noUpdates')));
    } else if (s.type === 'commitments') {
      var counts = {}; sec.commitments.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
      var max = Math.max.apply(null, [1].concat(Object.keys(counts).map(function (k) { return counts[k]; })));
      out += card(esc(t('rpt.s.commitments')), '<div class="card-b stack"><figure class="hchart"><figcaption>' + esc(t('rpt.chartCommitments', { date: fd(s.cutoff) })) + '</figcaption><ul>' + ['overdue', 'at_risk', 'on_track', 'complete'].map(function (k) {
        return '<li class="hb"><span class="hb-l">' + esc(t('cstatus.' + k)) + '</span><span class="hb-t"><i class="cs-' + k + '" style="width:' + Math.round((counts[k] || 0) / max * 100) + '%"></i></span><span class="hb-v num">' + (counts[k] || 0) + '</span></li>';
      }).join('') + '</ul><p class="field-hint">' + esc(t('rpt.chartCount')) + '</p></figure>' +
        table([t('misc.ref'), t('com.text'), t('com.party'), t('com.owner'), t('cm.promised'), t('cm.current'), t('cm.forecast'), t('f.status'), t('cm.blocker'), t('cm.next')], sec.commitments.map(function (c) {
          return '<tr><td class="mono">' + esc(c.ref) + '</td><td>' + esc(S().lang === 'ar' && c.textAr ? c.textAr : c.text) + '</td><td>' + esc(t('com.party.' + c.party)) + '</td><td>' + esc(c.owner) + '</td><td>' + esc(fd(c.promised)) + '</td><td>' + esc(fd(c.current)) + (c.rescheduled ? ' ' + pill('plain', t('cm.rescheduledN', { n: c.rescheduled })) : '') + '</td><td>' + esc(fd(c.forecast)) + '</td><td>' + G.cmPill(c.status) + '</td><td>' + esc(c.blocker || '—') + '</td><td>' + esc(c.next || '—') + '</td></tr>';
        }), 'snaptable') + '</div>');
    } else if (s.type === 'quality') {
      out += card(esc(t('rpt.s.inspections')) + ' <span class="pill plain num">' + sec.inspections.length + '</span>', sec.inspections.length ? table([t('misc.ref'), t('doc.title'), t('ic.type'), t('du.date'), t('f.status'), t('id.d.verify')], sec.inspections.map(function (i) { return '<tr><td class="mono">' + esc(i.ref) + '</td><td>' + esc(i.title) + '</td><td>' + esc(t('itype.' + i.type)) + '</td><td>' + esc(fd(i.date)) + '</td><td>' + esc(t('istat.' + i.status)) + '</td><td>' + (i.outcome ? esc(t('vout.' + i.outcome)) : '—') + '</td></tr>'; }), 'snaptable') : emptyBox('inspections', t('rpt.noInspections')));
      var byC = {}; sec.findings.forEach(function (f) { var k = f.classification + '|' + (f.status === 'closed' ? 'closed' : 'open'); byC[k] = (byC[k] || 0) + 1; });
      out += card(esc(t('rpt.s.findings')) + ' <span class="pill plain num">' + sec.findings.length + '</span>', '<div class="card-b stack"><figure class="hchart"><figcaption>' + esc(t('rpt.chartFindings', { date: fd(s.cutoff) })) + '</figcaption><ul>' + ['observation', 'nonconformance', 'hse_concern'].map(function (k) {
        var o = byC[k + '|open'] || 0, cl = byC[k + '|closed'] || 0, tot = Math.max(1, sec.findings.length);
        return '<li class="hb"><span class="hb-l">' + esc(t('fcls.' + k)) + '</span><span class="hb-t"><i style="width:' + Math.round(o / tot * 100) + '%"></i></span><span class="hb-v num">' + esc(t('rpt.openClosed', { o: o, c: cl })) + '</span></li>';
      }).join('') + '</ul><p class="field-hint">' + esc(t('rpt.chartCount')) + '</p></figure>' +
        (sec.findings.length ? table([t('misc.ref'), t('fnd.class'), t('fnd.severity'), t('f.status'), t('fnd.description'), t('fnd.target')], sec.findings.map(function (f) { return '<tr><td class="mono">' + esc(f.ref) + '</td><td>' + esc(t('fcls.' + f.classification)) + '</td><td>' + esc(t('sev.' + f.severity)) + '</td><td>' + esc(t('fstat.' + f.status)) + '</td><td>' + esc(f.description) + '</td><td>' + esc(fd(f.target)) + '</td></tr>'; }), 'snaptable') : '') +
        (sec.corrective.length ? '<h3 class="sub-h">' + esc(t('nav.corrective')) + '</h3>' + table([t('misc.ref'), t('doc.title'), t('f.status'), t('act.due')], sec.corrective.map(function (c) { return '<tr><td class="mono">' + esc(c.ref) + '</td><td>' + esc(c.title) + '</td><td>' + esc(t('castatus.' + c.status)) + '</td><td>' + esc(fd(c.due)) + '</td></tr>'; }), 'snaptable') : '') + '</div>');
    } else if (s.type === 'handover') {
      out += card(esc(t('rpt.s.handover')), '<div class="card-b stack"><figure class="hchart"><figcaption>' + esc(t('rpt.chartHandover', { date: fd(s.cutoff) })) + '</figcaption><ul>' + sec.packages.map(function (p) {
        return hbar('<span class="mono">' + esc(p.code) + '</span> ' + esc(t('svc.' + p.service)), p.configured ? p.pct : null, p.configured ? esc(t('rdst.' + p.state)) + ' · ' + esc(t('ho6.metOf', { a: p.met, b: p.total })) : esc(t('ho6.notConfigured')));
      }).join('') + '</ul><p class="field-hint">' + esc(t('rpt.chartHoUnit')) + '</p></figure>' +
        sec.packages.filter(function (p) { return p.configured; }).map(function (p) {
          return '<h3 class="sub-h"><span class="mono">' + esc(p.code) + '</span> ' + G.rdPill(p.state) + '</h3><ul class="ho-req">' + p.items.map(function (it) { return reqLine(it, true); }).join('') + '</ul>';
        }).join('') + '</div>');
    }
    var recs = '<details class="explain"><summary>' + pic('link') + ' ' + esc(t('rpt.records', { n: s.records.length })) + '</summary><ul class="fchips">' + s.records.map(function (x) { var r = st.get(x.kind, x.id); return '<li>' + (r ? recLink(x.kind, x.id) : '<span class="mono">' + esc(x.ref) + '</span>') + '</li>'; }).join('') + '</ul><p class="field-hint">' + esc(t('rpt.recordsNote')) + '</p></details>';
    return '<div class="snapshot">' + head + out + recs + '</div>';
  }
  function reportPrint(u, args) {
    var st = ST(), r = st.get('report', args[0]);
    var g = h.guard(u, 'report', r); if (g) return g;
    var c = st.reportControls(u.id, r);
    if (!c.exportCheck.allowed) return U().deniedState(c.exportCheck, null);
    var cur = versionOf(u, r, args[1]); if (!cur) return emptyBox('reports', t('rpt.noVersion'));
    // the print view itself is an export: it is recorded once per opening
    var key = 'rpt-print-' + r.id + '-' + cur.v;
    if (!S()[key]) { S()[key] = true; API().dispatch('report.export', u.id, { id: r.id, v: cur.v, format: 'print' }); }
    return '<div class="printview"><div class="no-print row-between"><a class="btn btn-secondary" ' + go('rpt.' + r.id + '.' + cur.v) + '>' + ic('arrow', 'flip back') + esc(t('rpt.backToReport')) + '</a><button class="btn btn-primary" data-pact="rpt-print">' + pic('documents') + esc(t('rpt.printBtn')) + '</button></div>' +
      '<p class="field-hint no-print">' + esc(t('rpt.printHint')) + '</p><header class="print-h"><img src="assets/rgs-logo.png" alt="RGS" class="print-logo" onerror="this.remove()"><div><h1>' + esc(r.title || t('rtype6.' + r.type)) + '</h1><p>' + esc(r.ref + ' · ' + (cur.v === 'draft' ? t('rpt.draft') : t('rpt.versionN', { v: cur.v }))) + '</p></div></header>' +
      renderSnapshot(u, cur.snap) + '<footer class="print-f">' + esc(t('rpt.printFoot', { ref: r.ref, v: cur.v, date: fdt(cur.meta.issuedAt || cur.meta.generatedAt) })) + '</footer></div>';
  }
  function csvFor(r, v, snap) {
    var rows = [['report', r.ref], ['version', v], ['type', snap.type], ['project', snap.projectCode], ['period_from', snap.period.from || ''], ['period_to', snap.period.to], ['cutoff', snap.cutoff], ['generated_at', snap.generatedAt], []];
    var sec = snap.sections;
    if (snap.type === 'progress') {
      rows.push(['section', 'package', 'service', 'method', 'percent', 'done', 'total', 'unit', 'as_of']);
      sec.packages.forEach(function (p) { rows.push(['package', p.code, p.service, p.method || 'not_configured', p.pct == null ? '' : p.pct, p.calc ? p.calc.done : '', p.calc ? p.calc.total : '', p.calc && p.calc.kind === 'quantities' ? p.calc.unit || '' : 'weight', p.asOf || '']); });
      rows.push(['project', snap.projectCode, '', '', sec.project.pct == null ? '' : sec.project.pct, '', '', '%', sec.project.asOf || '']);
      rows.push([]); rows.push(['section', 'ref', 'date', 'package', 'work_done', 'quantities']);
      sec.updates.forEach(function (d) { rows.push(['update', d.ref, d.date, d.pkg, d.workDone, d.quantities.map(function (q) { return q.qty + ' ' + q.unit; }).join('; ')]); });
    } else if (snap.type === 'commitments') {
      rows.push(['ref', 'commitment', 'party', 'owner', 'promised', 'current', 'forecast', 'status', 'blocker', 'next_action', 'rescheduled_times']);
      sec.commitments.forEach(function (c) { rows.push([c.ref, c.text, c.party, c.owner, c.promised, c.current, c.forecast, c.status, c.blocker, c.next, c.rescheduled]); });
    } else if (snap.type === 'quality') {
      rows.push(['section', 'ref', 'title_or_description', 'type_or_class', 'status', 'date_or_target', 'outcome_or_severity']);
      sec.inspections.forEach(function (i) { rows.push(['inspection', i.ref, i.title, i.type, i.status, i.date, i.outcome || '']); });
      sec.findings.forEach(function (f) { rows.push(['finding', f.ref, f.description, f.classification, f.status, f.target || '', f.severity]); });
      sec.corrective.forEach(function (c) { rows.push(['corrective', c.ref, c.title, '', c.status, c.due || '', '']); });
    } else if (snap.type === 'handover') {
      rows.push(['package', 'configured', 'state', 'percent_met', 'requirement', 'requirement_status', 'records', 'withheld_internal']);
      sec.packages.forEach(function (p) { if (!p.configured) rows.push([p.code, 'no', '', '', '', '', '', '']); else p.items.forEach(function (it) { rows.push([p.code, 'yes', p.state, p.pct, it.type, it.status, it.refs.map(function (x) { return x.kind + ':' + x.id + (x.rev != null ? '@' + x.rev : ''); }).join(' '), it.withheld]); }); });
    }
    return rows.map(function (r0) { return r0.map(function (c0) { var s0 = String(c0 == null ? '' : c0); return /[",\n;]/.test(s0) ? '"' + s0.replace(/"/g, '""') + '"' : s0; }).join(','); }).join('\r\n');
  }
  function exportCsv(id, v) {
    var r = ST().get('report', id), res = API().dispatch('report.export', me().id, { id: id, v: v === 'draft' ? 'draft' : +v, format: 'csv' });
    if (!res.ok) { F().serverError = res.code; U().toast(err(res.code)); U().render(); return; }
    var csv = '﻿' + csvFor(r, res.result.version, res.result.snapshot);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = r.ref + '-v' + res.result.version + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    U().toast(t('rpt.exported'));
  }

  // =====================================================================================================
  // 6. HANDOVER READINESS
  // =====================================================================================================
  function reqText(it) {
    var rq = it.req || it;
    if (it.type === 'document') return t('ho6.req.document', { cat: t('dtype.' + (rq.category || it.category)) });
    if (it.type === 'inspection') return t('ho6.req.inspection', { type: t('itype.' + (rq.inspectionType || it.inspectionType)) });
    return t('ho6.req.' + it.type);
  }
  function reqLine(it, snapshot) {
    var icon = it.status === 'met' ? 'check' : it.status === 'blocking' ? 'alert' : 'clock';
    var refs = (it.refs || []).map(function (x) { return ST().get(x.kind, x.id) ? recLink(x.kind, x.id) + (x.rev != null && x.kind === 'document' ? ' <span class="mono muted">' + esc(t('doc.revShort', { rev: x.rev })) + '</span>' : '') : ''; }).join(' ');
    var hidden = snapshot ? it.withheld : it.hidden;
    return '<li class="hq hq-' + it.status + '"><span class="hq-i">' + pic(icon) + '</span><span class="t"><b>' + esc(reqText(it)) + '</b><span>' + esc(t('hqst.' + it.status)) + (refs ? ' · ' + refs : '') + (hidden ? ' · <span class="muted">' + esc(t('ho6.withheld', { n: hidden })) + '</span>' : '') + '</span></span></li>';
  }
  function handoverPage(u) {
    var st = ST(), s = S(); if (!s.hof) s.hof = { project: '', area: '', state: '' };
    var f = s.hof, rows = st.handoverDashboard(u.id, f), set = st.handoverSetting(), cust = st.isCustomer(u.id);
    var areas = []; st.visibleProjects(u.id).forEach(function (p) { if (!f.project || f.project === p.id) areas = areas.concat(st.areas(p.id)); });
    var trs = rows.map(function (r) {
      var rd = r.readiness;
      return '<tr><td><a ' + go('ho.' + r.pkg.id) + ' class="mono">' + esc(r.pkg.code) + '</a><br>' + svcTag(r.pkg.service) + '</td><td>' + esc(r.project.code) + '</td><td>' + esc(areaName(r.pkg.areaId)) + '</td><td>' + G.rdPill(rd.state) + '</td>' +
        '<td>' + (rd.configured ? (rd.blockers.length ? '<b class="late">' + esc(t('ho6.blockersN', { n: rd.blockers.length })) + '</b>' : '<span class="muted">0</span>') : '—') + '</td><td class="num">' + (rd.configured ? '<b>' + rd.pct + '%</b>' + bar(rd.pct) + '<span class="muted">' + esc(t('ho6.metOf', { a: rd.met, b: rd.total })) + '</span>' : esc(t('ho6.notConfiguredShort'))) + '</td>' +
        '<td>' + (r.current ? recLink('handoverpkg', r.current.id) + (r.current.acceptance ? ' ' + pill('ok', t('ho6.accepted')) : '') : '<span class="muted">—</span>') + '</td></tr>';
    });
    return crumbs([[t('nav.home'), 'home'], [t('nav.handover'), null]]) + '<div class="page-h"><div><h1>' + esc(t('ho6.title')) + '</h1><p>' + esc(t(cust ? 'ho6.sub.customer' : 'ho6.sub.staff')) + '</p></div></div>' +
      '<div class="notice">' + ic('shield') + '<span>' + esc(t('ho6.rule')) + (set.example ? ' ' : '') + '</span>' + G.testPill(set.example, set.label) + '</div>' +
      '<section class="card card-b act-tools">' + sel('hof', 'ho-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projOpts(u))) + sel('hof', 'ho-area', 'area', t('rq.area'), [['', t('f.all')]].concat(areas.map(function (a) { return [a.id, a.code + ' · ' + L(a, 'name')]; }))) +
      sel('hof', 'ho-state', 'state', t('f.status'), [['', t('f.all')]].concat(['blocked', 'incomplete', 'ready', 'not_configured'].map(function (x) { return [x, t('rdst.' + x)]; }))) + '</section>' +
      card(esc(t('ho6.dashboard')) + ' <span class="pill plain num">' + rows.length + '</span>', rows.length ? table([t('misc.package'), t('nav.projects'), t('rq.area'), t('f.status'), t('ho6.blockers'), t('ho6.readiness'), t('ho6.currentPackage')], trs, 'hotable') : emptyBox('handover', t('ho6.none'))) + G.stamp();
  }
  function handoverDetail(u, args) {
    var st = ST(), w = st.get('package', args[0]);
    var g = h.guard(u, 'package', w); if (g) return g;
    if (!can(u.id, 'handover.view', { packageId: w.id })) return U().deniedState({ code: 'role' }, null);
    var p = st.get('project', w.projectId), rd = st.readiness(u.id, w.id), cust = st.isCustomer(u.id);
    var head = crumbs([[t('nav.home'), 'home'], [t('nav.handover'), 'handover'], [w.code, null]]) + '<div class="page-h"><div><span class="eyebrow">' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></span><h1>' + esc(t('ho6.detailTitle')) + '</h1><p>' + esc(areaName(w.areaId) + ' · ' + L(p, 'name')) + '</p></div>' + G.rdPill(rd.state) + '</div>';
    var readiness;
    if (!rd.configured) readiness = card(esc(t('ho6.readiness')), '<div class="card-b"><div class="notice warn" role="status">' + ic('alert') + '<span><b>' + esc(t('ho6.notConfigured')) + '</b> ' + esc(t('ho6.notConfigured.d')) + '</span></div></div>');
    else readiness = card(esc(t('ho6.readiness')), '<div class="card-b stack">' +
      (rd.blockers.length ? '<div class="ho-block" role="alert">' + ic('alert') + '<div><b>' + esc(t('ho6.blockedBanner', { n: rd.blockers.length })) + '</b><span>' + esc(t('ho6.blockedBanner.d')) + '</span></div></div>' : rd.state === 'ready' ? '<div class="notice">' + ic('check') + '<span>' + esc(t('ho6.readyBanner')) + '</span></div>' : '') +
      '<div class="ho-pct"><b class="num">' + rd.pct + '%</b><span>' + esc(t('ho6.metOf', { a: rd.met, b: rd.total })) + '</span>' + bar(rd.pct, t('ho6.readiness')) + '</div><p class="field-hint">' + esc(t('ho6.pctRule')) + '</p>' +
      '<ul class="ho-req">' + rd.items.map(function (it) { return reqLine(it, false); }).join('') + '</ul>' + G.testPill(rd.example, rd.label) + G.stamp() + '</div>');
    var vs = st.hpVersions(w.id).filter(function (x) { return st.canSee(u.id, 'handoverpkg', x); });
    var canPrep = !cust && can(u.id, 'handover.prepare', { packageId: w.id }) && !st.hpVersions(w.id).some(function (x) { return ['draft', 'in_review', 'reviewed'].indexOf(x.status) >= 0; });
    var versions = card(esc(t('ho6.packages')) + ' <span class="pill plain num">' + vs.length + '</span>', (vs.length ? '<ul class="doclist">' + vs.slice().reverse().map(function (x) { return '<li>' + recLink('handoverpkg', x.id) + '<span class="t"><b>' + esc(x.title) + '</b><span>' + esc(x.issuedAt ? t('ho6.issuedOn', { date: fd(x.issuedAt) }) : t('hpst.' + x.status)) + (x.acceptance ? ' · ' + esc(t('ho6.acceptedBy', { who: person(x.acceptance.by) })) : '') + '</span></span>' + G.hpPill(x.status) + '</li>'; }).join('') + '</ul>' : emptyBox('handover', t('ho6.noPackages'))) +
      (canPrep ? '<div class="card-b"><a class="btn btn-primary" ' + go('hpnew.' + w.id) + '>' + pic('plus') + esc(t('ho6.assemble')) + '</a></div>' : ''));
    return head + '<div class="grid g-home"><div class="grid">' + readiness + versions + '</div><div class="grid">' + releaseCard(u, w) + '</div></div>';
  }
  // ---- technical release: its own record, never implied by acknowledgement or acceptance
  function releaseCard(u, w) {
    var st = ST(), cust = st.isCustomer(u.id), rels = st.releasesFor(u.id, w.id);
    var list = rels.length ? '<ul class="plain">' + rels.map(function (r) {
      var flags = st.decisionFlags(r);
      return '<li class="rel-item"><b class="mono">' + esc(r.ref) + '</b> ' + pill(r.status === 'recorded' ? 'ok' : 'plain', t('relst.' + r.status)) + '<br>' + esc(t('rel.by', { who: person(r.decidedBy), date: fdt(r.at) })) + (r.authority ? ' · <span class="mono">' + esc(r.authority) + '</span>' : '') +
        '<br><span>' + esc(t('rel.scope')) + ': ' + esc(r.scope) + '</span>' + (r.conditions ? '<br><span>' + esc(t('rel.conditions')) + ': ' + esc(r.conditions) + '</span>' : '') + '<br><span class="muted">' + esc(t('rel.basis', { ref: (st.get('handoverpkg', r.handoverPackageId) || {}).ref || '', v: r.hpVersion })) + '</span>' +
        (r.status === 'recorded' && flags.length ? '<div class="notice warn">' + ic('alert') + '<span><b>' + esc(t('rel.reassess')) + '</b> ' + esc(flags.map(function (f0) { return t('relfl.' + f0); }).join('; ')) + '</span></div>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="muted">' + esc(t('rel.none')) + '</p>';
    if (cust) return card(esc(t('rel.title')), '<div class="card-b stack">' + list + '<p class="field-hint">' + esc(t('rel.customerNote')) + '</p></div>');
    var chk = st.releaseCheck(u.id, w.id), body;
    if (!chk.configured) body = '<div class="notice warn" role="status">' + ic('alert') + '<span><b>' + esc(t('rel.notConfigured')) + '</b> ' + esc(t('rel.notConfigured.d')) + '</span></div>';
    else {
      body = '<ul class="ho-req">' + chk.prereqs.map(function (x) { return '<li class="hq hq-' + (x.met ? 'met' : 'missing') + '"><span class="hq-i">' + pic(x.met ? 'check' : 'clock') + '</span><span class="t"><b>' + esc(t('rel.pre.' + x.key)) + '</b><span>' + esc(t(x.met ? 'hqst.met' : 'hqst.missing')) + '</span></span></li>'; }).join('') +
        '<li class="hq hq-' + (chk.authority.allowed ? 'met' : 'blocking') + '"><span class="hq-i">' + pic(chk.authority.allowed ? 'check' : 'lock') + '</span><span class="t"><b>' + esc(t('rel.authority')) + '</b><span>' + esc(chk.authority.allowed ? t('rel.authorityOk', { id: chk.authority.authority || '' }) : t('reason.' + (chk.authority.code || 'role'))) + '</span></span></li></ul>' + G.testPill(chk.example, chk.label);
      if (chk.allowed) body += isOpen('rel.' + w.id) ? formWrap(F().key, t('rel.f.record'), '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('rel.recordHint')) + '</span></div>' + input('scope', t('rel.scope'), 'textarea') + input('conditions', t('rel.conditions'), 'textarea', { optional: true }), t('rel.f.record')) : '<div class="btn-stack">' + opener('rel.' + w.id, t('rel.f.record'), true) + '</div>';
      else body += '<p class="why">' + esc(t('rel.blocked.' + (chk.code === 'authority_expired' || chk.code === 'authority' || chk.code === 'role' || chk.code === 'no_authority' ? 'authority' : chk.code || 'prerequisites_unmet'))) + '</p>';
    }
    return card(esc(t('rel.title')), '<div class="card-b stack"><p class="field-hint">' + esc(t('rel.rule')) + '</p>' + body + '<h3 class="sub-h">' + esc(t('rel.recorded')) + '</h3>' + list + '</div>');
  }
  // ---- handover package: assemble, review, issue (frozen), acknowledge, accept, amend
  function candidates(u, w) {
    var st = ST(), out = [];
    st.documents(u.id, w.projectId, w.id).forEach(function (d) { var pr = st.pubRev(d); if (pr) out.push({ kind: 'document', id: d.id, rev: pr.rev, label: d.number + ' ' + t('doc.revShort', { rev: pr.rev }) + ' · ' + d.title, group: 'documents' }); });
    st.inspections(u.id, w.projectId, w.id).forEach(function (i) { if (st.verifiedInspection(i)) out.push({ kind: 'inspection', id: i.id, rev: i.rev, label: i.ref + ' ' + t('ins.revN', { rev: i.rev }) + ' · ' + i.title, group: 'inspections' }); });
    st.evidence(u.id, w.projectId, w.id).forEach(function (e) { if (e.audience !== 'internal') out.push({ kind: 'evidence', id: e.id, version: e.version || 1, label: e.ref + ' · ' + e.caption, group: 'evidence' }); });
    return out;
  }
  function itemKey(it) { return it.kind + ':' + it.id + ':' + (it.kind === 'evidence' ? (it.version || 1) : it.rev); }
  function manifestPicker(u, w, current) {
    var chosen = F().values.item || (current || []).map(itemKey);
    var cs = candidates(u, w), groups = ['documents', 'inspections', 'evidence'];
    // items already in the manifest that are no longer current still show, so the preparer sees and removes them
    (current || []).forEach(function (it) { if (!cs.some(function (c) { return itemKey(c) === itemKey(it); })) { var r = ST().get(it.kind, it.id); cs.push({ kind: it.kind, id: it.id, rev: it.rev, version: it.version, label: (r ? (r.number || r.ref) : it.id) + ' ' + (it.rev != null ? t('doc.revShort', { rev: it.rev }) : '') + ' · ' + t('ho6.notCurrent'), group: it.kind === 'document' ? 'documents' : it.kind === 'inspection' ? 'inspections' : 'evidence', stale: true }); } });
    return groups.map(function (gname) {
      var list = cs.filter(function (c) { return c.group === gname; });
      return '<fieldset class="field"><legend class="label">' + esc(t('ho6.grp.' + gname)) + '</legend><div class="checks">' + (list.length ? list.map(function (c) { var k = itemKey(c); return '<label class="check' + (c.stale ? ' late' : '') + '"><input type="checkbox" name="item" value="' + esc(k) + '"' + (chosen.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(c.label) + '</label>'; }).join('') : '<span class="muted">' + esc(t('ho6.noCandidates')) + '</span>') + '</div></fieldset>';
    }).join('') + (F().errors.item ? '<div class="field-error">' + ic('alert') + esc(t(F().errors.item)) + '</div>' : '');
  }
  function parseItems(list) { return (list || []).map(function (k) { var a = k.split(':'); return a[0] === 'evidence' ? { kind: 'evidence', id: a[1], version: +a[2] } : a[0] === 'inspection' ? { kind: 'inspection', id: a[1], rev: +a[2] } : { kind: 'document', id: a[1], rev: a.slice(2).join(':') }; }); }
  function hpNew(u, args) {
    var st = ST(), w = st.get('package', args[0]);
    var g = h.guard(u, 'package', w); if (g) return g;
    if (st.isCustomer(u.id) || !can(u.id, 'handover.prepare', { packageId: w.id })) return U().deniedState({ code: 'role' }, null);
    ensure('hpnew.' + w.id);
    var body = input('title', t('doc.title'), 'text', { value: t('ho6.defaultTitle', { code: w.code }) }) + manifestPicker(u, w, []) + '<p class="field-hint">' + esc(t('ho6.filesNote')) + '</p>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.handover'), 'handover'], [w.code, 'ho.' + w.id], [t('ho6.assemble'), null]]) + '<div class="page-h"><div><h1>' + esc(t('ho6.assemble')) + '</h1><p>' + esc(t('ho6.assembleSub')) + '</p></div></div>' +
      card(esc(t('ho6.manifest')), '<div class="card-b">' + formWrap('hpnew.' + w.id, t('ho6.assemble'), body, t('ho6.createDraft')) + '</div>');
  }
  function hpDetail(u, args) {
    var st = ST(), hp = st.get('handoverpkg', args[0]);
    var g = h.guard(u, 'handoverpkg', hp); if (g) return g;
    var w = st.get('package', hp.packageId), c = st.hpControls(u.id, hp), mc = st.manifestCheck(hp), cust = st.isCustomer(u.id), frozen = hp.status !== 'draft';
    var STATE_TONE = { ok: 'ok', superseded: 'warn', withdrawn: 'crit', not_published: 'warn', not_verified: 'warn', changed: 'warn', internal: 'crit', missing: 'crit' };
    var rows = mc.items.map(function (x) {
      var it = x.item, ref = it.kind === 'evidence' ? t('ho6.v', { v: it.version || 1 }) : it.kind === 'inspection' ? t('ins.revN', { rev: it.rev }) : t('doc.revShort', { rev: it.rev });
      return '<tr><td>' + esc(t('kindname.' + it.kind)) + '</td><td>' + (x.rec ? recLink(it.kind, it.id) : '<span class="mono">' + esc(it.id) + '</span>') + '<br><span class="muted">' + esc(x.rec ? (x.rec.title || x.rec.caption || '') : '') + '</span></td><td class="mono">' + esc(ref) + '</td>' +
        (cust ? '' : '<td>' + pill(STATE_TONE[x.state] || '', t('mst.' + x.state)) + (x.state !== 'ok' && x.current != null ? '<br><span class="muted">' + esc(t('ho6.currentIs', { cur: x.current })) + '</span>' : '') + '</td>') + '</tr>';
    });
    var manifest = card(esc(t('ho6.manifest')) + ' <span class="pill plain num">' + mc.items.length + '</span>' + (frozen ? ' ' + pill('info', t('ho6.frozen')) : ''), table([t('ho6.kind'), t('ho6.record'), t('ho6.exactRev')].concat(cust ? [] : [t('ho6.checkState')]), rows, 'mftable') +
      (!cust && !mc.ok && (hp.status === 'draft' || hp.status === 'in_review' || hp.status === 'reviewed') ? '<div class="card-b"><div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('ho6.manifestProblems', { n: mc.problems.length })) + '</span></div></div>' : '') +
      '<p class="card-b field-hint">' + esc(t('ho6.filesNote')) + '</p>');
    var af = st.acceptanceFlags(hp);
    var decisions = card(esc(t('ho6.decisions')), '<ul class="droute card-b">' +
      decRow(t('ho6.d.review'), hp.review ? esc(t('id.by', { who: person(hp.review.by), date: fdt(hp.review.at) })) + ' · ' + esc(t('ho6.o.' + hp.review.outcome)) + (hp.review.readiness ? ' · ' + esc(t('ho6.atReview', { state: t('rdst.' + hp.review.readiness.state), pct: hp.review.readiness.pct })) : '') + (hp.review.reason ? ' “' + esc(hp.review.reason) + '”' : '') : esc(t('ins.notYet')), !!(hp.review && hp.review.outcome === 'ready')) +
      decRow(t('ho6.d.ack'), (hp.acknowledgements || []).length ? hp.acknowledgements.map(function (a) { return esc(t('id.by', { who: person(a.userId), date: fdt(a.at) })); }).join('<br>') : esc(t(hp.status === 'issued' ? 'ho6.awaitingAck' : 'ins.notYet')), (hp.acknowledgements || []).length > 0) +
      decRow(t('ho6.d.accept'), hp.acceptance ? esc(t('id.by', { who: person(hp.acceptance.by), date: fdt(hp.acceptance.at) })) + (hp.acceptance.authority ? ' · <span class="mono">' + esc(hp.acceptance.authority) + '</span>' : '') + ' · ' + esc(t('ho6.v', { v: hp.acceptance.pkgVersion })) + '<br>' + esc(t('rel.scope')) + ': ' + esc(hp.acceptance.scope) + (hp.acceptance.conditions ? '<br>' + esc(t('rel.conditions')) + ': ' + esc(hp.acceptance.conditions) : '') +
        (af.length ? '<br>' + pill('warn', t('rel.reassess')) + ' ' + esc(af.map(function (f0) { return t('relfl.' + f0); }).join('; ')) : '') : esc(t('ins.notYet')), !!hp.acceptance) +
      decRow(t('ho6.d.release'), (function () { var rs = st.releasesFor(u.id, hp.packageId).filter(function (r) { return r.handoverPackageId === hp.id; }); return rs.length ? rs.map(function (r) { return esc(r.ref + ' · ' + t('rel.by', { who: person(r.decidedBy), date: fdt(r.at) })); }).join('<br>') : esc(t('ho6.noRelease')); })(), st.releasesFor(u.id, hp.packageId).some(function (r) { return r.handoverPackageId === hp.id && r.status === 'recorded'; })) +
      '</ul><p class="field-hint card-b">' + esc(t('ho6.separate')) + '</p>');
    var a = [], form = '';
    if (c.edit) a.push(opener('hp-edit.' + hp.id, t('ho6.f.edit')));
    if (c.submit) a.push(opener('hp-submit.' + hp.id, t('ho6.f.submit'), true));
    if (c.review) a.push(opener('hp-review.' + hp.id, t('ho6.f.review'), true));
    if (c.reviewSelf) a.push('<span class="why">' + esc(t('ho6.why.self')) + '</span>');
    if (c.issue) a.push(opener('hp-issue.' + hp.id, t('ho6.f.issue'), true));
    if (c.acknowledge) a.push(opener('hp-ack.' + hp.id, t('ho6.f.ack'), true));
    if (c.accept) a.push(opener('hp-accept.' + hp.id, t('ho6.f.accept'), true));
    if (cust && hp.status === 'issued' && !hp.acceptance && !c.accept) a.push('<span class="why">' + esc(t('ho6.why.accept')) + '</span>');
    if (c.amend) a.push(opener('hp-amend.' + hp.id, t('ho6.f.amend')));
    var k = F().key || '';
    if (isOpen('hp-edit.' + hp.id)) form = formWrap(k, t('ho6.f.edit'), input('title', t('doc.title'), 'text', { value: hp.title }) + manifestPicker(u, w, hp.manifest), t('ho6.f.edit'));
    if (isOpen('hp-submit.' + hp.id)) form = formWrap(k, t('ho6.f.submit'), '<p class="field-hint">' + esc(t('ho6.submitHint')) + '</p>', t('ho6.f.submit'));
    if (isOpen('hp-review.' + hp.id)) { var rd = st.readiness(u.id, hp.packageId); form = formWrap(k, t('ho6.f.review'), '<p class="field-hint">' + esc(t('ho6.reviewHint', { state: t('rdst.' + rd.state), pct: rd.pct == null ? '—' : rd.pct })) + '</p><fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="row">' + ['ready', 'return'].map(function (o) { return '<label class="check"><input type="radio" name="outcome" value="' + o + '"' + (val('outcome', 'ready') === o ? ' checked' : '') + '> ' + esc(t('ho6.o.' + o)) + '</label>'; }).join('') + '</div></fieldset>' + input('reason', t('dv.reason'), 'textarea'), t('ho6.f.review')); }
    if (isOpen('hp-issue.' + hp.id)) {
      var rcp = U().D.users.filter(function (x) { return x.status === 'active' && st.isCustomer(x.id) && can(x.id, 'handover.view', { packageId: hp.packageId }); }), ch = F().values.rcp || [];
      form = formWrap(k, t('ho6.f.issue'), (mc.ok ? '' : '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('ho6.manifestProblems', { n: mc.problems.length })) + '</span></div>') + '<fieldset class="field"><legend class="label">' + esc(t('ho6.recipients')) + '</legend><div class="checks">' + rcp.map(function (x) { return '<label class="check"><input type="checkbox" name="rcp" value="' + x.id + '"' + (ch.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div>' + (F().errors.rcp ? '<div class="field-error">' + ic('alert') + esc(t(F().errors.rcp)) + '</div>' : '') + '</fieldset><p class="field-hint">' + esc(t('ho6.issueHint')) + '</p>', t('ho6.f.issue'));
    }
    if (isOpen('hp-ack.' + hp.id)) form = formWrap(k, t('ho6.f.ack'), '<p class="field-hint">' + esc(t('ho6.ackHint')) + '</p>', t('ho6.f.ack'));
    if (isOpen('hp-accept.' + hp.id)) form = formWrap(k, t('ho6.f.accept'), '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('ho6.acceptHint')) + '</span></div>' + input('scope', t('rel.scope'), 'textarea') + input('conditions', t('rel.conditions'), 'textarea', { optional: true }), t('ho6.f.accept'));
    if (isOpen('hp-amend.' + hp.id)) form = formWrap(k, t('ho6.f.amend'), '<p class="field-hint">' + esc(t('ho6.amendHint')) + '</p>' + input('reason', t('dv.reason'), 'textarea'), t('ho6.f.amend'));
    var vs = st.hpVersions(hp.packageId).filter(function (x) { return st.canSee(u.id, 'handoverpkg', x); });
    var verCard = card(esc(t('ho6.versions')), '<ul class="doclist">' + vs.slice().reverse().map(function (x) { return '<li>' + (x.id === hp.id ? '<b class="mono">' + esc(x.ref + ' v' + x.pkgVersion) + '</b>' : recLink('handoverpkg', x.id)) + '<span class="t"><span>' + esc(x.amendReason || x.title) + '</span></span>' + G.hpPill(x.status) + '</li>'; }).join('') + '</ul>');
    var side = (a.length || form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + form + '</div>') : '') + verCard +
      card(esc(t('ho6.readiness')), '<div class="card-b"><a class="btn btn-secondary" ' + go('ho.' + hp.packageId) + '>' + esc(t('ho6.openReadiness')) + '</a></div>');
    return h.recordShell(u, 'handoverpkg', hp, hp.title, G.hpPill(hp.status), (hp.amendReason ? '<div class="notice">' + ic('info') + '<span>' + esc(t('ho6.amendedBecause')) + ' “' + esc(hp.amendReason) + '”</span></div>' : '') + decisions + manifest, side);
  }

  // =====================================================================================================
  // 9. MANAGEMENT OVERSIGHT
  // =====================================================================================================
  function oversightPage(u) {
    var st = ST(), o = st.oversight(u.id);
    if (!o.projects.length) return U().deniedState({ code: 'role' }, null);
    function tile(id, n, label, tone) { return '<a class="stat ov-tile ' + (n ? tone : 'ok') + '" href="#oversight" data-pact="ov-jump" data-v="' + id + '"><b class="num">' + n + '</b><span>' + esc(label) + '</span></a>'; }
    var tiles = '<div class="ov-tiles">' + tile('ov-late', o.late.length, t('ovs.late'), 'crit') + tile('ov-blockers', o.blockers.length, t('ovs.blockers'), 'warn') + tile('ov-decisions', o.decisions.length, t('ovs.decisions'), 'warn') + tile('ov-ca', o.overdueCa.length, t('ovs.overdueCa'), 'crit') + tile('ov-ho', o.handoverBlockers.length, t('ovs.hoBlockers'), 'crit') + '</div>';
    function sec(id, title, list, row) { return '<section class="card" id="' + id + '"><div class="card-h"><h2 tabindex="-1">' + esc(title) + ' <span class="pill plain num">' + list.length + '</span></h2><span class="asof">' + esc(t('ovs.asOf', { date: fdt(G.nowStamp()) })) + '</span></div>' + (list.length ? '<div class="list">' + list.map(row).join('') + '</div>' : emptyBox('check', t('tri.empty'))) + '</section>'; }
    var late = sec('ov-late', t('ovs.late'), o.late, function (c) { return '<a class="list-row rowlink" ' + go('cm.' + c.id) + '><span class="sev crit"></span><span class="t"><b>' + esc(L(c, 'text')) + '</b><span><span class="mono">' + esc(c.ref) + '</span> · ' + esc(person(c.ownerId)) + ' · ' + esc(t('cm.current')) + ' ' + esc(fd(st.dueOf(c))) + ' · ' + esc(t('cm.promised')) + ' ' + esc(fd(c.promised)) + '</span></span></a>'; });
    var bl = sec('ov-blockers', t('ovs.blockers'), o.blockers, function (b) {
      if (b.kind === 'dependency') return '<a class="list-row rowlink" ' + go('deps.' + b.rec.projectId) + '><span class="sev ' + (b.state.state === 'overdue' ? 'crit' : 'warn') + '"></span><span class="t"><span class="row" style="gap:6px">' + G.depPill(b.state.state) + '</span><b>' + esc(b.rec.blocker) + '</b><span><span class="mono">' + esc(b.rec.ref) + '</span> · ' + esc(G.nodeLabel(b.rec.predecessor)) + ' → ' + esc(G.nodeLabel(b.rec.dependent)) + ' · ' + esc(person(b.rec.ownerId)) + '</span></span></a>';
      return '<a class="list-row rowlink" ' + go('cm.' + b.rec.id) + '><span class="sev warn"></span><span class="t"><b>' + esc(b.rec.blocker) + '</b><span><span class="mono">' + esc(b.rec.ref) + '</span> · ' + esc(L(b.rec, 'text')) + '</span></span></a>';
    });
    var dec = sec('ov-decisions', t('ovs.decisions'), o.decisions, function (v) { return '<div class="list-row"><span class="sev warn"></span><div class="t"><b>' + esc(h.needText(v)) + '</b><span>' + recLink(v.record.kind || v.action.record.kind, v.record.id) + ' · ' + esc(t('act.due')) + ' ' + dueCell(v.action.due) + '</span></div></div>'; });
    var ca = sec('ov-ca', t('ovs.overdueCa'), o.overdueCa, function (c) { return '<a class="list-row rowlink" ' + go('ca.' + c.id) + '><span class="sev crit"></span><span class="t"><b>' + esc(c.title) + '</b><span><span class="mono">' + esc(c.ref) + '</span> · ' + esc(person(c.ownerId)) + ' · ' + esc(fd(c.due)) + '</span></span></a>'; });
    var ho = sec('ov-ho', t('ovs.hoBlockers'), o.handoverBlockers, function (x) { return '<a class="list-row rowlink" ' + go('ho.' + x.pkg.id) + '><span class="sev crit"></span><span class="t"><span class="row" style="gap:6px">' + G.rdPill(x.readiness.state) + '<span class="num">' + x.readiness.pct + '%</span></span><b class="mono">' + esc(x.pkg.code) + '</b><span>' + esc(x.readiness.blockers.map(function (b) { return reqText(b); }).join('; ')) + '</span></span></a>'; });
    return crumbs([[t('nav.home'), 'home'], [t('nav.oversight'), null]]) + '<div class="page-h"><div><h1>' + esc(t('ovs.title')) + '</h1><p>' + esc(t('ovs.sub', { n: o.projects.length })) + '</p></div></div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('ovs.rule')) + '</span></div>' + tiles + '<div class="grid g-2">' + late + bl + '</div><div class="grid g-2">' + dec + ca + '</div>' + ho;
  }

  // =====================================================================================================
  // events
  // =====================================================================================================
  function captureForm(form) {
    var f = F(), fdat = new FormData(form), multi = ['aud', 'rcp', 'item'];
    var vals = {};
    Array.from(fdat.keys()).forEach(function (k) { vals[k] = multi.indexOf(k) >= 0 ? fdat.getAll(k).map(String) : String(fdat.get(k) || '').trim(); });
    multi.forEach(function (k) { if (form.querySelector('[name="' + k + '"]') && !vals[k]) vals[k] = []; });
    f.values = Object.assign({}, f.values, vals);
    return f.values;
  }
  function onAct(act, el) {
    var v = el.getAttribute('data-v');
    switch (act) {
      case 'f6-open': { openForm(v); F().idem = v + '-' + X.rnd(); U().render(); var hh = document.querySelector('.rd-form h3'); if (hh) hh.focus(); return true; }
      case 'f6-close': { S().f6 = null; U().render(); return true; }
      case 'du-save': G.dupSave(false); return true;
      case 'du-submit': G.dupSave(true); return true;
      case 'rpt-csv': { var p = v.split('|'); exportCsv(p[0], p[1]); return true; }
      case 'rpt-print': { window.print(); return true; }
      case 'ov-jump': { var s2 = document.getElementById(v); if (s2) { s2.scrollIntoView({ block: 'start' }); var h2 = s2.querySelector('h2'); if (h2) h2.focus(); } return true; }
    }
    return false;
  }
  function onChange(el) {
    var s = S();
    if (el.hasAttribute('data-upctx') && /^dupev-/.test(el.getAttribute('data-upctx'))) { G.snapDup(); return false; }
    var b = el.getAttribute('data-dubind');
    if (b) {
      G.snapDup(); var id = G.currentDupId(), ds = G.dupState(id);
      ds.v[b] = el.value; if (b === 'packageId') { ds.v.areaId = ''; ds.v.quantities = []; ds.v.milestoneIds = []; }
      G.dupPersist(id); U().render(); var a = document.getElementById(el.id); if (a) a.focus(); return true;
    }
    if (el.hasAttribute('data-dutext') || el.hasAttribute('data-duq')) { G.snapDup(); return true; }
    var m = el.getAttribute('data-dums');
    if (m) { G.snapDup(); var id2 = G.currentDupId(), d2 = G.dupState(id2).v; d2.milestoneIds = d2.milestoneIds.filter(function (x) { return x !== m; }); if (el.checked) d2.milestoneIds.push(m); G.dupPersist(id2); return true; }
    if (el.form && el.form.hasAttribute('data-f6form')) {
      captureForm(el.form);
      if (el.hasAttribute('data-f6live')) {
        if (el.name === 'projectId') { F().values.source = ''; F().values.ownerId = ''; F().values.aud = []; F().values.reviewerId = ''; }
        if (el.name === 'kind') F().values.source = '';
        if (el.name === 'party') F().values.ownerId = '';
        U().render(); var a2 = document.getElementById(el.id); if (a2) a2.focus();
      }
      return true;
    }
    return false;
  }
  function onInput(el) {
    if (el.id === 'cm-q') { S().cmf.q = el.value; var c = el.selectionStart; U().render(); var a = document.getElementById('cm-q'); if (a) { a.focus(); try { a.setSelectionRange(c, c); } catch (e) {} } return true; }
    return false;
  }
  function goAfter(route) { return function () { U().go(route); }; }
  function onSubmit(form) {
    if (!form.hasAttribute('data-f6form')) return false;
    var key = form.getAttribute('data-f6form'), f = F();
    if (f.key !== key) { openForm(key); f = F(); }
    var v = captureForm(form); f.errors = {}; f.serverError = null; f.detail = null;
    var kind = key.split('.')[0], id = key.split('.').slice(1).join('.'), st = ST(), t0 = t;
    function reason(min, opt) { if (!opt || v.reason) need(String(v.reason || '').length >= (min || 5), 'reason', 'rd.err.reason'); }
    switch (kind) {
      case 'ms-verify': { var m = st.get('milestone', id); run('milestone.verify', { id: id, version: m.version, date: v.date, note: v.note }, t0('pg.done.verify')); return true; }
      case 'ms-forecast': { reason(); need(v.forecast, 'forecast', 'err.due_required'); if (invalid()) return true; var m2 = st.get('milestone', id); run('milestone.forecast', { id: id, version: m2.version, forecast: v.forecast, reason: v.reason }, t0('pg.done.forecast')); return true; }
      case 'ms-rebaseline': { reason(); need(v.planned, 'planned', 'err.due_required'); if (invalid()) return true; var m3 = st.get('milestone', id); run('milestone.rebaseline', { id: id, version: m3.version, planned: v.planned, reason: v.reason }, t0('pg.done.rebaseline')); return true; }
      case 'pg-weights': { reason(); if (invalid()) return true; var ws = {}; Object.keys(v).forEach(function (k) { if (/^w_/.test(k)) ws[k.slice(2)] = Number(v[k]); }); run('progress.setWeights', { packageId: id, cversion: st.progressConfig(id).version, weights: ws, reason: v.reason }, t0('pg.done.settings')); return true; }
      case 'pg-planned': { reason(); need(v.lineId, 'lineId', 'wiz.err.choose'); need(Number(v.planned) > 0, 'planned', 'du.err.qty'); if (invalid()) return true; run('progress.setPlanned', { packageId: id, cversion: st.progressConfig(id).version, lineId: v.lineId, planned: Number(v.planned), reason: v.reason }, t0('pg.done.settings')); return true; }
      case 'pg-addline': { reason(); need(v.description.length >= 3, 'description', 'ins.err.title'); need(Number(v.planned) > 0, 'planned', 'du.err.qty'); if (invalid()) return true; run('progress.addLine', { packageId: id, cversion: st.progressConfig(id).version, description: v.description, planned: Number(v.planned), unit: v.unit, reason: v.reason }, t0('pg.done.settings')); return true; }
      case 'dup-review': { var d = st.get('dailyupdate', id); if ((v.outcome || 'approved') === 'returned') reason(); if (invalid()) return true; run('dailyupdate.review', { id: id, version: d.version, outcome: v.outcome || 'approved', reason: v.reason }, t0('du.done.review')); return true; }
      case 'dup-publish': { var d2 = st.get('dailyupdate', id); run('dailyupdate.publish', { id: id, version: d2.version }, t0('du.done.publish')); return true; }
      case 'cmnew': {
        need(v.projectId, 'projectId', 'wiz.err.choose'); need(String(v.text || '').length >= 5, 'text', 'ins.err.title'); need(v.ownerId, 'ownerId', 'wiz.err.choose'); need(v.promised, 'promised', 'err.due_required');
        if (v.kind && !v.source) need(false, 'source', 'wiz.err.choose');
        if (invalid()) return true;
        var src = v.kind && v.source ? { kind: v.kind, id: v.source.split(':')[0], rev: v.source.split(':')[1] || null } : null;
        run('commitment.create', { idempotencyKey: f.idem, projectId: v.projectId, source: src, text: v.text, ownerId: v.ownerId, promised: v.promised, party: v.party || 'rgs', next: v.next, blocker: v.blocker }, t0('cm.done.create'), function (r) { U().go('cm.' + r.id); });
        return true;
      }
      case 'cm-reschedule': { reason(); need(v.to, 'to', 'err.due_required'); if (invalid()) return true; var c = st.get('commitment', id); run('commitment.reschedule', { id: id, version: c.version, to: v.to, reason: v.reason }, t0('cm.done.reschedule')); return true; }
      case 'cm-update': { var c2 = st.get('commitment', id); run('commitment.update', { id: id, version: c2.version, forecast: v.forecast, blocker: v.blocker, next: v.next, reason: v.reason }, t0('cm.done.update')); return true; }
      case 'cm-complete': { var c3 = st.get('commitment', id); run('commitment.complete', { id: id, version: c3.version, note: v.note }, t0('cm.done.complete')); return true; }
      case 'depnew': {
        need(v.pred, 'pred', 'wiz.err.choose'); need(v.dep, 'dep', 'wiz.err.choose'); need(String(v.blocker || '').length >= 5, 'blocker', 'ins.err.title'); need(v.ownerId, 'ownerId', 'wiz.err.choose'); need(v.resolutionTarget, 'resolutionTarget', 'err.due_required');
        if (invalid()) return true;
        var a1 = v.pred.split(':'), b1 = v.dep.split(':');
        run('dependency.create', { idempotencyKey: f.idem, projectId: id, predecessor: { kind: a1[0], id: a1[1] }, dependent: { kind: b1[0], id: b1[1] }, blocker: v.blocker, ownerId: v.ownerId, resolutionTarget: v.resolutionTarget }, t0('dep.done.create'));
        return true;
      }
      case 'dep-update': { reason(); if (invalid()) return true; var dp = st.get('dependency', id); run('dependency.update', { id: id, version: dp.version, resolutionTarget: v.resolutionTarget, ownerId: v.ownerId, blocker: v.blocker, reason: v.reason }, t0('dep.done.update')); return true; }
      case 'dep-resolve': { reason(); if (invalid()) return true; var dp2 = st.get('dependency', id); run('dependency.resolve', { id: id, version: dp2.version, reason: v.reason }, t0('dep.done.resolve')); return true; }
      case 'rptnew': {
        need(v.type, 'type', 'wiz.err.choose'); need(v.projectId, 'projectId', 'wiz.err.choose'); need(v.from, 'from', 'err.due_required'); need(v.to, 'to', 'err.due_required'); need(v.cutoff, 'cutoff', 'err.due_required'); need(v.reviewerId, 'reviewerId', 'wiz.err.choose');
        if (!(v.aud || []).length) f.errors.aud = 'rpt.err.audience';
        if (invalid()) return true;
        run('report.create', { idempotencyKey: f.idem, type: v.type, projectId: v.projectId, title: v.title, from: v.from, to: v.to, cutoff: v.cutoff, reviewerId: v.reviewerId, audience: v.aud }, t0('rpt.done.create'), function (r) { U().go('rpt.' + r.id + '.draft'); });
        return true;
      }
      case 'rpt-regen': { var r1 = st.get('report', id); run('report.regenerate', { id: id, version: r1.version }, t0('rpt.done.regen')); return true; }
      case 'rpt-submit': { var r2 = st.get('report', id); run('report.submit', { id: id, version: r2.version }, t0('rpt.done.submit')); return true; }
      case 'rpt-review': { if ((v.outcome || 'approve') === 'return') reason(); if (invalid()) return true; var r3 = st.get('report', id); run('report.review', { id: id, version: r3.version, outcome: v.outcome || 'approve', reason: v.reason }, t0('rpt.done.review')); return true; }
      case 'rpt-issue': { var r4 = st.get('report', id); run('report.issue', { id: id, version: r4.version }, t0('rpt.done.issue'), function (res) { U().go('rpt.' + id + '.' + res.version); }); return true; }
      case 'rpt-amend': { reason(); if (invalid()) return true; var r5 = st.get('report', id); run('report.amend', { id: id, version: r5.version, reason: v.reason }, t0('rpt.done.amend'), function () { U().go('rpt.' + id + '.draft'); }); return true; }
      case 'hpnew': {
        need(String(v.title || '').length >= 5, 'title', 'ins.err.title'); if (!(v.item || []).length) f.errors.item = 'ho6.err.items';
        if (invalid()) return true;
        run('handover.create', { idempotencyKey: f.idem, packageId: id, title: v.title, manifest: parseItems(v.item) }, t0('ho6.done.create'), function (r) { U().go('hp.' + r.id); });
        return true;
      }
      case 'hp-edit': { if (!(v.item || []).length) f.errors.item = 'ho6.err.items'; if (invalid()) return true; var hp = st.get('handoverpkg', id); run('handover.saveManifest', { id: id, version: hp.version, title: v.title, manifest: parseItems(v.item) }, t0('ho6.done.edit')); return true; }
      case 'hp-submit': { var hp2 = st.get('handoverpkg', id); run('handover.submit', { id: id, version: hp2.version }, t0('ho6.done.submit')); return true; }
      case 'hp-review': { reason(); if (invalid()) return true; var hp3 = st.get('handoverpkg', id); run('handover.review', { id: id, version: hp3.version, outcome: v.outcome || 'ready', reason: v.reason }, t0('ho6.done.review')); return true; }
      case 'hp-issue': { if (!(v.rcp || []).length) f.errors.rcp = 'ho6.err.recipients'; if (invalid()) return true; var hp4 = st.get('handoverpkg', id); run('handover.issue', { id: id, version: hp4.version, recipients: v.rcp }, t0('ho6.done.issue')); return true; }
      case 'hp-ack': { var hp5 = st.get('handoverpkg', id); run('handover.acknowledge', { id: id, version: hp5.version }, t0('ho6.done.ack')); return true; }
      case 'hp-accept': { need(String(v.scope || '').length >= 5, 'scope', 'rel.err.scope'); if (invalid()) return true; var hp6 = st.get('handoverpkg', id); run('handover.accept', { id: id, version: hp6.version, scope: v.scope, conditions: v.conditions }, t0('ho6.done.accept')); return true; }
      case 'hp-amend': { reason(); if (invalid()) return true; var hp7 = st.get('handoverpkg', id); run('handover.amend', { id: id, version: hp7.version, reason: v.reason }, t0('ho6.done.amend'), function (r) { U().go('hp.' + r.id); }); return true; }
      case 'rel': { need(String(v.scope || '').length >= 5, 'scope', 'rel.err.scope'); if (invalid()) return true; run('release.record', { idempotencyKey: f.idem, packageId: id, scope: v.scope, conditions: v.conditions }, t0('rel.done')); return true; }
    }
    return false;
  }

  P.extend({
    bases: { cm: commitmentDetail, cmnew: cmNewPage, deps: depsPage, rpt: reportDetail, rptnew: reportNew, rptprint: reportPrint, ho: handoverDetail, hp: hpDetail, hpnew: hpNew },
    modules: { commitments: commitmentsPage, dependencies: depsPage, reports: reportsPage, handover: handoverPage, oversight: oversightPage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit
  });
  window.RGSPages6.csvFor = csvFor; window.RGSPages6.renderSnapshot = renderSnapshot;
})();
