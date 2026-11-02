/*
 * RGS Client Portal — Stage 2 pages: customer overview, project directory, project workspace,
 * service packages, linked records, my actions and commitments, project activity.
 *
 * Every number, status and list on these pages comes from the record store (store.js) and
 * every record passes the access rules (rbac.js) before it is rendered.
 */
(function () {
  'use strict';
  var P = {};
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function esc(x) { return U().esc(x); }
  function t(k, vars) {
    var s = U().t(k);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, v) { return vars[v] != null ? vars[v] : ''; });
    return s;
  }
  // template with HTML slots: text parts escaped, slot values inserted as given
  function th(k, slots) {
    var raw = U().t(k), out = '', re = /\{(\w+)\}/g, last = 0, m;
    while ((m = re.exec(raw))) { out += esc(raw.slice(last, m.index)) + (slots[m[1]] != null ? slots[m[1]] : ''); last = re.lastIndex; }
    return out + esc(raw.slice(last));
  }
  function L(o, f) { return U().L(o, f); }
  function ar() { return S().lang === 'ar'; }
  function fd(d) { return d ? U().fmtDate(d) : '—'; }
  function ftime(d) { return d && d.length > 10 ? d.slice(11, 16) : ''; }
  function person(uid) { var u = U().byId(U().D.users, uid); return u ? u.name : (uid || '—'); }
  function orgName(id) { var o = U().byId(U().D.orgs, id); return o ? L(o, 'name') : id; }
  function byWho(id) { return /^org-/.test(id) ? orgName(id) : person(id); }

  var PI = {
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>', team: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20a6 6 0 0112 0M10 20a6 6 0 0112 0"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', ack: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M9.5 15l2 2 4-4.5"/>', accept: '<path d="M4 12h3l3-3 4 1 3 3h3"/><path d="M7 12l4 4 3-1"/><path d="M15 4l2 2 4-4"/>',
    sign: '<path d="M4 20c3-1 4-4 6-4s1 3 3 3 3-2 7-2"/><path d="M14 4l6 6-8 8H6v-6z"/>', change: '<path d="M4 7h12l-3-3M20 17H8l3 3"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  function pic(n, cls) { return PI[n] ? '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + PI[n] + '</svg>' : U().ic(n, cls); }

  // ---------------------------------------------------------------- record routing
  var KIND_ROUTE = { project: 'project', package: 'package', document: 'doc', inspection: 'insp', corrective: 'ca', change: 'chg', request: 'req', evidence: 'ev', transmittal: 'tr', finding: 'fnd', template: 'tpl',
    commitment: 'cm', dailyupdate: 'dup', report: 'rpt', handoverpkg: 'hp' };
  var ROUTE_KIND = { project: 'project', package: 'package', doc: 'document', insp: 'inspection', ca: 'corrective', chg: 'change', req: 'request', ev: 'evidence', tr: 'transmittal', fnd: 'finding', tpl: 'template',
    cm: 'commitment', dup: 'dailyupdate', rpt: 'report', hp: 'handoverpkg' };
  var KIND_ICON = { project: 'projects', package: 'services', document: 'documents', inspection: 'inspections', corrective: 'corrective', change: 'change', request: 'requests', evidence: 'camera', commitment: 'commitments', milestone: 'flag', action: 'approvals', transmittal: 'send', file: 'documents', finding: 'flag', template: 'inspections' , dailyupdate: 'reports', report: 'reports', handoverpkg: 'handover', release: 'shield', dependency: 'link', progressconfig: 'reports' };
  function routeOf(kind, id) {
    if (KIND_ROUTE[kind]) return KIND_ROUTE[kind] + '.' + id;
    var r = ST().get(kind, id); if (!r) return 'home';
    if (kind === 'dependency') return 'deps.' + r.projectId;
    if (kind === 'release') return 'hp.' + r.handoverPackageId;
    if (kind === 'progressconfig') return 'pprog.' + r.packageId;
    if (kind === 'evidence') return 'project.' + ST().projectOf(r) + '.photos';
    if (kind === 'milestone') return 'pprog.' + r.packageId;
    if (kind === 'action') return 'actions';
    return 'home';
  }
  function codeOf(kind, r) {
    if (!r) return '?';
    if (kind === 'document') return r.number;
    if (kind === 'package' || kind === 'project') return r.code;
    if (kind === 'milestone') return L(r, 'name');
    if (kind === 'action') return r.id;
    if (kind === 'handoverpkg') return r.ref + ' v' + (r.pkgVersion || 1);
    return r.ref || r.id;
  }
  function recLink(kind, id, label) {
    var r = ST().get(kind, id), u = U().user();
    if (!r) return '<span class="rec missing">' + esc(id) + '</span>';
    var visible = kind === 'action' || ST().canSee(u.id, kind === 'milestone' ? 'milestone' : kind, r);
    if (!visible) return '<span class="rec restricted" title="' + esc(t('rec.restricted')) + '">' + pic('lock') + '<span class="mono">' + esc(codeOf(kind, r)) + '</span></span>';
    var route = routeOf(kind, id);
    return '<a class="rec" href="#' + route + '" data-route="' + route + '">' + pic(KIND_ICON[kind] || 'documents') + '<span class="mono">' + esc(label || codeOf(kind, r)) + '</span></a>';
  }
  function go(route) { return 'href="#' + route + '" data-route="' + route + '"'; }

  // ---------------------------------------------------------------- small components
  function pill(tone, label) { return '<span class="pill ' + tone + '">' + esc(label) + '</span>'; }
  var TONE = {
    health: { on_track: 'ok', at_risk: 'warn', overdue: 'crit' },
    commitment: { complete: 'ok', on_track: 'info', at_risk: 'warn', overdue: 'crit' },
    action: { pending: 'info', overdue: 'crit', done: 'ok' },
    doc: { approved: 'ok', issued: 'info', returned: 'warn', superseded: '', draft: '' },
    result: { accepted: 'ok', observations: 'warn', rejected: 'crit', scheduled: 'info' },
    ca: { in_progress: 'warn', awaiting_verification: 'info', closed: 'ok' },
    req: { draft: '', submitted: 'info', clarification_requested: 'warn', in_review: 'info', completion_submitted: 'warn', resolved: 'ok', closed: 'plain-ok', cancelled: '', superseded: '', withdrawn: '' },
    chg: { draft: '', under_review: 'info', awaiting_approval: 'warn', authorised: 'ok', in_progress: 'info', ready_for_verification: 'warn', closed: 'plain-ok', rejected: 'crit', cancelled: '', superseded: '' },
    pkg: { not_started: '', active: 'info', complete: 'ok' },
    life: { execution: 'ok', mobilising: 'info', handover: 'brand' },
    reg: { in_use: 'ok', erected: 'info', dismantled: '', installed: 'ok', in_progress: 'info', released: 'info', not_started: '' }
  };
  function sp(group, v, labelKey) { return pill(TONE[group][v] || '', t((labelKey || group) + '.' + v)); }
  P.healthPill = function (h) { return sp('health', h); };
  function bar(pct, label) {
    return '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(label || t('misc.progress')) + '"><i style="width:' + pct + '%"></i></div>';
  }
  P.bar = function (pct) { return pct === null || pct === undefined ? '' : '<div style="margin-top:6px">' + bar(pct) + '</div>'; };
  // Stage 6: a package or project without an approved progress method has no percentage.
  function pctText(p) { return p.pct === null || p.pct === undefined ? t('pg.notConfiguredShort') : p.pct + '%'; }
  function pctBar(p, label) { return p.pct === null || p.pct === undefined ? '<p class="field-hint nc-note">' + esc(t(p.reason === 'mixed_units' ? 'pg.mixedUnits' : p.reason === 'weights_invalid' ? 'pg.weightsInvalid' : 'pg.notConfigured')) + '</p>' : bar(p.pct, label); }
  P.pctText = pctText; P.pctBar = pctBar;
  function explainProgress() {
    return '<details class="explain"><summary>' + pic('info') + ' ' + esc(t('prog.how')) + '</summary><div class="prose"><p>' + esc(t('prog.p1')) + '</p><p>' + esc(t('prog.p2')) + '</p><p>' + esc(t('prog.p3')) + '</p><p class="mono" dir="ltr">' + esc(t('prog.formula')) + '</p></div></details>';
  }
  function illus(src, cls) {
    return '<div class="illus ' + (cls || '') + '"><img src="' + esc(src) + '" alt="" aria-hidden="true" loading="lazy"><span class="illus-tag">' + esc(t('img.illustrative')) + '</span></div>';
  }
  var SVC_IMG = { scaffolding: 'assets/svc-scaffolding.jpg', insulation: 'assets/svc-insulation.jpg', waterproofing: 'assets/svc-waterproofing.jpg', fireproofing: 'assets/svc-fireproofing.jpg' };
  function svcTag(s) { return '<span class="svc-tag svc-' + s + '">' + esc(t('svc.' + s)) + '</span>'; }
  function crumbs(items) {
    return '<nav class="crumbs" aria-label="' + esc(t('nav.crumbs')) + '"><ol>' + items.map(function (it, i) {
      return '<li>' + (it[1] && i < items.length - 1 ? '<a ' + go(it[1]) + '>' + esc(it[0]) + '</a>' : '<span aria-current="page">' + esc(it[0]) + '</span>') + '</li>';
    }).join('') + '</ol></nav>';
  }
  function emptyBox(icon, title, desc, actions) {
    return '<div class="state compact"><div class="glyph">' + pic(icon) + '</div><h3>' + esc(title) + '</h3>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
  }
  function card(title, body, extra, id) {
    return '<section class="card"' + (id ? ' id="' + id + '"' : '') + '><div class="card-h"><h2' + (id ? ' tabindex="-1"' : '') + '>' + title + '</h2>' + (extra || '') + '</div>' + body + '</section>';
  }
  function table(head, rows, cls) {
    return '<div class="tablewrap"><table class="' + (cls || '') + '"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function kv(pairs) { return '<dl class="kv">' + pairs.filter(Boolean).map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>'; }
  function guard(u, kind, rec, label) {
    var res = ST().recordAccess(u.id, kind, rec);
    if (res.allowed) return null;
    if (res.code === 'not_found') {
      return '<div class="card"><div class="state err" role="alert"><div class="glyph">' + U().ic('alert') + '</div><h2>' + esc(t('nf.title')) + '</h2><p>' + esc(t('nf.desc')) + '</p><div class="actions"><button class="btn btn-primary" data-route="projects">' + esc(t('nf.back')) + '</button></div></div></div>';
    }
    return U().deniedState(res, null);
  }
  function overdue(date, done) { return !done && date && date < ST().today; }
  function dueCell(date, done) { return '<span class="num' + (overdue(date, done) ? ' late' : '') + '">' + esc(fd(date)) + '</span>'; }

  // ---------------------------------------------------------------- actions (type, wording, enablement)
  var TYPE_ICON = { document_ack: 'ack', change_approval: 'change', inspection_signoff: 'sign', customer_acceptance: 'accept' };
  function typeBadge(type) { return '<span class="atype at-' + type + '">' + pic(TYPE_ICON[type]) + esc(t('atype.' + type)) + '</span>'; }
  function needText(v) {
    var a = v.action, r = v.record, kind = v.recordKind;
    var vars = { ref: codeOf(kind, r), rev: kind === 'document' ? ST().currentRev(r).rev : (r.approvalRev != null ? r.approvalRev : (r.rev || '')), pkg: a.packageId ? ST().get('package', a.packageId).code : '' };
    return t('need.' + a.type, vars);
  }
  function responsible(v) { return v.action.assigneeId ? esc(person(v.action.assigneeId)) : esc(t('resp.' + v.action.type)); }
  function whyNot(u, v) {
    var c = v.can.code;
    if (c === 'authority' || c === 'authority_expired') {
      var mine = U().D.authorities.filter(function (d) { return d.userId === u.id && d.action === v.permission; });
      if (mine.length) {
        var scopes = mine.map(function (d) { return d.scope.service ? t('svc.' + d.scope.service) : ST().get('project', d.scope.projectId).code; }).join(', ');
        return t(c === 'authority_expired' ? 'why.expired' : 'why.outside', { scope: scopes });
      }
      return t('why.noauthority');
    }
    return t('why.' + (c === 'role' || c === 'scope' ? c : 'other'));
  }
  function decisionRoute(a) { return a.source === 'instruction' ? 'decision.chg.' + a.record.id + '.' + a.decisionType : 'decision.act.' + a.id; }
  function actionButton(u, v, compact) {
    if (v.status === 'done') return '<span class="done-by' + (v.action.outcome && v.action.outcome !== 'approve' ? ' declined' : '') + '">' + pic(v.action.outcome && v.action.outcome !== 'approve' ? 'x' : 'check') + esc(t(v.action.outcome && v.action.outcome !== 'approve' ? 'act.declinedBy' : 'act.doneBy', { who: person(v.action.doneBy), date: fd(v.action.doneAt) })) + '</span>';
    if (v.can.allowed) { var dr = decisionRoute(v.action); return '<a class="btn btn-primary btn-sm" ' + go(dr) + '>' + esc(t('act.review')) + '</a>'; }
    var wid = 'why-' + v.action.id + (compact ? '-c' : '');
    return '<span class="blocked"><button class="btn btn-secondary btn-sm" disabled aria-describedby="' + wid + '">' + pic('lock') + esc(t('act.unavailable')) + '</button><span class="why" id="' + wid + '">' + esc(whyNot(u, v)) + '</span></span>';
  }
  function actionRowCompact(u, v) {
    return '<div class="list-row"><span class="sev ' + (v.status === 'overdue' ? 'crit' : v.can.allowed ? 'warn' : 'info') + '"></span><div class="t">' + typeBadge(v.action.type) +
      '<b>' + esc(needText(v)) + '</b><span>' + recLink(v.recordKind, v.record.id) + ' · ' + esc(t('act.due')) + ' ' + dueCell(v.action.due) + ' · ' + responsible(v) + '</span></div>' +
      '<div class="row-end">' + sp('action', v.status, 'astatus') + actionButton(u, v, true) + '</div></div>';
  }

  // ---------------------------------------------------------------- project card
  function nextOwner(c) {
    if (!c) return '—';
    return esc((c.party === 'customer' ? t('party.customer') : 'RGS') + ' · ' + person(c.ownerId));
  }
  function projectCard(u, row) {
    var p = row.project, route = 'project.' + p.id;
    return '<article class="card pcard"><a class="pcard-link" ' + go(route) + ' aria-label="' + esc(L(p, 'name') + ', ' + p.code) + '"></a>' + illus(p.cover, 'pcard-img') +
      '<div class="pcard-b"><div class="row-between"><span class="mono muted">' + esc(p.code) + '</span><span class="row" style="gap:6px">' + sp('life', p.status, 'pstatus') + sp('health', row.health) + '</span></div>' +
      '<h2>' + esc(L(p, 'name')) + '</h2><p class="muted">' + pic('pin') + ' ' + esc(L(p, 'location')) + ' · ' + esc(t('ptype.' + p.type)) + '</p>' +
      '<div class="svc-tags">' + row.services.map(svcTag).join('') + '</div>' +
      '<div class="pcard-prog"><div class="row-between"><span class="label">' + esc(t('misc.progress')) + '</span><b class="num">' + esc(pctText(row.progress)) + '</b></div>' + pctBar(row.progress) + '</div>' +
      '<dl class="pcard-meta"><div><dt>' + esc(t('card.lastUpdate')) + '</dt><dd>' + esc(fd(row.lastUpdate)) + '</dd></div>' +
      '<div><dt>' + esc(t('card.nextDate')) + '</dt><dd>' + (row.next ? dueCell(row.nextDue) + ' <span class="mono muted">' + esc(row.next.ref) + '</span>' : '—') + '</dd></div>' +
      '<div><dt>' + esc(t('card.nextOwner')) + '</dt><dd>' + nextOwner(row.next) + '</dd></div>' +
      '<div><dt>' + esc(t(ST().isCustomer(u.id) ? 'card.yourActions' : 'card.awaitingCustomer')) + '</dt><dd class="num">' + row.openActions + '</dd></div></dl></div></article>';
  }

  // ---------------------------------------------------------------- briefing + staff items
  P.briefingCard = function (u) {
    var st = ST(), items = st.briefing(u.id);
    var rows = items.map(function (s) {
      var tone = 'info', html = '';
      if (s.kind === 'progress') { html = esc(s.pct === null ? t('brief.progressNc', { project: L(s.project, 'name'), n: s.packages }) : t('brief.progress', { project: L(s.project, 'name'), pct: s.pct, n: s.packages, date: fd(s.asOf) })); tone = 'info'; }
      else if (s.kind === 'decisions') { html = esc(t('brief.decisions', { n: s.count, date: fd(s.first.action.due) })); tone = 'warn'; }
      else if (s.kind === 'commitment') { html = esc(t('brief.commitment.' + s.status, { ref: s.commitment.ref, text: L(s.commitment, 'text'), date: fd(st.dueOf(s.commitment)) })) + (s.commitment.riskReason ? ' ' + esc(L(s.commitment, 'riskReason')) + '.' : ''); tone = s.status === 'overdue' ? 'crit' : 'warn'; }
      else if (s.kind === 'corrective') { html = esc(t('brief.corrective', { n: s.count, ref: s.first.ref, date: fd(s.first.due) })); tone = 'warn'; }
      var ev = s.evidence.map(function (e) { return recLink(e.kind, e.id); });
      return '<div class="list-row"><span class="sev ' + tone + '"></span><div class="t"><b style="font-weight:500">' + html + '</b><span class="evlinks">' + esc(t('home.ai.evidence')) + ': ' + ev.join(' ') + '</span></div></div>';
    }).join('');
    return '<section class="card"><div class="card-h"><h2>' + U().ic('ai') + ' ' + esc(t('brief.title')) + '</h2><span class="pill plain">' + esc(t('brief.preview')) + '</span></div>' +
      '<p class="field-hint" style="padding:var(--s3) var(--s5) 0">' + esc(t('home.ai.scope')) + '</p>' +
      (rows ? '<div class="list">' + rows + '</div>' : emptyBox('ai', t('brief.empty'))) +
      '<p class="card-b field-hint" style="padding-top:var(--s2)">' + esc(t('brief.note')) + '</p></section>';
  };
  P.staffOpenItems = function (u) {
    var st = ST(), uid = u.id, items = [];
    st.visibleProjects(uid).forEach(function (p) {
      st.correctives(uid, p.id).filter(st.openCorrective).forEach(function (c) {
        if (c.ownerId === uid || (u.role === 'qa_qc_inspector' && c.status === 'awaiting_verification') || (u.role === 'hse_officer' && c.raisedBy === uid) || u.role === 'project_manager')
          items.push({ due: c.due, tone: overdue(c.due) ? 'crit' : 'warn', text: c.title, link: recLink('corrective', c.id) });
      });
      st.inspections(uid, p.id).filter(function (i) { return !i.result && (i.inspectorId === uid || u.role === 'project_manager'); })
        .forEach(function (i) { items.push({ due: i.planned, tone: 'info', text: i.title, link: recLink('inspection', i.id) }); });
      st.commitments(uid, p.id).filter(function (c) { var s = st.commitmentStatus(c); return s !== 'complete' && c.party === 'rgs' && (c.ownerId === uid || ((u.role === 'general_manager' || u.role === 'operations_manager') && s !== 'on_track')); })
        .forEach(function (c) { var s = st.commitmentStatus(c); items.push({ due: st.dueOf(c), tone: TONE.commitment[s], text: L(c, 'text'), link: recLink('commitment', c.id) }); });
      if (p.repId === uid || u.role === 'document_controller') st.awaitingCustomer(uid, p.id).forEach(function (v) {
        if (u.role === 'document_controller' && v.action.type !== 'document_ack') return;
        items.push({ due: v.action.due, tone: v.status === 'overdue' ? 'crit' : 'info', text: t('staff.awaiting') + ': ' + needText(v), link: recLink(v.recordKind, v.record.id) });
      });
    });
    items.sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    var body = items.length ? '<div class="list">' + items.slice(0, 8).map(function (it) {
      return '<div class="list-row"><span class="sev ' + it.tone + '"></span><div class="t"><b>' + esc(it.text) + '</b><span>' + it.link + ' · ' + dueCell(it.due) + '</span></div></div>';
    }).join('') + '</div>' : emptyBox('inbox', t('staff.none'), t('staff.none.d'));
    return card(esc(t('staff.title')), body, '<span class="pill plain num">' + items.length + '</span>');
  };

  // ---------------------------------------------------------------- 1. customer overview
  function overview(u) {
    var st = ST(), uid = u.id, o = U().org(u);
    var rows = st.directoryRows(uid);
    var acts = st.openActions(st.actionsFor(uid));
    var mine = acts.filter(function (v) { return v.can.allowed; });
    var since = st.sinceLastVisit(uid);
    var upcoming = [];
    rows.forEach(function (r) { st.commitments(uid, r.project.id).forEach(function (c) { if (st.commitmentStatus(c) !== 'complete') upcoming.push(c); }); });
    upcoming.sort(function (a, b) { return st.dueOf(a) < st.dueOf(b) ? -1 : 1; });
    var banner = '<section class="mast"><div><p class="greet">' + esc(t('home.hello')) + ' ' + esc(u.name.split(' ')[0]) + '</p>' +
      '<h1>' + esc(t('ov.title')) + '</h1><div class="chips"><span class="chip brand">' + esc(t('role.' + u.role)) + '</span><span class="chip">' + esc(L(o, 'name')) + '</span>' +
      '<span class="chip">' + esc(t('ov.chip.projects', { n: rows.length })) + '</span><span class="chip">' + esc(t('ov.chip.actions', { n: mine.length })) + '</span>' +
      '<span class="chip">' + esc(t('ov.chip.changes', { n: since.length, date: fd(u.lastVisitAt) })) + '</span></div></div><figure><img src="assets/banner.jpg" alt="" aria-hidden="true"><span class="illus-tag">' + esc(t('img.illustrative')) + '</span></figure></section>';
    var qa = quickActions(u);
    if (!rows.length) return banner + qa + '<div class="card">' + emptyBox('projects', t('ov.noProjects'), t('ov.noProjects.d'), '<button class="btn btn-secondary" data-pact="dlg" data-v="contact">' + esc(t('qa.contact')) + '</button>') + '</div>';
    var projects = '<section class="stack"><div class="row-between"><h2 class="sec-h">' + esc(t('ov.yourProjects')) + '</h2><a class="linkbtn" ' + go('projects') + '>' + esc(t('ov.allProjects')) + '</a></div><div class="grid pgrid">' + rows.map(function (r) { return projectCard(u, r); }).join('') + '</div></section>';
    var actCard = card(esc(t('ov.awaiting')), acts.length ? '<div class="list">' + acts.slice(0, 5).map(function (v) { return actionRowCompact(u, v); }).join('') + '</div>' : emptyBox('approvals', t('act.none'), t('act.none.d')),
      '<a class="linkbtn" ' + go('actions') + '>' + esc(t('ov.viewAll', { n: acts.length })) + '</a>');
    var commitCard = card(esc(t('ov.upcoming')), upcoming.length ? '<div class="list">' + upcoming.slice(0, 5).map(function (c) {
      var s = st.commitmentStatus(c);
      return '<div class="list-row"><span class="sev ' + TONE.commitment[s] + '"></span><div class="t"><b>' + esc(L(c, 'text')) + '</b><span>' + recLink('commitment', c.id) + ' · ' + esc(c.party === 'customer' ? t('party.customer') : 'RGS') + ' · ' + esc(person(c.ownerId)) + '</span></div><div class="row-end">' + dueCell(st.dueOf(c)) + sp('commitment', s, 'cstatus') + '</div></div>';
    }).join('') + '</div>' : emptyBox('commitments', t('com.none')), '<a class="linkbtn" ' + go('actions') + '>' + esc(t('ov.viewCommitments')) + '</a>');
    var changes = card(esc(t('ov.changes', { date: fd(u.lastVisitAt) })), since.length ? timeline(u, since.slice(0, 6), true) : emptyBox('reports', t('ov.noChanges')),
      '<a class="linkbtn" ' + go('activity') + '>' + esc(t('ov.allActivity')) + '</a>');
    return banner + qa + projects + '<div class="grid g-home"><div class="grid">' + actCard + changes + '</div><div class="grid">' + commitCard + P.briefingCard(u) + '</div></div>';
  }
  function quickActions(u) {
    var st = ST();
    var canReq = st.visibleProjects(u.id).some(function (p) { return U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed; });
    var canUp = st.visiblePackages(u.id).some(function (w) { return U().A.can(U().D, u.id, 'evidence.upload', { packageId: w.id }).allowed; });
    function qb(v, icon, label, ok) {
      return '<div class="qa-item"><button class="qa-btn" data-pact="dlg" data-v="' + v + '"' + (ok ? '' : ' disabled aria-describedby="qa-why-' + v + '"') + '>' + pic(icon) + '<span>' + esc(label) + '</span></button>' +
        (ok ? '' : '<span class="why" id="qa-why-' + v + '">' + esc(t('qa.noperm')) + '</span>') + '</div>';
    }
    function qbr(ok) { return '<div class="qa-item"><button class="qa-btn" data-pact="newreq"' + (ok ? '' : ' disabled aria-describedby="qa-why-request"') + '>' + pic('plus') + '<span>' + esc(t('qa.request')) + '</span></button>' + (ok ? '' : '<span class="why" id="qa-why-request">' + esc(t('qa.noperm')) + '</span>') + '</div>'; }
    return '<section class="qa-bar" aria-label="' + esc(t('qa.title')) + '">' + qbr(canReq) + qb('evidence', 'upload', t('qa.evidence'), canUp) + qb('contact', 'phone', t('qa.contact'), true) + '</section>';
  }

  // ---------------------------------------------------------------- 2. project directory
  function dirState() {
    var s = S();
    if (!s.dir) { var v = 'grid'; try { v = localStorage.getItem('rgs.dirview') || 'grid'; } catch (e) {} s.dir = { q: '', service: '', type: '', location: '', status: '', health: '', view: v }; }
    return s.dir;
  }
  function selectF(id, key, label, opts, cur) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="dir.' + key + '"><option value="">' + esc(t('f.all')) + '</option>' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function uniq(a) { return Array.from(new Set(a)); }
  function directory(u) {
    var st = ST(), f = dirState();
    var rows = st.directoryRows(u.id);
    var res = st.filterDirectory(rows, f);
    // filter options come only from projects this user may see
    var opt = {
      service: uniq([].concat.apply([], rows.map(function (r) { return r.services; }))).map(function (s) { return [s, t('svc.' + s)]; }),
      type: uniq(rows.map(function (r) { return r.project.type; })).map(function (s) { return [s, t('ptype.' + s)]; }),
      location: uniq(rows.map(function (r) { return r.project.location; })).map(function (s) { var p = rows.filter(function (r) { return r.project.location === s; })[0].project; return [s, L(p, 'location')]; }),
      status: uniq(rows.map(function (r) { return r.project.status; })).map(function (s) { return [s, t('pstatus.' + s)]; }),
      health: uniq(rows.map(function (r) { return r.health; })).map(function (s) { return [s, t('health.' + s)]; })
    };
    var active = ['q', 'service', 'type', 'location', 'status', 'health'].some(function (k) { return f[k]; });
    var toolbar = '<section class="card card-b dir-tools" aria-label="' + esc(t('dir.filters')) + '">' +
      '<div class="field dir-search"><label for="dir-q">' + esc(t('dir.search')) + '</label><div class="control">' + U().ic('search') + '<input id="dir-q" class="input" type="search" data-live value="' + esc(f.q) + '" placeholder="' + esc(t('dir.search.ph')) + '"></div></div>' +
      selectF('dir-service', 'service', t('f.service'), opt.service, f.service) + selectF('dir-type', 'type', t('f.type'), opt.type, f.type) +
      selectF('dir-location', 'location', t('f.location'), opt.location, f.location) + selectF('dir-status', 'status', t('f.status'), opt.status, f.status) +
      selectF('dir-health', 'health', t('f.health'), opt.health, f.health) + '</section>';
    var head = '<div class="row-between"><p class="muted" role="status" id="dir-count">' + esc(t('dir.count', { n: res.length, m: rows.length })) + '</p><div class="row">' +
      (active ? '<button class="btn btn-ghost btn-sm" data-pact="dir-clear">' + pic('x') + esc(t('dir.clear')) + '</button>' : '') +
      '<div class="seg" role="group" aria-label="' + esc(t('dir.view')) + '"><button class="btn btn-sm" data-pact="dir-view" data-v="grid" aria-pressed="' + (f.view === 'grid') + '">' + pic('grid') + esc(t('dir.grid')) + '</button><button class="btn btn-sm" data-pact="dir-view" data-v="list" aria-pressed="' + (f.view === 'list') + '">' + pic('list') + esc(t('dir.list')) + '</button></div></div></div>';
    var body;
    if (!rows.length) body = '<div class="card">' + emptyBox('projects', t('ov.noProjects'), t('ov.noProjects.d')) + '</div>';
    else if (!res.length) body = '<div class="card">' + emptyBox('search', t('dir.none'), t('dir.none.d'), '<button class="btn btn-secondary" data-pact="dir-clear">' + esc(t('dir.clear')) + '</button>') + '</div>';
    else if (f.view === 'list') body = '<section class="card">' + table([t('nav.projects'), t('f.type'), t('f.location'), t('f.service'), t('f.status'), t('f.health'), t('misc.progress'), t('card.lastUpdate'), t('card.nextDate')],
      res.map(function (r) { var p = r.project; return '<tr><td><a ' + go('project.' + p.id) + '><b>' + esc(L(p, 'name')) + '</b></a><br><span class="mono muted">' + esc(p.code) + '</span></td><td>' + esc(t('ptype.' + p.type)) + '</td><td>' + esc(L(p, 'location')) + '</td><td>' + r.services.map(svcTag).join(' ') + '</td><td>' + sp('life', p.status, 'pstatus') + '</td><td>' + sp('health', r.health) + '</td><td class="num"><b>' + esc(pctText(r.progress)) + '</b>' + (r.progress.pct === null ? '' : bar(r.progress.pct)) + '</td><td class="num">' + esc(fd(r.lastUpdate)) + '</td><td>' + (r.next ? dueCell(r.nextDue) + '<br><span class="mono muted">' + esc(r.next.ref) + '</span>' : '—') + '</td></tr>'; }), 'dirtable') + '</section>';
    else body = '<div class="grid pgrid">' + res.map(function (r) { return projectCard(u, r); }).join('') + '</div>';
    return crumbs([[t('nav.home'), 'home'], [t('dir.title'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('dir.title')) + '</h1><p>' + esc(t('dir.sub')) + '</p></div></div>' + toolbar + head + body + explainProgress();
  }

  // ---------------------------------------------------------------- 3. project workspace
  var TABS = ['overview', 'packages', 'areas', 'photos', 'requests', 'documents', 'inspections', 'corrective', 'commitments', 'reports', 'handover', 'activity'];
  function tabCounts(u, pid) {
    var st = ST(), uid = u.id;
    var docs = st.documents(uid, pid);
    return {
      packages: st.visiblePackages(uid, pid).length, areas: st.areas(pid).length, photos: st.evidence(uid, pid).length,
      requests: st.requests(uid, pid).filter(function (r) { return st.OPEN_REQ.indexOf(r.status) >= 0; }).length,
      documents: docs.filter(function (d) { return d.type !== 'report'; }).length, reports: docs.filter(function (d) { return d.type === 'report'; }).length,
      inspections: st.inspections(uid, pid).length, corrective: st.correctives(uid, pid).filter(st.openCorrective).length,
      commitments: st.commitments(uid, pid).filter(function (c) { return st.commitmentStatus(c) !== 'complete'; }).length
    };
  }
  function projectHeader(u, p, tab) {
    var st = ST(), pr = st.projectProgress(p.id, u.id), health = st.projectHealth(p.id), counts = tabCounts(u, p.id);
    var rep = U().byId(U().D.users, p.repId);
    var svcRows = pr.services.filter(function (s) { return st.visiblePackages(u.id, p.id).some(function (w) { return w.service === s.service; }); });
    var head = '<section class="phero">' + illus(p.cover, 'phero-img') + '<div class="phero-b">' +
      '<div class="row" style="gap:8px"><span class="mono">' + esc(p.code) + '</span>' + sp('life', p.status, 'pstatus') + sp('health', health) + '</div>' +
      '<h1>' + esc(L(p, 'name')) + '</h1><p class="phero-loc">' + pic('pin') + ' ' + esc(L(p, 'location')) + ' · ' + esc(t('ptype.' + p.type)) + '</p>' +
      '<dl class="phero-meta"><div><dt>' + esc(t('pw.client')) + '</dt><dd>' + esc(orgName(p.customerOrgId)) + '</dd></div><div><dt>' + esc(t('pw.asof')) + '</dt><dd>' + esc(fd(p.reportingDate)) + '</dd></div>' +
      '<div><dt>' + esc(t('pw.rep')) + '</dt><dd>' + esc(rep ? rep.name : '—') + '</dd></div><div><dt>' + esc(t('pw.completion')) + '</dt><dd>' + esc(fd(p.plannedCompletion)) + '</dd></div></dl></div>' +
      '<div class="phero-prog"><span class="label">' + esc(t('pw.progress')) + '</span><b class="big num">' + esc(pctText(pr)) + '</b>' + pctBar(pr, t('pw.progress')) + '<a class="linkbtn" ' + go('prog.' + p.id) + '>' + esc(t('pg.openProgress')) + '</a>' +
      '<ul class="svc-bars">' + svcRows.map(function (s) { return '<li><span>' + svcTag(s.service) + '</span><span class="num">' + esc(pctText(s)) + '</span><span class="num muted" title="' + esc(t('pw.share')) + '">' + Math.round(s.share * 100) + '% ' + esc(t('pw.weight')) + '</span></li>'; }).join('') + '</ul></div></section>';
    var tabs = '<nav class="ptabs" aria-label="' + esc(t('pw.sections')) + '"><ul>' + TABS.map(function (k) {
      var n = counts[k];
      return '<li><a ' + go('project.' + p.id + (k === 'overview' ? '' : '.' + k)) + (tab === k ? ' aria-current="page"' : '') + '>' + esc(t('tab.' + k)) + (n != null ? '<span class="count num">' + n + '</span>' : '') + '</a></li>';
    }).join('') + '</ul></nav>';
    return crumbs([[t('nav.home'), 'home'], [t('dir.title'), 'projects'], [L(p, 'name'), tab === 'overview' ? null : 'project.' + p.id], tab === 'overview' ? null : [t('tab.' + tab), null]].filter(Boolean)) + head + tabs;
  }
  function project(u, args) {
    var st = ST(), p = st.get('project', args[0]);
    var g = guard(u, 'project', p); if (g) return g;
    var tab = TABS.indexOf(args[1]) >= 0 ? args[1] : 'overview';
    var body = ({
      overview: projOverview, packages: projPackages, areas: projAreas, photos: projPhotos, requests: projRequests, documents: projDocuments,
      inspections: projInspections, corrective: projCorrective, commitments: projCommitments, reports: projReports, handover: projHandover, activity: projActivity
    })[tab](u, p);
    return projectHeader(u, p, tab) + body + (tab === 'overview' ? explainProgress() : '');
  }
  function sitePlan(u, p, large) {
    var st = ST(), areas = st.areas(p.id), sel = S().selArea;
    var pk = st.visiblePackages(u.id, p.id);
    var boxes = areas.map(function (a) {
      var mine = pk.filter(function (w) { return w.areaId === a.id || (a.parentId == null && areas.some(function (c) { return c.parentId === a.id && c.id === w.areaId; })); });
      var issues = st.correctives(u.id, p.id).filter(function (c) { return st.openCorrective(c) && c.areaId === a.id; }).length;
      var style = 'left:' + a.plan.x + '%;top:' + (a.plan.y / 60 * 100) + '%;width:' + a.plan.w + '%;height:' + (a.plan.h / 60 * 100) + '%';
      return '<button type="button" class="plan-area ' + a.kind + (a.parentId ? ' child' : '') + (sel === a.id ? ' sel' : '') + '" style="' + style + '" data-pact="area" data-v="' + a.id + '" aria-pressed="' + (sel === a.id) + '">' +
        '<span class="pa-name"><b class="mono">' + esc(a.code) + '</b> ' + esc(L(a, 'name')) + '</span>' +
        (a.parentId ? '' : '<span class="pa-svcs">' + mine.map(function (w) { return '<span class="dot svc-' + w.service + '" title="' + esc(t('svc.' + w.service) + ' ' + pctText(st.packageProgress(w.id, u.id))) + '">' + esc(pctText(st.packageProgress(w.id, u.id))) + '</span>'; }).join('') + '</span>') +
        (issues ? '<span class="pa-issue" title="' + esc(t('plan.issues', { n: issues })) + '">' + issues + '</span>' : '') + '</button>';
    }).join('');
    var legend = '<div class="legend">' + uniq(pk.map(function (w) { return w.service; })).map(function (s) { return '<span><i class="dot svc-' + s + '"></i>' + esc(t('svc.' + s)) + '</span>'; }).join('') + '<span><i class="pa-issue sm">1</i>' + esc(t('plan.issueLegend')) + '</span></div>';
    var detail = '';
    if (sel && areas.some(function (a) { return a.id === sel; })) {
      var a = st.get('areas', sel) || areas.filter(function (x) { return x.id === sel; })[0];
      var ids = [a.id].concat(areas.filter(function (c) { return c.parentId === a.id; }).map(function (c) { return c.id; }));
      if (a.parentId) ids.push(a.parentId);
      var here = pk.filter(function (w) { return ids.indexOf(w.areaId) >= 0; });
      detail = '<div class="plan-detail" role="status"><b>' + esc(a.code + ' · ' + L(a, 'name')) + '</b> <span class="muted">(' + esc(t('kind.' + a.kind)) + ')</span><div class="row">' +
        (here.length ? here.map(function (w) { return recLink('package', w.id, w.code + ' · ' + t('svc.' + w.service)); }).join(' ') : '<span class="muted">' + esc(t('plan.noPkgs')) + '</span>') + '</div></div>';
    }
    return '<div class="plan-wrap"><div class="plan' + (large ? ' large' : '') + '" dir="ltr" role="group" aria-label="' + esc(t('plan.title')) + '">' + boxes + '<span class="plan-n" aria-hidden="true">N ↑</span></div>' + legend +
      '<p class="field-hint">' + esc(t('plan.note')) + '</p>' + detail + '</div>';
  }
  function teamCard(u, p) {
    var st = ST(), users = p.team.map(function (id) { return U().byId(U().D.users, id); }).filter(Boolean);
    var scopeOf = function (x) {
      var a = U().D.assignments.filter(function (s) { return s.userId === x.id && s.scope.projectId === p.id; })[0];
      if (!a) return '';
      if (a.scope.service) return t('svc.' + a.scope.service);
      if (a.scope.areaId) return L(st.get('areas', a.scope.areaId) || U().byId(U().D.areas, a.scope.areaId), 'name');
      return '';
    };
    return card(esc(t('pw.team')), '<ul class="team">' + users.map(function (x) {
      var sc = scopeOf(x);
      return '<li><span class="avatar sm">' + esc(U().initials(x.name)) + '</span><span class="t"><b>' + esc(x.name) + (x.id === p.repId ? ' <span class="pill brand plain">' + esc(t('pw.yourRep')) + '</span>' : '') + '</b><span>' + esc(t('role.' + x.role)) + (sc ? ' · ' + esc(sc) : '') + '</span></span></li>';
    }).join('') + '</ul>', '<button class="btn btn-secondary btn-sm" data-pact="dlg" data-v="contact" data-p="' + p.id + '">' + pic('phone') + esc(t('qa.contactShort')) + '</button>');
  }
  function decisionsCard(u, p) {
    var st = ST(), cust = st.isCustomer(u.id);
    var list = cust ? st.openActions(st.actionsFor(u.id, { projectId: p.id })) : st.awaitingCustomer(u.id, p.id);
    var title = cust ? t('pw.decisions') : t('pw.awaitingCustomer');
    return card(esc(title), list.length ? '<div class="list">' + list.map(function (v) { return cust ? actionRowCompact(u, v) :
      '<div class="list-row"><span class="sev ' + (v.status === 'overdue' ? 'crit' : 'info') + '"></span><div class="t">' + typeBadge(v.action.type) + '<b>' + esc(needText(v)) + '</b><span>' + recLink(v.recordKind, v.record.id) + ' · ' + dueCell(v.action.due) + '</span></div>' + sp('action', v.status, 'astatus') + '</div>'; }).join('') + '</div>'
      : emptyBox('approvals', t('act.none')), cust ? '<a class="linkbtn" ' + go('actions') + '>' + esc(t('ov.viewAll', { n: list.length })) + '</a>' : '');
  }
  function projOverview(u, p) {
    var st = ST();
    var acts = st.activity(u.id, { projectId: p.id }).slice(0, 6);
    var up = st.commitments(u.id, p.id).filter(function (c) { return st.commitmentStatus(c) !== 'complete'; }).slice(0, 4);
    var commit = card(esc(t('ov.upcoming')), up.length ? '<div class="list">' + up.map(function (c) { var s = st.commitmentStatus(c); return '<div class="list-row"><span class="sev ' + TONE.commitment[s] + '"></span><div class="t"><b>' + esc(L(c, 'text')) + '</b><span>' + recLink('commitment', c.id) + ' · ' + esc(person(c.ownerId)) + '</span></div><div class="row-end">' + dueCell(st.dueOf(c)) + sp('commitment', s, 'cstatus') + '</div></div>'; }).join('') + '</div>' : emptyBox('commitments', t('com.none')),
      '<a class="linkbtn" ' + go('project.' + p.id + '.commitments') + '>' + esc(t('tab.commitments')) + '</a>');
    return '<div class="grid g-home"><div class="grid">' + card(esc(t('plan.title')), '<div class="card-b">' + sitePlan(u, p) + '</div>', '<a class="linkbtn" ' + go('project.' + p.id + '.areas') + '>' + esc(t('tab.areas')) + '</a>') +
      card(esc(t('pw.recent')), acts.length ? timeline(u, acts, true) : emptyBox('reports', t('tl.none')), '<a class="linkbtn" ' + go('project.' + p.id + '.activity') + '>' + esc(t('ov.allActivity')) + '</a>') + '</div>' +
      '<div class="grid">' + decisionsCard(u, p) + commit + teamCard(u, p) + '</div></div>';
  }
  function pkgCard(u, w) {
    var st = ST(), pr = st.packageProgress(w.id, u.id), a = U().byId(U().D.areas, w.areaId);
    var next = pr.milestones.filter(function (m) { return !m.completedAt; })[0];
    var issues = st.correctives(u.id, null, w.id).filter(st.openCorrective).length + st.requests(u.id, null, w.id).filter(function (r) { return st.OPEN_REQ.indexOf(r.status) >= 0; }).length;
    return '<article class="card pkgcard"><a class="pcard-link" ' + go('package.' + w.id) + ' aria-label="' + esc(t('svc.' + w.service) + ' ' + w.code) + '"></a>' + illus(SVC_IMG[w.service], 'pkg-img') +
      '<div class="pcard-b"><div class="row-between">' + svcTag(w.service) + sp('pkg', st.packageStatus(w.id), 'pkgstatus') + '</div><h2 class="mono">' + esc(w.code) + '</h2><p class="muted">' + esc(L(a, 'name')) + ' · ' + esc(person(w.supervisorId)) + '</p>' +
      '<div class="pcard-prog"><div class="row-between"><span class="label">' + esc(t('pkg.milestonesDone', { a: pr.completed, b: pr.total })) + '</span><b class="num">' + esc(pctText(pr)) + '</b></div>' + pctBar(pr) + '</div>' +
      '<dl class="pcard-meta"><div><dt>' + esc(t('pkg.next')) + '</dt><dd>' + (next ? esc(L(next, 'name')) + ' · ' + dueCell(next.forecast) : esc(t('pkg.allDone'))) + '</dd></div><div><dt>' + esc(t('pkg.openIssues')) + '</dt><dd class="num">' + issues + '</dd></div></dl></div></article>';
  }
  function projPackages(u, p) {
    var pk = ST().visiblePackages(u.id, p.id);
    return pk.length ? '<div class="grid pgrid">' + pk.map(function (w) { return pkgCard(u, w); }).join('') + '</div>' : '<div class="card">' + emptyBox('services', t('pkg.none')) + '</div>';
  }
  function projAreas(u, p) {
    var st = ST(), areas = st.areas(p.id), pk = st.visiblePackages(u.id, p.id);
    var ordered = [];
    areas.filter(function (a) { return !a.parentId; }).forEach(function (a) { ordered.push(a); areas.filter(function (c) { return c.parentId === a.id; }).forEach(function (c) { ordered.push(c); }); });
    var rows = ordered.map(function (a) {
      var here = pk.filter(function (w) { return w.areaId === a.id; });
      var issues = st.correctives(u.id, p.id).filter(function (c) { return st.openCorrective(c) && c.areaId === a.id; });
      return '<tr' + (a.parentId ? ' class="child"' : '') + '><td><span class="mono">' + esc(a.code) + '</span></td><td>' + (a.parentId ? '↳ ' : '') + esc(L(a, 'name')) + '</td><td>' + esc(t('kind.' + a.kind)) + '</td><td>' + (here.map(function (w) { return recLink('package', w.id, w.code); }).join(' ') || '<span class="muted">—</span>') + '</td><td>' + (issues.map(function (c) { return recLink('corrective', c.id); }).join(' ') || '<span class="muted">0</span>') + '</td></tr>';
    });
    return card(esc(t('plan.title')), '<div class="card-b">' + sitePlan(u, p, true) + '</div>') + card(esc(t('area.register')), table([t('misc.code'), t('area.name'), t('area.kind'), t('tab.packages'), t('pkg.openIssues')], rows));
  }
  function evidenceTile(ev) {
    var a = U().byId(U().D.areas, ev.areaId), w = ST().get('package', ev.packageId);
    return '<figure class="evidence"><div class="ev-media' + (ev.file ? '' : ' nofile') + '">' + pic('camera') + '<span>' + esc(t(ev.file ? 'ev.file' : 'ev.nofile')) + '</span><span class="ev-badge">' + esc(t('ev.badge')) + '</span></div>' +
      '<figcaption><b class="mono">' + esc(ev.ref) + '</b><span>' + esc(ev.caption) + '</span><dl class="ev-meta"><dt>' + esc(t('ev.captured')) + '</dt><dd class="num">' + esc(fd(ev.capturedAt) + ' ' + ftime(ev.capturedAt)) + '</dd><dt>' + esc(t('ev.by')) + '</dt><dd>' + esc(person(ev.capturedBy)) + '</dd>' +
      '<dt>' + esc(t('ev.where')) + '</dt><dd>' + esc(a ? L(a, 'name') : '') + ' · <span class="mono">' + esc(w.code) + '</span></dd><dt>' + esc(t('ev.linked')) + '</dt><dd>' + recLink(ev.linked.kind, ev.linked.id) + '</dd></dl></figcaption></figure>';
  }
  function evidenceNote() { return '<div class="notice">' + pic('camera') + '<span>' + esc(t('ev.note')) + '</span></div>'; }
  function projPhotos(u, p) {
    var st = ST(), evs = st.evidence(u.id, p.id);
    if (!evs.length) return evidenceNote() + '<div class="card">' + emptyBox('camera', t('ev.none')) + '</div>';
    var groups = st.visiblePackages(u.id, p.id).map(function (w) { var list = evs.filter(function (e) { return e.packageId === w.id; }); return list.length ? '<section class="stack"><h2 class="sec-h sm">' + svcTag(w.service) + ' <span class="mono">' + esc(w.code) + '</span></h2><div class="grid evgrid">' + list.map(evidenceTile).join('') + '</div></section>' : ''; }).join('');
    return evidenceNote() + groups;
  }
  function pkgCode(id) { var w = id && ST().get('package', id); return w ? recLink('package', w.id) : '<span class="muted">' + esc(t('misc.wholeProject')) + '</span>'; }
  function reqRows(u, list) {
    return list.map(function (r) { return '<tr><td>' + recLink('request', r.id) + '</td><td>' + esc(r.subject) + '</td><td>' + pkgCode(r.packageId) + '</td><td>' + esc(person(r.raisedBy)) + '<br><span class="muted num">' + esc(fd(r.raisedAt)) + '</span></td><td>' + sp('req', r.status, 'rstatus') + '</td></tr>'; });
  }
  function projRequests(u, p) {
    if (P.requestRows) return P.requestRows(u, p);
    var list = ST().requests(u.id, p.id);
    var canReq = U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed;
    var btn = canReq ? '<button class="btn btn-primary btn-sm" data-pact="newreq" data-p="' + p.id + '">' + pic('plus') + esc(t('qa.request')) + '</button>' : '';
    return card(esc(t('tab.requests')), list.length ? table([t('misc.ref'), t('req.subject'), t('misc.package'), t('req.raisedBy'), t('f.status')], reqRows(u, list)) : emptyBox('requests', t('st.empty.t'), t('st.empty.d')), btn) +
      '<p class="field-hint">' + esc(t('req.later')) + '</p>';
  }
  function docRows(u, list) {
    return list.map(function (d) { var cr = ST().currentRev(d); return '<tr><td>' + recLink('document', d.id) + '</td><td>' + esc(d.title) + (!d.customerVisible ? ' <span class="pill plain">' + esc(t('misc.internal')) + '</span>' : '') + '</td><td>' + esc(t('dtype.' + d.type)) + '</td><td class="mono">' + esc(cr.rev) + '</td><td>' + sp('doc', d.status, 'dstatus') + '</td><td>' + ((d.packageIds || []).map(function (id) { return recLink('package', id); }).join(' ') || '<span class="muted">' + esc(t('misc.wholeProject')) + '</span>') + '</td><td class="num">' + esc(fd(cr.date)) + '</td></tr>'; });
  }
  function projDocuments(u, p) {
    var list = ST().documents(u.id, p.id).filter(function (d) { return d.type !== 'report'; });
    return card(esc(t('tab.documents')), list.length ? table([t('doc.number'), t('doc.title'), t('doc.type'), t('doc.rev'), t('f.status'), t('misc.package'), t('doc.date')], docRows(u, list)) : emptyBox('documents', t('doc.none')));
  }
  function custSignoff(i) {
    if (!i.customerSignoffRequired) return '<span class="muted">' + esc(t('insp.notRequired')) + '</span>';
    var a = U().D.actions.filter(function (x) { return x.type === 'inspection_signoff' && x.record.id === i.id; })[0];
    if (a && a.doneAt) return pill('ok', t('insp.recorded'));
    if (a) return pill('warn', t('insp.awaitingCustomer'));
    return pill('', t('insp.afterResult'));
  }
  function inspRows(u, list) {
    return list.map(function (i) {
      var a = U().byId(U().D.areas, i.areaId);
      return '<tr><td>' + recLink('inspection', i.id) + '</td><td>' + esc(i.title) + '</td><td>' + pkgCode(i.packageId) + '<br><span class="muted">' + esc(a ? L(a, 'name') : '') + '</span></td><td class="num">' + esc(fd(i.performed || i.planned)) + '</td><td>' + sp('result', i.result || 'scheduled', 'result') + '</td><td>' + (i.rgsSignoff ? esc(person(i.rgsSignoff.by)) + '<br><span class="muted num">' + esc(fd(i.rgsSignoff.at)) + '</span>' : '<span class="muted">' + esc(t(i.result ? 'insp.pendingRgs' : 'insp.notYet')) + '</span>') + '</td><td>' + custSignoff(i) + '</td></tr>';
    });
  }
  function projInspections(u, p) {
    var list = ST().inspections(u.id, p.id).sort(function (a, b) { return (a.performed || a.planned) < (b.performed || b.planned) ? 1 : -1; });
    return '<div class="notice">' + U().ic('info') + '<span>' + esc(t('insp.criteriaNote')) + '</span></div>' +
      card(esc(t('tab.inspections')), list.length ? table([t('misc.ref'), t('insp.title'), t('misc.package'), t('insp.date'), t('insp.result'), t('insp.rgs'), t('insp.customer')], inspRows(u, list)) : emptyBox('inspections', t('insp.none')));
  }
  function caRows(u, list) {
    return list.map(function (c) { return '<tr><td>' + recLink('corrective', c.id) + '</td><td>' + esc(c.title) + '</td><td>' + pkgCode(c.packageId) + '</td><td>' + (c.sourceInspectionId ? recLink('inspection', c.sourceInspectionId) : '<span class="muted">' + esc(t('ca.observation')) + '</span>') + '</td><td>' + esc(person(c.ownerId)) + '</td><td>' + dueCell(c.due, c.status === 'closed') + '</td><td>' + sp('ca', c.status, 'castatus') + '</td></tr>'; });
  }
  function projCorrective(u, p) {
    var list = ST().correctives(u.id, p.id);
    return card(esc(t('tab.corrective')), list.length ? table([t('misc.ref'), t('ca.title'), t('misc.package'), t('ca.source'), t('ca.owner'), t('ca.due'), t('f.status')], caRows(u, list)) : emptyBox('corrective', t('ca.none')));
  }
  function comRows(u, list) {
    var st = ST();
    return list.map(function (c) { var s = st.commitmentStatus(c); return '<tr><td><span class="mono">' + esc(c.ref) + '</span></td><td>' + esc(L(c, 'text')) + (c.riskReason && s !== 'complete' ? '<br><span class="muted">' + esc(L(c, 'riskReason')) + '</span>' : '') + '</td><td>' + esc(c.party === 'customer' ? t('party.customer') : 'RGS') + '</td><td>' + esc(person(c.ownerId)) + '</td><td class="num">' + esc(fd(c.promised)) + '</td><td class="num">' + (c.revised ? esc(fd(c.revised)) : '—') + '</td><td>' + sp('commitment', s, 'cstatus') + '</td><td>' + pkgCode(c.packageId) + '</td></tr>'; });
  }
  function projCommitments(u, p) {
    var list = ST().commitments(u.id, p.id);
    return card(esc(t('tab.commitments')), list.length ? table([t('misc.ref'), t('com.text'), t('com.party'), t('com.owner'), t('com.promised'), t('com.revised'), t('f.status'), t('misc.package')], comRows(u, list)) : emptyBox('commitments', t('com.none'))) +
      '<p class="field-hint">' + esc(t('com.rule')) + '</p>';
  }
  function projReports(u, p) {
    var list = ST().documents(u.id, p.id).filter(function (d) { return d.type === 'report'; });
    return card(esc(t('tab.reports')), list.length ? table([t('doc.number'), t('doc.title'), t('doc.type'), t('doc.rev'), t('f.status'), t('misc.package'), t('doc.date')], docRows(u, list)) : emptyBox('reports', t('rpt.none'))) +
      '<p class="field-hint">' + esc(t('rpt.later')) + '</p>';
  }
  function handoverBlock(u, wpId, withHead) {
    var st = ST(), h = st.handover(u.id, wpId), w = h.pkg;
    var items = h.items.map(function (it) {
      var link = '';
      if (it.ref && it.ref.kind === 'action') { var v = h.acceptance; link = v ? actionButton(u, v) : ''; }
      else if (it.ref) link = recLink(it.ref.kind, it.ref.id);
      return '<li class="' + (it.met ? 'met' : 'unmet') + '">' + pic(it.met ? 'check' : 'clock') + '<span class="t"><b>' + esc(t('ho.' + it.key)) + '</b><span>' + esc(t('ho.' + it.key + '.d', { n: it.detail })) + '</span></span><span class="ho-link">' + link + '</span></li>';
    }).join('');
    return '<section class="card ho"' + (withHead ? '' : ' id="sec-handover"') + '><div class="card-h"><h2' + (withHead ? '' : ' tabindex="-1"') + '>' + (withHead ? svcTag(w.service) + ' ' + recLink('package', w.id) : esc(t('pkgsec.handover'))) + '</h2><span class="ho-pct"><b class="num">' + h.met + '/' + h.total + '</b> ' + esc(t('ho.met')) + '</span></div>' +
      '<div class="card-b">' + bar(h.pct, t('ho.readiness')) + '<ul class="ho-list">' + items + '</ul><p class="field-hint">' + esc(t('ho.rule')) + '</p></div></section>';
  }
  function projHandover(u, p) {
    var pk = ST().visiblePackages(u.id, p.id);
    return pk.length ? '<div class="grid g-2">' + pk.map(function (w) { return handoverBlock(u, w.id, true); }).join('') + '</div>' : '<div class="card">' + emptyBox('handover', t('pkg.none')) + '</div>';
  }
  function projActivity(u, p) { return activityBody(u, p.id); }

  // ---------------------------------------------------------------- 4. service package
  var REG_COLS = { scaffolding: ['reg.scf.ref', 'reg.location', 'reg.scf.purpose', 'reg.status'], insulation: ['reg.ins.ref', 'reg.location', 'reg.system', 'reg.status'], waterproofing: ['reg.wpr.ref', 'reg.location', 'reg.system', 'reg.status'], fireproofing: ['reg.fpr.ref', 'reg.location', 'reg.system', 'reg.status'] };
  var PKG_SECTIONS = ['scope', 'milestones', 'specs', 'documents', 'photos', 'inspections', 'issues', 'handover'];
  function packagePage(u, args) {
    var st = ST(), w = st.get('package', args[0]);
    var g = guard(u, 'package', w); if (g) return g;
    var p = st.get('project', w.projectId), a = U().byId(U().D.areas, w.areaId), pr = st.packageProgress(w.id, u.id);
    var docs = st.documents(u.id, p.id, w.id);
    var specs = docs.filter(function (d) { return d.type === 'specification' && d.status === 'published'; });
    var others = docs.filter(function (d) { return specs.indexOf(d) < 0; });
    var evs = st.evidence(u.id, p.id, w.id), ins = st.inspections(u.id, p.id, w.id);
    var cas = st.correctives(u.id, p.id, w.id).filter(st.openCorrective), reqs = st.requests(u.id, p.id, w.id).filter(function (r) { return st.OPEN_REQ.indexOf(r.status) >= 0; }), chg = st.instructions(u.id, p.id).filter(function (c) { return c.packageIds.indexOf(w.id) >= 0 && ['closed', 'rejected', 'cancelled', 'superseded'].indexOf(c.state) < 0; });
    var head = crumbs([[t('nav.home'), 'home'], [t('dir.title'), 'projects'], [L(p, 'name'), 'project.' + p.id], [t('tab.packages'), 'project.' + p.id + '.packages'], [w.code, null]]) +
      '<section class="phero pkg-hero svc-hero-' + w.service + '">' + illus(SVC_IMG[w.service], 'phero-img') + '<div class="phero-b"><div class="row" style="gap:8px">' + svcTag(w.service) + '<span class="mono">' + esc(w.code) + '</span>' + sp('pkg', st.packageStatus(w.id), 'pkgstatus') + '</div>' +
      '<h1>' + esc(t('pkgtitle.' + w.service)) + '</h1><p class="phero-loc">' + pic('pin') + ' ' + esc(L(a, 'name')) + ' · ' + esc(L(p, 'name')) + '</p>' +
      '<dl class="phero-meta"><div><dt>' + esc(t('pkg.supervisor')) + '</dt><dd>' + esc(person(w.supervisorId)) + '</dd></div><div><dt>' + esc(t('pkg.area')) + '</dt><dd><span class="mono">' + esc(a.code) + '</span></dd></div>' +
      '<div><dt>' + esc(t('pkg.weight')) + '</dt><dd class="num">' + w.weight + '%</dd></div><div><dt>' + esc(t('pw.asof')) + '</dt><dd>' + esc(fd(p.reportingDate)) + '</dd></div></dl></div>' +
      '<div class="phero-prog"><span class="label">' + esc(t('pkg.progress')) + '</span><b class="big num">' + esc(pctText(pr)) + '</b>' + pctBar(pr, t('pkg.progress')) + '<p class="muted">' + esc(t('pkg.milestonesDone', { a: pr.completed, b: pr.total })) + '</p><a class="linkbtn" ' + go('pprog.' + w.id) + '>' + esc(t('pg.openProgress')) + '</a></div></section>' +
      '<nav class="ptabs sec-nav" aria-label="' + esc(t('pkg.sections')) + '"><ul>' + PKG_SECTIONS.map(function (k) { return '<li><button type="button" data-pact="scroll" data-v="sec-' + k + '">' + esc(t('pkgsec.' + k)) + '</button></li>'; }).join('') + '</ul></nav>' +
      '<div class="notice">' + U().ic('info') + '<span>' + esc(t('pkg.criteriaNote')) + '</span></div>';
    var reg = st.register(w.id);
    var scope = card(esc(t('pkgsec.scope')), '<div class="card-b stack"><p class="lead">' + esc(L(w, 'scope')) + '</p><h3 class="sub-h">' + esc(t('reg.' + w.service)) + '</h3>' +
      (reg.length ? table(REG_COLS[w.service].map(function (k) { return t(k); }), reg.map(function (r) { return '<tr><td class="mono">' + esc(r.ref) + '</td><td>' + esc(L(r, 'location')) + '</td><td>' + esc(r.purpose === 'System per approved specification' ? t('reg.perSpec') : r.purpose) + '</td><td>' + sp('reg', r.status, 'regstatus') + '</td></tr>'; })) : '<p class="muted">' + esc(t('reg.none')) + '</p>') + '</div>', '', 'sec-scope');
    var ms = card(esc(t('pkgsec.milestones')), table([t('ms.name'), t('ms.weight'), t('ms.planned'), t('ms.forecast'), t('ms.completed'), t('f.status')], pr.milestones.map(function (m) {
      var slip = m.forecast > m.planned;
      return '<tr><td>' + esc(L(m, 'name')) + '</td><td class="num">' + m.weight + '%</td><td class="num">' + esc(fd(m.planned)) + '</td><td class="num' + (slip && !m.completedAt ? ' late' : '') + '">' + esc(fd(m.forecast)) + '</td><td class="num">' + (m.completedAt ? esc(fd(m.completedAt)) : '—') + '</td><td>' + (m.completedAt ? pill('ok', t('ms.done')) : overdue(m.forecast) ? pill('crit', t('ms.late')) : pill('', t('ms.open'))) + '</td></tr>';
    })) + '<p class="card-b field-hint">' + esc(pr.pct === null ? t('pg.notConfigured') : t('ms.rule', { a: pr.completed, b: pr.total, pct: pr.pct })) + '</p>', '', 'sec-milestones');
    var specCard = card(esc(t('pkgsec.specs')), specs.length ? '<ul class="doclist">' + specs.map(function (d) { var cr = st.currentRev(d); return '<li>' + recLink('document', d.id) + '<span class="t"><b>' + esc(d.title) + '</b><span>' + esc(t('doc.revShort', { rev: cr.rev })) + ' · ' + esc(fd(cr.date)) + ' · ' + esc(t('dsource.' + d.source)) + '</span></span>' + sp('doc', d.status, 'dstatus') + '</li>'; }).join('') + '</ul>' : emptyBox('documents', t('spec.none')), '', 'sec-specs');
    var docCard = card(esc(t('pkgsec.documents')), others.length ? table([t('doc.number'), t('doc.title'), t('doc.type'), t('doc.rev'), t('f.status'), t('misc.package'), t('doc.date')], docRows(u, others)) : emptyBox('documents', t('doc.none')), '', 'sec-documents');
    var photoCard = card(esc(t('pkgsec.photos')), '<div class="card-b stack">' + evidenceNote() + (evs.length ? '<div class="grid evgrid">' + evs.map(evidenceTile).join('') + '</div>' : emptyBox('camera', t('ev.none'))) + '</div>', '', 'sec-photos');
    var inspCard = card(esc(t('pkgsec.inspections')), ins.length ? table([t('misc.ref'), t('insp.title'), t('misc.package'), t('insp.date'), t('insp.result'), t('insp.rgs'), t('insp.customer')], inspRows(u, ins)) : emptyBox('inspections', t('insp.none')), '', 'sec-inspections');
    var issueRows = cas.map(function (c) { return '<li>' + recLink('corrective', c.id) + '<span class="t"><b>' + esc(c.title) + '</b><span>' + esc(person(c.ownerId)) + ' · ' + esc(t('ca.due')) + ' ' + dueCell(c.due) + '</span></span>' + sp('ca', c.status, 'castatus') + '</li>'; })
      .concat(reqs.map(function (r) { return '<li>' + recLink('request', r.id) + '<span class="t"><b>' + esc(r.subject) + '</b><span>' + esc(person(r.raisedBy)) + ' · ' + esc(fd(r.raisedAt)) + '</span></span>' + sp('req', r.status, 'rstatus') + '</li>'; }))
      .concat(chg.map(function (c) { return '<li>' + recLink('change', c.id) + '<span class="t"><b>' + esc(c.title) + '</b><span>' + esc(person(c.issuerId)) + ' · ' + esc(fd(c.raisedAt)) + '</span></span>' + sp('chg', c.state, 'chstatus') + '</li>'; }));
    var issueCard = card(esc(t('pkgsec.issues')), issueRows.length ? '<ul class="doclist">' + issueRows.join('') + '</ul>' : emptyBox('approvals', t('issues.none')), '<span class="pill plain num">' + issueRows.length + '</span>', 'sec-issues');
    return head + scope + '<div class="grid g-2">' + ms + specCard + '</div>' + docCard + photoCard + inspCard + '<div class="grid g-2">' + issueCard + handoverBlock(u, w.id, false) + '</div>' +
      '<div class="row back-row"><a class="btn btn-secondary" ' + go('project.' + p.id + '.packages') + '>' + U().ic('arrow', 'flip back') + esc(t('back.packages')) + '</a><a class="btn btn-ghost" ' + go('project.' + p.id) + '>' + esc(t('back.project')) + '</a></div>';
  }

  // ---------------------------------------------------------------- linked record pages
  function recordShell(u, kind, rec, title, pillHtml, main, side) {
    var st = ST(), pid = st.projectOf(rec) || rec.projectId, p = st.get('project', pid);
    var pkgId = rec.packageId || (rec.packageIds && rec.packageIds[0]);
    var tabFor = { document: rec.type === 'report' ? 'reports' : 'documents', inspection: 'inspections', corrective: 'corrective', change: 'overview', request: 'requests',
      commitment: 'commitments', report: 'reports', handoverpkg: 'handover', dailyupdate: 'overview', release: 'handover', finding: 'corrective', evidence: 'photos' }[kind] || 'overview';
    var c = [[t('nav.home'), 'home'], [t('dir.title'), 'projects'], [L(p, 'name'), 'project.' + p.id]];
    if (pkgId) c.push([st.get('package', pkgId).code, 'package.' + pkgId]); else c.push([t('tab.' + tabFor), 'project.' + p.id + '.' + tabFor]);
    c.push([codeOf(kind, rec), null]);
    return crumbs(c) + '<div class="page-h"><div><span class="eyebrow">' + esc(t('kindname.' + kind)) + ' · <span class="mono">' + esc(codeOf(kind, rec)) + '</span></span><h1>' + esc(title) + '</h1></div>' + (pillHtml || '') + '</div>' +
      '<div class="grid g-home"><div class="grid">' + main + '</div><div class="grid">' + side + '</div></div>' +
      '<div class="row back-row">' + (pkgId ? '<a class="btn btn-secondary" ' + go('package.' + pkgId) + '>' + U().ic('arrow', 'flip back') + esc(t('back.package', { code: st.get('package', pkgId).code })) + '</a>' : '') +
      '<a class="btn ' + (pkgId ? 'btn-ghost' : 'btn-secondary') + '" ' + go('project.' + p.id + (tabFor && tabFor !== 'overview' ? '.' + tabFor : '')) + '>' + (pkgId ? '' : U().ic('arrow', 'flip back')) + esc(t('back.project')) + '</a></div>';
  }
  function actionsForRecord(u, kind, id) {
    var st = ST(), cust = st.isCustomer(u.id);
    var list = U().D.actions.filter(function (a) { return a.record.kind === kind && a.record.id === id; }).map(function (a) { return st.actionView(u.id, a); })
      .filter(function (v) { var p = st.get('project', v.action.projectId); return cust ? p.customerOrgId === U().user().orgId : true; });
    if (!list.length) return '';
    return card(esc(t('rec.customerActions')), '<div class="list">' + list.map(function (v) {
      return '<div class="list-row"><span class="sev ' + (v.status === 'done' ? 'ok' : v.status === 'overdue' ? 'crit' : 'info') + '"></span><div class="t">' + typeBadge(v.action.type) + '<b>' + esc(needText(v)) + '</b><span>' + esc(t('act.due')) + ' ' + dueCell(v.action.due, v.status === 'done') + ' · ' + responsible(v) + '</span></div><div class="row-end">' + sp('action', v.status, 'astatus') + (cust ? actionButton(u, v) : '') + '</div></div>';
    }).join('') + '</div>');
  }
  function docPage(u, args) {
    var st = ST(), d = st.get('document', args[0]);
    var g = guard(u, 'document', d); if (g) return g;
    var cr = st.currentRev(d);
    var main = card(esc(t('rec.details')), '<div class="card-b">' + kv([[t('doc.number'), '<span class="mono">' + esc(d.number) + '</span>'], [t('doc.type'), esc(t('dtype.' + d.type))], [t('doc.rev'), '<span class="mono">' + esc(cr.rev) + '</span> · ' + esc(fd(cr.date))],
        [t('f.status'), sp('doc', d.status, 'dstatus')], [t('doc.source'), esc(t('dsource.' + d.source))], [t('misc.package'), (d.packageIds || []).map(function (id) { return recLink('package', id); }).join(' ') || esc(t('misc.wholeProject'))]]) + '</div>') +
      card(esc(t('doc.revisions')), table([t('doc.rev'), t('doc.date'), t('f.status'), t('doc.by'), t('doc.note')], d.revisions.slice().reverse().map(function (r) { return '<tr' + (r === cr ? ' class="current"' : '') + '><td class="mono">' + esc(r.rev) + (r === cr ? ' <span class="pill plain">' + esc(t('doc.current')) + '</span>' : '') + '</td><td class="num">' + esc(fd(r.date)) + '</td><td>' + sp('doc', r.status, 'dstatus') + '</td><td>' + esc(byWho(r.by)) + '</td><td>' + esc(r.note) + '</td></tr>'; })));
    var used = U().D.inspections.filter(function (i) { return i.basisDocId === d.id && st.canSee(u.id, 'inspection', i); });
    var side = actionsForRecord(u, 'document', d.id) + card(esc(t('doc.file')), emptyBox('documents', t('doc.nofile'), t('doc.nofile.d'))) +
      (used.length ? card(esc(t('doc.usedBy')), '<ul class="doclist">' + used.map(function (i) { return '<li>' + recLink('inspection', i.id) + '<span class="t"><b>' + esc(i.title) + '</b></span></li>'; }).join('') + '</ul>') : '');
    return recordShell(u, 'document', d, d.title, sp('doc', d.status, 'dstatus'), main, side);
  }
  function inspPage(u, args) {
    var st = ST(), i = st.get('inspection', args[0]);
    var g = guard(u, 'inspection', i); if (g) return g;
    var a = U().byId(U().D.areas, i.areaId);
    var main = card(esc(t('rec.details')), '<div class="card-b">' + kv([[t('misc.ref'), '<span class="mono">' + esc(i.ref) + '</span>'], [t('misc.package'), recLink('package', i.packageId)], [t('pkg.area'), esc(L(a, 'name')) + ' <span class="mono muted">' + esc(a.code) + '</span>'],
        [t('insp.inspector'), esc(person(i.inspectorId))], [t('ms.planned'), esc(fd(i.planned))], [t('insp.performed'), esc(fd(i.performed))], [t('insp.result'), sp('result', i.result || 'scheduled', 'result')],
        [t('insp.basis'), (i.basisDocId ? recLink('document', i.basisDocId) : '—') + '<br><span class="field-hint">' + esc(t('insp.basisNote')) + '</span>']]) + '</div>') +
      card(esc(t('insp.signoffs')), '<div class="card-b">' + kv([[t('insp.rgs'), i.rgsSignoff ? esc(person(i.rgsSignoff.by)) + ' · ' + esc(fd(i.rgsSignoff.at)) + ' · <span class="mono">' + esc(i.rgsSignoff.authority) + '</span>' : esc(t(i.result ? 'insp.pendingRgs' : 'insp.notYet'))], [t('insp.customer'), custSignoff(i)]]) + '</div>');
    var evs = st.evidence(u.id, null).filter(function (e) { return e.linked.kind === 'inspection' && e.linked.id === i.id; });
    var cas = st.correctives(u.id, null).filter(function (c) { return c.sourceInspectionId === i.id; });
    var side = actionsForRecord(u, 'inspection', i.id) + card(esc(t('insp.evidence')), evs.length ? '<div class="card-b grid">' + evs.map(evidenceTile).join('') + '</div>' : emptyBox('camera', t('ev.none'))) +
      card(esc(t('insp.raised')), cas.length ? '<ul class="doclist">' + cas.map(function (c) { return '<li>' + recLink('corrective', c.id) + '<span class="t"><b>' + esc(c.title) + '</b></span>' + sp('ca', c.status, 'castatus') + '</li>'; }).join('') + '</ul>' : emptyBox('corrective', t('insp.noCa')));
    return recordShell(u, 'inspection', i, i.title, sp('result', i.result || 'scheduled', 'result'), main, side);
  }
  function caPage(u, args) {
    var st = ST(), c = st.get('corrective', args[0]);
    var g = guard(u, 'corrective', c); if (g) return g;
    var a = U().byId(U().D.areas, c.areaId);
    var main = card(esc(t('rec.details')), '<div class="card-b">' + kv([[t('misc.ref'), '<span class="mono">' + esc(c.ref) + '</span>'], [t('misc.package'), recLink('package', c.packageId)], [t('pkg.area'), esc(L(a, 'name'))],
        [t('ca.source'), c.sourceInspectionId ? recLink('inspection', c.sourceInspectionId) : esc(t('ca.observation'))], [t('ca.raised'), esc(person(c.raisedBy)) + ' · ' + esc(fd(c.raisedAt))], [t('ca.owner'), esc(person(c.ownerId))],
        [t('ca.due'), dueCell(c.due, c.status === 'closed')], [t('f.status'), sp('ca', c.status, 'castatus')], c.closedAt ? [t('ca.closed'), esc(fd(c.closedAt)) + ' · ' + esc(t('ca.verifiedBy', { who: person(c.verifiedBy) }))] : null]) + '</div>');
    var evs = st.evidence(u.id, null).filter(function (e) { return e.linked.kind === 'corrective' && e.linked.id === c.id; });
    var side = card(esc(t('insp.evidence')), evs.length ? '<div class="card-b grid">' + evs.map(evidenceTile).join('') + '</div>' : emptyBox('camera', t('ev.none'))) + '<p class="field-hint">' + esc(t('ca.later')) + '</p>';
    return recordShell(u, 'corrective', c, c.title, sp('ca', c.status, 'castatus'), main, side);
  }
  function chgPage(u, args) {
    var st = ST(), c = st.get('change', args[0]);
    var g = guard(u, 'change', c); if (g) return g;
    var main = card(esc(t('rec.details')), '<div class="card-b stack">' + kv([[t('misc.ref'), '<span class="mono">' + esc(c.ref) + '</span> · ' + esc(t('doc.revShort', { rev: c.rev }))], [t('chg.raised'), esc(person(c.raisedBy)) + ' · ' + esc(fd(c.raisedAt))],
        [t('f.status'), sp('chg', c.state, 'chstatus')], [t('chg.affects'), c.packageIds.map(function (id) { return recLink('package', id); }).join(' ')], c.decidedBy ? [t('chg.decided'), esc(person(c.decidedBy)) + ' · ' + esc(fd(c.decidedAt))] : null]) +
      '<h3 class="sub-h">' + esc(t('chg.summary')) + '</h3><p>' + esc(c.summary) + '</p></div>');
    var side = actionsForRecord(u, 'change', c.id) + '<p class="field-hint">' + esc(t('chg.later')) + '</p>';
    return recordShell(u, 'change', c, c.title, sp('chg', c.state, 'chstatus'), main, side);
  }
  function reqPage(u, args) {
    var st = ST(), r = st.get('request', args[0]);
    var g = guard(u, 'request', r); if (g) return g;
    var main = card(esc(t('rec.details')), '<div class="card-b stack">' + kv([[t('misc.ref'), '<span class="mono">' + esc(r.ref) + '</span>'], [t('misc.package'), pkgCode(r.packageId)], [t('req.raisedBy'), esc(person(r.raisedBy)) + ' · ' + esc(fd(r.raisedAt))], [t('f.status'), sp('req', r.status, 'rstatus')]]) +
      '<h3 class="sub-h">' + esc(t('req.response')) + '</h3>' + (r.response ? '<p>' + esc(r.response) + '</p><p class="muted">' + esc(person(r.respondedBy)) + ' · ' + esc(fd(r.respondedAt)) + '</p>' : '<p class="muted">' + esc(t('req.noResponse')) + '</p>') + '</div>');
    return recordShell(u, 'request', r, r.subject, sp('req', r.status, 'rstatus'), main, '<p class="field-hint">' + esc(t('req.later')) + '</p>');
  }

  // ---------------------------------------------------------------- 5. my actions and commitments
  function actState() { var s = S(); if (!s.act) s.act = { type: '', status: 'open', project: '' }; return s.act; }
  function actionsPage(u) {
    var st = ST(), f = actState(), all = st.actionsFor(u.id);
    var open = st.openActions(all), mine = open.filter(function (v) { return v.can.allowed; }), late = open.filter(function (v) { return v.status === 'overdue'; });
    var list = all.filter(function (v) {
      if (f.type && v.action.type !== f.type) return false;
      if (f.project && v.action.projectId !== f.project) return false;
      if (f.status === 'open') return v.status !== 'done';
      if (f.status && f.status !== 'all') return v.status === f.status;
      return true;
    });
    var projects = st.visibleProjects(u.id);
    function sel(id, key, label, opts) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="act.' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (f[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    var legend = '<section class="card card-b"><h2 class="sec-h sm">' + esc(t('act.types')) + '</h2><ul class="type-legend">' + st.ACTION_TYPES.map(function (k) { return '<li>' + typeBadge(k) + '<span>' + esc(t('atype.' + k + '.d')) + '</span></li>'; }).join('') + '</ul></section>';
    var rows = list.map(function (v) {
      var p = st.get('project', v.action.projectId);
      return '<tr class="arow' + (v.can.allowed && v.status !== 'done' ? ' can' : '') + '" data-action="' + v.action.id + '"><td>' + typeBadge(v.action.type) + '</td><td><b>' + esc(needText(v)) + '</b><br><span class="mono muted">' + esc(v.action.id) + '</span></td><td>' + recLink(v.recordKind, v.record.id) + '</td><td>' + esc(L(p, 'name')) + (v.action.packageId ? '<br>' + recLink('package', v.action.packageId) : '') + '</td><td>' + responsible(v) + '</td><td>' + dueCell(v.action.due, v.status === 'done') + '</td><td>' + sp('action', v.status, 'astatus') + '</td><td class="actcell">' + actionButton(u, v) + '</td></tr>';
    });
    // Same records, two layouts: a table on wide screens, stacked rows on phones (CSS picks one).
    var actCard = card(esc(t('act.listTitle')), list.length ? '<div class="act-wide">' + table([t('act.type'), t('act.required'), t('act.record'), t('nav.projects'), t('act.responsible'), t('act.due'), t('f.status'), ''], rows, 'acttable') + '</div>' +
      '<div class="list act-narrow">' + list.map(function (v) { return actionRowCompact(u, v); }).join('') + '</div>' : emptyBox('approvals', t('act.none'), t('act.none.d')));
    var coms = []; projects.forEach(function (p) { coms = coms.concat(st.commitments(u.id, p.id).filter(function (c) { return st.commitmentStatus(c) !== 'complete'; })); });
    coms.sort(function (a, b) { return st.dueOf(a) < st.dueOf(b) ? -1 : 1; });
    var yours = coms.filter(function (c) { return c.party === 'customer'; }), theirs = coms.filter(function (c) { return c.party === 'rgs'; });
    function comTable(list) { return list.length ? table([t('misc.ref'), t('com.text'), t('nav.projects'), t('com.owner'), t('com.due'), t('f.status'), t('misc.package')], list.map(function (c) { var s = st.commitmentStatus(c), p = st.get('project', c.projectId); return '<tr><td class="mono">' + esc(c.ref) + '</td><td>' + esc(L(c, 'text')) + (c.riskReason ? '<br><span class="muted">' + esc(L(c, 'riskReason')) + '</span>' : '') + '</td><td>' + esc(L(p, 'name')) + '</td><td>' + esc(person(c.ownerId)) + '</td><td>' + dueCell(st.dueOf(c)) + (c.revised ? '<br><span class="muted">' + esc(t('com.was', { date: fd(c.promised) })) + '</span>' : '') + '</td><td>' + sp('commitment', s, 'cstatus') + '</td><td>' + pkgCode(c.packageId) + '</td></tr>'; })) : emptyBox('commitments', t('com.none')); }
    return crumbs([[t('nav.home'), 'home'], [t('nav.actions'), null]]) +
      '<div class="page-h"><div><h1>' + esc(t('act.title')) + '</h1><p>' + esc(t('act.sub')) + '</p></div><div class="chips dark"><span class="chip">' + esc(t('act.sum.open', { n: open.length })) + '</span><span class="chip brand">' + esc(t('act.sum.mine', { n: mine.length })) + '</span><span class="chip">' + esc(t('act.sum.late', { n: late.length })) + '</span></div></div>' +
      legend + '<section class="card card-b act-tools">' + sel('af-type', 'type', t('act.type'), [['', t('f.all')]].concat(st.ACTION_TYPES.map(function (k) { return [k, t('atype.' + k)]; }))) +
      sel('af-status', 'status', t('f.status'), [['open', t('af.open')], ['overdue', t('astatus.overdue')], ['done', t('astatus.done')], ['all', t('f.all')]]) +
      sel('af-project', 'project', t('nav.projects'), [['', t('f.all')]].concat(projects.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; }))) + '</section>' +
      '<p class="muted" role="status">' + esc(t('act.showing', { n: list.length })) + '</p>' + actCard +
      '<h2 class="sec-h">' + esc(t('com.title')) + '</h2>' + card(esc(t('com.yours')), comTable(yours)) + card(esc(t('com.rgs')), comTable(theirs)) + '<p class="field-hint">' + esc(t('com.rule')) + '</p>';
  }

  // ---------------------------------------------------------------- 6. activity
  function sentence(e) {
    var st = ST(), rec = st.get(e.ref.kind, e.ref.id), slots = { actor: '<b>' + esc(person(e.actor)) + '</b>', rev: esc(e.rev || ''), ref: '', pkg: '', name: '', result: '', date: '' };
    if (e.ref.kind === 'package') slots.pkg = recLink('package', e.ref.id);
    else if (e.ref.kind === 'milestone') { slots.name = esc(L(rec, 'name')); slots.pkg = recLink('package', rec.packageId); }
    else slots.ref = recLink(e.ref.kind, e.ref.id);
    if (e.ref.kind === 'inspection') slots.result = esc(t('result.' + (rec.result || 'scheduled')));
    if (e.ref.kind === 'commitment') slots.date = esc(fd(st.dueOf(rec)));
    slots.dtype = e.decisionType ? esc(t('dtype2.' + e.decisionType)) : e.actionType ? esc(t('dtype2.' + e.actionType)) : '';
    slots.outcome = e.outcome ? esc(t('outcome.' + e.outcome)) : '';
    slots.other = esc(e.otherRef || '');
    return th('tl.' + e.kind, slots);
  }
  function timeline(u, list, compact) {
    var st = ST(), days = {}, order = [];
    list.forEach(function (e) { var d = e.at.slice(0, 10); if (!days[d]) { days[d] = []; order.push(d); } days[d].push(e); });
    return '<ol class="timeline' + (compact ? ' compact' : '') + '">' + order.map(function (d) {
      return '<li class="tl-day"><h3 class="tl-date">' + esc(fd(d)) + '</h3><ol>' + days[d].map(function (e) {
        var p = st.get('project', e.projectId);
        return '<li class="tl-item' + (e.visibility === 'internal' ? ' internal' : '') + '"><span class="tl-time num">' + esc(ftime(e.at)) + '</span><span class="tl-dot"></span><div class="t"><p>' + sentence(e) + '</p>' +
          '<span class="tl-meta">' + (compact ? '' : '<a class="muted" ' + go('project.' + p.id + '.activity') + '>' + esc(p.code) + '</a> · ') + esc(t('role.' + (U().byId(U().D.users, e.actor) || {}).role)) +
          (e.visibility === 'internal' ? ' <span class="pill plain">' + esc(t('misc.internal')) + '</span>' : '') + '</span></div></li>';
      }).join('') + '</ol></li>';
    }).join('') + '</ol>';
  }
  function activityBody(u, pid) {
    var st = ST(), s = S(); if (!s.actv) s.actv = { since: false, project: '' };
    var f = s.actv, p = pid || f.project;
    var list = st.activity(u.id, { projectId: p || undefined, since: f.since ? u.lastVisitAt : undefined });
    var cust = st.isCustomer(u.id);
    var tools = '<section class="card card-b act-tools">' + (pid ? '' : '<div class="field"><label for="tl-project">' + esc(t('nav.projects')) + '</label><select id="tl-project" class="select" data-pbind="actv.project"><option value="">' + esc(t('f.all')) + '</option>' + st.visibleProjects(u.id).map(function (x) { return '<option value="' + x.id + '"' + (f.project === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + L(x, 'name')) + '</option>'; }).join('') + '</select></div>') +
      '<label class="toggle"><input type="checkbox" id="tl-since" data-pbind="actv.since"' + (f.since ? ' checked' : '') + '><span class="track"></span> ' + esc(t('tl.since', { date: fd(u.lastVisitAt) })) + '</label></section>';
    return '<div class="notice">' + U().ic(cust ? 'shield' : 'info') + '<span>' + esc(t(cust ? 'tl.customerNote' : 'tl.staffNote')) + '</span></div>' + tools +
      '<p class="muted" role="status">' + esc(t('tl.count', { n: list.length })) + '</p>' + card(esc(t('tl.title')), list.length ? '<div class="card-b">' + timeline(u, list, !!pid) + '</div>' : emptyBox('reports', t('tl.none')));
  }
  function activityPage(u) {
    return crumbs([[t('nav.home'), 'home'], [t('nav.activity'), null]]) + '<div class="page-h"><div><h1>' + esc(t('tl.title')) + '</h1><p>' + esc(t('tl.sub')) + '</p></div></div>' + activityBody(u, null);
  }

  // ---------------------------------------------------------------- dialogs (quick actions, decisions)
  function openDialog(type, extra, opener) { var s = S(); s.dialog = Object.assign({ type: type, step: 'form', values: {}, errors: {} }, extra || {}); s.dialogOpener = opener || null; U().render(); }
  P.closeDialog = function () { var s = S(), op = s.dialogOpener; s.dialog = null; U().render(); if (op) { var el = document.querySelector(op); if (el) el.focus(); } };
  P.afterDialogRender = function () {
    var d = document.getElementById('dlg'); if (!d) return;
    var first = d.querySelector('[aria-invalid="true"]') || d.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, .dlg-done button') || d.querySelector('button');
    if (first && !d.contains(document.activeElement)) first.focus();
  };
  function fieldErr(id, k) { var e = S().dialog.errors[k]; return e ? '<div id="' + id + '-err" class="field-error">' + U().ic('alert') + esc(t(e)) + '</div>' : ''; }
  function inv(k, id) { return S().dialog.errors[k] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : ''; }
  function dlgSelect(id, key, label, opts) {
    var d = S().dialog;
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-dbind="' + key + '"' + inv(key, id) + '><option value="">' + esc(t('dlg.choose')) + '</option>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (d.values[key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + fieldErr(id, key) + '</div>';
  }
  P.renderDialog = function (u) {
    var d = S().dialog, st = ST(), body = '', title = '';
    if (d.type === 'request') {
      title = t('qa.request');
      var projs = st.visibleProjects(u.id).filter(function (p) { return U().A.can(U().D, u.id, 'request.create', { projectId: p.id }).allowed; });
      if (!d.values.project && projs.length === 1) d.values.project = projs[0].id;
      var pk = d.values.project ? st.visiblePackages(u.id, d.values.project) : [];
      body = d.step === 'done' ? doneBox(t('dlg.req.notSent'), [[t('nav.projects'), st.get('project', d.values.project).code], [t('req.subject'), d.values.subject]]) :
        '<form id="dlg-form" class="stack" novalidate>' + dlgSelect('rq-project', 'project', t('nav.projects'), projs.map(function (p) { return [p.id, p.code + ' · ' + L(p, 'name')]; })) +
        dlgSelect('rq-package', 'package', t('misc.package') + ' ' + t('dlg.optional'), [['_project', t('misc.wholeProject')]].concat(pk.map(function (w) { return [w.id, w.code + ' · ' + t('svc.' + w.service)]; }))) +
        '<div class="field"><label for="rq-subject">' + esc(t('req.subject')) + '</label><input id="rq-subject" class="input" maxlength="120" data-dbind="subject" value="' + esc(d.values.subject || '') + '"' + inv('subject', 'rq-subject') + '>' + fieldErr('rq-subject', 'subject') + '</div>' +
        '<div class="field"><label for="rq-details">' + esc(t('dlg.details')) + '</label><textarea id="rq-details" class="textarea" data-dbind="details"' + inv('details', 'rq-details') + '>' + esc(d.values.details || '') + '</textarea>' + fieldErr('rq-details', 'details') + '</div>' +
        '<div class="notice warn">' + U().ic('info') + '<span>' + esc(t('dlg.req.stage')) + '</span></div><div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="dlg-close">' + esc(t('dlg.cancel')) + '</button><button class="btn btn-primary" type="submit">' + esc(t('dlg.req.submit')) + '</button></div></form>';
    } else if (d.type === 'evidence') {
      title = t('qa.evidence');
      var pk2 = st.visiblePackages(u.id).filter(function (w) { return U().A.can(U().D, u.id, 'evidence.upload', { packageId: w.id }).allowed; });
      var fm = d.values.file;
      body = d.step === 'done' ? doneBox(t('dlg.ev.notSent'), [[t('misc.package'), st.get('package', d.values.package).code], [t('dlg.file'), fm.name + ' (' + fmtSize(fm.size) + ')']]) :
        '<form id="dlg-form" class="stack" novalidate>' + dlgSelect('ev-package', 'package', t('misc.package'), pk2.map(function (w) { return [w.id, w.code + ' · ' + t('svc.' + w.service) + ' · ' + L(st.get('project', w.projectId), 'name')]; })) +
        '<div class="field"><label for="ev-file">' + esc(t('dlg.file')) + '</label><input id="ev-file" class="input file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"' + inv('file', 'ev-file') + '>' +
        (fm ? '<span class="field-hint">' + esc(t('dlg.selected', { name: fm.name, size: fmtSize(fm.size) })) + '</span>' : '<span class="field-hint">' + esc(t('dlg.fileHint')) + '</span>') + fieldErr('ev-file', 'file') + '</div>' +
        '<div class="field"><label for="ev-caption">' + esc(t('dlg.caption')) + '</label><input id="ev-caption" class="input" maxlength="140" data-dbind="caption" value="' + esc(d.values.caption || '') + '"' + inv('caption', 'ev-caption') + '>' + fieldErr('ev-caption', 'caption') + '</div>' +
        '<div class="notice warn">' + U().ic('info') + '<span>' + esc(t('dlg.ev.stage')) + '</span></div><div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="dlg-close">' + esc(t('dlg.cancel')) + '</button><button class="btn btn-primary" type="submit">' + esc(t('dlg.ev.submit')) + '</button></div></form>';
    } else if (d.type === 'contact') {
      title = t('qa.contact');
      var ps = st.visibleProjects(u.id).filter(function (p) { return !d.project || p.id === d.project; });
      var reps = {}; ps.forEach(function (p) { (reps[p.repId] = reps[p.repId] || []).push(p); });
      body = '<div class="stack">' + Object.keys(reps).map(function (rid) {
        var r = U().byId(U().D.users, rid);
        return '<div class="contact"><span class="avatar">' + esc(U().initials(r.name)) + '</span><div class="t"><b>' + esc(r.name) + '</b><span>' + esc(t('role.' + r.role)) + ' · ' + esc(reps[rid].map(function (p) { return p.code; }).join(', ')) + '</span>' +
          '<span class="copyrow"><span class="sel" dir="ltr">' + esc(r.email) + '</span><button class="btn btn-ghost btn-sm" data-pact="copy" data-v="' + esc(r.email) + '">' + pic('copy') + esc(t('dlg.copy')) + '</button></span>' +
          (r.phone ? '<span class="copyrow"><span class="sel num" dir="ltr">' + esc(r.phone) + '</span><button class="btn btn-ghost btn-sm" data-pact="copy" data-v="' + esc(r.phone) + '">' + pic('copy') + esc(t('dlg.copy')) + '</button></span>' : '') + '</div></div>';
      }).join('') + '<p class="field-hint">' + esc(t('dlg.contact.note')) + '</p><div class="dlg-actions"><button type="button" class="btn btn-primary" data-pact="dlg-close">' + esc(t('misc.close')) + '</button></div></div>';
    } else if (d.type === 'decide') {
      var v = st.actionView(u.id, st.get('action', d.actionId));
      title = t('atype.' + v.action.type);
      if (!v.can.allowed) body = '<p>' + esc(whyNot(u, v)) + '</p>';
      else {
        var opts = { document_ack: ['ack'], change_approval: ['approve', 'return'], inspection_signoff: ['signoff', 'decline'], customer_acceptance: ['accept', 'decline'] }[v.action.type];
        if (!d.values.choice) d.values.choice = opts[0];
        var needsReason = d.values.choice === 'return' || d.values.choice === 'decline';
        body = d.step === 'done' ? doneBox(t('dlg.dec.notSent'), [[t('act.record'), codeOf(v.recordKind, v.record)], [t('dlg.decision'), t('dec.' + d.values.choice)], [t('dlg.authority'), v.can.authority || t('dlg.roleGrant')]]) :
          '<form id="dlg-form" class="stack" novalidate><p><b>' + esc(needText(v)) + '</b></p>' + kv([[t('act.record'), recLink(v.recordKind, v.record.id)], [t('act.due'), dueCell(v.action.due)], [t('dlg.authority'), v.can.authority ? '<span class="mono">' + esc(v.can.authority) + '</span>' : esc(t('dlg.roleGrant'))]]) +
          '<fieldset class="field"><legend class="label">' + esc(t('dlg.decision')) + '</legend><div class="row">' + opts.map(function (o) { return '<label class="check"><input type="radio" name="dchoice" id="dc-' + o + '" value="' + o + '" data-dbind="choice"' + (d.values.choice === o ? ' checked' : '') + '> ' + esc(t('dec.' + o)) + '</label>'; }).join('') + '</div></fieldset>' +
          '<div class="field"><label for="dc-comment">' + esc(t(needsReason ? 'dlg.reason' : 'dlg.comment')) + '</label><textarea id="dc-comment" class="textarea" data-dbind="comment"' + inv('comment', 'dc-comment') + '>' + esc(d.values.comment || '') + '</textarea>' + fieldErr('dc-comment', 'comment') + '</div>' +
          '<label class="check"><input type="checkbox" id="dc-confirm" data-dbind="confirm"' + (d.values.confirm ? ' checked' : '') + inv('confirm', 'dc-confirm') + '> ' + esc(t('dlg.confirm')) + '</label>' + fieldErr('dc-confirm', 'confirm') +
          '<div class="notice warn">' + U().ic('info') + '<span>' + esc(t('dlg.dec.stage')) + '</span></div><div class="dlg-actions"><button type="button" class="btn btn-ghost" data-pact="dlg-close">' + esc(t('dlg.cancel')) + '</button><button class="btn btn-primary" type="submit">' + esc(t('dlg.dec.submit')) + '</button></div></form>';
      }
    }
    return '<div class="dlg-scrim" data-pact="dlg-close"></div><div class="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dlg-h"><h2 id="dlg-title">' + esc(title) + '</h2><button class="iconbtn" data-pact="dlg-close" aria-label="' + esc(t('misc.close')) + '">' + pic('x') + '</button></div><div class="dlg-b">' + body + '</div></div>';
  };
  function doneBox(msg, pairs) {
    return '<div class="dlg-done stack" role="status"><div class="notice warn">' + U().ic('info') + '<span>' + esc(msg) + '</span></div>' + kv(pairs.map(function (p) { return [p[0], esc(p[1])]; })) +
      '<div class="dlg-actions"><button type="button" class="btn btn-primary" data-pact="dlg-close">' + esc(t('misc.close')) + '</button></div></div>';
  }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  var OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
  function validateDialog() {
    var d = S().dialog, v = d.values, e = {};
    if (d.type === 'request') {
      if (!v.project) e.project = 'dlg.err.project';
      if (!v.subject || !v.subject.trim()) e.subject = 'dlg.err.subject';
      if (!v.details || v.details.trim().length < 10) e.details = 'dlg.err.details';
    } else if (d.type === 'evidence') {
      if (!v.package) e.package = 'dlg.err.package';
      if (!v.file) e.file = 'dlg.err.file';
      else if (OK_TYPES.indexOf(v.file.type) < 0) e.file = 'dlg.err.fileType';
      else if (v.file.size > 25 * 1048576) e.file = 'dlg.err.fileSize';
      if (!v.caption || !v.caption.trim()) e.caption = 'dlg.err.caption';
    } else if (d.type === 'decide') {
      var view = ST().actionView(U().user().id, ST().get('action', d.actionId));
      if (!view.can.allowed) e.confirm = 'dlg.err.noauth'; // re-checked at submit, never trusted from the open dialog
      if ((v.choice === 'return' || v.choice === 'decline') && (!v.comment || v.comment.trim().length < 5)) e.comment = 'dlg.err.reason';
      if (!v.confirm) e.confirm = 'dlg.err.confirm';
    }
    d.errors = e;
    return !Object.keys(e).length;
  }

  // ---------------------------------------------------------------- event hooks (called by app.js)
  function restoreFocus(id, caret) {
    var el = document.getElementById(id); if (!el) return;
    el.focus();
    if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) {}
  }
  P.onAct = function (act, el, ev) {
    var s = S(), v = el.getAttribute('data-v');
    if (act === 'dlg') { ev.preventDefault(); openDialog(v, { project: el.getAttribute('data-p') || null, values: el.getAttribute('data-p') && v === 'request' ? { project: el.getAttribute('data-p') } : {} }, el.id ? '#' + el.id : '[data-pact="dlg"][data-v="' + v + '"]'); return true; }
    if (act === 'dlg-close') { ev.preventDefault(); P.closeDialog(); return true; }
    if (act === 'decide') { ev.preventDefault(); openDialog('decide', { actionId: v }, '[data-pact="decide"][data-v="' + v + '"]'); return true; }
    if (act === 'dir-view') { dirState().view = v; try { localStorage.setItem('rgs.dirview', v); } catch (e) {} U().render(); restoreFocus(''); var b = document.querySelector('[data-pact="dir-view"][data-v="' + v + '"]'); if (b) b.focus(); return true; }
    if (act === 'dir-clear') { var f = dirState(); ['q', 'service', 'type', 'location', 'status', 'health'].forEach(function (k) { f[k] = ''; }); U().render(); restoreFocus('dir-q'); return true; }
    if (act === 'area') { s.selArea = s.selArea === v ? null : v; U().render(); var bb = document.querySelector('[data-pact="area"][data-v="' + v + '"]'); if (bb) bb.focus(); return true; }
    if (act === 'scroll') { var sec = document.getElementById(v); if (sec) { sec.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); var h = sec.querySelector('h2'); if (h) h.focus({ preventScroll: true }); } return true; }
    if (act === 'copy') {
      var done = function () { U().toast(t('dlg.copied')); };
      try { navigator.clipboard.writeText(v).then(done, function () { selectNear(el); }); } catch (e) { selectNear(el); }
      return true;
    }
    return false;
  };
  function selectNear(el) { var s = el.parentNode.querySelector('.sel'); if (!s) return; var r = document.createRange(); r.selectNodeContents(s); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); U().toast(t('dlg.copyManual')); }
  P.onChange = function (el) {
    var s = S(), pb = el.getAttribute('data-pbind'), db = el.getAttribute('data-dbind');
    if (pb) { var k = pb.split('.'); if (!s[k[0]]) { if (k[0] === 'dir') dirState(); else if (k[0] === 'act') actState(); else s[k[0]] = {}; } s[k[0]][k[1]] = el.type === 'checkbox' ? el.checked : el.value; U().render(); restoreFocus(el.id); return true; }
    if (s.dialog && db && (el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'search' || (el.tagName === 'INPUT' && !el.type))) { s.dialog.values[db] = el.value; return true; } // no re-render: keeps focus where the user tabbed
    if (s.dialog && db) { s.dialog.values[db] = el.type === 'checkbox' ? el.checked : el.value; if (db === 'project') s.dialog.values.package = ''; if (s.dialog.errors[db]) { delete s.dialog.errors[db]; } U().render(); restoreFocus(el.id); return true; }
    if (s.dialog && el.id === 'ev-file') {
      var file = el.files && el.files[0];
      s.dialog.values.file = file ? { name: file.name, size: file.size, type: file.type } : null; // metadata only; contents never read
      delete s.dialog.errors.file; U().render(); restoreFocus('ev-file'); return true;
    }
    return false;
  };
  P.onInput = function (el) {
    var s = S();
    if (el.id === 'dir-q') { dirState().q = el.value; var c = el.selectionStart; U().render(); restoreFocus('dir-q', c); return; }
    var db = el.getAttribute('data-dbind');
    if (s.dialog && db) s.dialog.values[db] = el.value; // text fields: keep value without re-rendering
  };
  P.onSubmit = function (form) {
    var s = S();
    if (form.id !== 'dlg-form' || !s.dialog) return false;
    form.querySelectorAll('[data-dbind]').forEach(function (el) { if (el.type === 'radio') { if (el.checked) s.dialog.values.choice = el.value; } else s.dialog.values[el.getAttribute('data-dbind')] = el.type === 'checkbox' ? el.checked : el.value; });
    if (validateDialog()) s.dialog.step = 'done';
    U().render();
    return true;
  };

  // ---------------------------------------------------------------- router entry
  var RECORD_BASES = { project: project, package: packagePage, doc: docPage, insp: inspPage, ca: caPage, chg: chgPage, req: reqPage };
  P.handles = function (b) { return !!RECORD_BASES[b]; };
  var NAV_OF = { prog: 'progress', pprog: 'progress', dup: 'dailyupdates', dupnew: 'dailyupdates', cm: 'commitments', cmnew: 'commitments', deps: 'dependencies', rpt: 'reports', rptnew: 'reports', rptprint: 'reports', ho: 'handover', hp: 'handover', hpnew: 'handover', insp: 'inspections', inspnew: 'inspections', field: 'inspections', fnd: 'findings', fndnew: 'findings', ca: 'corrective', tpl: 'checklists', doc: 'documents', docnew: 'documents', tr: 'documents', ev: 'evidence', evnew: 'evidence', req: 'requests', newreq: 'requests', chg: 'instructions', newins: 'instructions', decision: 'approvals' };
  P.navFor = function (b) { return NAV_OF[b] || (RECORD_BASES[b] ? 'projects' : 'home'); };
  P.hasModule = function (id) { return !!MODULE_PAGES[id]; };
  // Stage 3 pages register here (pages-stage3.js).
  P.extend = function (ext) {
    Object.keys(ext.bases || {}).forEach(function (k) { RECORD_BASES[k] = ext.bases[k]; });
    Object.keys(ext.modules || {}).forEach(function (k) { MODULE_PAGES[k] = ext.modules[k]; });
    var prevAct = P.onAct, prevChange = P.onChange, prevInput = P.onInput, prevSubmit = P.onSubmit;
    if (ext.onAct) P.onAct = function (a, el, ev) { return ext.onAct(a, el, ev) || prevAct(a, el, ev); };
    if (ext.onChange) P.onChange = function (el) { return ext.onChange(el) || prevChange(el); };
    if (ext.onInput) P.onInput = function (el) { return ext.onInput(el) || prevInput(el); };
    if (ext.onSubmit) P.onSubmit = function (f) { return ext.onSubmit(f) || prevSubmit(f); };
    if (ext.requestRows) P.requestRows = ext.requestRows;
  };
  var MODULE_PAGES = {};
  P.render = function (base, args, u) {
    if (MODULE_PAGES[base]) return MODULE_PAGES[base](u, args);
    if (base === 'overview') return overview(u);
    if (base === 'directory') return directory(u);
    if (base === 'actions') return actionsPage(u);
    if (base === 'activity') return activityPage(u);
    return RECORD_BASES[base](u, args);
  };
  P._internals = { needText: needText, routeOf: routeOf, codeOf: codeOf }; // for tests
  // Shared building blocks for pages-stage3.js
  P._h = { t: t, th: th, esc: esc, pic: pic, recLink: recLink, routeOf: routeOf, codeOf: codeOf, go: go, pill: pill, sp: sp, TONE: TONE, bar: bar, illus: illus,
    svcTag: svcTag, crumbs: crumbs, emptyBox: emptyBox, card: card, table: table, kv: kv, guard: guard, dueCell: dueCell, overdue: overdue, fd: fd, ftime: ftime,
    person: person, orgName: orgName, L: L, typeBadge: typeBadge, needText: needText, whyNot: whyNot, actionButton: actionButton, decisionRoute: decisionRoute,
    timeline: timeline, evidenceTile: evidenceTile, SVC_IMG: SVC_IMG, explainProgress: explainProgress, recordShell: recordShell, actionsForRecord: actionsForRecord, custSignoff: custSignoff, pctText: pctText, pctBar: pctBar };
  window.RGSPages = P;
})();
