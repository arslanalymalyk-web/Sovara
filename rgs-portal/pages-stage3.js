/*
 * RGS Client Portal — Stage 3 pages: request centre, guided request flow, request detail, RGS triage,
 * instruction and change control, approval inbox, decision page, notifications.
 *
 * Pages read only from the store (store.js) and change records only through the command layer (api.js),
 * which re-checks permissions, state, versions and idempotency for every action.
 */
(function () {
  'use strict';
  var P = window.RGSPages, h = P._h;
  var t = h.t, esc = h.esc, pic = h.pic, recLink = h.recLink, go = h.go, pill = h.pill, sp = h.sp, card = h.card, table = h.table, kv = h.kv,
    crumbs = h.crumbs, emptyBox = h.emptyBox, dueCell = h.dueCell, fd = h.fd, ftime = h.ftime, person = h.person, L = h.L, svcTag = h.svcTag;
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function API() { return U().API; }
  function me() { return U().user(); }
  function ic(n, c) { return U().ic(n, c); }
  function rnd() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function fdt(d) { return d ? fd(d) + (d.length > 10 ? ' ' + ftime(d) : '') : '—'; }
  function err(code) { var k = 'err.' + code; var v = U().t(k); return v === k ? t('err.generic', { code: code }) : v; }
  function roleOf(uid) { var u = U().byId(U().D.users, uid); return u ? t('role.' + u.role) : ''; }
  function personRole(uid) { return '<b>' + esc(person(uid)) + '</b> <span class="muted">' + esc(roleOf(uid)) + '</span>'; }
  var BLOBS = {}; // uploaded file contents kept in memory for this session only

  var REQ_TYPES = ['info', 'document', 'inspection', 'site_issue', 'scope_change', 'handover_support'];
  var PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  var REQ_ICON = { info: 'info', document: 'documents', inspection: 'inspections', site_issue: 'corrective', scope_change: 'change', handover_support: 'handover' };
  function typeTag(type) { return '<span class="rtype rt-' + type + '">' + pic(REQ_ICON[type] || 'requests') + esc(t('rtype.' + type)) + '</span>'; }
  function prioPill(p) { return pill({ low: '', normal: 'plain', high: 'warn', urgent: 'crit' }[p] || '', t('prio.' + p)); }
  function reqStatus(s) { return sp('req', s, 'rstatus'); }
  function insState(s) { return sp('chg', s, 'chstatus'); }
  var DEC_ICON = { internal_review: 'inspections', customer_approval: 'change', execution_authorisation: 'shield', technical_signoff: 'sign', completion_acceptance: 'accept',
    document_ack: 'ack', inspection_signoff: 'sign', customer_acceptance: 'accept', change_approval: 'change', request_verify: 'check', request_ack: 'ack' };
  function decBadge(type) { return '<span class="dtype dt-' + type + '">' + pic(DEC_ICON[type] || 'approvals') + esc(t('dtype2.' + type)) + '</span>'; }

  // ---------------------------------------------------------------- command runner
  function run(cmd, payload, opts) {
    opts = opts || {};
    var r = API().dispatch(cmd, me().id, payload);
    if (r.ok) { if (opts.ok) opts.ok(r.result, r); if (opts.toast) U().toast(opts.toast); }
    else if (opts.fail) opts.fail(r);
    if (!opts.noRender) U().render();
    return r;
  }

  // ---------------------------------------------------------------- uploads (simulated transfer, real validation)
  // Each upload has a stable idempotency key, so a retry registers the same file once.
  function uploads(ctx) { var s = S(); s.uploads = s.uploads || {}; return (s.uploads[ctx] = s.uploads[ctx] || []); }
  function sha256(file) {
    if (!window.crypto || !crypto.subtle || !file.arrayBuffer) return Promise.resolve(null);
    return file.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (d) {
      return Array.from(new Uint8Array(d)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    }).catch(function () { return null; });
  }
  // Upload profiles let later stages reuse this control with their own types, limits and registration payload.
  var PROFILES = [];
  function profileFor(ctx) { return PROFILES.filter(function (p) { return ctx.indexOf(p.prefix) === 0; })[0] || null; }
  function headHex(file) {
    if (!file || !file.slice) return Promise.resolve(null);
    var part = file.slice(0, 16);
    if (!part.arrayBuffer) return Promise.resolve(null);
    return part.arrayBuffer().then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }).catch(function () { return null; });
  }
  var EXT_TYPE = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', dwg: 'image/vnd.dwg',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  function guessType(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? EXT_TYPE[m[1].toLowerCase()] || 'application/octet-stream' : 'application/octet-stream'; }
  function startUpload(ctx, item, onDone) {
    var prof = profileFor(ctx);
    var types = prof ? prof.types : API().FILE_TYPES, max = prof ? prof.max : API().MAX_FILE;
    if (types.indexOf(item.type) < 0) { item.status = 'rejected'; item.error = prof ? prof.typeError : 'dlg.err.fileType'; U().render(); return; }
    if (item.size > max || item.size <= 0) { item.status = 'rejected'; item.error = prof ? prof.sizeError : 'dlg.err.fileSize'; U().render(); return; }
    item.status = 'uploading'; item.progress = 0; item.error = null; U().render();
    var simulateFail = !!(S().simFail && !item.failedOnce);
    Promise.all([sha256(item.file), headHex(item.file)]).then(function (res) {
      var hash = res[0]; item.sha256 = hash; item.head = res[1];
      var steps = 0;
      var timer = setInterval(function () {
        steps++; item.progress = Math.min(100, steps * 25);
        if (simulateFail && steps === 2) { clearInterval(timer); item.status = 'failed'; item.failedOnce = true; item.error = 'up.err.network'; U().render(); return; }
        if (steps >= 4) {
          clearInterval(timer);
          var payload = Object.assign({ name: item.name, size: item.size, type: item.type, sha256: hash, head: item.head, idempotencyKey: item.key }, prof && prof.payload ? prof.payload(ctx) : {});
          var r = API().dispatch('file.register', me().id, payload);
          if (!r.ok) { item.status = r.code === 'file_type' || r.code === 'file_size' ? 'rejected' : 'failed'; item.error = 'err.' + r.code; U().render(); return; }
          item.status = 'done'; item.fileId = r.result.id; item.validation = r.result.validation; item.quarantined = r.result.quarantined; item.duplicates = r.result.duplicates; BLOBS[item.fileId] = item.file;
          if (onDone) onDone(item);
          U().render();
          return;
        }
        refreshUploadRow(ctx, item);
      }, 180);
    });
  }
  function refreshUploadRow(ctx, item) { var el = document.querySelector('[data-up="' + item.key + '"] .progress > i'); if (el) el.style.width = item.progress + '%'; }
  function addFiles(ctx, files, onDone) {
    Array.prototype.forEach.call(files || [], function (f) {
      var item = { key: 'up-' + rnd(), name: f.name, size: f.size, type: f.type || guessType(f.name), file: f, status: 'queued' };
      uploads(ctx).push(item); startUpload(ctx, item, onDone);
    });
  }
  function fsize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function uploadList(ctx) {
    var list = uploads(ctx);
    if (!list.length) return '';
    return '<ul class="uplist" aria-live="polite">' + list.map(function (it) {
      var state = it.status === 'done' && it.quarantined ? pill('crit', t('up.quarantined')) : it.status === 'done' ? pill('ok', t('up.done')) : it.status === 'failed' ? pill('crit', t('up.failed')) : it.status === 'rejected' ? pill('crit', t('up.rejected')) : pill('info', t('up.uploading'));
      return '<li data-up="' + it.key + '" class="up-' + it.status + '">' + pic('documents') + '<span class="t"><b>' + esc(it.name) + '</b><span class="muted">' + esc(fsize(it.size)) + (it.sha256 ? ' · SHA-256 <span class="mono">' + esc(it.sha256.slice(0, 12)) + '…</span>' : '') + '</span>' +
        (it.status === 'uploading' ? h.bar(it.progress || 0, t('up.uploading')) : '') + (it.error ? '<span class="field-error">' + ic('alert') + esc(t(it.error)) + '</span>' : '') + '</span>' + state +
        '<span class="row">' + (it.status === 'failed' ? '<button type="button" class="btn btn-secondary btn-sm" data-pact="up-retry" data-ctx="' + ctx + '" data-v="' + it.key + '">' + esc(t('up.retry')) + '</button>' : '') +
        (it.status !== 'uploading' ? '<button type="button" class="btn btn-ghost btn-sm" data-pact="up-remove" data-ctx="' + ctx + '" data-v="' + it.key + '" aria-label="' + esc(t('up.remove') + ' ' + it.name) + '">' + pic('x') + '</button>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  function uploadControl(ctx, label) {
    var prof = profileFor(ctx);
    return '<div class="field"><label for="file-' + ctx + '">' + esc(label || t('up.add')) + '</label><input id="file-' + ctx + '" class="input file" type="file"' + (prof && prof.single ? '' : ' multiple') + ' accept="' + (prof ? prof.accept : 'image/jpeg,image/png,image/webp,image/heic,application/pdf') + '"' + (prof && prof.capture ? ' capture="environment"' : '') + ' data-upctx="' + ctx + '">' +
      '<span class="field-hint">' + esc(t(prof ? prof.hint : 'dlg.fileHint')) + '</span></div>' + uploadList(ctx) +
      '<label class="check proto-only"><input type="checkbox" id="simfail-' + ctx + '" data-pact="simfail"' + (S().simFail ? ' checked' : '') + '> ' + esc(t('up.simulate')) + '</label>';
  }
  function uploadsBusy(ctx) { return uploads(ctx).some(function (i) { return i.status === 'uploading' || i.status === 'queued'; }); }
  function uploadsFailed(ctx) { return uploads(ctx).some(function (i) { return i.status === 'failed'; }); }
  function doneFileIds(ctx) { return uploads(ctx).filter(function (i) { return i.status === 'done'; }).map(function (i) { return i.fileId; }); }
  function fileChips(ids) {
    var files = ST().filesFor(me().id, ids);
    if (!files.length) return '';
    return '<span class="fchips">' + files.map(function (f) { return '<button type="button" class="rec" data-pact="openfile" data-v="' + f.id + '">' + pic('documents') + '<span>' + esc(f.name) + '</span></button>'; }).join('') + '</span>';
  }

  // ---------------------------------------------------------------- 1. request centre
  function rqState() { var s = S(); if (!s.rq) s.rq = { tab: 'list', q: '', project: '', status: 'open', type: '', priority: '', package: '' }; return s.rq; }
  function canCreateAny(u) { return ST().visibleProjects(u.id).some(function (p) { return U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed; }); }
  function nextText(r) {
    var n = ST().nextAction(r), who = n.who ? person(n.who) : (n.party === 'customer' ? t('party.customer') : 'RGS');
    if (n.key === 'next.none') return '<span class="muted">—</span>';
    var mine = n.who === me().id || (n.party === 'customer' && ST().isCustomer(me().id) && n.key !== 'next.draft');
    return '<span class="next' + (mine ? ' mine' : '') + '">' + esc(t(n.key, { who: who, ref: n.ref || '' })) + '</span>';
  }
  function areaName(id) { var a = U().byId(U().D.areas, id); return a ? a.code + ' · ' + L(a, 'name') : '—'; }
  function requestTableRows(list) {
    return list.map(function (r) {
      var p = ST().get('project', r.projectId), w = r.packageId && ST().get('package', r.packageId);
      return '<tr data-req="' + r.id + '"><td>' + recLink('request', r.id) + '</td><td><a ' + go('req.' + r.id) + '><b>' + esc(r.subject) + '</b></a></td><td>' + esc(L(p, 'name')) + '</td><td>' + (w ? svcTag(w.service) + ' <span class="mono muted">' + esc(w.code) + '</span>' : '—') + '</td>' +
        '<td>' + esc(areaName(r.areaId)) + '</td><td>' + typeTag(r.type) + '</td><td>' + prioPill(r.priority) + '</td><td>' + (r.ownerId ? esc(person(r.ownerId)) : '<span class="muted">' + esc(t('rq.unassigned')) + '</span>') + '</td><td>' + reqStatus(r.status) + '</td><td>' + nextText(r) + '</td><td>' + (r.responseDue ? dueCell(r.responseDue, ST().TERMINAL_REQ.indexOf(r.status) >= 0 || r.status === 'resolved') : '—') + '</td></tr>';
    });
  }
  function requestStack(list) {
    return '<div class="list">' + list.map(function (r) {
      var p = ST().get('project', r.projectId);
      return '<a class="list-row rowlink" ' + go('req.' + r.id) + '><span class="sev ' + ({ clarification_requested: 'warn', submitted: 'info', completion_submitted: 'warn', resolved: 'ok' }[r.status] || '') + '"></span><span class="t"><span class="row" style="gap:6px">' + typeTag(r.type) + reqStatus(r.status) + prioPill(r.priority) + '</span><b>' + esc(r.subject) + '</b>' +
        '<span><span class="mono">' + esc(r.ref) + '</span> · ' + esc(L(p, 'name')) + ' · ' + esc(areaName(r.areaId)) + '</span><span>' + nextText(r) + (r.responseDue ? ' · ' + dueCell(r.responseDue) : '') + '</span></span></a>';
    }).join('') + '</div>';
  }
  function requestTable(list) {
    return '<div class="rq-wide">' + table([t('rq.id'), t('req.subject'), t('nav.projects'), t('misc.package'), t('rq.area'), t('rq.category'), t('rq.priority'), t('rq.owner'), t('f.status'), t('rq.next'), t('rq.due')], requestTableRows(list), 'rqtable') + '</div><div class="rq-narrow">' + requestStack(list) + '</div>';
  }
  function requestCentre(u) {
    var st = ST(), f = rqState(), list = st.requestCentre(u.id, f), all = st.requests(u.id), drafts = st.drafts(u.id);
    var withdrawn = U().D.requests.filter(function (r) { return r.status === 'withdrawn' && r.raisedBy === u.id; });
    var cust = st.isCustomer(u.id);
    var projects = st.visibleProjects(u.id);
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="rq.' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var pk = f.project ? st.visiblePackages(u.id, f.project) : st.visiblePackages(u.id);
    var tools = '<section class="card card-b rq-tools"><div class="field rq-search"><label for="rq-q">' + esc(t('dir.search')) + '</label><div class="control">' + ic('search') + '<input id="rq-q" class="input" type="search" data-live value="' + esc(f.q) + '" placeholder="' + esc(t('rq.search.ph')) + '"></div></div>' +
      sel('rq-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) +
      sel('rq-status', 'status', t('f.status'), [['open', t('rq.f.open')], ['mine_action', t('rq.f.mine')], ['all', t('f.all')]].concat(['submitted', 'clarification_requested', 'in_review', 'completion_submitted', 'resolved', 'closed', 'cancelled', 'superseded'].map(function (s) { return [s, t('rstatus.' + s)]; }))) +
      sel('rq-type', 'type', t('rq.category'), [['', t('f.all')]].concat(REQ_TYPES.map(function (x) { return [x, t('rtype.' + x)]; }))) +
      sel('rq-priority', 'priority', t('rq.priority'), [['', t('f.all')]].concat(PRIORITIES.map(function (x) { return [x, t('prio.' + x)]; }))) +
      sel('rq-package', 'package', t('misc.package'), [['', t('f.all')]].concat(pk.map(function (w) { return [w.id, w.code + ' · ' + t('svc.' + w.service)]; }))) + '</section>';
    var stale = (st.policy.draftStaleDays || 14);
    var draftBody = drafts.length ? '<div class="list">' + drafts.map(function (d) {
      var p = d.projectId && st.get('project', d.projectId);
      var age = Math.floor((new Date(st.today) - new Date((d.updatedAt || d.raisedAt).slice(0, 10))) / 864e5);
      return '<div class="list-row"><span class="sev"></span><div class="t"><b>' + esc(d.subject || t('rq.untitled')) + '</b><span>' + esc(p ? L(p, 'name') : t('rq.noProject')) + ' · ' + esc(t('wiz.step.' + (d.step || 'project'))) + ' · ' + esc(t('rq.savedAt', { date: fdt(d.updatedAt) })) + (age > stale ? ' · <span class="late">' + esc(t('rq.stale', { n: age })) + '</span>' : '') + '</span></div>' +
        '<div class="row-end"><a class="btn btn-primary btn-sm" ' + go('newreq.' + d.id) + '>' + esc(t('rq.continue')) + '</a>' +
        (S().confirmDelete === d.id ? '<span class="row"><button class="btn btn-danger btn-sm" data-pact="draft-delete" data-v="' + d.id + '">' + esc(t('rq.deleteConfirm')) + '</button><button class="btn btn-ghost btn-sm" data-pact="draft-delete-cancel">' + esc(t('dlg.cancel')) + '</button></span>'
          : '<button class="btn btn-ghost btn-sm" data-pact="draft-delete-ask" data-v="' + d.id + '">' + esc(t('rq.delete')) + '</button>') + '</div></div>';
    }).join('') + '</div>' : emptyBox('documents', t('rq.noDrafts'), t('rq.noDrafts.d'));
    if (withdrawn.length) draftBody += '<div class="card-b"><h3 class="sub-h">' + esc(t('rq.withdrawnTitle')) + '</h3><ul class="doclist">' + withdrawn.map(function (d) { return '<li><span class="t"><b>' + esc(d.subject) + '</b><span>' + esc(t('rq.addedTo')) + ' ' + recLink('request', d.withdrawnInto) + '</span></span>' + pill('', t('rstatus.withdrawn')) + '</li>'; }).join('') + '</ul></div>';
    var tabs = '<div class="seg" role="tablist" aria-label="' + esc(t('rq.views')) + '"><button class="btn btn-sm" role="tab" data-pact="rq-tab" data-v="list" aria-selected="' + (f.tab === 'list') + '" aria-pressed="' + (f.tab === 'list') + '">' + esc(t('rq.tab.requests', { n: all.length })) + '</button><button class="btn btn-sm" role="tab" data-pact="rq-tab" data-v="drafts" aria-selected="' + (f.tab === 'drafts') + '" aria-pressed="' + (f.tab === 'drafts') + '">' + esc(t('rq.tab.drafts', { n: drafts.length })) + '</button></div>';
    var triageCount = cust ? 0 : all.filter(function (r) { return r.status === 'submitted' && st.requestControls(u.id, r).triage; }).length;
    var head = crumbs([[t('nav.home'), 'home'], [t('nav.requests'), null]]) + '<div class="page-h"><div><h1>' + esc(t('rq.title')) + '</h1><p>' + esc(t(cust ? 'rq.sub.customer' : 'rq.sub.staff')) + '</p></div><div class="row">' +
      (triageCount ? '<a class="btn btn-secondary" ' + go('triage') + '>' + esc(t('tri.open', { n: triageCount })) + '</a>' : '') +
      (canCreateAny(u) ? '<button class="btn btn-primary" data-pact="newreq">' + pic('plus') + esc(t('qa.request')) + '</button>' : '') + '</div></div>';
    if (f.tab === 'drafts') return head + '<div class="row-between">' + tabs + '</div>' + card(esc(t('rq.draftsTitle')), draftBody) + '<p class="field-hint">' + esc(t('rq.draftNote')) + '</p>';
    var body = list.length ? requestTable(list) : (all.length ? emptyBox('search', t('rq.none'), t('dir.none.d'), '<button class="btn btn-secondary" data-pact="rq-clear">' + esc(t('dir.clear')) + '</button>') : emptyBox('requests', t('st.empty.t'), t('st.empty.d')));
    return head + '<div class="row-between">' + tabs + '<p class="muted" role="status" id="rq-count">' + esc(t('rq.count', { n: list.length, m: all.length })) + '</p></div>' + tools + '<section class="card">' + body + '</section>' +
      '<p class="field-hint">' + esc(t(cust ? 'rq.scope.customer' : 'rq.scope.staff')) + '</p>';
  }
  P.requestRows = function (u, p) {
    var list = ST().requests(u.id, p.id);
    var canReq = U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed;
    var btn = canReq ? '<button class="btn btn-primary btn-sm" data-pact="newreq" data-p="' + p.id + '">' + pic('plus') + esc(t('qa.request')) + '</button>' : '';
    return card(esc(t('tab.requests')), list.length ? requestTable(list) : emptyBox('requests', t('st.empty.t'), t('st.empty.d')), btn);
  };

  // ---------------------------------------------------------------- 2. guided request flow
  var STEPS = ['project', 'package', 'area', 'type', 'description', 'attachments', 'review'];
  function wiz() { var s = S(); s.wiz = s.wiz || {}; return s.wiz; }
  function newRequest(projectId) {
    var u = me(), st = ST();
    var projs = st.visibleProjects(u.id).filter(function (p) { return U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed; });
    var pid = projectId || (projs.length === 1 ? projs[0].id : null);
    var r = API().dispatch('request.saveDraft', u.id, { fields: pid ? { projectId: pid, step: 'package' } : { step: 'project' } });
    if (!r.ok) { U().toast(err(r.code)); return; }
    S().wiz = { draftId: r.result.id };
    U().go('newreq.' + r.result.id);
  }
  function saveDraft(fields, quiet) {
    var w = wiz(), r = API().dispatch('request.saveDraft', me().id, { draftId: w.draftId, fields: fields });
    if (!r.ok) { w.serverError = r.code; if (!quiet) U().render(); return false; }
    w.serverError = null; return true;
  }
  function stepIndex(d) { return Math.max(0, STEPS.indexOf(d.step || 'project')); }
  function stepComplete(d, step) {
    switch (step) {
      case 'project': return !!d.projectId;
      case 'package': return !!d.packageId;
      case 'area': return !!d.areaId;
      case 'type': return !!d.type;
      case 'description': return String(d.subject || '').trim().length >= 3 && String(d.description || '').trim().length >= 10;
      case 'attachments': return true;
      default: return false;
    }
  }
  function choiceCards(name, opts, cur) {
    return '<fieldset class="choices"><legend class="visually-hidden">' + esc(t('wiz.step.' + name)) + '</legend>' + opts.map(function (o) {
      return '<label class="choice' + (o[0] === cur ? ' sel' : '') + '"><input type="radio" name="w-' + name + '" value="' + esc(o[0]) + '" data-wbind="' + name + '"' + (o[0] === cur ? ' checked' : '') + '>' + o[1] + '</label>';
    }).join('') + '</fieldset>';
  }
  function areaOptions(d) {
    var pk = ST().get('package', d.packageId); if (!pk) return [];
    var areas = ST().areas(d.projectId).filter(function (a) { return a.id === pk.areaId || a.parentId === pk.areaId; });
    return areas.map(function (a) { return [a.id, '<span class="t"><b>' + esc(a.code) + ' · ' + esc(L(a, 'name')) + '</b><span class="muted">' + esc(t('kind.' + a.kind)) + (a.parentId ? ' · ' + esc(t('wiz.within', { area: L(ST().get('areas', a.parentId), 'name') })) : '') + '</span></span>']; });
  }
  function suggestType(d) {
    var txt = ((d.subject || '') + ' ' + (d.description || '')).toLowerCase(), best = null;
    var KW = { site_issue: ['loose', 'damaged', 'damage', 'leak', 'leaking', 'broken', 'missing', 'unsafe', 'gap', 'crack', 'falling', 'مفكوك', 'تسرب', 'تالف', 'مكسور'],
      inspection: ['inspect', 'inspection', 'witness', 'hold point', 'test', 'تفتيش', 'فحص'], document: ['drawing', 'document', 'photos', 'photo', 'certificate', 'report', 'copy', 'as-built', 'مخطط', 'وثيقة', 'صور'],
      scope_change: ['additional', 'extra', 'extend', 'extension', 'add a', 'new platform', 'change', 'modify', 'إضافي', 'تعديل', 'توسعة'], handover_support: ['handover', 'walkdown', 'punch', 'تسليم'],
      info: ['when', 'what', 'confirm', 'clarify', 'which', 'متى', 'تأكيد'] };
    Object.keys(KW).forEach(function (k) { var hits = KW[k].filter(function (w) { return txt.indexOf(w) >= 0; }); if (hits.length && (!best || hits.length > best.hits.length)) best = { type: k, hits: hits }; });
    return best && best.type !== d.type ? best : null;
  }
  function wizard(u, args) {
    var st = ST(), w = wiz(), d = st.get('request', args[0]);
    if (!d) return h.guard(u, 'request', null);
    if (d.status !== 'draft') {
      if (d.status === 'withdrawn' && d.raisedBy === u.id) return '<div class="card">' + emptyBox('requests', t('wiz.withdrawn'), '', recLink('request', d.withdrawnInto)) + '</div>';
      return h.guard(u, 'request', d) || '<div class="card">' + emptyBox('requests', t('wiz.alreadySubmitted', { ref: d.ref }), '', '<a class="btn btn-primary" ' + go('req.' + d.id) + '>' + esc(t('wiz.openRequest')) + '</a>') + '</div>';
    }
    if (d.raisedBy !== u.id) return h.guard(u, 'request', d);
    if (w.draftId !== d.id) S().wiz = w = { draftId: d.id };
    var idx = stepIndex(d), step = STEPS[idx], ctx = 'draft-' + d.id;
    var bar = '<ol class="stepper" aria-label="' + esc(t('wiz.progress')) + '">' + STEPS.map(function (s, i) {
      var done = i < idx && stepComplete(d, s), cur = i === idx;
      var inner = '<span class="dot">' + (done ? pic('check') : (i + 1)) + '</span><span class="lbl">' + esc(t('wiz.step.' + s)) + '</span>';
      return '<li class="' + (cur ? 'cur' : done ? 'done' : '') + '"' + (cur ? ' aria-current="step"' : '') + '>' + (done ? '<button type="button" data-pact="wiz-goto" data-v="' + s + '">' + inner + '</button>' : '<span>' + inner + '</span>') + '</li>';
    }).join('') + '</ol>';
    var e = w.errors || {}, body = '';
    var projs = st.visibleProjects(u.id).filter(function (p) { return U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed; });
    if (step === 'project') body = choiceCards('projectId', projs.map(function (p) { return [p.id, h.illus(p.cover, 'choice-img') + '<span class="t"><b>' + esc(L(p, 'name')) + '</b><span class="muted mono">' + esc(p.code) + '</span><span class="muted">' + esc(L(p, 'location')) + ' · ' + esc(t('ptype.' + p.type)) + '</span></span>']; }), d.projectId);
    if (step === 'package') body = choiceCards('packageId', st.visiblePackages(u.id, d.projectId).filter(function (pk) { return U().A.can(U().D, u.id, 'request.create', { packageId: pk.id }).allowed; }).map(function (pk) {
      return [pk.id, '<span class="t"><span>' + svcTag(pk.service) + '</span><b class="mono">' + esc(pk.code) + '</b><span class="muted">' + esc(L(st.get('areas', pk.areaId), 'name')) + '</span></span>'];
    }), d.packageId);
    if (step === 'area') body = choiceCards('areaId', areaOptions(d), d.areaId);
    if (step === 'type') body = choiceCards('type', REQ_TYPES.map(function (x) { return [x, '<span class="t">' + typeTag(x) + '<span class="muted">' + esc(t('rtype.' + x + '.d')) + '</span></span>']; }), d.type) +
      '<p class="notice">' + ic('info') + '<span>' + esc(t('wiz.noAuthorise')) + '</span></p>';
    if (step === 'description') {
      var vs = w.values || {};
      var subj = vs.subject != null ? vs.subject : (d.subject || ''), desc = vs.description != null ? vs.description : (d.description || '');
      body = '<div class="stack"><div class="field"><label for="w-subject">' + esc(t('req.subject')) + '</label><input id="w-subject" class="input" maxlength="120" data-wtext="subject" value="' + esc(subj) + '"' + (e.subject ? ' aria-invalid="true" aria-describedby="w-subject-err"' : '') + '><span class="field-hint num">' + subj.length + '/120</span>' + (e.subject ? '<div id="w-subject-err" class="field-error">' + ic('alert') + esc(t(e.subject)) + '</div>' : '') + '</div>' +
        '<div class="field"><label for="w-description">' + esc(t('wiz.describe')) + '</label><textarea id="w-description" class="textarea" rows="6" maxlength="2000" data-wtext="description"' + (e.description ? ' aria-invalid="true" aria-describedby="w-description-err"' : '') + '>' + esc(desc) + '</textarea><span class="field-hint">' + esc(t('wiz.describe.hint')) + '</span>' + (e.description ? '<div id="w-description-err" class="field-error">' + ic('alert') + esc(t(e.description)) + '</div>' : '') + '</div>' +
        '<div class="grid g-2"><div class="field"><label for="w-priority">' + esc(t('wiz.priority')) + '</label><select id="w-priority" class="select" data-wbind="priority">' + PRIORITIES.map(function (x) { return '<option value="' + x + '"' + (d.priority === x ? ' selected' : '') + '>' + esc(t('prio.' + x)) + '</option>'; }).join('') + '</select><span class="field-hint">' + esc(t('wiz.priority.hint')) + '</span></div>' +
        '<div class="field"><label for="w-needed">' + esc(t('wiz.neededBy')) + ' ' + esc(t('dlg.optional')) + '</label><input id="w-needed" class="input" type="date" data-wbind="neededBy" value="' + esc(d.neededBy || '') + '"></div></div></div>';
    }
    if (step === 'attachments') {
      // files already attached to the draft (e.g. after a reload) plus this session's uploads
      var have = st.filesFor(u.id, d.attachments).filter(function (f) { return !uploads(ctx).some(function (i) { return i.fileId === f.id; }); });
      body = '<div class="stack">' + (have.length ? '<ul class="uplist">' + have.map(function (f) { return '<li class="up-done">' + pic('documents') + '<span class="t"><b>' + esc(f.name) + '</b><span class="muted">' + esc(fsize(f.size)) + '</span></span>' + pill('ok', t('up.done')) + '<button type="button" class="btn btn-ghost btn-sm" data-pact="draft-file-remove" data-v="' + f.id + '" aria-label="' + esc(t('up.remove') + ' ' + f.name) + '">' + pic('x') + '</button></li>'; }).join('') + '</ul>' : '') +
        uploadControl(ctx, t('up.add')) + (e.attachments ? '<div class="field-error">' + ic('alert') + esc(t(e.attachments)) + '</div>' : '') + '<p class="field-hint">' + esc(t('up.private')) + '</p></div>';
    }
    if (step === 'review') body = reviewStep(u, d);
    var serverErr = w.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(w.serverError)) + '</span></div>' : '';
    var nav = step === 'review' ? '' : '<div class="dlg-actions wiz-nav">' + (idx > 0 ? '<button type="button" class="btn btn-ghost" data-pact="wiz-back">' + ic('arrow', 'flip back') + esc(t('wiz.back')) + '</button>' : '') +
      '<button type="button" class="btn btn-secondary" data-pact="wiz-exit">' + esc(t('wiz.saveExit')) + '</button><button type="button" class="btn btn-primary" data-pact="wiz-next"' + (step === 'attachments' && uploadsBusy(ctx) ? ' aria-disabled="true"' : '') + '>' + esc(t('wiz.continue')) + '</button></div>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.requests'), 'requests'], [t('wiz.title'), null]]) +
      '<div class="page-h"><div><span class="eyebrow">' + esc(t('wiz.eyebrow', { n: idx + 1, m: STEPS.length })) + '</span><h1>' + esc(t('wiz.title')) + '</h1><p>' + esc(t('wiz.sub')) + '</p></div><span class="pill plain">' + esc(t('wiz.autosaved')) + '</span></div>' + bar +
      '<section class="card wiz-card"><div class="card-h"><h2 tabindex="-1" id="wiz-h">' + esc(t('wiz.q.' + step)) + '</h2></div><div class="card-b stack">' + serverErr + body + (e.step ? '<div class="field-error" role="alert">' + ic('alert') + esc(t(e.step)) + '</div>' : '') + nav + '</div></section>';
  }
  function dupPanel(u, d, cands) {
    var w = wiz();
    if (!cands.length) return '<div class="notice">' + ic('check') + '<span>' + esc(t('dup.none')) + '</span></div>';
    return '<section class="dup" aria-labelledby="dup-h"><h3 id="dup-h" class="sub-h">' + pic('search') + ' ' + esc(t('dup.title', { n: cands.length })) + '</h3><p class="field-hint">' + esc(t('dup.sub')) + '</p><ul class="dup-list">' + cands.map(function (c) {
      var r = c.request;
      return '<li><div class="row-between"><span>' + recLink('request', r.id) + ' ' + reqStatus(r.status) + '</span><span class="muted num">' + esc(fd(r.raisedAt)) + '</span></div><b>' + esc(r.subject) + '</b>' +
        '<span class="chips dark">' + c.reasons.map(function (x) { return '<span class="chip">' + esc(t(x.key, { v: x.key === 'dup.sameType' ? t('rtype.' + x.v) : x.key === 'dup.sameService' ? t('svc.' + x.v) : x.v })) + '</span>'; }).join('') + '</span>' +
        '<div class="row"><a class="btn btn-secondary btn-sm" ' + go('req.' + r.id) + '>' + esc(t('dup.open')) + '</a>' +
        (ST().requestControls(u.id, r).message ? (w.addTo === r.id ? '<span class="confirm-inline"><span>' + esc(t('dup.addConfirm', { ref: r.ref })) + '</span><button class="btn btn-primary btn-sm" data-pact="dup-add" data-v="' + r.id + '">' + esc(t('dup.addYes')) + '</button><button class="btn btn-ghost btn-sm" data-pact="dup-add-cancel">' + esc(t('dlg.cancel')) + '</button></span>'
          : '<button class="btn btn-secondary btn-sm" data-pact="dup-add-ask" data-v="' + r.id + '">' + esc(t('dup.add')) + '</button>') : '<span class="why">' + esc(t('dup.cannotAdd')) + '</span>') + '</div></li>';
    }).join('') + '</ul><div class="field"><label for="w-dupreason">' + esc(t('dup.reason')) + '</label><textarea id="w-dupreason" class="textarea" rows="2" data-wtext="dupReason"' + ((w.errors || {}).dupReason ? ' aria-invalid="true" aria-describedby="w-dupreason-err"' : '') + '>' + esc(w.dupReason || '') + '</textarea>' +
      ((w.errors || {}).dupReason ? '<div id="w-dupreason-err" class="field-error">' + ic('alert') + esc(t(w.errors.dupReason)) + '</div>' : '') + '<span class="field-hint">' + esc(t('dup.reason.hint')) + '</span></div></section>';
  }
  function reviewStep(u, d) {
    var st = ST(), w = wiz(), p = st.get('project', d.projectId), pk = st.get('package', d.packageId), a = st.get('areas', d.areaId);
    var cands = st.duplicateCandidates(u.id, d), sug = suggestType(d);
    var rows = [['project', t('nav.projects'), esc(L(p, 'name'))], ['package', t('misc.package'), svcTag(pk.service) + ' <span class="mono">' + esc(pk.code) + '</span>'], ['area', t('rq.area'), esc(a.code + ' · ' + L(a, 'name'))],
      ['type', t('rq.category'), typeTag(d.type)], ['description', t('req.subject'), esc(d.subject)], ['description', t('wiz.describe'), '<span class="pre">' + esc(d.description) + '</span>'],
      ['description', t('wiz.priority'), prioPill(d.priority) + (d.neededBy ? ' · ' + esc(t('wiz.neededBy')) + ' ' + esc(fd(d.neededBy)) : '')], ['attachments', t('up.files'), fileChips(d.attachments) || '<span class="muted">' + esc(t('up.none')) + '</span>']];
    var summary = '<dl class="review">' + rows.map(function (r) { return '<div><dt>' + esc(r[1]) + '</dt><dd>' + r[2] + '</dd><button type="button" class="linkbtn" data-pact="wiz-goto" data-v="' + r[0] + '">' + esc(t('wiz.edit')) + '</button></div>'; }).join('') + '</dl>';
    var suggestion = sug ? '<div class="suggest" role="note"><span class="sg-h">' + pic('ai') + esc(t('ai.suggestion')) + '</span><p>' + esc(t('ai.typeSuggest', { type: t('rtype.' + sug.type) })) + '</p><p class="muted">' + esc(t('ai.evidence')) + ': ' + esc(sug.hits.join(', ')) + '</p><button type="button" class="btn btn-secondary btn-sm" data-pact="wiz-usetype" data-v="' + sug.type + '">' + esc(t('ai.useType', { type: t('rtype.' + sug.type) })) + '</button></div>' : '';
    return summary + suggestion + dupPanel(u, d, cands) + '<div class="notice warn">' + ic('shield') + '<span>' + esc(t('wiz.noAuthorise')) + '</span></div>' +
      '<div class="dlg-actions wiz-nav"><button type="button" class="btn btn-ghost" data-pact="wiz-back">' + ic('arrow', 'flip back') + esc(t('wiz.back')) + '</button><button type="button" class="btn btn-secondary" data-pact="wiz-exit">' + esc(t('wiz.saveExit')) + '</button>' +
      '<button type="button" class="btn btn-primary" id="wiz-submit" data-pact="wiz-submit"' + (w.submitting ? ' aria-disabled="true"' : '') + '>' + (w.submitting ? '<span class="spin" aria-hidden="true"></span>' + esc(t('wiz.submitting')) : esc(cands.length ? t('wiz.submitAnyway') : t('wiz.submit'))) + '</button></div>';
  }
  function wizNext(dir) {
    var u = me(), w = wiz(), d = ST().get('request', w.draftId); if (!d) return;
    var idx = stepIndex(d), step = STEPS[idx];
    w.errors = {};
    if (dir > 0) {
      var vs = w.values || {};
      if (step === 'description') {
        var subject = (vs.subject != null ? vs.subject : d.subject || '').trim(), desc = (vs.description != null ? vs.description : d.description || '').trim();
        if (subject.length < 3) w.errors.subject = 'wiz.err.subject';
        if (desc.length < 10) w.errors.description = 'wiz.err.description';
        if (Object.keys(w.errors).length) { saveDraft({ subject: subject, description: desc }, true); w.values = {}; U().render(); focusInvalid(); return; }
        saveDraft({ subject: subject, description: desc }, true); w.values = {};
      } else if (step === 'attachments') {
        var ctx = 'draft-' + d.id;
        if (uploadsBusy(ctx)) { w.errors.attachments = 'up.err.busy'; U().render(); return; }
        if (uploadsFailed(ctx)) { w.errors.attachments = 'up.err.failedPending'; U().render(); return; }
      } else if (!stepComplete(d, step)) { w.errors.step = 'wiz.err.choose'; U().render(); return; }
    }
    var nextStep = STEPS[Math.max(0, Math.min(STEPS.length - 1, idx + dir))];
    saveDraft({ step: nextStep }, true);
    U().render(); focusStep();
  }
  function focusStep() { var hh = document.getElementById('wiz-h'); if (hh) hh.focus(); }
  function focusInvalid() { var el = document.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }
  function wizSubmit() {
    var u = me(), w = wiz(), d = ST().get('request', w.draftId);
    if (!d || w.submitting) return; // second click while submitting does nothing
    var cands = ST().duplicateCandidates(u.id, d);
    var reason = (w.dupReason || '').trim();
    w.errors = {};
    if (cands.length && reason.length < 5) { w.errors.dupReason = 'dup.err.reason'; U().render(); focusInvalid(); return; }
    w.submitting = true; U().render();
    var key = d.submitKey;
    setTimeout(function () { // simulated network latency; the idempotency key makes any retry safe
      var r = API().dispatch('request.submit', u.id, { draftId: d.id, idempotencyKey: key, duplicateReview: cands.length ? { outcome: 'continued', reason: reason } : null });
      w.submitting = false;
      if (r.ok) { S().wiz = {}; U().toast(t('wiz.submitted', { ref: r.result.ref })); U().go('req.' + r.result.id); return; }
      w.serverError = r.code;
      if (r.code === 'exact_duplicate' && r.detail) w.serverError = 'exact_duplicate';
      w.exact = r.detail;
      U().render();
    }, 450);
  }

  // ---------------------------------------------------------------- 4. request detail
  function rdState(id) { var s = S(); if (!s.rd || s.rd.id !== id) s.rd = { id: id, form: null, errors: {}, values: {} }; return s.rd; }
  var FORM_LABEL = { triage: 'rd.f.triage', clarify: 'rd.f.clarify', escalate: 'rd.f.escalate', complete: 'rd.f.complete', verify: 'rd.f.verify', acknowledge: 'rd.f.acknowledge', reopen: 'rd.f.reopen', cancel: 'rd.f.cancel', link: 'rd.f.link', edit: 'rd.f.edit', createInstruction: 'rd.f.instruction' };
  function fErr(rd, k, id) { return rd.errors[k] ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(rd.errors[k])) + '</div>' : ''; }
  function fInv(rd, k, id) { return rd.errors[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; }
  function reasonField(rd, label, name) { name = name || 'reason'; return '<div class="field"><label for="rf-' + name + '">' + esc(label) + '</label><textarea id="rf-' + name + '" name="' + name + '" class="textarea" rows="3"' + fInv(rd, name, 'rf-' + name) + '>' + esc(rd.values[name] || '') + '</textarea>' + fErr(rd, name, 'rf-' + name) + '</div>'; }
  function eligible(r, perm) {
    var p = ST().get('project', r.projectId);
    return U().D.users.filter(function (x) { return U().A.can(U().D, x.id, perm, r.packageId ? { packageId: r.packageId } : { projectId: r.projectId }).allowed && (p.team.indexOf(x.id) >= 0 || x.role === 'operations_manager' || x.role === 'general_manager'); });
  }
  function formBody(u, r, rd) {
    var st = ST(), f = rd.form, pol = st.policy, v = rd.values;
    var submit = function (label, danger) { return '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="rd-form" data-v="">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(label) + '</button></div>'; };
    var out = '';
    if (f === 'triage') {
      var type = v.type || r.type, routed = (pol.routing || {})[type];
      var owners = eligible(r, 'request.respond'), verifiers = eligible(r, 'request.verify');
      var needVerify = (pol.verificationRequired || []).indexOf(type) >= 0;
      var target = (pol.responseTargets || {})[v.priority || r.priority];
      out = '<div class="field"><label for="tf-type">' + esc(t('rq.category')) + '</label><select id="tf-type" name="type" class="select" data-rdbind="type">' + REQ_TYPES.map(function (x) { return '<option value="' + x + '"' + (type === x ? ' selected' : '') + '>' + esc(t('rtype.' + x)) + '</option>'; }).join('') + '</select>' +
        (routed ? '<span class="field-hint">' + esc(t('tri.routing', { role: t('role.' + routed) })) + '</span>' : '') + '</div>' +
        '<div class="field"><label for="tf-priority">' + esc(t('rq.priority')) + '</label><select id="tf-priority" name="priority" class="select" data-rdbind="priority">' + PRIORITIES.map(function (x) { return '<option value="' + x + '"' + ((v.priority || r.priority) === x ? ' selected' : '') + '>' + esc(t('prio.' + x)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="tf-owner">' + esc(t('rq.owner')) + '</label><select id="tf-owner" name="ownerId" class="select"' + fInv(rd, 'ownerId', 'tf-owner') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + owners.map(function (x) { return '<option value="' + x.id + '"' + ((v.ownerId || r.ownerId) === x.id ? ' selected' : '') + '>' + esc(x.name + ' · ' + t('role.' + x.role) + (x.role === routed ? ' ★' : '')) + '</option>'; }).join('') + '</select>' + fErr(rd, 'ownerId', 'tf-owner') + '</div>' +
        (needVerify ? '<div class="field"><label for="tf-verifier">' + esc(t('tri.verifier')) + '</label><select id="tf-verifier" name="verifierId" class="select"' + fInv(rd, 'verifierId', 'tf-verifier') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + verifiers.map(function (x) { return '<option value="' + x.id + '"' + ((v.verifierId || r.verifierId) === x.id ? ' selected' : '') + '>' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select><span class="field-hint">' + esc(t('tri.verifier.hint')) + '</span>' + fErr(rd, 'verifierId', 'tf-verifier') + '</div>' : '') +
        '<div class="field"><label for="tf-due">' + esc(t('tri.due')) + '</label><input id="tf-due" name="responseDue" type="date" class="input" min="' + st.today + '" value="' + esc(v.responseDue || r.responseDue || '') + '"' + fInv(rd, 'responseDue', 'tf-due') + '><span class="field-hint">' + esc(target ? t('tri.target', { n: target }) : t('tri.noTarget')) + '</span>' + fErr(rd, 'responseDue', 'tf-due') + '</div>' +
        '<div class="field"><label for="tf-msg">' + esc(t('tri.message')) + ' ' + esc(t('dlg.optional')) + '</label><textarea id="tf-msg" name="message" class="textarea" rows="2">' + esc(v.message || '') + '</textarea></div>' + submit(t('tri.save'));
    } else if (f === 'clarify') out = reasonField(rd, t('rd.clarify.q'), 'message') + submit(t('rd.f.clarify'));
    else if (f === 'escalate') {
      var targets = eligible(r, 'request.triage').filter(function (x) { return x.id !== u.id && (x.role === 'operations_manager' || x.role === 'general_manager'); });
      out = '<div class="field"><label for="ef-to">' + esc(t('rd.escalate.to')) + '</label><select id="ef-to" name="toId" class="select"' + fInv(rd, 'toId', 'ef-to') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + targets.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name + ' · ' + t('role.' + x.role)) + '</option>'; }).join('') + '</select>' + fErr(rd, 'toId', 'ef-to') + '</div>' + reasonField(rd, t('rd.reason')) + submit(t('rd.f.escalate'));
    } else if (f === 'complete') out = '<p class="field-hint">' + esc(t(r.verificationRequired ? 'rd.complete.verify' : 'rd.complete.noverify', { who: person(r.verifierId) })) + '</p>' + reasonField(rd, t('rd.complete.summary'), 'summary') + uploadControl('complete-' + r.id, t('rd.complete.evidence')) + submit(t('rd.f.complete'));
    else if (f === 'verify') out = '<p class="field-hint">' + esc(t('rd.verify.hint')) + '</p><fieldset class="field"><legend class="label">' + esc(t('dlg.decision')) + '</legend><div class="row"><label class="check"><input type="radio" name="outcome" value="confirm"' + (v.outcome !== 'return' ? ' checked' : '') + '> ' + esc(t('rd.verify.confirm')) + '</label><label class="check"><input type="radio" name="outcome" value="return"' + (v.outcome === 'return' ? ' checked' : '') + '> ' + esc(t('rd.verify.return')) + '</label></div></fieldset>' + reasonField(rd, t('rd.verify.reason')) + submit(t('rd.f.verify'));
    else if (f === 'acknowledge') out = '<p class="field-hint">' + esc(t('rd.ack.hint')) + '</p><div class="field"><label for="rf-comment">' + esc(t('dlg.comment')) + '</label><textarea id="rf-comment" name="comment" class="textarea" rows="2"></textarea></div>' + submit(t('rd.f.acknowledge'));
    else if (f === 'reopen') out = reasonField(rd, t('rd.reopen.reason')) + submit(t('rd.f.reopen'));
    else if (f === 'cancel') out = '<p class="field-hint">' + esc(t('rd.cancel.hint')) + '</p>' + reasonField(rd, t('rd.reason')) + submit(t('rd.f.cancel'), true);
    else if (f === 'link') {
      var others = st.requests(u.id, r.projectId).filter(function (x) { return x.id !== r.id; });
      out = '<div class="field"><label for="lf-other">' + esc(t('rd.link.other')) + '</label><select id="lf-other" name="otherId" class="select"' + fInv(rd, 'otherId', 'lf-other') + '><option value="">' + esc(t('dlg.choose')) + '</option>' + others.map(function (x) { return '<option value="' + x.id + '">' + esc(x.ref + ' · ' + x.subject) + '</option>'; }).join('') + '</select>' + fErr(rd, 'otherId', 'lf-other') + '</div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('rd.link.relation')) + '</legend><div class="row"><label class="check"><input type="radio" name="relation" value="related" checked> ' + esc(t('rel.related')) + '</label><label class="check"><input type="radio" name="relation" value="superseded_by"> ' + esc(t('rel.superseded_by.this')) + '</label></div></fieldset>' + reasonField(rd, t('rd.reason')) + '<p class="field-hint">' + esc(t('rd.link.hint')) + '</p>' + submit(t('rd.f.link'));
    } else if (f === 'edit') out = '<div class="field"><label for="ed-subject">' + esc(t('req.subject')) + '</label><input id="ed-subject" name="subject" class="input" maxlength="120" value="' + esc(v.subject != null ? v.subject : r.subject) + '"' + fInv(rd, 'subject', 'ed-subject') + '>' + fErr(rd, 'subject', 'ed-subject') + '</div>' +
      '<div class="field"><label for="ed-description">' + esc(t('wiz.describe')) + '</label><textarea id="ed-description" name="description" class="textarea" rows="5"' + fInv(rd, 'description', 'ed-description') + '>' + esc(v.description != null ? v.description : r.description) + '</textarea>' + fErr(rd, 'description', 'ed-description') + '</div>' + reasonField(rd, t('rd.edit.reason')) + '<p class="field-hint">' + esc(t('rd.edit.hint')) + '</p>' + submit(t('rd.f.edit'));
    return '<form class="stack rd-form" data-form="' + f + '" novalidate><h3 class="sub-h">' + esc(t(FORM_LABEL[f])) + '</h3>' + (rd.serverError ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(rd.serverError)) + '</span></div>' : '') + out + '</form>';
  }
  function summariseThread(r) {
    var ms = r.messages || [];
    if (!ms.length) return null;
    var people = Array.from(new Set(ms.map(function (m) { return m.by; })));
    var last = ms[ms.length - 1], lastCust = ms.filter(function (m) { return ST().isCustomer(m.by); }).pop(), lastStaff = ms.filter(function (m) { return !ST().isCustomer(m.by); }).pop();
    var open = lastCust && (!lastStaff || lastCust.at > lastStaff.at);
    return { count: ms.length, people: people, last: last, open: open, lastCust: lastCust };
  }
  function draftReply(r) {
    // Uses only the customer-visible request and conversation, never internal notes, so a draft cannot leak them.
    var name = person(r.raisedBy).split(' ')[0];
    var key = { info: 'ai.reply.info', document: 'ai.reply.document', inspection: 'ai.reply.inspection', site_issue: 'ai.reply.site_issue', scope_change: 'ai.reply.scope_change', handover_support: 'ai.reply.handover_support' }[r.type] || 'ai.reply.info';
    return t(key, { name: name, ref: r.ref, date: r.responseDue ? fd(r.responseDue) : t('ai.reply.soon') });
  }
  function requestDetail(u, args) {
    var st = ST(), r = st.get('request', args[0]);
    var g = h.guard(u, 'request', r); if (g) return g;
    if (r.status === 'draft') return '<div class="card">' + emptyBox('documents', t('rd.isDraft'), '', '<a class="btn btn-primary" ' + go('newreq.' + r.id) + '>' + esc(t('rq.continue')) + '</a>') + '</div>';
    var rd = rdState(r.id), c = st.requestControls(u.id, r), cust = st.isCustomer(u.id);
    if (args[1] === 'triage' && !rd.form && c.triage && !rd.openedFromRoute) { rd.form = 'triage'; rd.openedFromRoute = true; }
    var p = st.get('project', r.projectId), w = r.packageId && st.get('package', r.packageId), n = st.nextAction(r);
    var mineNext = n.who === u.id || (n.party === 'customer' && cust && n.key !== 'next.none');
    var head = crumbs([[t('nav.home'), 'home'], [t('nav.requests'), 'requests'], [r.ref, null]]) +
      '<div class="page-h"><div><span class="eyebrow"><span class="mono">' + esc(r.ref) + '</span></span><h1>' + esc(r.subject) + '</h1><div class="row" style="gap:8px;margin-top:6px">' + typeTag(r.type) + reqStatus(r.status) + prioPill(r.priority) + '</div></div></div>' +
      '<section class="nextbar' + (mineNext ? ' mine' : '') + '" role="status"><span class="label">' + esc(t('rd.nextAction')) + '</span><b>' + (n.key === 'next.none' ? esc(t('rd.noNext.' + r.status)) : nextText(r)) + '</b>' +
      (n.due ? '<span class="muted">' + esc(t('rq.due')) + ' ' + dueCell(n.due) + '</span>' : '') + '</section>';
    var context = card(esc(t('rd.context')), '<div class="card-b">' + kv([
      [t('nav.projects'), recLink('project', p.id) + ' ' + esc(L(p, 'name'))], [t('misc.package'), w ? recLink('package', w.id) + ' ' + svcTag(w.service) : '—'], [t('rq.area'), esc(areaName(r.areaId))],
      [t('rd.raisedBy'), personRole(r.raisedBy) + ' · ' + esc(fdt(r.raisedAt))], [t('rq.owner'), r.ownerId ? personRole(r.ownerId) : '<span class="muted">' + esc(t('rq.unassigned')) + '</span>'],
      r.verificationRequired ? [t('tri.verifier'), r.verifierId ? personRole(r.verifierId) : '<span class="muted">' + esc(t('rq.unassigned')) + '</span>'] : null,
      [t('tri.due'), r.responseDue ? dueCell(r.responseDue, ['resolved', 'closed'].indexOf(r.status) >= 0) : '<span class="muted">' + esc(t('rd.noDue')) + '</span>'],
      r.neededBy ? [t('wiz.neededBy'), esc(fd(r.neededBy))] : null, r.escalatedTo && !cust ? [t('rd.escalatedTo'), personRole(r.escalatedTo)] : null]) + '</div>');
    // conversation (customer-visible)
    var sum = summariseThread(r);
    var convo = '<ol class="thread">' + (r.messages || []).map(function (m) {
      var c2 = st.isCustomer(m.by);
      return '<li class="msg ' + (c2 ? 'from-customer' : 'from-rgs') + '"><span class="avatar sm' + (c2 ? ' customer' : '') + '">' + esc(U().initials(person(m.by))) + '</span><div class="bubble"><div class="msg-h">' + personRole(m.by) + '<span class="muted num">' + esc(fdt(m.at)) + '</span></div><p class="pre">' + esc(m.text) + '</p>' + fileChips(m.attachments) + '</div></li>';
    }).join('') + '</ol>';
    var aiTools = '<div class="row ai-tools"><button type="button" class="btn btn-ghost btn-sm" data-pact="rd-summary">' + pic('ai') + esc(t('ai.summarise')) + '</button>' + (!cust && c.message ? '<button type="button" class="btn btn-ghost btn-sm" data-pact="rd-draftreply">' + pic('ai') + esc(t('ai.draftReply')) + '</button>' : '') + '</div>';
    var summaryBox = rd.summary && sum ? '<div class="suggest" role="note"><span class="sg-h">' + pic('ai') + esc(t('ai.summaryTitle')) + '</span><p>' + esc(t('ai.summary', { n: sum.count, people: sum.people.map(person).join(', '), who: person(sum.last.by), date: fdt(sum.last.at) })) + '</p>' +
      (sum.open ? '<p>' + esc(t('ai.summaryOpen', { who: person(sum.lastCust.by) })) + '</p>' : '') + '<p class="muted">' + esc(t('ai.summaryNote')) + '</p></div>' : '';
    var composer = c.message ? '<form class="composer stack" data-form="message" novalidate><label for="rd-msg" class="label">' + esc(t(cust && r.status === 'clarification_requested' ? 'rd.reply.clarify' : 'rd.reply')) + '</label><textarea id="rd-msg" name="text" class="textarea" rows="3"' + fInv(rd, 'text', 'rd-msg') + '>' + esc(rd.values.text || '') + '</textarea>' + fErr(rd, 'text', 'rd-msg') +
      (rd.drafted ? '<p class="field-hint">' + pic('ai') + ' ' + esc(t('ai.draftNote')) + '</p>' : '') + uploadControl('msg-' + r.id, t('up.attach')) + '<div class="dlg-actions"><button class="btn btn-primary" type="submit">' + esc(t('rd.send')) + '</button></div></form>' : '';
    var conversation = card(esc(t('rd.conversation')) + ' <span class="pill plain num">' + (r.messages || []).length + '</span>', '<div class="card-b stack">' + aiTools + summaryBox + convo + composer + '</div>', '<span class="pill ok plain">' + esc(t('rd.visibleToCustomer')) + '</span>');
    // internal notes (separately permissioned; never rendered for customers)
    var notes = '';
    if (!cust && st.requestCan(u.id, r, 'request.note.view').allowed) {
      var ns = st.notesFor(u.id, r);
      notes = '<section class="card internal-card"><div class="card-h"><h2>' + pic('lock') + ' ' + esc(t('rd.notes')) + '</h2><span class="pill crit plain">' + esc(t('rd.internalOnly')) + '</span></div><div class="card-b stack">' +
        (ns.length ? '<ol class="thread">' + ns.map(function (m) { return '<li class="msg note"><span class="avatar sm">' + esc(U().initials(person(m.by))) + '</span><div class="bubble"><div class="msg-h">' + personRole(m.by) + '<span class="muted num">' + esc(fdt(m.at)) + '</span></div><p class="pre">' + esc(m.text) + '</p>' + fileChips(m.attachments) + '</div></li>'; }).join('') + '</ol>' : '<p class="muted">' + esc(t('rd.noNotes')) + '</p>') +
        (c.note ? '<form class="composer stack" data-form="note" novalidate><label for="rd-note" class="label">' + esc(t('rd.addNote')) + '</label><textarea id="rd-note" name="text" class="textarea" rows="2"' + fInv(rd, 'note', 'rd-note') + '></textarea>' + fErr(rd, 'note', 'rd-note') + '<div class="dlg-actions"><button class="btn btn-secondary" type="submit">' + esc(t('rd.saveNote')) + '</button></div></form>' : '') + '</div></section>';
    }
    // request text + revision history
    var revs = card(esc(t('rd.request')), '<div class="card-b stack"><p class="pre lead">' + esc(r.description) + '</p>' +
      (r.revisions.length > 1 ? '<h3 class="sub-h">' + esc(t('rd.revisions', { n: r.revisions.length })) + '</h3><ol class="revlist">' + r.revisions.slice().reverse().map(function (v) { return '<li><span class="mono">' + esc(t('rd.revN', { n: v.rev })) + '</span> <span class="muted">' + esc(person(v.by) + ' · ' + fdt(v.at)) + '</span><b>' + esc(v.subject) + '</b><span class="pre">' + esc(v.description) + '</span><span class="muted">' + esc(t('rd.reason')) + ': ' + esc(v.reason) + '</span></li>'; }).join('') + '</ol>' : '<p class="field-hint">' + esc(t('rd.oneRevision')) + '</p>') + '</div>');
    // actions
    var btns = ['triage', 'clarify', 'createInstruction', 'complete', 'verify', 'acknowledge', 'reopen', 'escalate', 'edit', 'link', 'cancel'].filter(function (k) { return c[k]; });
    var actionsCard = card(esc(t('rd.actions')), '<div class="card-b stack">' + (btns.length ? '<div class="btn-stack">' + btns.map(function (k) {
      if (k === 'createInstruction') return '<a class="btn btn-secondary" ' + go('newins.' + r.id) + '>' + esc(t(FORM_LABEL[k])) + '</a>';
      return '<button type="button" class="btn ' + (k === 'cancel' ? 'btn-ghost' : ['triage', 'complete', 'verify', 'acknowledge'].indexOf(k) >= 0 ? 'btn-primary' : 'btn-secondary') + '" data-pact="rd-form" data-v="' + k + '" aria-expanded="' + (rd.form === k) + '">' + esc(t(FORM_LABEL[k])) + '</button>';
    }).join('') + '</div>' : '<p class="muted">' + esc(t('rd.noActions')) + '</p>') + (rd.form ? formBody(u, r, rd) : '') + '</div>');
    // instruction link
    var ins = r.instructionId && st.get('change', r.instructionId);
    var insCard = ins ? card(esc(t('rd.instruction')), '<div class="card-b">' + (st.canSee(u.id, 'change', ins) ? '<p>' + recLink('change', ins.id) + ' ' + insState(ins.state) + '</p><p>' + esc(ins.title) + '</p>' : '<p class="muted">' + esc(t('rd.instructionPreparing')) + '</p>') + '<p class="field-hint">' + esc(t('wiz.noAuthorise')) + '</p></div>') : '';
    var coms = U().D.commitments.filter(function (x) { return x.requestId === r.id; });
    var comCard = card(esc(t('com.title')), coms.length ? '<div class="list">' + coms.map(function (x) { var s = st.commitmentStatus(x); return '<div class="list-row"><span class="sev ' + h.TONE.commitment[s] + '"></span><div class="t"><b>' + esc(L(x, 'text')) + '</b><span class="mono">' + esc(x.ref) + '</span> <span>· ' + esc(person(x.ownerId)) + (x.withdrawn ? ' · ' + esc(t('com.withdrawn')) : '') + '</span></div><div class="row-end">' + dueCell(st.dueOf(x), !!x.doneAt) + sp('commitment', s, 'cstatus') + '</div></div>'; }).join('') + '</div>' : emptyBox('commitments', t('rd.noCommitment')));
    var attach = card(esc(t('rd.attachments')), '<div class="card-b stack">' + (fileChips(r.attachments) || '<p class="muted">' + esc(t('up.none')) + '</p>') +
      (r.linkedDocs && r.linkedDocs.length ? '<h3 class="sub-h">' + esc(t('rd.linkedDocs')) + '</h3><ul class="doclist">' + r.linkedDocs.map(function (ld) { var d = st.get('document', ld.id); return d ? '<li>' + recLink('document', d.id) + '<span class="t"><b>' + esc(d.title) + '</b><span>' + esc(t('doc.revShort', { rev: ld.rev })) + (st.currentRev(d).rev !== ld.rev ? ' · ' + esc(t('rd.newerRev', { rev: st.currentRev(d).rev })) : '') + '</span></span></li>' : ''; }).join('') + '</ul>' : '') + '</div>');
    var dr = r.duplicateReview || { outcome: 'none' };
    var rel = (r.related || []).filter(function (x) { return st.get('request', x.id); });
    var relCard = card(esc(t('rd.related')), '<div class="card-b stack"><p>' + esc(t('dupout.' + dr.outcome, { who: dr.by ? person(dr.by) : '' })) + '</p>' + (dr.reason ? '<p class="muted">“' + esc(dr.reason) + '”</p>' : '') +
      (rel.length ? '<ul class="doclist">' + rel.map(function (x) { var o = st.get('request', x.id); return '<li>' + recLink('request', o.id) + '<span class="t"><b>' + esc(st.canSee(u.id, 'request', o) ? o.subject : t('rec.restricted')) + '</b><span>' + esc(t('rel.' + x.relation)) + (x.reason ? ' · ' + esc(x.reason) : '') + '</span></span>' + (st.canSee(u.id, 'request', o) ? reqStatus(o.status) : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('rd.noRelated')) + '</p>') +
      (r.supersededBy ? '<div class="notice warn">' + ic('info') + '<span>' + esc(t('rd.supersededBy')) + ' ' + '</span>' + recLink('request', r.supersededBy) + '</div>' : '') + '</div>');
    var hist = st.activity(u.id, {}).filter(function (e) { return e.ref.kind === 'request' && e.ref.id === r.id; });
    var histCard = card(esc(t('rd.history')), hist.length ? '<div class="card-b">' + h.timeline(u, hist, true) + '</div>' : emptyBox('reports', t('tl.none')));
    return head + '<div class="grid g-home"><div class="grid">' + conversation + notes + revs + histCard + '</div><div class="grid">' + actionsCard + context + insCard + comCard + attach + relCard + '</div></div>' +
      '<div class="row back-row"><a class="btn btn-secondary" ' + go('requests') + '>' + ic('arrow', 'flip back') + esc(t('rd.backCentre')) + '</a><a class="btn btn-ghost" ' + go('project.' + p.id + '.requests') + '>' + esc(t('back.project')) + '</a></div>';
  }
  function submitRequestForm(form) {
    var u = me(), r = ST().get('request', S().rd.id), rd = S().rd, f = form.getAttribute('data-form'), fd2 = new FormData(form), val = function (k) { return (fd2.get(k) || '').toString(); };
    rd.errors = {}; rd.serverError = null;
    Array.from(fd2.keys()).forEach(function (k) { rd.values[k] = val(k); });
    var cmd, payload = { id: r.id, version: r.version }, toast;
    switch (f) {
      case 'message':
        if (val('text').trim().length < 2) { rd.errors.text = 'rd.err.text'; break; }
        if (uploadsBusy('msg-' + r.id)) { rd.errors.text = 'up.err.busy'; break; }
        cmd = 'request.message'; payload = { id: r.id, text: val('text'), attachments: doneFileIds('msg-' + r.id) }; toast = t('rd.sent'); break;
      case 'note':
        if (val('text').trim().length < 2) { rd.errors.note = 'rd.err.text'; break; }
        cmd = 'request.note'; payload = { id: r.id, text: val('text') }; toast = t('rd.noteSaved'); break;
      case 'triage':
        if (!val('ownerId')) rd.errors.ownerId = 'tri.err.owner';
        if (!val('responseDue')) rd.errors.responseDue = 'tri.err.due';
        if (form.querySelector('[name=verifierId]') && !val('verifierId')) rd.errors.verifierId = 'tri.err.verifier';
        if (Object.keys(rd.errors).length) break;
        cmd = 'request.triage'; Object.assign(payload, { type: val('type'), priority: val('priority'), ownerId: val('ownerId'), verifierId: val('verifierId') || null, responseDue: val('responseDue'), message: val('message') }); toast = t('tri.saved'); break;
      case 'clarify': if (val('message').trim().length < 5) { rd.errors.message = 'rd.err.reason'; break; } cmd = 'request.clarify'; payload.message = val('message'); toast = t('rd.clarifySent'); break;
      case 'escalate': if (!val('toId')) rd.errors.toId = 'tri.err.owner'; if (val('reason').trim().length < 5) rd.errors.reason = 'rd.err.reason'; if (Object.keys(rd.errors).length) break; cmd = 'request.escalate'; payload = { id: r.id, toId: val('toId'), reason: val('reason') }; toast = t('rd.escalated'); break;
      case 'complete':
        if (val('summary').trim().length < 5) { rd.errors.summary = 'rd.err.reason'; break; }
        if (uploadsBusy('complete-' + r.id) || uploadsFailed('complete-' + r.id)) { rd.errors.summary = 'up.err.failedPending'; break; }
        cmd = 'request.complete'; payload.summary = val('summary'); payload.attachments = doneFileIds('complete-' + r.id); toast = t('rd.completed'); break;
      case 'verify': if (val('outcome') === 'return' && val('reason').trim().length < 5) { rd.errors.reason = 'rd.err.reason'; break; } cmd = 'request.verify'; payload.outcome = val('outcome') || 'confirm'; payload.reason = val('reason'); toast = t('rd.verified'); break;
      case 'acknowledge': cmd = 'request.acknowledge'; payload.comment = val('comment'); toast = t('rd.acknowledged'); break;
      case 'reopen': if (val('reason').trim().length < 5) { rd.errors.reason = 'rd.err.reason'; break; } cmd = 'request.reopen'; payload.reason = val('reason'); toast = t('rd.reopened'); break;
      case 'cancel': if (val('reason').trim().length < 5) { rd.errors.reason = 'rd.err.reason'; break; } cmd = 'request.cancel'; payload.reason = val('reason'); toast = t('rd.cancelled'); break;
      case 'link': if (!val('otherId')) rd.errors.otherId = 'rd.err.other'; if (val('reason').trim().length < 5) rd.errors.reason = 'rd.err.reason'; if (Object.keys(rd.errors).length) break; cmd = 'request.link'; payload = { id: r.id, otherId: val('otherId'), relation: val('relation') || 'related', reason: val('reason') }; toast = t('rd.linked'); break;
      case 'edit':
        if (val('subject').trim().length < 3) rd.errors.subject = 'wiz.err.subject';
        if (val('description').trim().length < 10) rd.errors.description = 'wiz.err.description';
        if (val('reason').trim().length < 5) rd.errors.reason = 'rd.err.reason';
        if (Object.keys(rd.errors).length) break;
        cmd = 'request.edit'; Object.assign(payload, { subject: val('subject'), description: val('description'), reason: val('reason') }); toast = t('rd.edited'); break;
    }
    if (!cmd) { U().render(); focusInvalid(); return; }
    run(cmd, payload, {
      toast: toast,
      ok: function () { var keep = rd.id; S().rd = { id: keep, form: null, errors: {}, values: {} }; var s = S(); if (s.uploads) { delete s.uploads['msg-' + keep]; delete s.uploads['complete-' + keep]; } },
      fail: function (res) { rd.serverError = res.code; }
    });
    if (rd.serverError) focusInvalid();
  }

  // ---------------------------------------------------------------- 5. RGS triage workspace
  function triagePage(u) {
    var st = ST(), all = st.requests(u.id).filter(function (r) { return st.requestCan(u.id, r, 'request.triage').allowed; });
    var lastBy = function (r, cust) { return (r.messages || []).filter(function (m) { return st.isCustomer(m.by) === cust; }).map(function (m) { return m.at; }).pop() || ''; };
    var waiting = all.filter(function (r) { return r.status === 'submitted'; });
    var replied = all.filter(function (r) { return ['in_review', 'submitted'].indexOf(r.status) >= 0 && lastBy(r, true) > lastBy(r, false) && r.triaged; });
    var clar = all.filter(function (r) { return r.status === 'clarification_requested'; });
    var esc2 = all.filter(function (r) { return r.escalatedTo === u.id && st.OPEN_REQ.indexOf(r.status) >= 0; });
    var soon = new Date(st.today); soon.setDate(soon.getDate() + 2); soon = soon.toISOString().slice(0, 10);
    var due = all.filter(function (r) { return r.status === 'in_review' && r.responseDue && r.responseDue <= soon; });
    var verif = all.filter(function (r) { return r.status === 'completion_submitted'; });
    function sec(key, list, cta) { return card(esc(t(key)) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? requestStack(list) + (cta ? '' : '') : emptyBox('approvals', t('tri.empty'))); }
    var pol = st.policy;
    var rules = '<section class="card card-b stack"><h2 class="sec-h sm">' + esc(t('tri.rules')) + '</h2><div class="tablewrap"><table><thead><tr><th>' + esc(t('rq.category')) + '</th><th>' + esc(t('tri.routeTo')) + '</th><th>' + esc(t('tri.verifyNeeded')) + '</th></tr></thead><tbody>' +
      REQ_TYPES.map(function (x) { return '<tr><td>' + typeTag(x) + '</td><td>' + esc(t('role.' + ((pol.routing || {})[x] || 'project_manager'))) + '</td><td>' + esc((pol.verificationRequired || []).indexOf(x) >= 0 ? t('misc.yes') : t('misc.no')) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="notice warn">' + ic('info') + '<span>' + esc(Object.keys(pol.responseTargets || {}).length ? t('tri.targetsSet') : t('tri.targetsUnset')) + '</span></div><p class="field-hint">' + esc(t('tri.rulesNote')) + '</p></section>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.triage'), null]]) + '<div class="page-h"><div><h1>' + esc(t('tri.title')) + '</h1><p>' + esc(t('tri.sub')) + '</p></div></div>' +
      '<div class="grid g-home"><div class="grid">' + sec('tri.waiting', waiting) + sec('tri.replied', replied) + sec('tri.dueSoon', due) + '</div><div class="grid">' + sec('tri.escalated', esc2) + sec('tri.clarifying', clar) + sec('tri.verifying', verif) + rules + '</div></div>';
  }

  // ---------------------------------------------------------------- event hooks
  function onAct(act, el, ev) {
    var s = S(), v = el.getAttribute('data-v');
    switch (act) {
      case 'newreq': ev.preventDefault(); newRequest(el.getAttribute('data-p')); return true;
      case 'wiz-next': wizNext(1); return true;
      case 'wiz-back': wizNext(-1); return true;
      case 'wiz-goto': saveDraft({ step: v }, true); wiz().errors = {}; U().render(); focusStep(); return true;
      case 'wiz-exit': {
        var vs = wiz().values || {}; var f = {}; if (vs.subject != null) f.subject = vs.subject; if (vs.description != null) f.description = vs.description;
        if (Object.keys(f).length) saveDraft(f, true);
        wiz().values = {}; S().rq = Object.assign(rqState(), { tab: 'drafts' }); U().toast(t('wiz.draftSaved')); U().go('requests'); return true;
      }
      case 'wiz-submit': if (el.getAttribute('aria-disabled') === 'true') return true; wizSubmit(); return true;
      case 'wiz-usetype': saveDraft({ type: v }, true); U().toast(t('ai.typeApplied', { type: t('rtype.' + v) })); U().render(); return true;
      case 'dup-add-ask': wiz().addTo = v; U().render(); return true;
      case 'dup-add-cancel': wiz().addTo = null; U().render(); return true;
      case 'dup-add': {
        var d = ST().get('request', wiz().draftId);
        var r = API().dispatch('request.addInfo', me().id, { draftId: d.id, targetId: v, idempotencyKey: 'add-' + d.id });
        if (r.ok) { S().wiz = {}; U().toast(t('dup.added', { ref: r.result.ref })); U().go('req.' + v); } else { wiz().serverError = r.code; U().render(); }
        return true;
      }
      case 'up-retry': { var it = uploads(el.getAttribute('data-ctx')).filter(function (i) { return i.key === v; })[0]; if (it) startUpload(el.getAttribute('data-ctx'), it, uploadDoneFor(el.getAttribute('data-ctx'))); return true; }
      case 'up-remove': {
        var ctx = el.getAttribute('data-ctx'), list = uploads(ctx), item = list.filter(function (i) { return i.key === v; })[0];
        s.uploads[ctx] = list.filter(function (i) { return i.key !== v; });
        if (item && item.fileId && /^draft-/.test(ctx)) { var dd = ST().get('request', ctx.slice(6)); saveDraft({ attachments: dd.attachments.filter(function (x) { return x !== item.fileId; }) }, true); }
        U().render(); return true;
      }
      case 'draft-file-remove': { var d2 = ST().get('request', wiz().draftId); saveDraft({ attachments: d2.attachments.filter(function (x) { return x !== v; }) }, true); U().render(); return true; }
      case 'simfail': s.simFail = el.checked; return false;
      case 'openfile': openFile(v); return true;
      case 'rq-tab': rqState().tab = v; U().render(); return true;
      case 'rq-clear': { var f2 = rqState(); ['q', 'project', 'type', 'priority', 'package'].forEach(function (k) { f2[k] = ''; }); f2.status = 'open'; U().render(); return true; }
      case 'draft-delete-ask': s.confirmDelete = v; U().render(); return true;
      case 'draft-delete-cancel': s.confirmDelete = null; U().render(); return true;
      case 'draft-delete': run('request.deleteDraft', { draftId: v }, { toast: t('rq.deleted') }); s.confirmDelete = null; return true;
      case 'rd-form': { var rd = S().rd; rd.form = v || null; rd.errors = {}; rd.serverError = null; rd.values = {}; U().render(); var fh = document.querySelector('.rd-form h3'); if (fh) { fh.setAttribute('tabindex', '-1'); fh.focus(); } return true; }
      case 'rd-summary': S().rd.summary = !S().rd.summary; U().render(); return true;
      case 'rd-draftreply': { var r2 = ST().get('request', S().rd.id); S().rd.values.text = draftReply(r2); S().rd.drafted = true; U().render(); var ta = document.getElementById('rd-msg'); if (ta) ta.focus(); return true; }
    }
    return false;
  }
  function uploadDoneFor(ctx) {
    var prof = profileFor(ctx);
    if (prof && prof.onDone) return function (item) { prof.onDone(ctx, item); };
    if (!/^draft-/.test(ctx)) return null;
    return function (item) { var d = ST().get('request', ctx.slice(6)); if (d) saveDraft({ attachments: (d.attachments || []).concat([item.fileId]) }, true); };
  }
  function openFile(id) {
    var f = ST().get('file', id);
    if (!f || !ST().fileAccess(me().id, f).allowed) { U().toast(t('file.denied')); return; } // access is checked when opening, not only when listing
    var dl = API().dispatch('file.download', me().id, { fileId: id }); if (!dl.ok) { U().toast(t('file.denied')); return; } // audited
    var blob = BLOBS[id];
    if (!blob) { U().toast(t('file.notRetained', { name: f.name })); return; }
    var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function onChange(el) {
    var s = S();
    if (el.hasAttribute('data-upctx')) { var ctx = el.getAttribute('data-upctx'); addFiles(ctx, el.files, uploadDoneFor(ctx)); el.value = ''; return true; }
    var wb = el.getAttribute('data-wbind');
    if (wb) {
      var f = {}; f[wb] = el.value;
      if (wb === 'projectId' || wb === 'packageId' || wb === 'areaId' || wb === 'type') { saveDraft(f, true); wiz().errors = {}; U().render(); var sel = document.querySelector('[data-wbind="' + wb + '"]:checked'); if (sel) sel.focus(); return true; }
      saveDraft(f, true); return true;
    }
    if (el.hasAttribute('data-wtext')) {
      var w = wiz(), k = el.getAttribute('data-wtext'); w.values = w.values || {};
      if (k === 'dupReason') { w.dupReason = el.value; return true; }
      w.values[k] = el.value; var sv = {}; sv[k] = el.value; saveDraft(sv, true); // saved when the field loses focus, so a closed tab keeps the text
      return true;
    }
    var rb = el.getAttribute('data-rdbind');
    if (rb && s.rd) { s.rd.values[rb] = el.value; Array.from(el.form.elements).forEach(function (x) { if (x.name && x.name !== rb) s.rd.values[x.name] = x.value; }); U().render(); var again = document.getElementById(el.id); if (again) again.focus(); return true; }
    return false;
  }
  function onInput(el) {
    var s = S();
    if (el.id === 'rq-q') { rqState().q = el.value; var c = el.selectionStart; U().render(); var a = document.getElementById('rq-q'); if (a) { a.focus(); try { a.setSelectionRange(c, c); } catch (e) {} } return true; }
    if (el.hasAttribute('data-wtext')) { var w = wiz(); w.values = w.values || {}; if (el.getAttribute('data-wtext') === 'dupReason') w.dupReason = el.value; else w.values[el.getAttribute('data-wtext')] = el.value; var cnt = el.parentNode.querySelector('.field-hint.num'); if (cnt) cnt.textContent = el.value.length + '/120'; return true; }
    if (s.rd && el.form && el.form.getAttribute('data-form') && el.name) { s.rd.values[el.name] = el.value; return true; }
    return false;
  }
  function onSubmit(form) {
    if (form.getAttribute('data-form') && S().rd && document.querySelector('.rd-form, .composer') && ['message', 'note', 'triage', 'clarify', 'escalate', 'complete', 'verify', 'acknowledge', 'reopen', 'cancel', 'link', 'edit'].indexOf(form.getAttribute('data-form')) >= 0) { submitRequestForm(form); return true; }
    return false;
  }

  window.RGSPages3 = { addProfile: function (p) { PROFILES.push(p); }, BLOBS: BLOBS, sha256: sha256, uploadList: uploadList, startUpload: startUpload, REQ_TYPES: REQ_TYPES, typeTag: typeTag, decBadge: decBadge, insState: insState, reqStatus: reqStatus, run: run, err: err, fdt: fdt, personRole: personRole,
    uploadControl: uploadControl, uploads: uploads, uploadsBusy: uploadsBusy, uploadsFailed: uploadsFailed, doneFileIds: doneFileIds, fileChips: fileChips, focusInvalid: focusInvalid, rnd: rnd, areaName: areaName, nextText: nextText, requestStack: requestStack };
  P.extend({
    bases: { req: requestDetail, newreq: wizard },
    modules: { requests: requestCentre, triage: triagePage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit, requestRows: P.requestRows
  });
})();
