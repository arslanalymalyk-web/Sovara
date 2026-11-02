/*
 * RGS Client Portal — Stage 6 pages: progress (project and package), site officer daily updates, commitments register,
 * dependencies, customer report centre (directory, builder, preview, issued versions, print/PDF and CSV), handover
 * readiness, handover packages, acceptance and technical release, and management oversight.
 * Changes go through api.js; reads go through store.js. Nothing here stores a figure: every number is derived.
 */
(function () {
  'use strict';
  var P = window.RGSPages, h = P._h, X = window.RGSPages3;
  var t = h.t, esc = h.esc, pic = h.pic, recLink = h.recLink, go = h.go, pill = h.pill, card = h.card, table = h.table, kv = h.kv,
    crumbs = h.crumbs, emptyBox = h.emptyBox, dueCell = h.dueCell, fd = h.fd, person = h.person, L = h.L, svcTag = h.svcTag, bar = h.bar, pctText = h.pctText, pctBar = h.pctBar;
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function API() { return U().API; }
  function me() { return U().user(); }
  function ic(n, c) { return U().ic(n, c); }
  var fdt = X.fdt, personRole = X.personRole, err = X.err;
  function can(uid, a, res) { return U().A.can(U().D, uid, a, res).allowed; }
  function canAnywhere(uid, a) { return ST().visibleProjects(uid).some(function (p) { return can(uid, a, { projectId: p.id }) || ST().visiblePackages(uid, p.id).some(function (w) { return can(uid, a, { packageId: w.id }); }); }); }
  function areaName(id) { var a = id && U().byId(U().D.areas, id); return a ? a.code + ' · ' + L(a, 'name') : '—'; }
  function pkgCode(id) { var w = ST().get('package', id); return w ? w.code : id; }
  function errBox(code, detail) { return code ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(err(code)) + (detail ? ' ' + esc(detail) : '') + '</span></div>' : ''; }
  function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  var NUM_FMT = {};
  function num(n) { var k = S().lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB'; return (NUM_FMT[k] = NUM_FMT[k] || new Intl.NumberFormat(k)).format(Math.round(n * 100) / 100); }
  function testPill(example, label) { return example ? ' ' + pill('warn', t('pg.testSetting')) + (label ? ' <span class="muted">' + esc(label) + '</span>' : '') : ''; }
  function msName(id) { var m = ST().get('milestone', id); return m ? L(m, 'name') : id; }
  function nodeLabel(ref) {
    if (!ref) return '—';
    if (ref.kind === 'package') return pkgCode(ref.id);
    var m = ST().get('milestone', ref.id); return m ? pkgCode(m.packageId) + ' · ' + L(m, 'name') : ref.id;
  }
  function nowStamp() { return U().API && window.RGSApi ? window.RGSApi.ksaStamp(new Date()) : new Date().toISOString().slice(0, 16); }
  function stamp() { return '<p class="asof">' + pic('clock') + esc(t('pg.reportingAt', { date: fdt(nowStamp()) })) + '</p>'; }

  // ---------------------------------------------------------------- generic form state (one open form at a time)
  // Values are kept in memory, so a failed command or a re-render never loses what was typed.
  function F() { var s = S(); if (!s.f6) s.f6 = { key: null, values: {}, errors: {}, serverError: null, detail: null }; return s.f6; }
  function openForm(key) { var f = F(); f.key = key; f.values = {}; f.errors = {}; f.serverError = null; f.detail = null; }
  function isOpen(key) { return F().key === key; }
  function val(k, d) { var f = F(); return f.values[k] != null ? f.values[k] : (d == null ? '' : d); }
  function fe(k, id) { var e = F().errors[k]; return e ? '<div id="' + id + '-err" class="field-error">' + ic('alert') + esc(t(e)) + '</div>' : ''; }
  function inv(k, id) { return F().errors[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; }
  function input(name, label, type, opts) {
    opts = opts || {}; var id = 'f6-' + name;
    return '<div class="field' + (opts.cls ? ' ' + opts.cls : '') + '"><label for="' + id + '">' + esc(label) + (opts.optional ? ' ' + esc(t('dlg.optional')) : '') + '</label>' +
      (type === 'textarea' ? '<textarea id="' + id + '" name="' + name + '" class="textarea" rows="' + (opts.rows || 2) + '"' + inv(name, id) + '>' + esc(val(name, opts.value)) + '</textarea>'
        : '<input id="' + id + '" name="' + name + '" class="input' + (type === 'number' ? ' num' : '') + '" type="' + (type || 'text') + '"' + (opts.min ? ' min="' + opts.min + '"' : '') + (opts.max ? ' max="' + opts.max + '"' : '') + (opts.step ? ' step="' + opts.step + '"' : '') + (type === 'number' ? ' inputmode="decimal"' : '') + ' value="' + esc(val(name, opts.value)) + '"' + inv(name, id) + '>') +
      (opts.hint ? '<span class="field-hint">' + esc(opts.hint) + '</span>' : '') + fe(name, id) + '</div>';
  }
  function select(name, label, options, opts) {
    opts = opts || {}; var id = 'f6-' + name, cur = val(name, opts.value);
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" name="' + name + '" class="select"' + inv(name, id) + (opts.live ? ' data-f6live' : '') + '>' +
      (opts.blank === false ? '' : '<option value="">' + esc(t('dlg.choose')) + '</option>') +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
      (opts.hint ? '<span class="field-hint">' + esc(opts.hint) + '</span>' : '') + fe(name, id) + '</div>';
  }
  function formWrap(key, title, body, submitLabel, opts) {
    opts = opts || {};
    return '<form class="stack rd-form" data-f6form="' + esc(key) + '" novalidate><h3 class="sub-h" tabindex="-1">' + esc(title) + '</h3>' + errBox(F().serverError, F().detail) + body +
      '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="f6-close">' + esc(t('dlg.cancel')) + '</button><button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(submitLabel) + '</button></div></form>';
  }
  function opener(key, label, primary) { return '<button type="button" class="btn ' + (primary ? 'btn-primary' : 'btn-secondary') + '" data-pact="f6-open" data-v="' + esc(key) + '">' + esc(label) + '</button>'; }
  function run(cmd, payload, toast, after) {
    var f = F(), r = API().dispatch(cmd, me().id, payload);
    if (r.ok) { var k = f.key; S().f6 = null; if (toast) U().toast(toast); if (after) after(r.result, k); else U().render(); return r; }
    f.serverError = r.code; f.detail = r.detail && r.detail.ref ? r.detail.ref : (r.detail && r.detail.unmet ? r.detail.unmet.map(function (x) { return t('rel.pre.' + x); }).join(', ') : null);
    U().render(); var a = document.querySelector('.rd-form [role=alert]'); if (a) a.scrollIntoView({ block: 'center' });
    return r;
  }
  function need(cond, k, code) { if (!cond) F().errors[k] = code; }
  function invalid() { if (Object.keys(F().errors).length) { U().render(); X.focusInvalid(); return true; } return false; }

  // ---------------------------------------------------------------- status vocabulary
  var DUP_TONE = { draft: '', submitted: 'warn', returned: 'crit', approved: 'info', published: 'ok' };
  function dupPill(s) { return pill(DUP_TONE[s] || '', t('dupst.' + s)); }
  var CM_TONE = { complete: 'ok', on_track: 'info', at_risk: 'warn', overdue: 'crit' };
  function cmPill(s) { return pill(CM_TONE[s] || '', t('cstatus.' + s)); }
  var RD_TONE = { ready: 'ok', blocked: 'crit', incomplete: 'warn', not_configured: 'plain' };
  function rdPill(s) { return pill(RD_TONE[s] || '', t('rdst.' + s)); }
  var RPT_TONE = { draft: '', in_review: 'warn', approved: 'info', issued: 'ok' };
  function rptPill(s) { return pill(RPT_TONE[s] || '', t('rptst.' + s)); }
  var HP_TONE = { draft: '', in_review: 'warn', reviewed: 'info', issued: 'ok', superseded: 'plain' };
  function hpPill(s) { return pill(HP_TONE[s] || '', t('hpst.' + s)); }
  var DEP_TONE = { open: 'info', satisfied: 'ok', overdue: 'crit', resolved: 'plain', cancelled: '' };
  function depPill(s) { return pill(DEP_TONE[s] || '', t('depst.' + s)); }

  // =====================================================================================================
  // 1. PROGRESS
  // =====================================================================================================
  function progressModule(u) {
    var st = ST(), ps = st.visibleProjects(u.id);
    var cards = ps.map(function (p) {
      var pr = st.projectProgress(p.id, u.id), pk = st.visiblePackages(u.id, p.id);
      var nc = pk.filter(function (w) { return !st.progressConfig(w.id); }).length;
      return '<a class="pcard rowlink pg-card" ' + go('prog.' + p.id) + '><div class="pcard-b"><span class="mono muted">' + esc(p.code) + '</span><b>' + esc(L(p, 'name')) + '</b>' +
        '<div class="pcard-prog"><div class="row-between"><span class="label">' + esc(t('misc.progress')) + '</span><b class="num">' + esc(pctText(pr)) + '</b></div>' + pctBar(pr) + '</div>' +
        '<span class="muted">' + esc(t('pg.asOf', { date: fd(pr.asOf) })) + (nc ? ' · ' + esc(t('pg.ncCount', { n: nc })) : '') + '</span></div></a>';
    }).join('');
    return crumbs([[t('nav.home'), 'home'], [t('nav.progress'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('pg.title')) + '</h1><p>' + esc(t(st.isCustomer(u.id) ? 'pg.sub.customer' : 'pg.sub.staff')) + '</p></div>' +
      (!st.isCustomer(u.id) && canAnywhere(u.id, 'progress.report') ? '<a class="btn btn-primary" ' + go('dupnew') + '>' + pic('plus') + esc(t('du.new')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('pg.rule')) + '</span></div>' +
      (ps.length ? '<div class="grid g-3">' + cards + '</div>' : card(esc(t('pg.title')), emptyBox('reports', t('pg.none'))));
  }
  function projectProgressPage(u, args) {
    var st = ST(), p = st.get('project', args[0]);
    var g = h.guard(u, 'project', p); if (g) return g;
    var pr = st.projectProgress(p.id, u.id), pk = st.visiblePackages(u.id, p.id), cust = st.isCustomer(u.id);
    var rows = pr.packages.filter(function (r) { return pk.indexOf(r.pkg) >= 0; }).map(function (r) {
      var pp = r.progress, w = r.pkg;
      return '<tr><td><a ' + go('pprog.' + w.id) + ' class="mono">' + esc(w.code) + '</a><br>' + svcTag(w.service) + '</td><td>' + esc(pp.method ? t('pgm.' + pp.method) : t('pg.notConfiguredShort')) + testPill(pp.config && pp.config.testExample) + '</td>' +
        '<td class="num"><b>' + esc(pctText(pp)) + '</b>' + (pp.pct === null ? '' : bar(pp.pct)) + '</td><td class="num">' + w.weight + '%</td><td class="num">' + (pp.pct === null || !pr.totalWeight ? '—' : num(pp.ratio * w.weight / pr.totalWeight * 100) + ' ' + esc(t('pg.points'))) + '</td><td>' + esc(fd(pp.asOf)) + '</td></tr>';
    });
    var formula = pr.configured ? '<p class="mono calc" dir="ltr">Σ (package % × weight) ÷ Σ weight = ' + pr.pct + '%</p>' :
      '<div class="notice warn" role="status">' + ic('alert') + '<span><b>' + esc(t('pg.notConfigured')) + '</b> ' + esc(t('pg.projectNc', { list: pr.missing.map(function (w) { return w.code; }).join(', ') })) + '</span></div>';
    var head = '<section class="phero pg-hero"><div class="phero-b"><span class="eyebrow mono">' + esc(p.code) + '</span><h1>' + esc(L(p, 'name')) + '</h1><p>' + esc(t('pg.projectSub')) + '</p></div>' +
      '<div class="phero-prog"><span class="label">' + esc(t('pw.progress')) + '</span><b class="big num">' + esc(pctText(pr)) + '</b>' + pctBar(pr, t('pw.progress')) +
      '<p class="muted">' + esc(t('pg.asOf', { date: fd(pr.asOf) })) + '</p></div></section>';
    var links = '<div class="row">' + '<a class="btn btn-secondary" ' + go('commitments') + '>' + esc(t('nav.commitments')) + '</a>' +
      (cust ? '' : '<a class="btn btn-secondary" ' + go('deps.' + p.id) + '>' + esc(t('nav.dependencies')) + '</a><a class="btn btn-secondary" ' + go('dailyupdates') + '>' + esc(t('nav.dailyupdates')) + '</a>') + '</div>';
    return crumbs([[t('nav.home'), 'home'], [t('nav.progress'), 'progress'], [L(p, 'name'), null]]) + head +
      card(esc(t('pg.calc')), '<div class="card-b stack">' + table([t('misc.package'), t('pg.method'), t('misc.progress'), t('pg.weight'), t('pg.contribution'), t('pg.asOfShort')], rows, 'pgtable') + formula +
        '<p class="field-hint">' + esc(t(cust ? 'pg.lens.customer' : 'pg.lens.staff')) + '</p>' + stamp() + '</div>') + links;
  }
  function packageProgressPage(u, args) {
    var st = ST(), w = st.get('package', args[0]);
    var g = h.guard(u, 'package', w); if (g) return g;
    var p = st.get('project', w.projectId), pp = st.packageProgress(w.id, u.id), cust = st.isCustomer(u.id), cfg = pp.config;
    var head = crumbs([[t('nav.home'), 'home'], [t('nav.progress'), 'progress'], [L(p, 'name'), 'prog.' + p.id], [w.code, null]]) +
      '<section class="phero pg-hero"><div class="phero-b"><span class="eyebrow">' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></span><h1>' + esc(t('pkgtitle.' + w.service)) + '</h1>' +
      '<p>' + pic('pin') + ' ' + esc(areaName(w.areaId)) + ' · ' + esc(L(p, 'name')) + '</p></div><div class="phero-prog"><span class="label">' + esc(t('pkg.progress')) + '</span><b class="big num">' + esc(pctText(pp)) + '</b>' + pctBar(pp, t('pkg.progress')) +
      '<p class="muted">' + esc(t('pg.asOf', { date: fd(pp.asOf) })) + '</p></div></section>';
    var method = card(esc(t('pg.method')), '<div class="card-b stack">' + (cfg ? '<p><b>' + esc(t('pgm.' + cfg.method)) + '</b>' + testPill(cfg.testExample, cfg.label) + '</p><p class="field-hint">' + esc(t('pgm.' + cfg.method + '.d')) + '</p>' +
      kv([[t('pg.approvedBy'), esc(person(cfg.approvedBy) + ' · ' + fd(cfg.approvedAt))]]) : '<div class="notice warn" role="status">' + ic('alert') + '<span><b>' + esc(t('pg.notConfigured')) + '</b> ' + esc(t('pg.notConfigured.d')) + '</span></div>') + '</div>');
    var calc = '';
    if (pp.calc && pp.calc.kind === 'weighted') {
      calc = '<p class="mono calc" dir="ltr">' + esc(t('pg.calcWeighted', { done: pp.calc.done, total: pp.calc.total })) + (pp.pct !== null ? ' = ' + pp.pct + '%' : '') + '</p>' + (pp.reason === 'weights_invalid' ? '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('pg.weightsInvalid')) + '</span></div>' : '');
    } else if (pp.calc && pp.calc.kind === 'quantities') {
      var qrows = pp.calc.rows.map(function (r) {
        return '<tr><td>' + esc(L(r, 'description')) + '</td><td class="num">' + num(r.planned) + ' ' + esc(r.unit) + '</td><td class="num">' + num(r.done) + ' ' + esc(r.unit) + (r.over ? ' ' + pill('crit', t('pg.over')) : '') + '</td><td class="num">' + (r.planned ? Math.round(r.counted / r.planned * 100) + '%' : '—') + '</td><td>' + (r.updates.length ? r.updates.map(function (id) { return recLink('dailyupdate', id); }).join(' ') : '—') + '</td></tr>';
      });
      calc = table([t('pg.line'), t('pg.planned'), t(cust ? 'pg.donePublished' : 'pg.doneReviewed'), t('misc.progress'), t('pg.fromUpdates')], qrows, 'qtable') +
        (pp.reason === 'mixed_units' ? '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('pg.mixedUnits')) + ' (' + esc(pp.calc.units.join(', ')) + ')</span></div>' :
          '<p class="mono calc" dir="ltr">' + esc(t('pg.calcQty', { done: num(pp.calc.done), total: num(pp.calc.total), unit: pp.calc.unit || '' })) + (pp.pct !== null ? ' = ' + pp.pct + '%' : '') + '</p>');
    }
    // milestones: reported, verified and customer acceptance shown separately
    var ms = pp.milestones.map(function (m) {
      var c = st.msControls(u.id, m);
      var rep = m.reported ? esc(person(m.reported.by) + ' · ' + fdt(m.reported.at)) + (m.reported.updateId ? ' ' + recLink('dailyupdate', m.reported.updateId) : '') : '<span class="muted">—</span>';
      var ver = m.completedAt ? pill('ok', fd(m.completedAt)) + '<br><span class="muted">' + esc(person(m.verifiedBy)) + '</span>' : (m.reported ? pill('warn', t('pg.awaitingVerify')) : '<span class="muted">—</span>');
      var acc = m.acceptance ? pill('ok', fd(m.acceptance.at)) : '<span class="muted">' + esc(t('pg.accNotConfigured')) + '</span>';
      var evs = (m.evidence || []).filter(function (id) { var e = st.get('evidence', id); return e && st.canSee(u.id, 'evidence', e); }).map(function (id) { return recLink('evidence', id); }).join(' ');
      var acts = [];
      if (c.verify) acts.push('<button class="btn btn-primary btn-sm" data-pact="f6-open" data-v="ms-verify.' + m.id + '">' + esc(t('pg.f.verify')) + '</button>');
      if (c.forecast) acts.push('<button class="btn btn-secondary btn-sm" data-pact="f6-open" data-v="ms-forecast.' + m.id + '">' + esc(t('pg.f.forecast')) + '</button>');
      if (c.rebaseline) acts.push('<button class="btn btn-ghost btn-sm" data-pact="f6-open" data-v="ms-rebaseline.' + m.id + '">' + esc(t('pg.f.rebaseline')) + '</button>');
      if (c.verifySelf && !cust) acts.push('<span class="why">' + esc(t('pg.why.self')) + '</span>');
      return '<tr><td><b>' + esc(L(m, 'name')) + '</b><br><span class="muted">' + esc(areaName(m.areaId)) + ' · ' + esc(person(m.ownerId)) + '</span></td>' + (pp.method === 'weighted_milestones' ? '<td class="num">' + m.weight + '</td>' : '') +
        '<td>' + esc(fd(m.planned)) + ((m.baselineHistory || []).length ? ' ' + pill('plain', t('pg.rebaselined', { n: m.baselineHistory.length })) : '') + '</td><td>' + dueCell(m.forecast, !!m.completedAt) + '</td>' +
        (cust ? '' : '<td>' + rep + '</td>') + '<td>' + ver + '</td><td>' + acc + '</td><td>' + (evs || '<span class="muted">—</span>') + '</td>' + (cust ? '' : '<td><div class="btn-stack">' + acts.join('') + '</div></td>') + '</tr>' +
        (F().key && F().key.split('.')[1] === m.id && /^ms-/.test(F().key) ? '<tr class="formrow"><td colspan="9">' + msForm(u, m) + '</td></tr>' : '');
    });
    var msHead = [t('ms.name')].concat(pp.method === 'weighted_milestones' ? [t('ms.weight')] : []).concat([t('pg.baseline'), t('ms.forecast')]).concat(cust ? [] : [t('pg.reported')]).concat([t('pg.verified'), t('pg.acceptance'), t('pg.evidence')]).concat(cust ? [] : ['']);
    var msCard = card(esc(t('pkgsec.milestones')) + ' <span class="pill plain num">' + pp.milestones.length + '</span>', table(msHead, ms, 'mstable') + '<p class="card-b field-hint">' + esc(t('pg.threeStates')) + '</p>');
    // settings changes (weights / planned quantities) with reasons and history
    var setCard = '';
    if (!cust && cfg && can(u.id, 'progress.baseline', { packageId: w.id })) {
      var key = cfg.method === 'weighted_milestones' ? 'pg-weights.' + w.id : 'pg-planned.' + w.id;
      setCard = card(esc(t('pg.settings')), '<div class="card-b stack"><p class="field-hint">' + esc(t('pg.settings.d')) + '</p>' + (isOpen(key) ? settingsForm(u, w, cfg, pp) : '<div class="btn-stack">' + opener(key, t(cfg.method === 'weighted_milestones' ? 'pg.f.weights' : 'pg.f.planned')) +
        (cfg.method === 'quantities' ? opener('pg-addline.' + w.id, t('pg.f.addLine')) : '') + '</div>') + (isOpen('pg-addline.' + w.id) ? addLineForm(u, w, cfg) : '') + '</div>');
    }
    var hist = [];
    pp.milestones.forEach(function (m) {
      (m.baselineHistory || []).forEach(function (x) { hist.push({ at: x.at, html: '<b>' + esc(L(m, 'name')) + '</b> · ' + esc(t('pg.h.baseline', { from: fd(x.from), to: fd(x.to) })), by: x.by, reason: x.reason }); });
      if (!cust) (m.forecastHistory || []).forEach(function (x) { hist.push({ at: x.at, html: '<b>' + esc(L(m, 'name')) + '</b> · ' + esc(t('pg.h.forecast', { from: fd(x.from), to: fd(x.to) })), by: x.by, reason: x.reason }); });
    });
    if (cfg) cfg.history.forEach(function (x) { hist.push({ at: x.at, html: esc(t('pg.h.' + x.change, { line: x.lineId || '', from: typeof x.from === 'object' && x.from ? Object.keys(x.from).map(function (k) { return msName(k) + ' ' + x.from[k]; }).join(', ') : String(x.from), to: typeof x.to === 'object' ? Object.keys(x.to).map(function (k) { return msName(k) + ' ' + x.to[k]; }).join(', ') : String(x.to) })), by: x.by, reason: x.reason }); });
    hist.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var histCard = card(esc(t('pg.history')), hist.length ? '<ol class="revlist card-b">' + hist.map(function (x) { return '<li>' + x.html + '<span class="muted">' + esc(person(x.by) + ' · ' + fdt(x.at)) + '</span><span>' + esc(x.reason || '') + '</span></li>'; }).join('') + '</ol>' : emptyBox('reports', t('pg.noHistory')));
    var updates = st.dailyUpdatesList(u.id, { package: w.id }).slice(0, 6);
    var upCard = card(esc(t(cust ? 'pg.publishedUpdates' : 'nav.dailyupdates')), updates.length ? '<ul class="doclist">' + updates.map(function (d) { return '<li>' + recLink('dailyupdate', d.id) + '<span class="t"><b>' + esc(d.workDone) + '</b><span>' + esc(fd(d.date)) + ' · ' + esc(person(d.authorId)) + '</span></span>' + (cust ? '' : dupPill(d.status)) + '</li>'; }).join('') + '</ul>' : emptyBox('reports', t('du.none')));
    return head + '<div class="grid g-home"><div class="grid">' + card(esc(t('pg.calc')), '<div class="card-b stack">' + (calc || '<p class="muted">' + esc(t('pg.notConfigured')) + '</p>') + '<p class="field-hint">' + esc(t(cust ? 'pg.lens.customer' : 'pg.lens.staff')) + '</p>' + stamp() + '</div>') + msCard + histCard + '</div>' +
      '<div class="grid">' + method + setCard + upCard + '</div></div>';
  }
  function msForm(u, m) {
    var k = F().key.split('.')[0];
    if (k === 'ms-verify') return formWrap(F().key, t('pg.f.verify'), '<p class="field-hint">' + esc(t('pg.verifyHint')) + '</p>' + input('date', t('pg.actualDate'), 'date', { value: ST().today, max: ST().today }) + input('note', t('fi.note'), 'text', { optional: true }), t('pg.f.verify'));
    if (k === 'ms-forecast') return formWrap(F().key, t('pg.f.forecast'), input('forecast', t('ms.forecast'), 'date', { value: m.forecast }) + input('reason', t('dv.reason'), 'textarea'), t('pg.f.forecast'));
    return formWrap(F().key, t('pg.f.rebaseline'), '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('pg.rebaselineHint')) + '</span></div>' + input('planned', t('pg.baseline'), 'date', { value: m.planned }) + input('reason', t('dv.reason'), 'textarea'), t('pg.f.rebaseline'));
  }
  function settingsForm(u, w, cfg, pp) {
    if (cfg.method === 'weighted_milestones') {
      var body = '<div class="wgrid">' + pp.milestones.map(function (m) { return input('w_' + m.id, L(m, 'name'), 'number', { value: m.weight, min: '0', step: '1' }); }).join('') + '</div>' +
        '<p class="field-hint">' + esc(t('pg.weightsHint', { total: (ST().policy.progress || {}).weightTotal || 100 })) + '</p>' + input('reason', t('dv.reason'), 'textarea');
      return formWrap(F().key, t('pg.f.weights'), body, t('pg.f.weights'));
    }
    var body2 = select('lineId', t('pg.line'), cfg.lines.map(function (l) { return [l.id, L(l, 'description') + ' · ' + num(l.planned) + ' ' + l.unit]; })) + input('planned', t('pg.planned') + ' (' + cfg.unit + ')', 'number', { min: '0' }) + input('reason', t('dv.reason'), 'textarea');
    return formWrap(F().key, t('pg.f.planned'), body2, t('pg.f.planned'));
  }
  function addLineForm(u, w, cfg) {
    return formWrap(F().key, t('pg.f.addLine'), input('description', t('pg.line'), 'text') + '<div class="grid g-2">' + input('planned', t('pg.planned'), 'number', { min: '0' }) + input('unit', t('pg.unit'), 'text', { value: cfg.unit, hint: t('pg.unitHint', { unit: cfg.unit }) }) + '</div>' + input('reason', t('dv.reason'), 'textarea'), t('pg.f.addLine'));
  }

  // =====================================================================================================
  // 2. DAILY UPDATES (site officer, mobile)
  // =====================================================================================================
  function dupListPage(u) {
    var st = ST(), s = S(); if (!s.dupf) s.dupf = { project: '', status: '', mine: false };
    var f = s.dupf, list = st.dailyUpdatesList(u.id, f);
    var rows = list.map(function (d) {
      return '<a class="list-row rowlink" ' + go('dup.' + d.id) + '><span class="sev ' + (DUP_TONE[d.status] || '') + '"></span><span class="t"><span class="row" style="gap:6px">' + dupPill(d.status) + (d.reviewerId === u.id && d.status === 'submitted' ? pill('warn', t('du.yourReview')) : '') + '</span>' +
        '<b>' + esc(d.workDone || t('du.untitled')) + '</b><span><span class="mono">' + esc(d.ref) + '</span> · ' + esc(pkgCode(d.packageId)) + ' · ' + esc(fd(d.date)) + ' · ' + esc(person(d.authorId)) + '</span></span></a>';
    }).join('');
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="dupf.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(f[key]) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    return crumbs([[t('nav.home'), 'home'], [t('nav.dailyupdates'), null]]) + '<div class="page-h"><div><h1>' + esc(t('du.title')) + '</h1><p>' + esc(t('du.sub')) + '</p></div>' +
      (canAnywhere(u.id, 'progress.report') ? '<a class="btn btn-primary" ' + go('dupnew') + '>' + pic('plus') + esc(t('du.new')) + '</a>' : '') + '</div>' +
      '<div class="notice">' + ic('info') + '<span>' + esc(t('du.flow')) + '</span></div>' +
      '<section class="card card-b act-tools">' + sel('dup-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(st.visibleProjects(u.id).map(function (p) { return [p.id, p.code]; }))) +
      sel('dup-status', 'status', t('f.status'), [['', t('f.all')]].concat(['draft', 'submitted', 'returned', 'approved', 'published'].map(function (x) { return [x, t('dupst.' + x)]; }))) +
      '<label class="check"><input type="checkbox" data-pbind="dupf.mine"' + (f.mine ? ' checked' : '') + '> ' + esc(t('du.mine')) + '</label></section>' +
      card(esc(t('du.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? '<div class="list">' + rows + '</div>' : emptyBox('reports', t('du.none')));
  }
  // The form keeps its values on the device until submitted (reload- and upload-failure-safe).
  function dupKey(id) { return 'rgs.dup.' + (id || 'new'); }
  function dupState(id) {
    var s = S(); s.dupd = s.dupd || {};
    var k = id || 'new';
    if (!s.dupd[k]) {
      var rec = id ? ST().get('dailyupdate', id) : null, stored = load(dupKey(id));
      var base = rec ? { id: rec.id, packageId: rec.packageId, areaId: rec.areaId, date: rec.date, workDone: rec.workDone, quantities: JSON.parse(JSON.stringify(rec.quantities)), milestoneIds: rec.milestoneIds.slice(), evidence: rec.evidence.slice(), blockers: rec.blockers, next: rec.next }
        : { id: null, packageId: '', areaId: '', date: ST().today, workDone: '', quantities: [], milestoneIds: [], evidence: [], blockers: '', next: '' };
      s.dupd[k] = stored && stored.v && (!rec || stored.version === rec.version) ? { v: stored.v, restored: true, errors: {}, key: 'dsub-' + X.rnd(), version: rec ? rec.version : null } : { v: base, restored: false, errors: {}, key: 'dsub-' + X.rnd(), version: rec ? rec.version : null };
    }
    return s.dupd[k];
  }
  function dupPersist(id) { var d = S().dupd[id || 'new']; save(dupKey(id), { v: d.v, version: d.version }); }
  X.addProfile({ prefix: 'dupev-', single: false, capture: true, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'], max: 25 * 1048576, accept: 'image/*,application/pdf', hint: 'dlg.fileHint',
    typeError: 'dlg.err.fileType', sizeError: 'dlg.err.fileSize',
    payload: function (ctx) { var d = dupState(ctx.slice(6) === 'new' ? null : ctx.slice(6)).v; var w = ST().get('package', d.packageId); return { purpose: 'evidence', projectId: w ? w.projectId : null, packageId: d.packageId || null }; },
    onDone: function (ctx, item) {
      var key = ctx.slice(6), id = key === 'new' ? null : key, ds = dupState(id), d = ds.v;
      // the photo becomes evidence linked to the update; the update is saved as a draft first so the link exists
      if (!d.id) { var r0 = API().dispatch('dailyupdate.save', me().id, Object.assign({ idempotencyKey: ds.key + '-draft' }, dupPayload(d))); if (!r0.ok) { item.status = 'failed'; item.error = 'err.' + r0.code; return; } d.id = r0.result.id; ds.version = r0.result.version; }
      var r = API().dispatch('evidence.upload', me().id, { idempotencyKey: 'ev-' + item.key, packageId: d.packageId, areaId: d.areaId || ST().get('package', d.packageId).areaId, caption: t('du.photoCaption', { date: fd(d.date) }) + (d.workDone ? ' — ' + d.workDone.slice(0, 60) : ''), linked: { kind: 'dailyupdate', id: d.id }, fileId: item.fileId, audience: 'customer' });
      if (!r.ok) { item.status = 'failed'; item.error = 'err.' + r.code; return; }
      item.evidenceId = r.result.id;
      if (d.evidence.indexOf(r.result.id) < 0) d.evidence.push(r.result.id);
      var cur = ST().get('dailyupdate', d.id);
      var r2 = API().dispatch('dailyupdate.save', me().id, Object.assign({ id: d.id, version: cur.version }, dupPayload(d)));
      if (r2.ok) ds.version = r2.result.version;
      dupPersist(id);
    } });
  function dupPayload(d) {
    return { packageId: d.packageId, areaId: d.areaId, date: d.date, workDone: d.workDone, blockers: d.blockers, next: d.next, milestoneIds: d.milestoneIds, evidence: d.evidence,
      quantities: (d.quantities || []).filter(function (q) { return q.qty !== '' && q.qty != null && Number(q.qty) !== 0; }) };
  }
  function dupFormPage(u, args) {
    var st = ST(), id = args[0] || null, rec = id ? st.get('dailyupdate', id) : null;
    if (id) { var g = h.guard(u, 'dailyupdate', rec); if (g) return g; if (!st.dupControls(u.id, rec).edit) return U().deniedState({ code: 'role' }, null); }
    var pkgs = []; st.visibleProjects(u.id).forEach(function (p) { pkgs = pkgs.concat(st.visiblePackages(u.id, p.id).filter(function (w) { return can(u.id, 'progress.report', { packageId: w.id }); })); });
    if (!pkgs.length) return U().deniedState({ code: 'role' }, null);
    var ds = dupState(id), d = ds.v, e = ds.errors, w = d.packageId && st.get('package', d.packageId);
    if (!d.packageId && pkgs.length === 1) { d.packageId = pkgs[0].id; w = pkgs[0]; }
    var cfg = w && st.progressConfig(w.id);
    var areas = w ? st.areas(w.projectId).filter(function (a) { return a.id === w.areaId || a.parentId === w.areaId; }) : [];
    function err1(k) { return e[k] ? '<div class="field-error" id="du-' + k + '-err">' + ic('alert') + esc(t(e[k])) + '</div>' : ''; }
    var body = '<div class="field"><label for="du-package">' + esc(t('misc.package')) + '</label><select id="du-package" class="select" data-dubind="packageId"' + (id ? ' disabled' : '') + (e.packageId ? ' aria-invalid="true"' : '') + '><option value="">' + esc(t('dlg.choose')) + '</option>' +
      pkgs.map(function (x) { return '<option value="' + x.id + '"' + (d.packageId === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + t('svc.' + x.service)) + '</option>'; }).join('') + '</select>' + err1('packageId') + '</div>';
    if (w) {
      body += '<div class="grid g-2"><div class="field"><label for="du-area">' + esc(t('rq.area')) + '</label><select id="du-area" class="select" data-dubind="areaId"><option value="">' + esc(t('dlg.choose')) + '</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (d.areaId === a.id ? ' selected' : '') + '>' + esc(a.code + ' · ' + L(a, 'name')) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="du-date">' + esc(t('du.date')) + '</label><input id="du-date" type="date" class="input" max="' + st.today + '" data-dutext="date" value="' + esc(d.date) + '"></div></div>' +
        '<div class="field"><label for="du-work">' + esc(t('du.work')) + '</label><textarea id="du-work" class="textarea" rows="3" data-dutext="workDone"' + (e.workDone ? ' aria-invalid="true"' : '') + '>' + esc(d.workDone) + '</textarea>' + err1('workDone') + '</div>';
      if (cfg && cfg.method === 'quantities') {
        var pp = st.packageProgress(w.id);
        body += '<fieldset class="field"><legend class="label">' + esc(t('du.quantities')) + '</legend><div class="stack">' + cfg.lines.map(function (l) {
          var q = (d.quantities || []).filter(function (x) { return x.lineId === l.id; })[0] || {}, row = pp.calc.rows.filter(function (r) { return r.id === l.id; })[0];
          return '<div class="qrow"><label for="du-q-' + l.id + '">' + esc(L(l, 'description')) + '<span class="field-hint">' + esc(t('du.qtyHint', { done: num(row.done), planned: num(l.planned), unit: l.unit })) + '</span></label><div class="qinput"><input id="du-q-' + l.id + '" class="input num" inputmode="decimal" data-duq="' + l.id + '" value="' + esc(q.qty == null ? '' : q.qty) + '"><span class="unit">' + esc(l.unit) + '</span></div></div>';
        }).join('') + '</div><span class="field-hint">' + esc(t('du.qtyRule')) + '</span>' + err1('quantities') + '</fieldset>';
      } else {
        body += '<p class="field-hint">' + esc(t(cfg ? 'du.noQuantities' : 'pg.notConfigured')) + '</p>';
      }
      var open = st.pkgMilestones(w.id).filter(function (m) { return !m.completedAt; });
      if (open.length) body += '<fieldset class="field"><legend class="label">' + esc(t('du.milestones')) + '</legend><div class="checks">' + open.map(function (m) { return '<label class="check"><input type="checkbox" data-dums="' + m.id + '"' + (d.milestoneIds.indexOf(m.id) >= 0 ? ' checked' : '') + (m.reported && m.reported.updateId !== d.id ? ' disabled' : '') + '> ' + esc(L(m, 'name')) + (m.reported ? ' ' + pill('warn', t('pg.awaitingVerify')) : '') + '</label>'; }).join('') + '</div><span class="field-hint">' + esc(t('du.milestonesHint')) + '</span></fieldset>';
      body += '<div class="field"><span class="label">' + esc(t('du.photos')) + '</span>' + (d.evidence.length ? '<span class="fchips">' + d.evidence.map(function (x) { return recLink('evidence', x); }).join('') + '</span>' : '') + X.uploadControl('dupev-' + (id || 'new'), t('du.addPhoto')) + '<span class="field-hint">' + esc(t('du.sessionFiles')) + '</span></div>' +
        '<div class="field"><label for="du-block">' + esc(t('du.blockers')) + ' ' + esc(t('dlg.optional')) + '</label><textarea id="du-block" class="textarea" rows="2" data-dutext="blockers">' + esc(d.blockers) + '</textarea></div>' +
        '<div class="field"><label for="du-next">' + esc(t('du.next')) + '</label><textarea id="du-next" class="textarea" rows="2" data-dutext="next">' + esc(d.next) + '</textarea></div>' +
        '<p class="field-hint">' + esc(t('du.reviewer', { who: person(st.dupReviewer(w.id, u.id)) })) + '</p>';
    }
    return '<div class="field-page">' + crumbs([[t('nav.dailyupdates'), 'dailyupdates'], [rec ? rec.ref : t('du.new'), null]]) + '<div class="page-h"><div><h1>' + esc(t(rec ? 'du.edit' : 'du.new')) + '</h1><p>' + esc(t('du.formSub')) + '</p></div></div>' +
      (ds.restored ? '<div class="notice">' + ic('info') + '<span>' + esc(t('fi.restored')) + '</span></div>' : '') + (rec && rec.status === 'returned' && rec.review ? '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('du.returnedBy', { who: person(rec.review.by) })) + ' “' + esc(rec.review.reason) + '”</span></div>' : '') +
      errBox(ds.serverError, ds.detail) + '<section class="card card-b stack">' + body + '</section>' +
      '<div class="fi-bar"><button type="button" class="btn btn-secondary" data-pact="du-save">' + esc(t('fi.saveDraft')) + '</button><button type="button" class="btn btn-primary" data-pact="du-submit">' + esc(t('du.submit')) + '</button></div>' +
      '<p class="field-hint">' + esc(t('fi.offline')) + '</p></div>';
  }
  function snapDup() {
    var id = currentDupId(), ds = S().dupd && S().dupd[id || 'new']; if (!ds) return;
    var d = ds.v;
    document.querySelectorAll('[data-dutext]').forEach(function (el) { d[el.getAttribute('data-dutext')] = el.value; });
    var qs = [];
    document.querySelectorAll('[data-duq]').forEach(function (el) { if (String(el.value).trim() !== '') { var line = ST().progressConfig(d.packageId).lines.filter(function (l) { return l.id === el.getAttribute('data-duq'); })[0]; qs.push({ lineId: el.getAttribute('data-duq'), qty: String(el.value).trim(), unit: line ? line.unit : '' }); } });
    if (document.querySelectorAll('[data-duq]').length) d.quantities = qs;
    dupPersist(id);
  }
  function currentDupId() { var r = (location.hash || '').slice(1).split('.'); return r[0] === 'dupnew' && r[1] ? r[1] : null; }
  function dupSave(submit) {
    snapDup();
    var id = currentDupId(), ds = dupState(id), d = ds.v, st = ST();
    ds.errors = {}; ds.serverError = null; ds.detail = null;
    if (!d.packageId) ds.errors.packageId = 'wiz.err.choose';
    if (submit && String(d.workDone || '').trim().length < 5) ds.errors.workDone = 'du.err.work';
    (d.quantities || []).forEach(function (q) { if (!(Number(q.qty) > 0)) ds.errors.quantities = 'du.err.qty'; });
    if (X.uploadsBusy('dupev-' + (id || 'new'))) { ds.serverError = 'upload_busy'; }
    if (Object.keys(ds.errors).length || ds.serverError) { U().render(); X.focusInvalid(); return; }
    var r;
    if (!d.id) r = API().dispatch('dailyupdate.save', me().id, Object.assign({ idempotencyKey: ds.key + '-draft' }, dupPayload(d)));
    else { var cur = st.get('dailyupdate', d.id); r = API().dispatch('dailyupdate.save', me().id, Object.assign({ id: d.id, version: cur.version }, dupPayload(d))); }
    if (!r.ok) { ds.serverError = r.code; ds.detail = r.detail && r.detail.lineId ? r.detail.lineId : null; U().render(); return; }
    d.id = r.result.id; ds.version = r.result.version;
    if (!submit) { dupPersist(id); U().toast(t('fi.savedToast')); U().render(); return; }
    var r2 = API().dispatch('dailyupdate.submit', me().id, { id: d.id, version: st.get('dailyupdate', d.id).version, idempotencyKey: ds.key });
    if (!r2.ok) { ds.serverError = r2.code; U().render(); return; }
    save(dupKey(id), null); S().dupd[id || 'new'] = null;
    if (S().uploads) delete S().uploads['dupev-' + (id || 'new')];
    U().toast(t('du.submitted', { who: person(r2.result.reviewerId) })); U().go('dup.' + d.id);
  }
  function dupDetail(u, args) {
    var st = ST(), d = st.get('dailyupdate', args[0]);
    var g = h.guard(u, 'dailyupdate', d); if (g) return g;
    var c = st.dupControls(u.id, d), cust = st.isCustomer(u.id), cfg = st.progressConfig(d.packageId);
    var q = (d.quantities || []).map(function (x) { var l = cfg && cfg.lines.filter(function (y) { return y.id === x.lineId; })[0]; return '<li><b class="num">' + num(x.qty) + ' ' + esc(x.unit) + '</b> · ' + esc(l ? L(l, 'description') : x.lineId) + '</li>'; }).join('');
    var ms = d.milestoneIds.map(function (id) { var m = st.get('milestone', id); return '<li>' + esc(L(m, 'name')) + ' ' + (m.completedAt ? pill('ok', t('pg.verifiedOn', { date: fd(m.completedAt) })) : m.reported && m.reported.updateId === d.id ? pill('warn', t('pg.awaitingVerify')) : pill('plain', t('du.notReported'))) + '</li>'; }).join('');
    var main = card(esc(t('rec.details')), '<div class="card-b stack"><p class="lead">' + esc(d.workDone) + '</p>' + kv([[t('misc.package'), recLink('package', d.packageId)], [t('rq.area'), esc(areaName(d.areaId))], [t('du.date'), esc(fd(d.date))], [t('du.author'), personRole(d.authorId)],
        cust ? null : [t('du.reviewerLabel'), d.reviewerId ? personRole(d.reviewerId) : '—'], [t('du.quantities'), q ? '<ul class="plain">' + q + '</ul>' : '—'], [t('du.milestones'), ms ? '<ul class="plain">' + ms + '</ul>' : '—'],
        [t('du.blockers'), esc(d.blockers || '—')], [t('du.next'), esc(d.next || '—')], [t('du.photos'), (d.evidence || []).filter(function (x) { var e = st.get('evidence', x); return e && st.canSee(u.id, 'evidence', e); }).map(function (x) { return recLink('evidence', x); }).join(' ') || '—']]) +
      '<p class="field-hint">' + esc(t('du.sessionFiles')) + '</p></div>');
    var flow = card(esc(t('du.flowTitle')), '<ul class="droute card-b">' +
      decRow(t('du.s.reported'), d.submittedAt ? esc(person(d.authorId) + ' · ' + fdt(d.submittedAt)) : esc(t('dupst.draft')), !!d.submittedAt) +
      decRow(t('du.s.reviewed'), d.review ? esc(person(d.review.by) + ' · ' + fdt(d.review.at)) + ' · ' + esc(t('duout.' + d.review.outcome)) + (d.review.reason ? ' “' + esc(d.review.reason) + '”' : '') : esc(t('ins.notYet')), !!(d.review && d.review.outcome === 'approved')) +
      decRow(t('du.s.published'), d.publishedAt ? esc(person(d.publishedBy) + ' · ' + fdt(d.publishedAt)) : esc(t('ins.notYet')), !!d.publishedAt) + '</ul><p class="field-hint card-b">' + esc(t('du.flow')) + '</p>');
    var a = [];
    if (c.edit) a.push('<a class="btn btn-primary" ' + go('dupnew.' + d.id) + '>' + esc(t('du.edit')) + '</a>');
    if (c.review) a.push(opener('dup-review.' + d.id, t('du.f.review'), true));
    if (c.publish) a.push(opener('dup-publish.' + d.id, t('du.f.publish'), true));
    if (!cust && c.reviewBlocked && d.status === 'submitted') a.push('<span class="why">' + esc(t(c.reviewBlocked === 'self_approval' ? 'du.why.self' : 'du.why.reviewer', { who: person(d.reviewerId) })) + '</span>');
    var form = '';
    if (isOpen('dup-review.' + d.id)) form = formWrap(F().key, t('du.f.review'), '<fieldset class="field"><legend class="label">' + esc(t('dv.outcome')) + '</legend><div class="row">' + ['approved', 'returned'].map(function (o) { return '<label class="check"><input type="radio" name="outcome" value="' + o + '"' + (val('outcome', 'approved') === o ? ' checked' : '') + '> ' + esc(t('duout.' + o)) + '</label>'; }).join('') + '</div></fieldset>' + input('reason', t('dv.reason'), 'textarea', { optional: true }) + '<p class="field-hint">' + esc(t('du.reviewHint')) + '</p>', t('du.f.review'));
    if (isOpen('dup-publish.' + d.id)) form = formWrap(F().key, t('du.f.publish'), '<p class="field-hint">' + esc(t('du.publishHint')) + '</p>', t('du.f.publish'));
    var side = (a.length || form ? card(esc(t('rd.actions')), '<div class="card-b stack"><div class="btn-stack">' + a.join('') + '</div>' + form + '</div>') : '') + flow;
    return h.recordShell(u, 'dailyupdate', d, d.ref + ' · ' + fd(d.date), cust ? '' : dupPill(d.status), main, side);
  }
  function decRow(label, body, done) { return '<li class="dr ' + (done ? 'dr-done' : 'dr-later') + '"><span class="dr-dot">' + pic(done ? 'check' : 'clock') + '</span><div class="t"><b>' + esc(label) + '</b><span>' + body + '</span></div></li>'; }

  window.RGSPages6 = { F: F, openForm: openForm, isOpen: isOpen, val: val, input: input, select: select, formWrap: formWrap, opener: opener, run: run, need: need, invalid: invalid, errBox: errBox,
    dupPill: dupPill, cmPill: cmPill, rdPill: rdPill, rptPill: rptPill, hpPill: hpPill, depPill: depPill, decRow: decRow, nodeLabel: nodeLabel, testPill: testPill, num: num, stamp: stamp, areaName: areaName, pkgCode: pkgCode,
    canAnywhere: canAnywhere, can: can, msName: msName, snapDup: snapDup, dupSave: dupSave, dupState: dupState, dupPersist: dupPersist, currentDupId: currentDupId, nowStamp: nowStamp };
  P.extend({
    bases: { prog: projectProgressPage, pprog: packageProgressPage, dupnew: dupFormPage, dup: dupDetail },
    modules: { progress: progressModule, dailyupdates: dupListPage }
  });
})();
