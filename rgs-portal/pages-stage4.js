/*
 * RGS Client Portal — Stage 4 pages: document centre, register, document detail and viewer, review workspace,
 * transmittals, document controller workspace, document checks and the site evidence library.
 * Every change goes through api.js; every read goes through store.js, which applies the same access rules to
 * lists, previews, downloads, comments and notifications.
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
  function DOCPOL() { return (ST().policy || {}).documents || {}; }
  function CATS() { return DOCPOL().categories || []; }
  function can(uid, a, res) { return U().A.can(U().D, uid, a, res).allowed; }
  function fsize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  // ---------------------------------------------------------------- upload profiles (reuse the Stage 3 control)
  var DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.xlsx,.dwg,application/pdf,image/*';
  X.addProfile({ prefix: 'docnew', single: true, types: API_TYPES(), max: 50 * 1048576, accept: DOC_ACCEPT, hint: 'up.docHint', typeError: 'up.err.docType', sizeError: 'up.err.docSize',
    payload: function () { var v = (S().dn || {}).values || {}; return { purpose: 'document', projectId: v.projectId || null, packageId: (v.packageIds || [])[0] || null }; } });
  X.addProfile({ prefix: 'docrev-', single: true, types: API_TYPES(), max: 50 * 1048576, accept: DOC_ACCEPT, hint: 'up.docHint', typeError: 'up.err.docType', sizeError: 'up.err.docSize',
    payload: function (ctx) { var d = ST().get('document', ctx.slice(7)); return { purpose: 'document', projectId: d ? d.projectId : null, packageId: d ? d.packageIds[0] || null : null }; } });
  X.addProfile({ prefix: 'evnew', single: true, capture: true, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'], max: 25 * 1048576, accept: 'image/*,application/pdf', hint: 'dlg.fileHint',
    typeError: 'dlg.err.fileType', sizeError: 'dlg.err.fileSize', payload: function () { var v = (S().en || {}).values || {}; return { purpose: 'evidence', projectId: v.projectId || null, packageId: v.packageId || null }; } });
  X.addProfile({ prefix: 'evver-', single: true, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'], max: 25 * 1048576, accept: 'image/*,application/pdf', hint: 'dlg.fileHint',
    typeError: 'dlg.err.fileType', sizeError: 'dlg.err.fileSize', payload: function (ctx) { var e = ST().get('evidence', ctx.slice(6)); return { purpose: 'evidence', projectId: e ? e.projectId : null, packageId: e ? e.packageId : null }; } });
  function API_TYPES() { return ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/vnd.dwg']; }
  function doneFile(ctx) { var ids = X.doneFileIds(ctx); return ids.length ? ids[ids.length - 1] : null; }
  function doneItem(ctx) { var l = X.uploads(ctx).filter(function (i) { return i.status === 'done'; }); return l[l.length - 1] || null; }

  // ---------------------------------------------------------------- status vocabulary
  var REV_TONE = { draft: 'plain', under_review: 'info', accepted: 'ok', accepted_comments: 'ok', revise_resubmit: 'warn', rejected: 'crit', published: 'ok', superseded: '', withdrawn: 'crit' };
  function revPill(s) { return pill(REV_TONE[s] || '', t('rstat4.' + s)); }
  function pubPill(d) { return pill({ published: 'ok', unpublished: 'plain', withdrawn: 'crit' }[d.status] || '', t('dstatus.' + d.status)); }
  function catTag(c) { return '<span class="dcat">' + pic('documents') + esc(t('dtype.' + c)) + '</span>'; }
  function trLink(tr) { return '<a class="rec" ' + go('tr.' + tr.id) + '>' + pic('send') + '<span class="mono">' + esc(tr.ref) + '</span></a>'; }
  function areaName(id) { var a = id && U().byId(U().D.areas, id); return a ? a.code + ' · ' + L(a, 'name') : null; }
  function revChips(u, row) {
    var out = '';
    if (row.published) out += '<span class="revchip pub" title="' + esc(t('dc.currentPub')) + '">' + pic('check') + esc(t('doc.revShort', { rev: row.published.rev })) + '</span>';
    if (row.pending) out += '<span class="revchip pend">' + esc(t('doc.revShort', { rev: row.pending.rev })) + ' · ' + esc(t('rstat4.' + row.pending.status)) + '</span>';
    if (!row.published && !row.pending && row.shown) out += '<span class="revchip">' + esc(t('doc.revShort', { rev: row.shown.rev })) + ' · ' + esc(t('rstat4.' + row.shown.status)) + '</span>';
    return '<span class="revchips">' + out + '</span>';
  }

  // ---------------------------------------------------------------- 1. document centre
  function dcState() { var s = S(); if (!s.dcf) s.dcf = { view: 'list', q: '', project: '', category: '', package: '', area: '', pub: '', review: '' }; return s.dcf; }
  function documentsPage(u) {
    var st = ST(), f = dcState(), cust = st.isCustomer(u.id);
    var rows = st.docCentre(u.id, f), all = st.docCentre(u.id, {});
    var projects = st.visibleProjects(u.id);
    var canReg = !cust && projects.some(function (p) { return can(u.id, 'document.upload', { projectId: p.id }) || st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'document.upload', { packageId: w.id }); }); });
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="dcf.' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var pkgs = [], areas = [];
    projects.forEach(function (p) { if (!f.project || f.project === p.id) { pkgs = pkgs.concat(st.visiblePackages(u.id, p.id)); areas = areas.concat(st.areas(p.id)); } });
    var tools = '<section class="card card-b dc-tools"><div class="field dc-search"><label for="dc-q">' + esc(t('dir.search')) + '</label><div class="control">' + ic('search') + '<input id="dc-q" class="input" type="search" data-live value="' + esc(f.q) + '" placeholder="' + esc(t('dc.search.ph')) + '"></div></div>' +
      sel('dc-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) +
      sel('dc-cat', 'category', t('dc.category'), [['', t('f.all')]].concat(CATS().map(function (c) { return [c, t('dtype.' + c)]; }))) +
      sel('dc-pkg', 'package', t('misc.package'), [['', t('f.all')]].concat(pkgs.map(function (w) { return [w.id, w.code + ' · ' + t('svc.' + w.service)]; }))) +
      sel('dc-area', 'area', t('rq.area'), [['', t('f.all')]].concat(areas.map(function (a) { return [a.id, a.code + ' · ' + L(a, 'name')]; }))) +
      sel('dc-pub', 'pub', t('dc.publication'), [['', t('f.all')], ['published', t('dstatus.published')], ['unpublished', t('dstatus.unpublished')], ['withdrawn', t('dstatus.withdrawn')]]) +
      (cust ? '' : sel('dc-review', 'review', t('dc.review'), [['', t('f.all')], ['in_review', t('rstat4.under_review')], ['overdue', t('dc.overdue')], ['ready', t('dc.readyToPublish')]])) + '</section>';
    var head = [t('doc.number'), t('doc.title'), t('dc.category'), t('nav.projects'), t('misc.package'), t('rq.area'), t('doc.rev'), t('dc.review'), t('dc.publication'), t('dc.owner'), t('dc.updated')];
    var trs = rows.map(function (row) {
      var d = row.doc, p = st.get('project', d.projectId);
      return '<tr><td>' + recLink('document', d.id) + '</td><td><a ' + go('doc.' + d.id) + '><b>' + esc(d.title) + '</b></a>' + (d.audience === 'internal' ? ' ' + pill('plain', t('misc.internal')) : '') + '</td><td>' + esc(t('dtype.' + d.category)) + '</td><td>' + esc(p.code) + '</td>' +
        '<td>' + ((d.packageIds || []).map(function (id) { var w = st.get('package', id); return svcTag(w.service) + ' <span class="mono muted">' + esc(w.code) + '</span>'; }).join('<br>') || '<span class="muted">' + esc(t('misc.wholeProject')) + '</span>') + '</td>' +
        '<td>' + esc(areaName(d.areaId) || '—') + '</td><td>' + revChips(u, row) + '</td><td>' + (cust ? '<span class="muted">—</span>' : (row.pending ? revPill(row.pending.status) + (row.overdue ? ' ' + pill('crit', t('dc.overdue')) : '') : '<span class="muted">—</span>')) + '</td>' +
        '<td>' + pubPill(d) + '</td><td>' + esc(d.ownerId ? person(d.ownerId) : t('dc.noOwner')) + '</td><td class="num">' + esc(fd(row.updatedAt)) + '</td></tr>';
    });
    var stack = '<div class="list">' + rows.map(function (row) {
      var d = row.doc;
      return '<a class="list-row rowlink" ' + go('doc.' + d.id) + '><span class="sev ' + (d.status === 'withdrawn' ? 'crit' : row.overdue ? 'crit' : row.pending ? 'info' : d.status === 'published' ? 'ok' : '') + '"></span><span class="t"><span class="row" style="gap:6px">' + catTag(d.category) + pubPill(d) + '</span><b>' + esc(d.title) + '</b><span><span class="mono">' + esc(d.number) + '</span> · ' + esc(areaName(d.areaId) || st.get('project', d.projectId).code) + '</span><span>' + revChips(u, row) + '</span></span></a>';
    }).join('') + '</div>';
    var listView = rows.length ? '<div class="dc-wide">' + table(head, trs, 'dctable') + '</div><div class="dc-narrow">' + stack + '</div>' : emptyBox('documents', t('dc.none'), t(cust ? 'dc.none.customer' : 'dc.none.d'));
    // Folder view: category → package
    var folders = CATS().map(function (c) {
      var inCat = rows.filter(function (r) { return r.doc.category === c; });
      if (!inCat.length) return '';
      var byPkg = {};
      inCat.forEach(function (r) { var k = r.doc.packageIds[0] || '_'; (byPkg[k] = byPkg[k] || []).push(r); });
      return '<details class="folder" open><summary>' + ic('folder') + '<b>' + esc(t('dtype.' + c)) + '</b> <span class="pill plain num">' + inCat.length + '</span></summary>' + Object.keys(byPkg).map(function (k) {
        var w = k !== '_' && st.get('package', k);
        return '<div class="subfolder"><p class="label">' + (w ? svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span>' : esc(t('misc.wholeProject'))) + '</p><ul class="doclist">' + byPkg[k].map(function (r) {
          return '<li>' + recLink('document', r.doc.id) + '<span class="t"><b>' + esc(r.doc.title) + '</b><span>' + revChips(u, r) + '</span></span>' + pubPill(r.doc) + '</li>';
        }).join('') + '</ul></div>';
      }).join('') + '</details>';
    }).join('');
    var tabs = '<div class="seg" role="tablist" aria-label="' + esc(t('dc.views')) + '"><button class="btn btn-sm" role="tab" data-pact="dc-view" data-v="list" aria-selected="' + (f.view === 'list') + '" aria-pressed="' + (f.view === 'list') + '">' + ic('reports') + esc(t('dc.list')) + '</button><button class="btn btn-sm" role="tab" data-pact="dc-view" data-v="folders" aria-selected="' + (f.view === 'folders') + '" aria-pressed="' + (f.view === 'folders') + '">' + ic('folder') + esc(t('dc.folders')) + '</button></div>';
    var links = cust ? '' : '<div class="row">' + (can(u.id, 'document.review', { projectId: 'p1' }) || st.myReviews(u.id).length ? '<a class="btn btn-secondary btn-sm" ' + go('docreview') + '>' + esc(t('nav.docreview')) + ' <span class="pill plain num">' + st.myReviews(u.id).filter(function (x) { return x.mine; }).length + '</span></a>' : '') +
      (U().MODULE_BY.doccontrol && U().moduleAllowed && U().moduleAllowed(u.id, U().MODULE_BY.doccontrol) ? '<a class="btn btn-secondary btn-sm" ' + go('doccontrol') + '>' + esc(t('nav.doccontrol')) + '</a>' : '') + '</div>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('dc.title')) + '</h1><p>' + esc(t(cust ? 'dc.sub.customer' : 'dc.sub.staff')) + '</p></div>' + (canReg ? '<a class="btn btn-primary" ' + go('docnew') + '>' + pic('plus') + esc(t('dc.register')) + '</a>' : '') + '</div>' +
      (cust ? '<div class="notice">' + ic('shield') + '<span>' + esc(t('dc.customerRule')) + '</span></div>' : '<div class="notice">' + ic('info') + '<span>' + esc(t('dc.staffRule')) + '</span></div>') +
      links + tools + '<div class="row-between">' + tabs + '<p class="muted" role="status">' + esc(t('rq.count', { n: rows.length, m: all.length })) + '</p></div>' + (f.view === 'folders' ? (folders ? '<div class="stack">' + folders + '</div>' : emptyBox('documents', t('dc.none'))) : card(esc(t('dc.register.title')) + ' <span class="pill plain num">' + rows.length + '</span>', listView));
  }

  // ---------------------------------------------------------------- 2. upload and register
  var DN_KEY = 'rgs.docnew.v4';
  function dnState(fromFile) {
    var s = S();
    if (!s.dn || s.dn.fromFile !== (fromFile || null)) {
      var stored = !fromFile && load(DN_KEY);
      s.dn = stored && stored.values ? { values: stored.values, errors: {}, key: stored.key || 'docreg-' + X.rnd(), fromFile: null, restored: true }
        : { values: { packageIds: [], reviewers: [], links: [], audience: 'customer', rev: '', submit: true }, errors: {}, key: 'docreg-' + X.rnd(), fromFile: fromFile || null };
      if (fromFile) { var f = ST().get('file', fromFile); if (f && f.owner && f.owner.kind === 'upload') { s.dn.values.projectId = f.owner.projectId; if (f.owner.packageId) s.dn.values.packageIds = [f.owner.packageId]; s.dn.values.title = f.name.replace(/\.[a-z0-9]+$/i, ''); } }
    }
    return s.dn;
  }
  function persistDn() { var dn = S().dn; if (dn && !dn.fromFile) save(DN_KEY, { values: dn.values, key: dn.key }); }
  function reviewerPool(pid, category, res) {
    var st = ST(), on = st.customerReviewRequired({ projectId: pid, category: category });
    return eligibleUsers(pid, 'document.review', res).filter(function (x) { return on || !st.isCustomer(x.id); });
  }
  function custReviewNote(pid, category) {
    var st = ST(); if (!category || !st.customerReviewRequired({ projectId: pid, category: category })) return '';
    var set = st.customerReviewSetting();
    return '<div class="notice">' + ic('users') + '<span>' + esc(t('dn.custReview')) + (set.example ? ' ' + esc(t('dn.custReviewExample')) : '') + '</span></div>';
  }
  function eligibleUsers(pid, perm, res) { var p = ST().get('project', pid); return U().D.users.filter(function (x) { return x.status === 'active' && can(x.id, perm, res || { projectId: pid }) && (p.team.indexOf(x.id) >= 0 || x.orgId === p.customerOrgId || x.role === 'operations_manager' || x.role === 'general_manager' || x.role === 'document_controller' || /^u-ss/.test(x.id)); }); }
  function registerPage(u, args) {
    var st = ST(), fromFile = args[0] || null, dn = dnState(fromFile), v = dn.values, e = dn.errors;
    var projects = st.visibleProjects(u.id).filter(function (p) { return can(u.id, 'document.upload', { projectId: p.id }) || can(u.id, 'document.control', { projectId: p.id }) || st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'document.upload', { packageId: w.id }); }); });
    if (!projects.length) return U().deniedState({ code: 'role' }, null);
    var inbox = fromFile && st.get('file', fromFile);
    if (fromFile && (!inbox || !st.fileAccess(u.id, inbox).allowed || inbox.owner.kind !== 'upload')) return U().deniedState({ code: 'scope' }, null);
    var pid = v.projectId || (projects.length === 1 ? projects[0].id : '');
    if (pid && !v.projectId) v.projectId = pid;
    var fe = function (k, id) { return e[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(e[k])) + '</div>' : ''; };
    var inv = function (k, id) { return e[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; };
    var has = function (arr, x) { return (arr || []).indexOf(x) >= 0; };
    var body = '<div class="field"><label for="dn-project">' + esc(t('nav.projects')) + '</label><select id="dn-project" class="select" data-dnbind="projectId"' + (inbox ? ' disabled' : '') + inv('projectId', 'dn-project') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (pid === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select>' + fe('projectId', 'dn-project') + '</div>';
    if (pid) {
      var pkgs = st.visiblePackages(u.id, pid), areas = st.areas(pid);
      var owners = eligibleUsers(pid, 'document.control'), reviewers = reviewerPool(pid, v.category);
      var reqs = st.requests(u.id, pid), inss = st.instructions(u.id).filter(function (c) { return c.projectId === pid; }), insps = st.inspections(u.id, pid);
      var dups = (doneItem('docnew') || (inbox ? { sha256: inbox.sha256 } : {})).sha256 ? st.duplicateFiles(u.id, (doneItem('docnew') || inbox).sha256, doneItem('docnew') ? doneItem('docnew').fileId : inbox.id) : [];
      body += '<div class="grid g-2"><div class="field"><label for="dn-number">' + esc(t('doc.number')) + '</label><input id="dn-number" class="input mono" data-dntext="number" maxlength="40" value="' + esc(v.number || '') + '"' + inv('number', 'dn-number') + '><span class="field-hint">' + esc(t('dn.number.hint')) + '</span>' + fe('number', 'dn-number') + '</div>' +
        '<div class="field"><label for="dn-rev">' + esc(t('dn.rev')) + '</label><input id="dn-rev" class="input mono" data-dntext="rev" maxlength="8" value="' + esc(v.rev || '') + '"' + inv('rev', 'dn-rev') + '><span class="field-hint">' + esc(t('dn.rev.hint')) + '</span>' + fe('rev', 'dn-rev') + '</div></div>' +
        '<div class="field"><label for="dn-title">' + esc(t('doc.title')) + '</label><input id="dn-title" class="input" data-dntext="title" maxlength="160" value="' + esc(v.title || '') + '"' + inv('title', 'dn-title') + '>' + fe('title', 'dn-title') + '</div>' +
        '<div class="grid g-2"><div class="field"><label for="dn-cat">' + esc(t('dc.category')) + '</label><select id="dn-cat" class="select" data-dnbind="category"' + inv('category', 'dn-cat') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + CATS().map(function (c) { return '<option value="' + c + '"' + (v.category === c ? ' selected' : '') + '>' + esc(t('dtype.' + c)) + '</option>'; }).join('') + '</select><span class="field-hint">' + esc(t('dn.cat.hint')) + '</span>' + fe('category', 'dn-cat') + '</div>' +
        '<div class="field"><label for="dn-area">' + esc(t('rq.area')) + '</label><select id="dn-area" class="select" data-dnbind="areaId"><option value="">' + esc(t('dn.noArea')) + '</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (v.areaId === a.id ? ' selected' : '') + '>' + esc(a.code + ' · ' + L(a, 'name')) + '</option>'; }).join('') + '</select></div></div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('ins.packages')) + '</legend><div class="checks">' + pkgs.map(function (w) { return '<label class="check"><input type="checkbox" data-dnmulti="packageIds" value="' + w.id + '"' + (has(v.packageIds, w.id) ? ' checked' : '') + '> ' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></label>'; }).join('') + '</div><span class="field-hint">' + esc(t('dn.pkg.hint')) + '</span></fieldset>' +
        '<div class="grid g-2"><div class="field"><label for="dn-owner">' + esc(t('dn.owner')) + '</label><select id="dn-owner" class="select" data-dnbind="ownerId"' + inv('ownerId', 'dn-owner') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + owners.map(function (x) { return '<option value="' + x.id + '"' + (v.ownerId === x.id ? ' selected' : '') + '>' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select>' + fe('ownerId', 'dn-owner') + '</div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('dn.audience')) + '</legend><div class="row"><label class="check"><input type="radio" name="dn-aud" data-dnbind="audience" value="customer"' + (v.audience !== 'internal' ? ' checked' : '') + '> ' + esc(t('dn.aud.customer')) + '</label><label class="check"><input type="radio" name="dn-aud" data-dnbind="audience" value="internal"' + (v.audience === 'internal' ? ' checked' : '') + '> ' + esc(t('dn.aud.internal')) + '</label></div><span class="field-hint">' + esc(t('dn.aud.hint')) + '</span></fieldset></div>' +
        custReviewNote(pid, v.category) +
        '<fieldset class="field"><legend class="label">' + esc(t('dn.reviewers')) + '</legend><div class="checks">' + reviewers.map(function (x) { return '<label class="check"><input type="checkbox" data-dnmulti="reviewers" value="' + x.id + '"' + (has(v.reviewers, x.id) ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div><span class="field-hint">' + esc(t('dn.required.hint')) + '</span>' + fe('reviewers', 'dn-rv') + '</fieldset>' +
        '<details class="explain"' + ((v.optionalReviewers || []).length ? ' open' : '') + '><summary>' + esc(t('dn.optional')) + '</summary><div class="checks">' + reviewers.filter(function (x) { return !ST().isCustomer(x.id); }).map(function (x) { return '<label class="check"><input type="checkbox" data-dnmulti="optionalReviewers" value="' + x.id + '"' + (has(v.optionalReviewers, x.id) ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div><span class="field-hint">' + esc(t('dn.optional.hint')) + '</span></details>' +
        '<div class="grid g-2"><div class="field"><label for="dn-due">' + esc(t('dn.due')) + '</label><input id="dn-due" type="date" class="input" min="' + st.today + '" data-dnbind="reviewDue" value="' + esc(v.reviewDue || '') + '"' + inv('reviewDue', 'dn-due') + '>' + fe('reviewDue', 'dn-due') + '</div>' +
        '<div class="field"><label class="check dn-submit"><input type="checkbox" data-dnbind="submit" value="1"' + (v.submit ? ' checked' : '') + '> ' + esc(t('dn.submitNow')) + '</label><span class="field-hint">' + esc(t('dn.submitNow.hint')) + '</span></div></div>' +
        '<details class="explain"' + ((v.links || []).length ? ' open' : '') + '><summary>' + esc(t('dn.links')) + ' <span class="pill plain num">' + (v.links || []).length + '</span></summary><div class="checks">' +
        reqs.map(function (r) { return '<label class="check"><input type="checkbox" data-dnlink="request:' + r.id + '"' + (has(v.links, 'request:' + r.id) ? ' checked' : '') + '> <span class="mono">' + esc(r.ref) + '</span> ' + esc(r.subject) + '</label>'; }).join('') +
        inss.map(function (c) { return '<label class="check"><input type="checkbox" data-dnlink="change:' + c.id + '"' + (has(v.links, 'change:' + c.id) ? ' checked' : '') + '> <span class="mono">' + esc(c.ref) + '</span> ' + esc(c.title) + '</label>'; }).join('') +
        insps.map(function (i) { return '<label class="check"><input type="checkbox" data-dnlink="inspection:' + i.id + '"' + (has(v.links, 'inspection:' + i.id) ? ' checked' : '') + '> <span class="mono">' + esc(i.ref) + '</span> ' + esc(i.title) + '</label>'; }).join('') + '</div></details>' +
        '<div class="field"><label for="dn-note">' + esc(t('doc.note')) + ' ' + esc(t('dlg.optional')) + '</label><input id="dn-note" class="input" data-dntext="note" maxlength="200" value="' + esc(v.note || '') + '"></div>' +
        '<h3 class="sub-h">' + esc(t('dn.file')) + '</h3>' +
        (inbox ? '<div class="notice">' + ic('documents') + '<span><b>' + esc(inbox.name) + '</b> · ' + esc(fsize(inbox.size)) + ' · ' + esc(t('dn.fromInbox', { who: person(inbox.uploadedBy), date: fdt(inbox.at) })) + '</span></div>'
          : X.uploadControl('docnew', t('dn.chooseFile'))) + fe('fileId', 'dn-file') +
        (dups.length ? '<div class="dup"><h3 class="sub-h">' + pic('search') + ' ' + esc(t('dn.dupTitle', { n: dups.length })) + '</h3><ul class="plain">' + dups.map(function (x) {
          return '<li>' + (x.kind === 'document' ? recLink('document', x.doc.id) + ' ' + esc(t('doc.revShort', { rev: x.rev })) : x.kind === 'evidence' ? recLink('evidence', x.evidence.id) : esc(x.file.name + ' · ' + t('dn.unregistered'))) + '</li>';
        }).join('') + '</ul><div class="field"><label for="dn-dupreason">' + esc(t('dn.dupReason')) + '</label><textarea id="dn-dupreason" class="textarea" rows="2" data-dntext="duplicateReason"' + inv('duplicateReason', 'dn-dupreason') + '>' + esc(v.duplicateReason || '') + '</textarea>' + fe('duplicateReason', 'dn-dupreason') + '</div></div>' : '') +
        '<p class="field-hint">' + esc(t('dn.identity')) + '</p>';
    } else body += '<p class="muted">' + esc(t('dn.pickProject')) + '</p>';
    var server = dn.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(dn.serverError)) + '</span></div>' : '';
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), 'documents'], [t('dc.register'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('dn.title')) + '</h1><p>' + esc(t('dn.sub')) + '</p></div>' + (dn.restored ? '<span class="pill plain">' + esc(t('dn.restored')) + '</span>' : '') + '</div>' +
      card(esc(t('dn.details')), '<form class="card-b stack" data-form="docnew" novalidate>' + server + body +
        '<div class="notice">' + ic('shield') + '<span>' + esc(t('dn.notPublished')) + '</span></div><div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="dn-clear">' + esc(t('dn.clear')) + '</button><a class="btn btn-secondary" ' + go('documents') + '>' + esc(t('dlg.cancel')) + '</a><button class="btn btn-primary" type="submit" id="dn-submit"' + (dn.busy ? ' aria-disabled="true"' : '') + '>' + (dn.busy ? '<span class="spin" aria-hidden="true"></span>' : '') + esc(t('dn.save')) + '</button></div></form>');
  }
  function submitRegister() {
    var st = ST(), dn = S().dn, v = dn.values, u = me();
    if (dn.busy) return;
    dn.errors = {}; dn.serverError = null;
    var fileId = dn.fromFile || doneFile('docnew');
    if (!v.projectId) dn.errors.projectId = 'err.missing_project';
    if (!v.number || v.number.trim().length < 3) dn.errors.number = 'dn.err.number';
    if (!v.title || v.title.trim().length < 3) dn.errors.title = 'dn.err.title';
    if (!v.rev || !v.rev.trim()) dn.errors.rev = 'dn.err.rev';
    if (!v.category) dn.errors.category = 'dn.err.category';
    if (!v.ownerId) dn.errors.ownerId = 'err.owner_required';
    if (v.submit && !(v.reviewers || []).length) dn.errors.reviewers = 'dn.err.reviewers';
    if (v.submit && !v.reviewDue) dn.errors.reviewDue = 'err.due_required';
    if (X.uploadsBusy('docnew')) dn.errors.fileId = 'up.err.busy';
    else if (X.uploadsFailed('docnew')) dn.errors.fileId = 'up.err.failedPending';
    else if (!fileId) dn.errors.fileId = 'dn.err.file';
    var it = doneItem('docnew');
    if (it && it.quarantined && v.submit) dn.errors.fileId = 'err.file_not_validated';
    if (Object.keys(dn.errors).length) { U().render(); X.focusInvalid(); return; }
    dn.busy = true; U().render();
    setTimeout(function () {
      var r = API().dispatch('document.register', u.id, { idempotencyKey: dn.key, projectId: v.projectId, packageIds: v.packageIds, areaId: v.areaId || null, number: v.number, title: v.title, category: v.category, rev: v.rev,
        ownerId: v.ownerId, audience: v.audience || 'customer', reviewers: v.reviewers, optionalReviewers: (v.optionalReviewers || []).filter(function (x) { return (v.reviewers || []).indexOf(x) < 0; }), reviewDue: v.reviewDue || null, submit: !!v.submit, note: v.note,
        links: (v.links || []).map(function (x) { var p = x.split(':'); return { kind: p[0], id: p[1] }; }), fileId: fileId, duplicateReason: v.duplicateReason });
      dn.busy = false;
      if (r.ok) { S().dn = null; save(DN_KEY, null); if (S().uploads) delete S().uploads.docnew; U().toast(t('dn.saved', { ref: r.result.number })); U().go('doc.' + r.result.id); return; }
      dn.serverError = r.code;
      if (r.code === 'duplicate_file') dn.errors.duplicateReason = 'dn.err.dupReason';
      if (r.code === 'number_exists') dn.errors.number = 'err.number_exists';
      U().render();
    }, 400);
  }

  // ---------------------------------------------------------------- 3. document detail and viewer
  var URLS = {};
  function blobUrl(fid) { var b = X.BLOBS[fid]; if (!b) return null; if (!URLS[fid]) URLS[fid] = URL.createObjectURL(b); return URLS[fid]; }
  var PREVIEWABLE = { 'application/pdf': 'pdf', 'image/jpeg': 'img', 'image/png': 'img', 'image/webp': 'img' };
  function fileMeta(f) {
    return kv([[t('dv.fileName'), esc(f.name)], [t('dv.fileSize'), esc(fsize(f.size)) + ' · ' + esc(f.type)], [t('dv.sha'), '<span class="mono">' + esc((f.sha256 || '—').slice(0, 16)) + (f.sha256 ? '…' : '') + '</span>'],
      [t('dv.validation'), f.validation === 'ok' ? pill('ok', t('dv.val.ok')) : f.validation === 'mismatch' ? pill('crit', t('dv.val.mismatch')) : pill('warn', t('dv.val.unchecked'))], [t('dv.scan'), pill('warn', t('dv.scan.none'))],
      [t('dv.uploaded'), esc(person(f.uploadedBy) + ' · ' + fdt(f.at))]]);
  }
  function viewer(u, d, r) {
    var st = ST();
    var banner = statusBanner(u, d, r);
    if (!r.fileId) return banner + emptyBox('documents', t('doc.nofile'), t('dv.nofile.d'));
    var f = st.get('file', r.fileId);
    if (!f || !st.fileAccess(u.id, f).allowed) return banner + emptyBox('lock', t('file.denied'));
    var dl = '<button type="button" class="btn btn-secondary btn-sm" data-pact="doc-dl" data-v="' + f.id + '">' + ic('download') + esc(t('dv.download')) + '</button>';
    if (f.quarantined) return banner + '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('dv.quarantined')) + '</span></div>' + fileMeta(f);
    var url = blobUrl(f.id), kind = PREVIEWABLE[f.type], body;
    if (!url) body = emptyBox('documents', t('dv.notRetained'), t('dv.notRetained.d'));
    else if (!kind) body = emptyBox('documents', t('dv.noPreview', { type: f.name.split('.').pop().toUpperCase() }), t('dv.noPreview.d'));
    else if (kind === 'pdf') body = '<div class="pv"><iframe class="pv-frame" title="' + esc(t('dv.previewOf', { ref: d.number + ' ' + t('doc.revShort', { rev: r.rev }) })) + '" src="' + url + '#view=FitH"></iframe><p class="field-hint pv-fallback">' + esc(t('dv.pdfFallback')) + '</p></div>';
    else body = '<div class="pv"><img class="pv-img" src="' + url + '" alt="' + esc(d.title + ' ' + t('doc.revShort', { rev: r.rev })) + '" data-pverr="1"><div class="pv-failed" hidden>' + emptyBox('alert', t('dv.previewFailed'), t('dv.previewFailed.d')) + '</div></div>';
    return banner + body + '<div class="row">' + dl + '</div>' + '<details class="explain"><summary>' + esc(t('dv.fileDetails')) + '</summary>' + fileMeta(f) + '</details>';
  }
  function statusBanner(u, d, r) {
    var pub = ST().pubRev(d), cls, msg;
    if (r.status === 'published') { cls = 'ok'; msg = t('dv.b.published', { rev: r.rev, date: fd(r.publishedAt) }); }
    else if (r.status === 'superseded') { cls = 'warn'; msg = pub ? t('dv.b.superseded', { rev: r.rev, cur: pub.rev }) : t('dv.b.supersededNone', { rev: r.rev }); }
    else if (r.status === 'withdrawn') { cls = 'crit'; msg = t('dv.b.withdrawn', { rev: r.rev, reason: r.withdrawn ? r.withdrawn.reason : '' }); }
    else { cls = 'draft'; msg = t('dv.b.unpublished', { rev: r.rev, status: t('rstat4.' + r.status) }) + (pub ? ' ' + t('dv.b.curIs', { cur: pub.rev }) : ' ' + t('dv.b.noneYet')); }
    return '<div class="revbanner ' + cls + '" role="status"><span class="rb-rev mono">' + esc(t('doc.revShort', { rev: r.rev })) + '</span><span class="rb-state">' + esc(t('rstat4.' + r.status)) + '</span><span class="rb-msg">' + esc(msg) + '</span>' +
      (pub && pub !== r ? '<a class="btn btn-secondary btn-sm" ' + go('doc.' + d.id + '.' + pub.rev) + '>' + esc(t('dv.openCurrent')) + '</a>' : '') + '</div>';
  }
  function ddState(id) { var s = S(); if (!s.dd || s.dd.id !== id) s.dd = { id: id, form: null, errors: {}, values: {} }; return s.dd; }
  function documentDetail(u, args) {
    var st = ST(), d = st.get('document', args[0]);
    var g = h.guard(u, 'document', d); if (g) return g;
    var dd = ddState(d.id), staff = st.isStaffFor(u.id, d), revs = st.visibleRevisions(u.id, d);
    if (!revs.length) return U().deniedState({ code: 'internal_record' }, null);
    var reqRev = args[1] && st.revOf(d, args[1]);
    if (reqRev && !st.revisionAccess(u.id, d, reqRev).allowed) return U().deniedState(st.revisionAccess(u.id, d, reqRev), null);
    var r = reqRev || (staff ? (st.pendingRev(d) && args[2] === 'review' ? st.pendingRev(d) : (st.pubRev(d) || st.latestRev(d))) : (st.pubRev(d) || revs[revs.length - 1]));
    var c = st.docControls(u.id, d), p = st.get('project', d.projectId);
    // a form named in the link opens only when this person may use it
    var ROUTE_FORM = { review: c.review, publish: c.publish, submit: c.submit, assign: c.assign, revise: c.revise, withdraw: c.withdraw };
    if (args[2] && !dd.form && !dd.openedFromRoute) { dd.openedFromRoute = true; if (ROUTE_FORM[args[2]]) dd.form = args[2]; }
    dd.rev = r.rev;
    var revNav = '<nav class="revnav" aria-label="' + esc(t('dv.revisions')) + '">' + revs.map(function (x) {
      return '<a class="revtab' + (x === r ? ' cur' : '') + ' rs-' + x.status + '" ' + go('doc.' + d.id + '.' + x.rev) + (x === r ? ' aria-current="page"' : '') + '><span class="mono">' + esc(x.rev) + '</span><span>' + esc(t('rstat4.' + x.status)) + '</span></a>';
    }).join('') + '</nav>';
    var preview = card(esc(t('dv.viewer')), '<div class="card-b stack">' + revNav + viewer(u, d, r) + '</div>', '', 'doc-viewer');
    var meta = card(esc(t('rec.details')), '<div class="card-b">' + kv([[t('doc.number'), '<span class="mono">' + esc(d.number) + '</span>'], [t('dc.category'), esc(t('dtype.' + d.category))],
      [t('nav.projects'), recLink('project', p.id) + ' ' + esc(L(p, 'name'))], [t('misc.package'), (d.packageIds || []).map(function (id) { return recLink('package', id); }).join(' ') || esc(t('misc.wholeProject'))],
      [t('rq.area'), esc(areaName(d.areaId) || t('dc.missing'))], [t('dc.publication'), pubPill(d) + (st.pubRev(d) ? ' <span class="mono">' + esc(t('doc.revShort', { rev: st.pubRev(d).rev })) + '</span>' : '')],
      [t('dc.owner'), d.ownerId ? personRole(d.ownerId) : esc(t('dc.missing'))], staff ? [t('dn.audience'), esc(t(d.audience === 'internal' ? 'dn.aud.internal' : 'dn.aud.customer'))] : null,
      [t('doc.source'), esc(t('dsource.' + d.source))], staff ? [t('dv.registered'), esc(person(d.registeredBy) + ' · ' + fdt(d.registeredAt))] : null]) + '</div>');
    // review and comments (customer comments only on published revisions; internal comments staff only)
    var rs = st.reviewState(r), reviews = st.revReviews(u.id, d, r), comments = st.revComments(u.id, d, r);
    var custC = comments.filter(function (x) { return x.visibility === 'customer'; }), intC = comments.filter(function (x) { return x.visibility === 'internal'; });
    var cList = function (list) { return '<ol class="thread">' + list.map(function (m) { return '<li class="msg' + (m.visibility === 'internal' ? ' note' : '') + '"><span class="avatar sm">' + esc(U().initials(person(m.by))) + '</span><div class="bubble"><div class="msg-h">' + personRole(m.by) + '<span class="muted num">' + esc(fdt(m.at)) + '</span></div><p class="pre">' + esc(m.text) + '</p></div></li>'; }).join('') + '</ol>'; };
    var reviewCard = staff ? card(esc(t('dv.review', { rev: r.rev })), '<div class="card-b stack">' + ((r.reviewers || []).length ? '<ul class="droute">' + r.reviewers.concat(r.optionalReviewers || []).map(function (uid) {
      var x = reviews.filter(function (y) { return y.by === uid && y.rev === r.rev; })[0], opt = (r.reviewers || []).indexOf(uid) < 0;
      return '<li class="dr ' + (opt ? 'dr-optional ' : '') + (x ? (x.outcome === 'accepted' || x.outcome === 'accepted_comments' ? 'dr-done' : x.outcome === 'rejected' ? 'dr-rejected' : 'dr-returned') : (r.status === 'under_review' ? 'dr-pending' : 'dr-later')) + '"><span class="dr-dot">' + pic(x ? 'check' : 'clock') + '</span><div class="t"><span>' + personRole(uid) + ' ' + pill(opt ? 'plain' : 'info', t(opt ? 'dv.optional' : 'dv.required')) + '</span>' +
        (x ? '<span>' + revPill(x.outcome) + ' <span class="muted num">' + esc(fdt(x.at)) + '</span></span>' + (x.reason ? '<span class="muted">“' + esc(x.reason) + '”</span>' : '') : '<span class="muted">' + esc(t(r.status === 'under_review' ? 'dv.awaiting' : 'ins.notYet')) + '</span>') + '</div></li>';
    }).join('') + '</ul>' + (r.reviewDue ? '<p class="field-hint">' + esc(t('dv.due')) + ' ' + dueCell(r.reviewDue, r.status !== 'under_review') + (rs.complete ? ' · ' + esc(t('dv.consolidated')) + ' ' + esc(t('rstat4.' + rs.outcome)) : '') + '</p>' : '') : '<p class="muted">' + esc(t('dv.noReviewers')) + '</p>') +
      '<p class="field-hint">' + esc(t('dv.outcomesProposed')) + '</p></div>') : '';
    var commentCard = card(esc(t('dv.comments')), '<div class="card-b stack"><h3 class="sub-h">' + esc(t('dv.c.customer')) + ' <span class="pill plain num">' + custC.length + '</span></h3>' + (custC.length ? cList(custC) : '<p class="muted">' + esc(t('dv.c.none')) + '</p>') +
      (staff ? '<section class="internal-card card-b"><h3 class="sub-h">' + pic('lock') + ' ' + esc(t('dv.c.internal')) + ' <span class="pill crit plain">' + esc(t('rd.internalOnly')) + '</span></h3>' + (intC.length ? cList(intC) : '<p class="muted">' + esc(t('dv.c.none')) + '</p>') + '</section>' : '') +
      (c.comment ? '<form class="stack composer" data-form="doc-comment" novalidate><label for="dv-comment" class="label">' + esc(t('dv.addComment')) + '</label><textarea id="dv-comment" name="text" class="textarea" rows="2"></textarea>' +
        '<div class="row"><label class="check"><input type="radio" name="visibility" value="customer"' + (c.commentInternal ? '' : ' checked') + '> ' + esc(t('dv.vis.customer')) + '</label>' + (c.commentInternal ? '<label class="check"><input type="radio" name="visibility" value="internal" checked> ' + esc(t('dv.vis.internal')) + '</label>' : '') + '</div>' +
        '<p class="field-hint">' + esc(t('dv.vis.hint')) + '</p><div class="dlg-actions"><button class="btn btn-secondary" type="submit">' + esc(t('dv.saveComment')) + '</button></div></form>' : '') + '</div>');
    // revision history: the one table on this page
    var hist = card(esc(t('doc.revisions')), table([t('doc.rev'), t('doc.date'), t('f.status'), t('doc.by'), t('doc.note')], revs.slice().reverse().map(function (x) {
      return '<tr' + (x === r ? ' class="current"' : '') + '><td class="mono"><a ' + go('doc.' + d.id + '.' + x.rev) + '>' + esc(x.rev) + '</a></td><td class="num">' + esc(fd(x.publishedAt || x.submittedAt || x.date)) + '</td><td>' + revPill(x.status) + '</td><td>' + esc(person(x.publishedBy || x.submittedBy || x.by)) + '</td><td>' + esc(x.note || '') + (x.withdrawn ? '<br><span class="late">' + esc(x.withdrawn.reason) + '</span>' : '') + '</td></tr>';
    })) + (staff ? '' : '<p class="field-hint card-b">' + esc(t('dv.custHistory')) + '</p>'));
    // links and superseded flags
    var links = st.docLinks(d).filter(function (l) { var rec = st.get(l.kind, l.id); return rec && st.canSee(u.id, l.kind, rec); });
    var linkCard = card(esc(t('dv.links')), links.length ? '<ul class="doclist">' + links.map(function (l) {
      var f = l.rev ? st.revisionFlag(d, l.rev) : null;
      return '<li>' + recLink(l.kind, l.id) + '<span class="t"><b>' + esc(t('dv.via.' + l.via)) + '</b><span>' + (l.rev ? esc(t('dv.cites', { rev: l.rev })) : '') + '</span></span>' + (f ? pill(f.state === 'withdrawn' ? 'crit' : 'warn', t('dv.flag.' + f.state, { cur: f.current || '—' })) : '') + '</li>';
    }).join('') + '</ul><p class="field-hint card-b">' + esc(t('dv.flagNote')) + '</p>' : emptyBox('documents', t('dv.noLinks')));
    // distribution
    var trs = st.transmittals(u.id, null, d.id);
    var dist = card(esc(t('dv.distribution')), trs.length ? '<ul class="doclist">' + trs.map(function (tr) {
      var it = tr.items.filter(function (i) { return i.docId === d.id; })[0];
      return '<li>' + trLink(tr) + '<span class="t"><b>' + esc(t('doc.revShort', { rev: it.rev })) + ' · ' + esc(t('trp.' + tr.purpose)) + '</b><span>' + esc(fdt(tr.issuedAt)) + ' · ' + esc(t('tr.deliveredN', { n: tr.deliveries.length })) + ' · ' + esc(tr.acknowledgements.length ? t('tr.ackd') : t('tr.notAckd')) + '</span></span></li>';
    }).join('') + '</ul>' : emptyBox('send', t('dv.noDist'), d.status === 'published' ? t('dv.preportal') : ''));
    // actions
    var a = [];
    if (c.review && r.status === 'under_review' && r === st.pendingRev(d)) a.push('<button class="btn btn-primary" data-pact="dd-form" data-v="review">' + esc(t('dv.f.review')) + '</button>');
    if (c.submit && r === st.pendingRev(d)) a.push('<button class="btn btn-primary" data-pact="dd-form" data-v="submit">' + esc(t('dv.f.submit')) + '</button>');
    if (c.publish && r === st.pendingRev(d)) a.push('<button class="btn btn-primary" data-pact="dd-form" data-v="publish">' + esc(t('dv.f.publish')) + '</button>');
    if (c.assign && r === st.pendingRev(d)) a.push('<button class="btn btn-secondary" data-pact="dd-form" data-v="assign">' + esc(t('dv.f.assign')) + '</button>');
    if (c.replaceFile && r === st.pendingRev(d)) a.push('<button class="btn btn-secondary" data-pact="dd-form" data-v="replace">' + esc(t('dv.f.replace')) + '</button>');
    if (c.revise) a.push('<button class="btn btn-secondary" data-pact="dd-form" data-v="revise">' + esc(t('dv.f.revise')) + '</button>');
    if (c.withdraw && r.status === 'published') a.push('<button class="btn btn-ghost" data-pact="dd-form" data-v="withdraw">' + esc(t('dv.f.withdraw')) + '</button>');
    if (staff && c.routingMissing) a.push('<div class="notice warn" role="status">' + ic('alert') + '<span><b>' + esc(t('dv.routingMissing')) + '</b> ' + esc(t('dv.routingMissing.d')) + '</span></div>');
    if (staff && !c.revise && st.pendingRev(d) && !c.review && !c.publish && !c.submit) a.push('<span class="why">' + esc(t('dv.inProgress', { rev: st.pendingRev(d).rev })) + '</span>');
    if (!staff && c.review && r === st.pendingRev(d)) a = ['<button class="btn btn-primary" data-pact="dd-form" data-v="review">' + esc(t('dv.f.review')) + '</button>'];
    var acts = staff || (c.review && r === st.pendingRev(d)) ? card(esc(t('rd.actions')), '<div class="card-b stack">' + (a.length ? '<div class="btn-stack">' + a.join('') + '</div>' : '<p class="muted">' + esc(t('rd.noActions')) + '</p>') + (dd.serverError && !dd.form ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(dd.serverError)) + '</span></div>' : '') + (dd.form ? docForm(u, d, dd) : '') + '</div>') : '';
    var ack = '';
    if (!staff) {
      var open = trs.filter(function (tr) { return st.trAckState(u.id, tr).canAck; });
      if (open.length) ack = '<div class="notice">' + ic('ack') + '<span>' + esc(t('dv.ackPrompt')) + ' </span>' + open.map(trLink).join(' ') + '</div>';
    }
    var main = preview + hist + commentCard;
    var side = acts + reviewCard + meta + linkCard + dist;
    return h.recordShell ? h.recordShell(u, 'document', d, d.title, pubPill(d), ack + main, side) : main + side;
  }
  function docForm(u, d, dd) {
    var st = ST(), f = dd.form, e = dd.errors, v = dd.values, pend = st.pendingRev(d), body = '';
    var fe = function (k, id) { return e[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(e[k])) + '</div>' : ''; };
    var inv = function (k, id) { return e[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; };
    var submit = function (label, danger) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="dd-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="submit"' + (dd.busy ? ' aria-disabled="true"' : '') + '>' + esc(label) + '</button></div>'; };
    var reason = function (label, name) { name = name || 'reason'; return '<div class="field"><label for="df-' + name + '">' + esc(label) + '</label><textarea id="df-' + name + '" name="' + name + '" class="textarea" rows="2"' + inv(name, 'df-' + name) + '>' + esc(v[name] || '') + '</textarea>' + fe(name, 'df-' + name) + '</div>'; };
    var reviewersField = function () {
      var list = reviewerPool(d.projectId, d.category, d.packageIds[0] ? { packageId: d.packageIds[0] } : null), sel = v.reviewers || (pend ? pend.reviewers : []) || [], osel = v.optionalReviewers || (pend ? pend.optionalReviewers : []) || [];
      return custReviewNote(d.projectId, d.category) + '<fieldset class="field"><legend class="label">' + esc(t('dn.reviewers')) + '</legend><div class="checks">' + list.map(function (x) { return '<label class="check"><input type="checkbox" name="reviewers" value="' + x.id + '"' + (sel.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div><span class="field-hint">' + esc(t('dn.required.hint')) + '</span>' + fe('reviewers', 'df-rv') + '</fieldset>' +
        '<fieldset class="field"><legend class="label">' + esc(t('dn.optional')) + '</legend><div class="checks">' + list.filter(function (x) { return !ST().isCustomer(x.id); }).map(function (x) { return '<label class="check"><input type="checkbox" name="optionalReviewers" value="' + x.id + '"' + (osel.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + '</label>'; }).join('') + '</div><span class="field-hint">' + esc(t('dn.optional.hint')) + '</span></fieldset>' +
        '<div class="field"><label for="df-due">' + esc(t('dn.due')) + '</label><input id="df-due" name="reviewDue" type="date" class="input" min="' + st.today + '" value="' + esc(v.reviewDue || (pend && pend.reviewDue) || '') + '"' + inv('reviewDue', 'df-due') + '>' + fe('reviewDue', 'df-due') + '</div>';
    };
    if (f === 'review') {
      body = '<p class="field-hint">' + esc(t('dv.reviewHint', { rev: pend.rev })) + '</p><fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="choices compact">' + (DOCPOL().reviewOutcomes || []).map(function (o) {
        return '<label class="choice' + (v.outcome === o ? ' sel' : '') + '"><input type="radio" name="outcome" value="' + o + '"' + (v.outcome === o ? ' checked' : '') + '><span class="t"><b>' + esc(t('rstat4.' + o)) + '</b><span class="muted">' + esc(t('dv.o.' + o)) + '</span></span></label>';
      }).join('') + '</div>' + fe('outcome', 'df-outcome') + '</fieldset>' + reason(t('dv.reason')) +
        '<div class="field"><label for="df-comment">' + esc(t('dv.reviewComment')) + ' ' + esc(t('dlg.optional')) + '</label><textarea id="df-comment" name="comment" class="textarea" rows="2">' + esc(v.comment || '') + '</textarea></div>' +
        (ST().isCustomer(u.id) ? '<input type="hidden" name="commentVisibility" value="customer">' : '<div class="row"><label class="check"><input type="radio" name="commentVisibility" value="customer"' + (v.commentVisibility === 'internal' ? '' : ' checked') + '> ' + esc(t('dv.vis.customer')) + '</label><label class="check"><input type="radio" name="commentVisibility" value="internal"' + (v.commentVisibility === 'internal' ? ' checked' : '') + '> ' + esc(t('dv.vis.internal')) + '</label></div>') +
        '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('dv.notAuthorise')) + '</span></div>' + submit(t('dv.f.review'));
    } else if (f === 'submit') body = '<p class="field-hint">' + esc(t('dv.submitHint')) + '</p>' + reviewersField() + submit(t('dv.f.submit'));
    else if (f === 'assign') body = reviewersField() + submit(t('dv.f.assign'));
    else if (f === 'revise') {
      body = '<p class="field-hint">' + esc(t('dv.reviseHint', { cur: (st.pubRev(d) || st.latestRev(d)).rev })) + '</p><div class="field"><label for="df-rev">' + esc(t('dn.rev')) + '</label><input id="df-rev" name="rev" class="input mono" maxlength="8" value="' + esc(v.rev || '') + '"' + inv('rev', 'df-rev') + '>' + fe('rev', 'df-rev') + '</div>' +
        reason(t('dv.whatChanged'), 'note') + X.uploadControl('docrev-' + d.id, t('dn.chooseFile')) + fe('fileId', 'df-file') + '<label class="check"><input type="checkbox" name="submit" value="1"' + (v.submit ? ' checked' : '') + ' data-ddsub="1"> ' + esc(t('dn.submitNow')) + '</label>' + (v.submit ? reviewersField() : '') +
        (v.needDupReason ? reason(t('dn.dupReason'), 'duplicateReason') : '') + '<div class="notice">' + ic('info') + '<span>' + esc(t('dv.reviseKeeps')) + '</span></div>' + submit(t('dv.f.revise'));
    } else if (f === 'replace') body = '<p class="field-hint">' + esc(t('dv.replaceHint')) + '</p>' + X.uploadControl('docrev-' + d.id, t('dn.chooseFile')) + fe('fileId', 'df-file') + reason(t('dv.reason'), 'reason') + submit(t('dv.f.replace'));
    else if (f === 'publish') {
      var aud = st.audienceFor(d), sel = v.recipients || aud.map(function (x) { return x.id; }), cur = st.pubRev(d);
      body = '<p class="field-hint">' + esc(t('dv.publishHint', { rev: pend.rev })) + '</p><fieldset class="field"><legend class="label">' + esc(t('tr.recipients')) + '</legend><div class="checks">' + aud.map(function (x) { return '<label class="check"><input type="checkbox" name="recipients" value="' + x.id + '"' + (sel.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">' + esc(t('role.' + x.role)) + '</span></label>'; }).join('') + '</div>' + fe('recipients', 'df-rcp') + '<span class="field-hint">' + esc(t('dv.audienceRule')) + '</span></fieldset>' +
        '<div class="field"><label for="df-purpose">' + esc(t('tr.purpose')) + '</label><select id="df-purpose" name="purpose" class="select">' + (DOCPOL().transmittalPurposes || []).map(function (x) { return '<option value="' + x + '"' + (v.purpose === x ? ' selected' : '') + '>' + esc(t('trp.' + x)) + '</option>'; }).join('') + '</select></div>' +
        (cur ? '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('dv.replaces', { cur: cur.rev, rev: pend.rev })) + '</span></div>' + reason(t('dv.replaceReason')) : '') +
        '<div class="field"><label for="df-tnote">' + esc(t('tr.note')) + ' ' + esc(t('dlg.optional')) + '</label><input id="df-tnote" name="note" class="input" value="' + esc(v.note || '') + '"></div>' +
        publishAuthority(u, d) + '<div class="notice">' + ic('send') + '<span>' + esc(t('dv.portalOnly')) + ' ' + esc(t('dv.reminder', { n: DOCPOL().acknowledgeReminderDays || 7 })) + '</span></div><div class="notice warn">' + ic('shield') + '<span>' + esc(t('dv.notTechnical')) + '</span></div>' + submit(t('dv.f.publish'));
    } else if (f === 'withdraw') body = '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('dv.withdrawHint')) + '</span></div>' + reason(t('dv.reason')) + submit(t('dv.f.withdraw'), true);
    return '<form class="stack rd-form" data-form="doc-' + f + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(t('dv.f.' + f)) + '</h3>' + (dd.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(dd.serverError)) + '</span></div>' : '') + body + '</form>';
  }
  function publishAuthority(u, d) {
    var af = ST().authorityFor(u.id, 'document.publish', ST().docRes(d));
    if (!af.check.allowed) return '';
    if (!af.authority) return '<p class="field-hint">' + esc(t('dv.pubByRole', { role: t('role.' + u.role) })) + '</p>';
    var x = af.authority;
    return '<p class="field-hint">' + esc(t('dv.pubByDelegation', { id: x.id, to: x.validUntil ? fdt(x.validUntil.slice(0, 16)) + ' ' + (x.timezone || '') : fd(x.validTo) })) + (x.testExample ? ' ' + pill('warn', t('auth.testExample')) : '') + '</p>';
  }
  function submitDocForm(form) {
    var st = ST(), dd = S().dd, d = st.get('document', dd.id), u = me(), f = form.getAttribute('data-form').slice(4), fdat = new FormData(form);
    var val = function (k) { return (fdat.get(k) || '').toString().trim(); }, all = function (k) { return fdat.getAll(k).map(String); };
    var pend = st.pendingRev(d), cmd, payload = { id: d.id, version: d.version }, toast;
    dd.errors = {}; dd.serverError = null;
    Array.from(fdat.keys()).forEach(function (k) { dd.values[k] = k === 'reviewers' || k === 'recipients' || k === 'optionalReviewers' ? all(k) : val(k); });
    if (!fdat.has('reviewers') && form.querySelector('[name=reviewers]')) dd.values.reviewers = [];
    if (!fdat.has('recipients') && form.querySelector('[name=recipients]')) dd.values.recipients = [];
    var needReviewers = function () { if (!all('reviewers').length) dd.errors.reviewers = 'dn.err.reviewers'; if (!val('reviewDue')) dd.errors.reviewDue = 'err.due_required'; };
    switch (f) {
      case 'review':
        if (!val('outcome')) dd.errors.outcome = 'dv.err.outcome';
        else if (val('outcome') !== 'accepted' && val('reason').length < 5) dd.errors.reason = 'rd.err.reason';
        cmd = 'document.review'; payload.rev = pend.rev; payload.outcome = val('outcome'); payload.reason = val('reason'); payload.comment = val('comment'); payload.commentVisibility = val('commentVisibility'); toast = t('dv.done.review'); break;
      case 'submit': needReviewers(); cmd = 'document.submitReview'; payload.rev = pend.rev; payload.reviewers = all('reviewers'); payload.optionalReviewers = all('optionalReviewers'); payload.reviewDue = val('reviewDue'); toast = t('dv.done.submit'); break;
      case 'assign': needReviewers(); cmd = 'document.assignReviewers'; payload.rev = pend.rev; payload.reviewers = all('reviewers'); payload.optionalReviewers = all('optionalReviewers'); payload.reviewDue = val('reviewDue'); toast = t('dv.done.assign'); break;
      case 'revise':
        if (!val('rev')) dd.errors.rev = 'dn.err.rev';
        if (val('note').length < 3) dd.errors.note = 'rd.err.reason';
        if (X.uploadsBusy('docrev-' + d.id)) dd.errors.fileId = 'up.err.busy'; else if (X.uploadsFailed('docrev-' + d.id)) dd.errors.fileId = 'up.err.failedPending'; else if (!doneFile('docrev-' + d.id)) dd.errors.fileId = 'dn.err.file';
        if (fdat.get('submit')) needReviewers();
        cmd = 'document.addRevision'; payload.rev = val('rev'); payload.note = val('note'); payload.fileId = doneFile('docrev-' + d.id); payload.submit = !!fdat.get('submit'); payload.reviewers = all('reviewers'); payload.optionalReviewers = all('optionalReviewers'); payload.reviewDue = val('reviewDue') || null; payload.duplicateReason = val('duplicateReason'); payload.idempotencyKey = 'rev-' + d.id + '-' + (payload.fileId || ''); toast = t('dv.done.revise'); break;
      case 'replace':
        if (!doneFile('docrev-' + d.id)) dd.errors.fileId = 'dn.err.file';
        cmd = 'document.replaceFile'; payload.rev = pend.rev; payload.fileId = doneFile('docrev-' + d.id); payload.reason = val('reason'); toast = t('dv.done.replace'); break;
      case 'publish':
        if (!all('recipients').length) dd.errors.recipients = 'dv.err.recipients';
        if (st.pubRev(d) && val('reason').length < 5) dd.errors.reason = 'rd.err.reason';
        cmd = 'document.publish'; payload.rev = pend.rev; payload.recipients = all('recipients'); payload.purpose = val('purpose'); payload.reason = val('reason'); payload.note = val('note'); payload.allowNoFile = !pend.fileId; payload.idempotencyKey = dd.pubKey || (dd.pubKey = 'pub-' + X.rnd()); toast = t('dv.done.publish'); break;
      case 'withdraw': if (val('reason').length < 5) dd.errors.reason = 'rd.err.reason'; cmd = 'document.withdraw'; payload.rev = st.pubRev(d).rev; payload.reason = val('reason'); toast = t('dv.done.withdraw'); break;
      case 'comment': break;
    }
    if (Object.keys(dd.errors).length) { U().render(); X.focusInvalid(); return; }
    if (dd.busy) return;
    var r = API().dispatch(cmd, u.id, payload);
    if (r.ok) {
      U().toast(toast);
      if (S().uploads) delete S().uploads['docrev-' + d.id];
      S().dd = { id: d.id, form: null, errors: {}, values: {}, openedFromRoute: true };
      if (cmd === 'document.publish') { U().go('tr.' + r.result.transmittalId); return; }
      if (cmd === 'document.addRevision') { U().go('doc.' + d.id + '.' + r.result.rev); return; }
      U().render(); return;
    }
    dd.serverError = r.code;
    if (r.code === 'duplicate_file') { dd.values.needDupReason = true; dd.errors.duplicateReason = 'dn.err.dupReason'; }
    U().render();
  }
  function submitComment(form) {
    var dd = S().dd, d = ST().get('document', dd.id), fdat = new FormData(form), txt = (fdat.get('text') || '').toString().trim();
    if (txt.length < 2) { U().toast(t('rd.err.text')); return; }
    var r = API().dispatch('document.comment', me().id, { id: d.id, rev: dd.rev || currentShownRev(d), text: txt, visibility: (fdat.get('visibility') || 'customer').toString() });
    if (r.ok) { U().toast(t('dv.done.comment')); U().render(); } else { dd.serverError = r.code; U().render(); }
  }
  function currentShownRev(d) { var parts = (location.hash || '').slice(1).split('.'); var st = ST(); return parts[2] && st.revOf(d, parts[2]) ? parts[2] : (st.pendingRev(d) || st.pubRev(d) || st.latestRev(d)).rev; }

  // ---------------------------------------------------------------- transmittal
  function transmittalPage(u, args) {
    var st = ST(), tr = st.get('transmittal', args[0]);
    var g = h.guard(u, 'transmittal', tr); if (g) return g;
    var staff = st.isStaffFor(u.id, { projectId: tr.projectId }), ack = st.trAckState(u.id, tr), p = st.get('project', tr.projectId);
    var items = tr.items.map(function (i) { var d = st.get('document', i.docId), r = d && st.revOf(d, i.rev); return '<li>' + recLink('document', i.docId) + '<span class="t"><b>' + esc(d ? d.title : i.number) + '</b><span class="mono">' + esc(t('doc.revShort', { rev: i.rev })) + '</span></span>' + (r ? revPill(r.status) : '') + '</li>'; }).join('');
    var rcp = tr.recipients.map(function (uid) {
      var del = tr.deliveries.filter(function (x) { return x.userId === uid; })[0], a = tr.acknowledgements.filter(function (x) { return x.userId === uid; })[0];
      return '<li class="list-row"><span class="sev ' + (a ? 'ok' : 'info') + '"></span><div class="t"><b>' + esc(person(uid)) + '</b><span>' + esc(t('role.' + (U().byId(U().D.users, uid) || {}).role)) + '</span></div><div class="row-end tr-states"><span>' + esc(t('tr.delivered')) + ': ' + (del ? '<span class="num">' + esc(fdt(del.at)) + '</span> · ' + esc(t('tr.ch.' + del.channel)) : '—') + '</span><span>' + esc(t('tr.ack')) + ': ' + (a ? '<span class="num">' + esc(fdt(a.at)) + '</span>' : '—') + '</span></div></li>';
    }).join('');
    var orgAck = tr.acknowledgements.length ? tr.acknowledgements.map(function (a) { return esc(person(a.userId) + ' · ' + fdt(a.at)); }).join(', ') : t('tr.notAckd');
    var ackBox = !staff ? (ack.ack ? '<div class="notice">' + ic('check') + '<span>' + esc(t('tr.ackDone', { who: person(ack.ack.userId), date: fdt(ack.ack.at) })) + '</span></div>' :
      ack.canAck ? '<div class="stack"><button class="btn btn-primary" data-pact="tr-ack" data-v="' + tr.id + '">' + ic('ack') + esc(t('tr.ackBtn')) + '</button><p class="field-hint">' + esc(t('tr.ackMeaning')) + '</p></div>' :
      '<p class="muted">' + esc(t('tr.ackNotYou')) + '</p>') : '';
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), 'documents'], [tr.ref, null]]) +
      '<div class="page-h"><div><span class="eyebrow">' + esc(t('tr.kind')) + ' · <span class="mono">' + esc(tr.ref) + '</span></span><h1>' + esc(t('trp.' + tr.purpose)) + ' — ' + esc(p.code) + '</h1><p>' + esc(tr.note || '') + '</p></div>' + pill(tr.acknowledgements.length ? 'ok' : 'info', tr.acknowledgements.length ? t('tr.ackd') : t('tr.notAckd')) + '</div>' +
      '<div class="grid g-home"><div class="grid">' + card(esc(t('tr.items')), '<ul class="doclist">' + items + '</ul>') +
      card(esc(t('tr.recipients')), '<ul class="list">' + rcp + '</ul><p class="field-hint card-b">' + esc(t('tr.deliveryNote')) + '</p>') + '</div><div class="grid">' +
      card(esc(t('tr.ack')), '<div class="card-b stack"><p>' + esc(t('tr.ackMeaning')) + '</p>' + ackBox + '</div>') +
      card(esc(t('rec.details')), '<div class="card-b">' + kv([[t('tr.issued'), esc(person(tr.issuedBy) + ' · ' + fdt(tr.issuedAt))], [t('tr.purpose'), esc(t('trp.' + tr.purpose))], [t('nav.projects'), recLink('project', p.id)], tr.authority ? [t('tr.authority'), '<span class="mono">' + esc(tr.authority) + '</span>'] : null,
        tr.reminderAt ? [t('tr.reminderOn'), esc(fd(tr.reminderAt))] : null, [t('tr.acks'), esc(orgAck)]]) + '<p class="field-hint">' + esc(t('tr.reminderRule')) + '</p><p class="field-hint">' + esc(t('dv.notTechnical')) + '</p></div>') + '</div></div>';
  }

  // ---------------------------------------------------------------- 4. review workspace
  function reviewPage(u) {
    var st = ST(), list = st.myReviews(u.id), mine = list.filter(function (x) { return x.mine; }), done = list.filter(function (x) { return !x.mine; });
    var row = function (x) { return '<a class="list-row rowlink" ' + go('doc.' + x.doc.id + '.' + x.rev.rev + (x.mine ? '.review' : '')) + '><span class="sev ' + (x.overdue ? 'crit' : x.mine ? 'warn' : 'info') + '"></span><span class="t"><span class="row" style="gap:6px">' + catTag(x.doc.category) + revPill(x.rev.status) + (x.overdue ? pill('crit', t('dc.overdue')) : '') + '</span><b>' + esc(x.doc.title) + '</b><span><span class="mono">' + esc(x.doc.number + ' · ' + t('doc.revShort', { rev: x.rev.rev })) + '</span> · ' + esc(t('dv.due')) + ' ' + dueCell(x.rev.reviewDue) + ' · ' + esc(t('dr.waitingOn', { n: x.state.pending.length })) + '</span></span></a>'; };
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), 'documents'], [t('nav.docreview'), null]]) + '<div class="page-h"><div><h1>' + esc(t('dr.title')) + '</h1><p>' + esc(t('dr.sub')) + '</p></div></div>' +
      '<div class="notice">' + ic('shield') + '<span>' + esc(t('dv.notAuthorise')) + ' ' + esc(t('dv.outcomesProposed')) + '</span></div>' +
      card(esc(t('dr.mine')) + ' <span class="pill plain num">' + mine.length + '</span>', mine.length ? '<div class="list">' + mine.map(row).join('') + '</div>' : emptyBox('inspections', t('dr.none'), t('dr.none.d'))) +
      card(esc(t('dr.others')) + ' <span class="pill plain num">' + done.length + '</span>', done.length ? '<div class="list">' + done.map(row).join('') + '</div>' : emptyBox('inspections', t('tri.empty')));
  }

  // ---------------------------------------------------------------- 8. document controller workspace
  function controlPage(u) {
    var st = ST(), ws = st.dcWorkspace(u.id);
    function item(href, sev, title, sub, owner, extra) { return '<div class="list-row"><span class="sev ' + sev + '"></span><div class="t"><b>' + title + '</b><span>' + sub + '</span><span class="muted">' + esc(t('dcw.owner')) + ': ' + esc(owner ? person(owner) : t('dc.missing')) + '</span></div><div class="row-end">' + (extra || '') + (href ? '<a class="btn btn-secondary btn-sm" ' + go(href) + '>' + esc(t('inb.open')) + '</a>' : '') + '</div></div>'; }
    var sec = function (key, rows, hint) { return card(esc(t(key)) + ' <span class="pill plain num">' + rows.length + '</span>', rows.length ? '<div class="list">' + rows.join('') + '</div>' + (hint ? '<p class="field-hint card-b">' + esc(t(hint)) + '</p>' : '') : emptyBox('check', t('tri.empty'))); };
    var uploads = ws.uploads.map(function (f) { return item(null, 'warn', esc(f.name), esc(fsize(f.size)) + ' · ' + esc(person(f.uploadedBy) + ' · ' + fdt(f.at)) + (f.owner.packageId ? ' · ' + esc(st.get('package', f.owner.packageId).code) : ''), f.uploadedBy, '<a class="btn btn-primary btn-sm" ' + go('docnew.' + f.id) + '>' + esc(t('dcw.registerIt')) + '</a>'); });
    var pending = ws.pendingReviews.map(function (x) { return item('doc.' + x.doc.id + '.' + x.rev.rev, reviewOverdueTone(x), recLinkPlain(x.doc) + ' ' + esc(x.doc.title), esc(t('doc.revShort', { rev: x.rev.rev })) + ' · ' + esc(t('dv.due')) + ' ' + dueCell(x.rev.reviewDue) + ' · ' + esc(t('dcw.pendingWith', { who: x.state.pending.map(person).join(', ') || '—' })), x.state.pending[0] || x.doc.ownerId); });
    var overdue = ws.overdue.map(function (x) { return item('doc.' + x.doc.id + '.' + x.rev.rev, 'crit', recLinkPlain(x.doc) + ' ' + esc(x.doc.title), esc(t('dcw.overdueSince', { date: fd(x.rev.reviewDue) })) + ' · ' + esc(t('dcw.pendingWith', { who: x.state.pending.map(person).join(', ') || '—' })), x.state.pending[0] || x.doc.ownerId); });
    var drafts = ws.drafts.map(function (x) { return item('doc.' + x.doc.id + '.' + x.rev.rev, 'info', recLinkPlain(x.doc) + ' ' + esc(x.doc.title), esc(t('doc.revShort', { rev: x.rev.rev })) + ' · ' + esc(t('dcw.notSubmitted')), x.doc.ownerId); });
    var pub = ws.awaitingPub.map(function (x) { return item('doc.' + x.doc.id + '.' + x.rev.rev + '.publish', 'ok', recLinkPlain(x.doc) + ' ' + esc(x.doc.title), esc(t('doc.revShort', { rev: x.rev.rev })) + ' · ' + esc(t('rstat4.' + x.rev.status)), x.doc.ownerId); });
    var miss = ws.missing.map(function (c) { return item('doc.' + c.doc.id, 'warn', recLinkPlain(c.doc) + ' ' + esc(c.doc.title), esc(t('dcw.missingFields', { f: c.fields.map(function (x) { return t('dcf.' + x); }).join(', ') })), c.owner); });
    var sup = ws.superseded.map(function (c) { return item(null, c.closed ? 'info' : 'warn', recLink(c.link.kind, c.link.id) + ' → ' + recLinkPlain(c.doc), esc(t('dv.flag.' + c.flag.state, { cur: c.flag.current || '—' })) + ' · ' + esc(t('dv.cites', { rev: c.link.rev })) + (c.closed ? ' · ' + esc(t('dcw.closedRecord')) : ''), c.owner); });
    var rs = st.requirementSets(), reqRows = Object.keys(rs.sets).map(function (pk) {
      var w = st.get('package', pk); if (!w || !st.canSee(u.id, 'package', w)) return '';
      return '<li><span class="t"><b>' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></b><span>' + st.requirementStatus(u.id, pk).map(function (x) { return (x.met ? pill('ok', t('dtype.' + x.category)) : pill(x.inProgress ? 'warn' : 'crit', t('dtype.' + x.category) + ' · ' + t(x.inProgress ? 'dcw.inProgress' : 'dcw.missingDoc'))); }).join(' ') + '</span></span></li>';
    }).join('');
    var reqCard = card(esc(t('dcw.requirements')), '<div class="card-b stack">' + (rs.example ? '<div class="notice warn">' + ic('info') + '<span>' + esc(t('dcw.exampleSet')) + '</span></div>' : '') + (reqRows ? '<ul class="doclist">' + reqRows + '</ul>' : '<p class="muted">' + esc(t('dcw.noRequirements')) + '</p>') + '<p class="field-hint">' + esc(t('dcw.reqRule')) + '</p></div>');
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), 'documents'], [t('nav.doccontrol'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('dcw.title')) + '</h1><p>' + esc(t('dcw.sub')) + '</p></div><div class="row"><a class="btn btn-secondary" ' + go('docchecks') + '>' + esc(t('nav.docchecks')) + '</a><a class="btn btn-primary" ' + go('docnew') + '>' + pic('plus') + esc(t('dc.register')) + '</a></div></div>' +
      '<div class="grid g-home"><div class="grid">' + sec('dcw.uploads', uploads, 'dcw.uploads.hint') + sec('dcw.overdue', overdue) + sec('dcw.pending', pending) + sec('dcw.awaitingPub', pub, 'dcw.pub.hint') + '</div><div class="grid">' + sec('dcw.drafts', drafts) + sec('dcw.missing', miss) + sec('dcw.superseded', sup, 'dv.flagNote') + reqCard + '</div></div>';
  }
  function reviewOverdueTone(x) { return ST().reviewOverdue(x.rev) ? 'crit' : 'info'; }
  function recLinkPlain(d) { return recLink('document', d.id); }

  // ---------------------------------------------------------------- 9. document checks
  function checksPage(u) {
    var st = ST(), s = S(); if (!s.dchk) s.dchk = { project: '' };
    var projects = st.visibleProjects(u.id).filter(function (p) { return st.isStaffFor(u.id, { projectId: p.id }); });
    var pid = s.dchk.project || '';
    var checks = st.docChecks(u.id, pid || null), sug = st.docSuggestions(u.id, pid || null);
    var ORDER = ['routing_not_configured', 'missing_metadata', 'duplicate_file', 'file_not_validated', 'overdue_review', 'revision_conflict', 'incomplete_set', 'superseded_reference'];
    var rows = ORDER.map(function (k) {
      var list = checks.filter(function (c) { return c.check === k; });
      return '<details class="check-grp"' + (list.length ? ' open' : '') + '><summary><span class="sev ' + (list.length ? (k === 'overdue_review' || k === 'file_not_validated' || k === 'revision_conflict' ? 'crit' : 'warn') : 'ok') + '"></span><b>' + esc(t('chk.' + k)) + '</b> <span class="pill ' + (list.length ? 'warn' : 'ok') + ' num">' + list.length + '</span><span class="muted">' + esc(t('chk.' + k + '.d')) + '</span></summary>' +
        (list.length ? '<ul class="doclist">' + list.map(function (c) { return '<li>' + checkLine(u, c) + '<span class="muted chk-owner">' + esc(t('dcw.owner')) + ': ' + esc(c.owner ? person(c.owner) : t('dc.missing')) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted card-b">' + esc(t('chk.clear')) + '</p>') + '</details>';
    }).join('');
    var sugRows = sug.length ? '<ul class="doclist">' + sug.map(function (x) { return '<li>' + recLink('document', x.doc.id) + '<span class="t"><b>' + esc(t('sug.' + x.rule, x.evidence)) + '</b><span>' + esc(t('ai.evidence')) + ': ' + esc(Object.keys(x.evidence).map(function (k) { return x.evidence[k]; }).join(' · ')) + '</span></span>' + pill('info', t('sug.unverified')) + '</li>'; }).join('') + '</ul>' : emptyBox('ai', t('sug.none'));
    return crumbs([[t('nav.home'), 'home'], [t('nav.documents'), 'documents'], [t('nav.docchecks'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('chk.title')) + '</h1><p>' + esc(t('chk.sub')) + '</p></div></div>' +
      '<section class="card card-b act-tools"><div class="field"><label for="chk-project">' + esc(t('nav.projects')) + '</label><select id="chk-project" class="select" data-pbind="dchk.project"><option value="">' + esc(t('f.all')) + '</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (pid === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select></div></section>' +
      card(esc(t('chk.det')) + ' <span class="pill plain num">' + checks.length + '</span>', '<div class="card-b stack">' + rows + '<p class="field-hint">' + esc(t('chk.detNote')) + '</p></div>') +
      card(pic('ai') + ' ' + esc(t('chk.ai')) + ' <span class="pill plain num">' + sug.length + '</span>', '<div class="card-b stack"><div class="notice warn">' + ic('info') + '<span>' + esc(t('chk.aiNote')) + '</span></div>' + sugRows + '<div class="notice">' + ic('documents') + '<span>' + esc(t('chk.noExtraction')) + '</span></div></div>');
  }
  function checkLine(u, c) {
    var st = ST();
    switch (c.check) {
      case 'routing_not_configured': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(t('dv.routingMissing')) + '</b><span>' + esc(st.get('project', c.doc.projectId).code + ' · ' + t('dtype.' + c.doc.category)) + '</span></span>';
      case 'missing_metadata': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(c.doc.title) + '</b><span>' + esc(t('dcw.missingFields', { f: c.fields.map(function (x) { return t('dcf.' + x); }).join(', ') })) + '</span></span>';
      case 'overdue_review': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(c.doc.title) + ' · ' + esc(t('doc.revShort', { rev: c.rev })) + '</b><span>' + esc(t('dcw.overdueSince', { date: fd(c.due) })) + ' · ' + esc(t('dcw.pendingWith', { who: c.pending.map(person).join(', ') })) + '</span></span>';
      case 'duplicate_file': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(t('chk.dupWith', { a: c.doc.number + ' ' + c.rev, b: c.other.number + ' ' + c.other.rev })) + '</b></span>';
      case 'file_not_validated': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(t('dv.val.mismatch')) + '</b><span>' + esc(t('doc.revShort', { rev: c.rev })) + '</span></span>';
      case 'revision_conflict': return recLink('document', c.doc.id) + '<span class="t"><b>' + esc(t('chk.conflict.' + c.detail)) + '</b></span>';
      case 'incomplete_set': return '<span class="t"><b>' + svcTag(c.pkg.service) + ' <span class="mono">' + esc(c.pkg.code) + '</span></b><span>' + esc(t('chk.missingCats', { list: c.missing.map(function (m) { return t('dtype.' + m.category) + (m.inProgress ? ' (' + t('dcw.inProgress') + ')' : ''); }).join(', ') })) + (c.example ? ' · ' + esc(t('chk.exampleOnly')) : '') + '</span></span>';
      case 'superseded_reference': return recLink(c.link.kind, c.link.id) + '<span class="t"><b>' + esc(t('dv.cites', { rev: c.link.rev })) + ' — ' + esc(c.doc.number) + '</b><span>' + esc(t('dv.flag.' + c.flag.state, { cur: c.flag.current || '—' })) + (c.closed ? ' · ' + esc(t('dcw.closedRecord')) : '') + '</span></span>';
    }
    return '';
  }

  // ---------------------------------------------------------------- 7. evidence library
  function evState() { var s = S(); if (!s.evf) s.evf = { project: '', package: '', area: '', linked: '' }; return s.evf; }
  function evTile(u, e) {
    var st = ST(), a = U().byId(U().D.areas, e.areaId), w = st.get('package', e.packageId), f = e.fileId && st.get('file', e.fileId), url = f && blobUrl(f.id);
    var media = url && /^image\//.test(f.type) && f.type !== 'image/heic' ? '<img src="' + url + '" alt="' + esc(e.caption) + '" class="ev-img">' : pic('camera') + '<span>' + esc(t(f ? (url ? 'evl.noPreview' : 'dv.notRetained') : 'ev.nofile')) + '</span>';
    return '<figure class="evidence"><a class="ev-media' + (url ? '' : ' nofile') + '" ' + go('ev.' + e.id) + ' aria-label="' + esc(e.ref) + '">' + media + '<span class="ev-badge">' + esc(t('ev.badge')) + '</span>' + (e.audience === 'internal' ? '<span class="ev-int">' + esc(t('misc.internal')) + '</span>' : '') + '</a>' +
      '<figcaption><b class="mono"><a ' + go('ev.' + e.id) + '>' + esc(e.ref) + '</a></b><span>' + esc(e.caption) + '</span><dl class="ev-meta"><dt>' + esc(t('evl.uploaded')) + '</dt><dd class="num">' + esc(fdt(e.uploadedAt)) + ' · ' + esc(person(e.uploadedBy)) + ' <span class="vtag ok">' + esc(t('evl.verified')) + '</span></dd>' +
      '<dt>' + esc(t('ev.captured')) + '</dt><dd class="num">' + (e.capturedAt ? esc(fdt(e.capturedAt)) + ' <span class="vtag">' + esc(t('evl.stated')) + '</span>' : '<span class="muted">' + esc(t('evl.notStated')) + '</span>') + '</dd>' +
      '<dt>' + esc(t('ev.where')) + '</dt><dd>' + esc(a ? L(a, 'name') : '') + ' · <span class="mono">' + esc(w.code) + '</span></dd>' + (e.linked ? '<dt>' + esc(t('ev.linked')) + '</dt><dd>' + recLink(e.linked.kind, e.linked.id) + '</dd>' : '') + '</dl></figcaption></figure>';
  }
  function evidencePage(u) {
    var st = ST(), f = evState(), projects = st.visibleProjects(u.id);
    var list = st.evidence(u.id, f.project || null, f.package || null).filter(function (e) { return (!f.area || e.areaId === f.area) && (!f.linked || (e.linked && e.linked.kind === f.linked)); }).sort(function (a, b) { return (a.uploadedAt || '') < (b.uploadedAt || '') ? 1 : -1; });
    var pkgs = []; projects.forEach(function (p) { if (!f.project || f.project === p.id) pkgs = pkgs.concat(st.visiblePackages(u.id, p.id)); });
    var canUp = projects.some(function (p) { return st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'evidence.upload', { packageId: w.id }) || can(u.id, 'photo.upload', { packageId: w.id }); }); });
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="evf.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    return crumbs([[t('nav.home'), 'home'], [t('nav.evidence'), null]]) + '<div class="page-h"><div><h1>' + esc(t('evl.title')) + '</h1><p>' + esc(t('evl.sub')) + '</p></div>' + (canUp ? '<a class="btn btn-primary" ' + go('evnew') + '>' + ic('camera') + esc(t('evl.upload')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('camera') + '<span>' + esc(t('evl.rule')) + '</span></div>' +
      '<section class="card card-b act-tools">' + sel('evf-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) +
      sel('evf-package', 'package', t('misc.package'), [['', t('f.all')]].concat(pkgs.map(function (w) { return [w.id, w.code]; }))) +
      sel('evf-linked', 'linked', t('ev.linked'), [['', t('f.all')], ['inspection', t('kindname.inspection')], ['corrective', t('kindname.corrective')], ['request', t('kindname.request')], ['document', t('kindname.document')]]) + '</section>' +
      '<p class="muted" role="status">' + esc(t('evl.count', { n: list.length })) + '</p>' + (list.length ? '<div class="ev-grid">' + list.map(function (e) { return evTile(u, e); }).join('') + '</div>' : emptyBox('camera', t('ev.none')));
  }
  function enState() { var s = S(); if (!s.en) s.en = { values: { audience: 'customer' }, errors: {}, key: 'ev-' + X.rnd() }; return s.en; }
  function evidenceNew(u) {
    var st = ST(), en = enState(), v = en.values, e = en.errors;
    var projects = st.visibleProjects(u.id).filter(function (p) { return st.visiblePackages(u.id, p.id).some(function (w) { return can(u.id, 'evidence.upload', { packageId: w.id }) || can(u.id, 'photo.upload', { packageId: w.id }); }); });
    if (!projects.length) return U().deniedState({ code: 'role' }, null);
    if (!v.projectId && projects.length === 1) v.projectId = projects[0].id;
    var fe = function (k, id) { return e[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(e[k])) + '</div>' : ''; };
    var inv = function (k, id) { return e[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; };
    var body = '<div class="field"><label for="en-project">' + esc(t('nav.projects')) + '</label><select id="en-project" class="select" data-enbind="projectId"><option value="">' + esc(t('dlg.choose')) + '</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (v.projectId === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select></div>';
    if (v.projectId) {
      var pkgs = st.visiblePackages(u.id, v.projectId).filter(function (w) { return can(u.id, 'evidence.upload', { packageId: w.id }) || can(u.id, 'photo.upload', { packageId: w.id }); });
      var w = v.packageId && st.get('package', v.packageId);
      var areas = w ? st.areas(v.projectId).filter(function (a) { return a.id === w.areaId || a.parentId === w.areaId; }) : [];
      var targets = w ? st.inspections(u.id, v.projectId, w.id).map(function (i) { return ['inspection:' + i.id, i.ref + ' · ' + i.title]; }).concat(st.correctives(u.id, v.projectId, w.id).map(function (c) { return ['corrective:' + c.id, c.ref + ' · ' + c.title]; }), st.requests(u.id, v.projectId).filter(function (r) { return r.packageId === w.id; }).map(function (r) { return ['request:' + r.id, r.ref + ' · ' + r.subject]; })) : [];
      body += '<div class="grid g-2"><div class="field"><label for="en-package">' + esc(t('misc.package')) + '</label><select id="en-package" class="select" data-enbind="packageId"' + inv('packageId', 'en-package') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + pkgs.map(function (x) { return '<option value="' + x.id + '"' + (v.packageId === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + t('svc.' + x.service)) + '</option>'; }).join('') + '</select>' + fe('packageId', 'en-package') + '</div>' +
        '<div class="field"><label for="en-area">' + esc(t('rq.area')) + '</label><select id="en-area" class="select" data-enbind="areaId"' + inv('areaId', 'en-area') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (v.areaId === a.id ? ' selected' : '') + '>' + esc(a.code + ' · ' + L(a, 'name')) + '</option>'; }).join('') + '</select>' + fe('areaId', 'en-area') + '</div></div>' +
        '<div class="field"><label for="en-linked">' + esc(t('evl.linkTo')) + ' ' + esc(t('dlg.optional')) + '</label><select id="en-linked" class="select" data-enbind="linked"><option value="">' + esc(t('evl.noLink')) + '</option>' + targets.map(function (x) { return '<option value="' + x[0] + '"' + (v.linked === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="en-caption">' + esc(t('dlg.caption')) + '</label><input id="en-caption" class="input" maxlength="160" data-entext="caption" value="' + esc(v.caption || '') + '"' + inv('caption', 'en-caption') + '>' + fe('caption', 'en-caption') + '</div>' +
        '<div class="field"><label for="en-captured">' + esc(t('evl.capturedAt')) + ' ' + esc(t('dlg.optional')) + '</label><input id="en-captured" type="datetime-local" class="input" max="' + st.today + 'T23:59" data-enbind="capturedAt" value="' + esc(v.capturedAt || '') + '"' + inv('capturedAt', 'en-captured') + '><span class="field-hint">' + esc(t('evl.capturedHint')) + '</span>' + fe('capturedAt', 'en-captured') + '</div>' +
        (st.isCustomer(u.id) ? '' : '<fieldset class="field"><legend class="label">' + esc(t('dn.audience')) + '</legend><div class="row"><label class="check"><input type="radio" name="en-aud" data-enbind="audience" value="customer"' + (v.audience !== 'internal' ? ' checked' : '') + '> ' + esc(t('evl.aud.customer')) + '</label><label class="check"><input type="radio" name="en-aud" data-enbind="audience" value="internal"' + (v.audience === 'internal' ? ' checked' : '') + '> ' + esc(t('evl.aud.internal')) + '</label></div></fieldset>') +
        (v.packageId ? X.uploadControl('evnew', t('evl.photo')) : '<p class="muted">' + esc(t('evl.pickPackage')) + '</p>') + fe('fileId', 'en-file');
    }
    return crumbs([[t('nav.home'), 'home'], [t('nav.evidence'), 'evidence'], [t('evl.upload'), null]]) + '<div class="page-h"><div><h1>' + esc(t('evl.upload')) + '</h1><p>' + esc(t('evl.uploadSub')) + '</p></div></div>' +
      card(esc(t('dn.details')), '<form class="card-b stack" data-form="evnew" novalidate>' + (en.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(en.serverError)) + '</span></div>' : '') + body +
        '<div class="notice">' + ic('info') + '<span>' + esc(t('evl.metaRule')) + '</span></div><div class="dlg-actions"><a class="btn btn-secondary" ' + go('evidence') + '>' + esc(t('dlg.cancel')) + '</a><button class="btn btn-primary" type="submit">' + esc(t('evl.save')) + '</button></div></form>');
  }
  function submitEvidence() {
    var en = S().en, v = en.values, u = me();
    en.errors = {}; en.serverError = null;
    if (!v.packageId) en.errors.packageId = 'err.missing_package';
    if (!v.areaId) en.errors.areaId = 'err.missing_area';
    if (!v.caption || v.caption.trim().length < 5) en.errors.caption = 'dlg.err.caption';
    if (v.capturedAt && v.capturedAt.slice(0, 10) > ST().today) en.errors.capturedAt = 'err.capture_in_future';
    if (X.uploadsBusy('evnew')) en.errors.fileId = 'up.err.busy'; else if (X.uploadsFailed('evnew')) en.errors.fileId = 'up.err.failedPending'; else if (!doneFile('evnew')) en.errors.fileId = 'dlg.err.file';
    if (Object.keys(en.errors).length) { U().render(); X.focusInvalid(); return; }
    var link = v.linked ? { kind: v.linked.split(':')[0], id: v.linked.split(':')[1] } : null;
    var r = API().dispatch('evidence.upload', u.id, { idempotencyKey: en.key, packageId: v.packageId, areaId: v.areaId, caption: v.caption, capturedAt: v.capturedAt || null, linked: link, audience: v.audience, fileId: doneFile('evnew') });
    if (r.ok) { S().en = null; if (S().uploads) delete S().uploads.evnew; U().toast(t('evl.saved', { ref: r.result.ref })); U().go('ev.' + r.result.id); return; }
    en.serverError = r.code; U().render();
  }
  function evidenceDetail(u, args) {
    var st = ST(), e = st.get('evidence', args[0]);
    var g = h.guard(u, 'evidence', e); if (g) return g;
    var f = e.fileId && st.get('file', e.fileId), url = f && blobUrl(f.id);
    var media = !f ? emptyBox('camera', t('ev.nofile'), t('evl.fixtureNote')) : !url ? emptyBox('camera', t('dv.notRetained'), t('dv.notRetained.d')) : /^image\/(jpeg|png|webp)$/.test(f.type) ? '<div class="pv"><img class="pv-img" src="' + url + '" alt="' + esc(e.caption) + '" data-pverr="1"><div class="pv-failed" hidden>' + emptyBox('alert', t('dv.previewFailed'), t('dv.previewFailed.d')) + '</div></div>' : f.type === 'application/pdf' ? '<div class="pv"><iframe class="pv-frame" title="' + esc(e.ref) + '" src="' + url + '"></iframe></div>' : emptyBox('camera', t('dv.noPreview', { type: f.name.split('.').pop().toUpperCase() }), t('dv.noPreview.d'));
    var a = U().byId(U().D.areas, e.areaId), w = st.get('package', e.packageId);
    var verified = kv([[t('evl.uploadedBy'), esc(person(e.uploadedBy))], [t('evl.uploadedAt'), esc(fdt(e.uploadedAt))], f ? [t('dv.sha'), '<span class="mono">' + esc((f.sha256 || '—').slice(0, 16)) + '…</span>'] : null, f ? [t('dv.validation'), f.validation === 'ok' ? pill('ok', t('dv.val.ok')) : pill('warn', t('dv.val.' + (f.validation || 'unchecked')))] : null, [t('dv.scan'), pill('warn', t('dv.scan.none'))]]);
    var stated = kv([[t('ev.captured'), e.capturedAt ? esc(fdt(e.capturedAt)) : '<span class="muted">' + esc(t('evl.notStated')) + '</span>'], [t('dlg.caption'), esc(e.caption)], [t('ev.where'), esc(a ? a.code + ' · ' + L(a, 'name') : '') + ' · ' + recLink('package', w.id)], e.linked ? [t('ev.linked'), recLink(e.linked.kind, e.linked.id)] : null]);
    var canVer = e.uploadedBy === u.id || can(u.id, 'photo.upload', { packageId: e.packageId });
    var vers = '<ol class="revlist"><li><b>' + esc(t('evl.original')) + '</b><span class="muted">' + esc(person(e.uploadedBy) + ' · ' + fdt(e.uploadedAt)) + '</span></li>' + (e.versions || []).map(function (x, i) { return '<li><b>' + esc(t('evl.edited', { n: i + 1 })) + '</b><span>' + esc(x.note) + '</span><span class="muted">' + esc(person(x.by) + ' · ' + fdt(x.at)) + '</span>' + (X.BLOBS[x.fileId] ? '<button type="button" class="linkbtn" data-pact="doc-dl" data-v="' + x.fileId + '">' + esc(t('dv.download')) + '</button>' : '') + '</li>'; }).join('') + '</ol>';
    var addVer = canVer ? '<details class="explain"><summary>' + esc(t('evl.addVersion')) + '</summary><form class="stack" data-form="evver" novalidate>' + X.uploadControl('evver-' + e.id, t('evl.editedFile')) + '<div class="field"><label for="evv-note">' + esc(t('evl.whatEdited')) + '</label><input id="evv-note" name="note" class="input"></div><div class="dlg-actions"><button class="btn btn-secondary" type="submit">' + esc(t('evl.saveVersion')) + '</button></div></form></details>' : '';
    return crumbs([[t('nav.home'), 'home'], [t('nav.evidence'), 'evidence'], [e.ref, null]]) +
      '<div class="page-h"><div><span class="eyebrow">' + esc(t('ev.badge')) + ' · <span class="mono">' + esc(e.ref) + '</span></span><h1>' + esc(e.caption) + '</h1></div>' + (e.audience === 'internal' ? pill('plain', t('misc.internal')) : '') + '</div>' +
      '<div class="grid g-home"><div class="grid">' + card(esc(t('dv.viewer')), '<div class="card-b stack">' + media + (f ? '<div class="row"><button type="button" class="btn btn-secondary btn-sm" data-pact="doc-dl" data-v="' + f.id + '">' + ic('download') + esc(t('dv.download')) + '</button></div>' : '') + '</div>') +
      card(esc(t('evl.versions')), '<div class="card-b stack">' + vers + addVer + '<p class="field-hint">' + esc(t('evl.versionRule')) + '</p></div>') + '</div><div class="grid">' +
      card(esc(t('evl.verifiedMeta')), '<div class="card-b">' + verified + '<p class="field-hint">' + esc(t('evl.verifiedNote')) + '</p></div>') + card(esc(t('evl.statedMeta')), '<div class="card-b">' + stated + '<p class="field-hint">' + esc(t('evl.statedNote')) + '</p></div>') + '</div></div>' +
      '<div class="row back-row"><a class="btn btn-secondary" ' + go('evidence') + '>' + ic('arrow', 'flip back') + esc(t('evl.back')) + '</a>' + (e.linked ? '<a class="btn btn-ghost" ' + go(h.routeOf(e.linked.kind, e.linked.id)) + '>' + esc(t('evl.backLinked')) + '</a>' : '') + '</div>';
  }

  // ---------------------------------------------------------------- downloads (access checked and audited on every open)
  function download(fid) {
    var st = ST(), f = st.get('file', fid);
    var r = API().dispatch('file.download', me().id, { fileId: fid });
    if (!r.ok) { U().toast(t('file.denied')); return; }
    var b = X.BLOBS[fid];
    if (!b) { U().toast(t('file.notRetained', { name: f.name })); return; }
    var a = document.createElement('a'); a.href = blobUrl(fid); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    U().toast(t('dv.downloaded'));
  }

  // ---------------------------------------------------------------- events
  function onAct(act, el, ev) {
    var v = el.getAttribute('data-v');
    switch (act) {
      case 'dc-view': dcState().view = v; U().render(); return true;
      case 'dn-clear': S().dn = null; save(DN_KEY, null); if (S().uploads) delete S().uploads.docnew; U().render(); return true;
      case 'dd-form': { var dd = S().dd; dd.form = v || null; dd.errors = {}; dd.values = {}; dd.serverError = null; dd.pubKey = null; U().render(); var fh = document.querySelector('.rd-form h3'); if (fh) fh.focus(); return true; }
      case 'doc-dl': download(v); return true;
      case 'tr-ack': {
        var r = API().dispatch('transmittal.acknowledge', me().id, { id: v, idempotencyKey: 'ack-' + v + '-' + me().id });
        U().toast(r.ok ? t('tr.ackSaved') : err(r.code)); U().render(); return true;
      }
    }
    return false;
  }
  // Keep everything typed in the surrounding form before a re-render (for example when a file is chosen).
  function snapshotForm(form) {
    if (!form) return;
    var s = S(), f = form.getAttribute('data-form') || '';
    Array.from(form.elements).forEach(function (x) {
      if (!x.name && !x.getAttribute('data-dntext') && !x.getAttribute('data-entext')) return;
      if (x.type === 'file' || x.type === 'checkbox' || x.type === 'radio') return;
      if (s.dd && /^doc-/.test(f) && x.name) s.dd.values[x.name] = x.value;
      if (s.dn && f === 'docnew' && x.getAttribute('data-dntext')) s.dn.values[x.getAttribute('data-dntext')] = x.value;
      if (s.en && f === 'evnew' && x.getAttribute('data-entext')) s.en.values[x.getAttribute('data-entext')] = x.value;
    });
    if (s.dn && f === 'docnew') persistDn();
  }
  function onChange(el) {
    var s = S();
    if (el.hasAttribute('data-upctx')) { snapshotForm(el.form); return false; } // the upload itself is handled by the shared control
    if (s.dd && el.form && /^doc-/.test(el.form.getAttribute('data-form') || '') && el.name && el.type !== 'checkbox' && el.type !== 'radio' && !el.hasAttribute('data-ddsub')) { s.dd.values[el.name] = el.value; return true; }
    var b = el.getAttribute('data-dnbind');
    if (b && s.dn) {
      snapshotForm(el.form);
      s.dn.values[b] = el.type === 'checkbox' ? el.checked : el.value;
      if (b === 'projectId') { s.dn.values.packageIds = []; s.dn.values.areaId = ''; s.dn.values.reviewers = []; s.dn.values.links = []; s.dn.values.ownerId = ''; }
      persistDn(); U().render(); var again = document.getElementById(el.id); if (again) again.focus(); return true;
    }
    var m = el.getAttribute('data-dnmulti');
    if (m && s.dn) { var arr = (s.dn.values[m] || []).filter(function (x) { return x !== el.value; }); if (el.checked) arr.push(el.value); s.dn.values[m] = arr; persistDn(); return true; }
    var lk = el.getAttribute('data-dnlink');
    if (lk && s.dn) { var ls = (s.dn.values.links || []).filter(function (x) { return x !== lk; }); if (el.checked) ls.push(lk); s.dn.values.links = ls; persistDn(); return true; }
    if (el.hasAttribute('data-dntext') && s.dn) { s.dn.values[el.getAttribute('data-dntext')] = el.value; persistDn(); return true; }
    var eb = el.getAttribute('data-enbind');
    if (eb && s.en) { snapshotForm(el.form); s.en.values[eb] = el.value; if (eb === 'projectId') { s.en.values.packageId = ''; s.en.values.areaId = ''; s.en.values.linked = ''; } if (eb === 'packageId') { s.en.values.areaId = ''; s.en.values.linked = ''; } U().render(); var a2 = document.getElementById(el.id); if (a2) a2.focus(); return true; }
    if (el.hasAttribute('data-entext') && s.en) { s.en.values[el.getAttribute('data-entext')] = el.value; return true; }
    if (el.hasAttribute('data-ddsub') && s.dd) { snapshotForm(el.form); var form = el.form; Array.from(form.elements).forEach(function (x) { if (x.name && x.type !== 'checkbox' && x.type !== 'radio') s.dd.values[x.name] = x.value; }); s.dd.values.submit = el.checked ? '1' : ''; U().render(); return true; }
    if (el.form && el.form.getAttribute('data-form') === 'doc-review' && el.name === 'outcome' && s.dd) { Array.from(el.form.elements).forEach(function (x) { if (x.name && (x.type !== 'radio' || x.checked)) s.dd.values[x.name] = x.value; }); U().render(); var o = document.querySelector('input[name=outcome][value="' + el.value + '"]'); if (o) o.focus(); return true; }
    return false;
  }
  function onInput(el) {
    var s = S();
    if (el.id === 'dc-q') { dcState().q = el.value; var c = el.selectionStart; U().render(); var a = document.getElementById('dc-q'); if (a) { a.focus(); try { a.setSelectionRange(c, c); } catch (e) {} } return true; }
    if (el.hasAttribute('data-dntext') && s.dn) { s.dn.values[el.getAttribute('data-dntext')] = el.value; persistDn(); return true; }
    if (el.hasAttribute('data-entext') && s.en) { s.en.values[el.getAttribute('data-entext')] = el.value; return true; }
    if (s.dd && el.form && /^doc-/.test(el.form.getAttribute('data-form') || '') && el.name && el.type !== 'checkbox' && el.type !== 'radio') { s.dd.values[el.name] = el.value; return true; }
    return false;
  }
  function onSubmit(form) {
    var f = form.getAttribute('data-form');
    if (f === 'docnew') { submitRegister(); return true; }
    if (f === 'doc-comment') { submitComment(form); return true; }
    if (/^doc-/.test(f)) { submitDocForm(form); return true; }
    if (f === 'evnew') { submitEvidence(); return true; }
    if (f === 'evver') {
      var id = (location.hash || '').slice(1).split('.')[1], e = ST().get('evidence', id), note = (new FormData(form).get('note') || '').toString().trim(), fid = doneFile('evver-' + id);
      if (!fid || note.length < 3) { U().toast(t(!fid ? 'dn.err.file' : 'rd.err.reason')); return true; }
      var r = API().dispatch('evidence.addVersion', me().id, { id: id, version: e.version, fileId: fid, note: note });
      if (r.ok) { if (S().uploads) delete S().uploads['evver-' + id]; U().toast(t('evl.versionSaved')); } else U().toast(err(r.code));
      U().render(); return true;
    }
    return false;
  }
  // A preview that fails to load shows an accurate fallback instead of a broken frame.
  document.addEventListener('error', function (ev) {
    var el = ev.target;
    if (el && el.getAttribute && el.getAttribute('data-pverr')) { el.hidden = true; var fb = el.parentNode.querySelector('.pv-failed'); if (fb) fb.hidden = false; }
  }, true);

  P.extend({
    bases: { doc: documentDetail, docnew: registerPage, tr: transmittalPage, ev: evidenceDetail, evnew: evidenceNew },
    modules: { documents: documentsPage, docreview: reviewPage, doccontrol: controlPage, docchecks: checksPage, evidence: evidencePage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit
  });
  window.RGSPages4 = { download: download, blobUrl: blobUrl };
})();
