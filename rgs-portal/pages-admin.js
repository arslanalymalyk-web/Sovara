/*
 * RGS Client Portal — administration and support: users, organisations, roles and delegated authority,
 * audit and access, system settings, support requests.
 * Every change goes through the command layer (api.js), so it is permission-checked, all-or-nothing and audited.
 */
(function () {
  'use strict';
  var P = window.RGSPages, h = P._h, G = window.RGSPages6;
  var t = h.t, esc = h.esc, pic = h.pic, go = h.go, pill = h.pill, card = h.card, table = h.table, kv = h.kv,
    crumbs = h.crumbs, emptyBox = h.emptyBox, fd = h.fd, ftime = h.ftime, person = h.person;
  var F = G.F, openForm = G.openForm, isOpen = G.isOpen, val = G.val, input = G.input, select = G.select, formWrap = G.formWrap,
    opener = G.opener, run = G.run, need = G.need, invalid = G.invalid;
  function U() { return window.RGSUI; }
  function S() { return U().S; }
  function ST() { return U().ST; }
  function API() { return U().API; }
  function me() { return U().user(); }
  function A() { return U().A; }
  function ic(n, c) { return U().ic(n, c); }
  function ds() { return ST().ds; }
  function fdt(d) { return d ? fd(d) + (d.length > 10 ? ' ' + ftime(d) : '') : '—'; }
  function A_() { var s = S(); if (!s.adm) s.adm = {}; var a = s.adm; a.uq = a.uq || ''; a.uorg = a.uorg || ''; a.urole = a.urole || ''; a.ustatus = a.ustatus || ''; a.sel = a.sel || null; a.role = a.role || null;
    a.aq = a.aq || ''; a.aactor = a.aactor || ''; a.aaction = a.aaction || ''; a.alimit = a.alimit || 40; return a; }
  function org(id) { var o = ds().orgs.filter(function (x) { return x.id === id; })[0]; return o ? U().L(o, 'name') : id; }
  function roleName(r) { return t('role.' + r); }
  function projCode(id) { if (id === '*') return t('adm.scope.all'); var p = ds().projects.filter(function (x) { return x.id === id; })[0]; return p ? p.code : id; }
  function scopeText(sc) { return sc && sc.projectId ? projCode(sc.projectId) + (sc.service ? ' · ' + t('svc.' + sc.service) : '') : '—'; }
  function statusPill(s) { return pill(s === 'active' ? 'ok' : s === 'invited' ? 'info' : 'warn', t('adm.status.' + s)); }
  function pageHead(key, extra) {
    return crumbs([[t('nav.home'), 'home'], [t('nav.' + key), null]]) + '<div class="page-h"><div><h1>' + esc(t('adm.' + key + '.title')) + '</h1><p>' + esc(t('adm.' + key + '.sub')) + '</p></div>' + (extra || '') + '</div>';
  }
  function liveSearch(id, value) {
    return '<div class="field ic-search"><label for="' + id + '">' + esc(t('dir.search')) + '</label><div class="control">' + ic('search') + '<input id="' + id + '" class="input" type="search" data-live value="' + esc(value) + '"></div></div>';
  }
  function pbSel(id, key, label, opts, cur) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="select" data-pbind="adm.' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  // a form that sits directly under the page title gets a level-2 heading so the outline never skips a level
  function topForm(html) { return html.replace(/<h3 class="sub-h" tabindex="-1">([\s\S]*?)<\/h3>/, '<h2 class="sub-h" tabindex="-1">$1</h2>'); }
  function opts(list) { return list.map(function (o) { return [o[0], o[1]]; }); }
  function todayStr() { return ST().today; }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function denied() { return emptyBox('shield', t('adm.denied.t'), t('adm.denied.d')); }
  function can(u, action) { return A().can(ds(), u.id, action, null).allowed; }

  // =====================================================================================================
  // USERS
  // =====================================================================================================
  function userAssignments(uid) { return ds().assignments.filter(function (a) { return a.userId === uid && a.status !== 'revoked'; }); }
  function userAuths(uid) { return ds().authorities.filter(function (d) { return d.userId === uid; }); }
  function usersPage(u) {
    if (!can(u, 'admin.users')) return denied();
    var a = A_(), all = ds().users, q = a.uq.trim().toLowerCase();
    var list = all.filter(function (x) {
      return (!q || (x.name + ' ' + x.email).toLowerCase().indexOf(q) >= 0) && (!a.uorg || x.orgId === a.uorg) && (!a.urole || x.role === a.urole) && (!a.ustatus || x.status === a.ustatus);
    });
    var counts = { active: 0, invited: 0, suspended: 0 }; all.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
    var rows = list.map(function (x) {
      var sel = a.sel === x.id;
      return '<tr' + (sel ? ' aria-selected="true"' : '') + '><td><b>' + esc(x.name) + '</b><br><span class="muted">' + esc(x.email) + '</span></td><td>' + esc(org(x.orgId)) + '</td><td>' + esc(roleName(x.role)) + '</td><td>' + statusPill(x.status) + '</td>' +
        '<td>' + esc(fdt(x.lastVisitAt)) + '</td><td><button type="button" class="btn btn-secondary btn-sm" data-pact="adm-sel" data-v="' + esc(x.id) + '" aria-pressed="' + (sel ? 'true' : 'false') + '">' + esc(t('adm.details')) + '<span class="visually-hidden"> · ' + esc(x.name) + '</span></button></td></tr>';
    });
    var invite = isOpen('adm-invite') ? inviteForm() : '';
    var detail = a.sel ? userDetail(u, a.sel) : '';
    return pageHead('users', opener('adm-invite', t('adm.invite'), true)) + topForm(invite) +
      '<p class="muted" role="status">' + esc(t('adm.users.count', { n: list.length, m: all.length, a: counts.active, i: counts.invited, s: counts.suspended })) + '</p>' +
      '<section class="card card-b act-tools">' + liveSearch('adm-q', a.uq) +
      pbSel('adm-uorg', 'uorg', t('adm.org'), [['', t('f.all')]].concat(ds().orgs.map(function (o) { return [o.id, U().L(o, 'name')]; })), a.uorg) +
      pbSel('adm-urole', 'urole', t('adm.role'), [['', t('f.all')]].concat(Object.keys(A().ROLES).map(function (r) { return [r, roleName(r)]; })), a.urole) +
      pbSel('adm-ustatus', 'ustatus', t('f.status'), [['', t('f.all')], ['active', t('adm.status.active')], ['invited', t('adm.status.invited')], ['suspended', t('adm.status.suspended')]], a.ustatus) + '</section>' +
      card(esc(t('adm.users.register')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('adm.person'), t('adm.org'), t('adm.role'), t('f.status'), t('adm.lastvisit'), ''], rows) : emptyBox('users', t('adm.users.none'), t('adm.users.none.d'))) + detail;
  }
  function inviteForm() {
    var orgId = val('orgId'), o = ds().orgs.filter(function (x) { return x.id === orgId; })[0], side = o ? (o.kind === 'rgs' ? 'rgs' : 'customer') : null;
    var roles = Object.keys(A().ROLES).filter(function (r) { return !side || A().ROLES[r].side === side; });
    var role = val('role'), def = A().ROLES[role], needsProject = def && def.scopeLevel !== 'global';
    var projects = ds().projects.filter(function (p) { return !o || o.kind === 'rgs' || p.customerOrgId === o.id; });
    return formWrap('adm-invite', t('adm.invite'),
      input('name', t('adm.name'), 'text') + input('email', t('adm.email'), 'email') +
      select('orgId', t('adm.org'), ds().orgs.map(function (x) { return [x.id, U().L(x, 'name')]; }), { live: true }) +
      select('role', t('adm.role'), roles.map(function (r) { return [r, roleName(r)]; }), { live: true, hint: t('adm.invite.roleHint') }) +
      (needsProject ? select('projectId', t('adm.scope'), projects.map(function (p) { return [p.id, p.code + ' · ' + U().L(p, 'name')]; })) : '') +
      '<p class="field-hint">' + esc(t('adm.invite.note')) + '</p>', t('adm.invite.send'));
  }
  function roleChangeForm(x) {
    var o = ds().orgs.filter(function (y) { return y.id === x.orgId; })[0], side = o && o.kind === 'rgs' ? 'rgs' : 'customer';
    var roles = Object.keys(A().ROLES).filter(function (r) { return A().ROLES[r].side === side && r !== x.role; });
    var role = val('role'), def = A().ROLES[role], needsProject = def && def.scopeLevel !== 'global';
    var projects = ds().projects.filter(function (pj) { return !o || o.kind === 'rgs' || pj.customerOrgId === o.id; });
    return formWrap('adm-role.' + x.id, t('adm.role.change') + ' · ' + x.name,
      '<p class="field-hint">' + esc(t('adm.role.note', { role: roleName(x.role) })) + '</p>' +
      select('role', t('adm.role.new'), roles.map(function (r) { return [r, roleName(r)]; }), { live: true }) +
      (needsProject ? select('projectId', t('adm.scope'), projects.map(function (pj) { return [pj.id, pj.code + ' · ' + U().L(pj, 'name')]; })) : '') +
      input('reason', t('dlg.reason'), 'textarea'), t('adm.role.change'));
  }
  function userDetail(u, id) {
    var x = ds().users.filter(function (y) { return y.id === id; })[0]; if (!x) return '';
    var asg = userAssignments(id), auths = userAuths(id), self = x.id === u.id;
    var acts = '';
    if (!self && x.status === 'active') acts = opener('adm-susp.' + id, t('adm.suspend'), false);
    else if (!self) acts = '<button type="button" class="btn btn-primary" data-pact="adm-activate" data-v="' + esc(id) + '">' + esc(t(x.status === 'invited' ? 'adm.activate' : 'adm.reactivate')) + '</button>';
    var roleBtn = !self ? opener('adm-role.' + id, t('adm.role.change'), false) : '';
    var roleForm = isOpen('adm-role.' + id) ? roleChangeForm(x) : '';
    var form = isOpen('adm-susp.' + id) ? formWrap('adm-susp.' + id, t('adm.suspend') + ' · ' + x.name, '<p class="field-hint">' + esc(t('adm.suspend.note')) + '</p>' + input('reason', t('dlg.reason'), 'textarea'), t('adm.suspend'), { danger: true }) : '';
    return card(esc(x.name), kv([[t('adm.email'), esc(x.email)], [t('adm.org'), esc(org(x.orgId))], [t('adm.role'), esc(roleName(x.role))], [t('f.status'), statusPill(x.status)],
      x.statusReason ? [t('adm.status.reason'), esc(x.statusReason)] : null, [t('adm.lastvisit'), esc(fdt(x.lastVisitAt))],
      [t('adm.assignments'), asg.length ? '<ul class="plain">' + asg.map(function (g) { return '<li>' + esc(roleName(g.role)) + ' · ' + esc(scopeText(g.scope)) + '</li>'; }).join('') + '</ul>' : '—'],
      [t('adm.authorities'), auths.length ? '<ul class="plain">' + auths.map(function (d) { return '<li>' + esc(d.id) + ' · ' + esc(U().actLabel(d.action)) + ' ' + pill(d.status === 'active' && !d.revokedAt ? 'ok' : 'plain', t('adm.auth.' + (d.revokedAt ? 'revoked' : d.status))) + '</li>'; }).join('') + '</ul>' : '—']]) +
      (self ? '<p class="field-hint card-b">' + esc(t('adm.self')) + '</p>' : '') + '<div class="card-b stack"><div class="btn-stack">' + roleBtn + acts + '</div>' + roleForm + form + '</div>', '', 'adm-detail');
  }

  // =====================================================================================================
  // ORGANISATIONS
  // =====================================================================================================
  function orgsPage(u) {
    if (!can(u, 'admin.users')) return denied();
    var rows = ds().orgs.map(function (o) {
      var us = ds().users.filter(function (x) { return x.orgId === o.id; }), act = us.filter(function (x) { return x.status === 'active'; }).length;
      var pr = o.kind === 'rgs' ? ds().projects : ds().projects.filter(function (p) { return p.customerOrgId === o.id; });
      return '<tr><td><b>' + esc(U().L(o, 'name')) + '</b></td><td>' + pill(o.kind === 'rgs' ? 'brand' : 'info', t('adm.orgkind.' + o.kind)) + '</td><td class="num">' + us.length + ' <span class="muted">(' + esc(t('adm.org.active', { n: act })) + ')</span></td>' +
        '<td>' + (pr.length ? pr.map(function (p) { return '<span class="mono">' + esc(p.code) + '</span>'; }).join('<br>') : '—') + '</td>' +
         '<td><div class="btn-stack">' + (o.kind === 'rgs' ? '' : opener('adm-orgedit.' + o.id, t('adm.org.rename'), false)) + '<button type="button" class="btn btn-secondary btn-sm" data-pact="adm-users-org" data-v="' + esc(o.id) + '">' + esc(t('adm.org.viewUsers')) + '<span class="visually-hidden"> · ' + esc(U().L(o, 'name')) + '</span></button></div></td></tr>';
    });
    var edit = '', fk = F().key || '';
    if (isOpen('adm-orgnew')) edit = formWrap('adm-orgnew', t('adm.org.new'), '<p class="field-hint">' + esc(t('adm.org.new.note')) + '</p>' + input('name', t('adm.org.name'), 'text') + input('nameAr', t('adm.org.nameAr'), 'text', { optional: true }), t('adm.org.create'));
    else if (/^adm-orgedit\./.test(fk)) { var oo = ds().orgs.filter(function (y) { return y.id === fk.slice(12); })[0]; if (oo) edit = formWrap(fk, t('adm.org.rename') + ' · ' + U().L(oo, 'name'), input('name', t('adm.org.name'), 'text', { value: oo.name }) + input('nameAr', t('adm.org.nameAr'), 'text', { value: oo.nameAr, optional: true }), t('adm.org.rename')); }
    return pageHead('orgs', opener('adm-orgnew', t('adm.org.new'), true)) + (edit ? '<div class="card"><div class="card-b">' + topForm(edit) + '</div></div>' : '') + '<div class="notice">' + ic('info') + '<span>' + esc(t('adm.orgs.rule')) + '</span></div>' + card(esc(t('adm.orgs.register')) + ' <span class="pill plain num">' + rows.length + '</span>', table([t('adm.org'), t('adm.kind'), t('adm.users'), t('adm.projects'), ''], rows));
  }

  // =====================================================================================================
  // ROLES AND DELEGATED AUTHORITY
  // =====================================================================================================
  function grantAuthorityForm(u) {
    var A_ = A(), actions = Object.keys(A_.ACTIONS).filter(function (k) { return A_.ACTIONS[k].kind === 'technical'; }).sort(function (x, y) { return U().actLabel(x).localeCompare(U().actLabel(y)); });
    var action = val('action'), projectId = val('projectId');
    var holders = ds().users.filter(function (x) { return x.id !== u.id && x.status === 'active' && A_.ROLES[x.role] && (!action || A_.ROLES[x.role].eligible.indexOf(action) >= 0); });
    var nominators = ds().users.filter(function (x) { return x.id !== u.id && x.status === 'active'; }).map(function (x) { return [x.id, x.name + ' · ' + roleName(x.role)]; })
      .concat(ds().orgs.filter(function (o) { return o.kind === 'customer'; }).map(function (o) { return [o.id, U().L(o, 'name')]; }));
    var from = todayStr();
    return formWrap('adm-grant', t('adm.grant'), '<p class="field-hint">' + esc(t('adm.grant.note')) + '</p>' +
      select('action', t('adm.action'), actions.map(function (k) { return [k, U().actLabel(k)]; }), { live: true }) +
      select('userId', t('adm.grant.holder'), holders.map(function (x) { return [x.id, x.name + ' · ' + roleName(x.role)]; }), { hint: action && !holders.length ? t('adm.grant.noholder') : t('adm.grant.holder.hint') }) +
      select('projectId', t('adm.scope'), ds().projects.map(function (pj) { return [pj.id, pj.code + ' · ' + U().L(pj, 'name')]; })) +
      input('validFrom', t('adm.grant.from'), 'date', { value: from }) +
      input('validTo', t('adm.grant.to'), 'date', { value: addDays(from, 180), hint: t('adm.grant.to.hint') }) +
      select('nominatedBy', t('adm.grant.nominatedBy'), nominators, { hint: t('adm.grant.nominatedBy.hint') }), t('adm.grant.submit'));
  }
  function rolesPage(u) {
    if (!can(u, 'admin.roles')) return denied();
    var a = A_(), R = A().ROLES, order = A().ROLE_ORDER;
    var rows = order.map(function (r) {
      var holders = ds().users.filter(function (x) { return x.role === r; }).length, d = R[r], sel = a.role === r;
      return '<tr' + (sel ? ' aria-selected="true"' : '') + '><td><b>' + esc(roleName(r)) + '</b></td><td>' + pill(d.side === 'rgs' ? 'brand' : 'info', t('adm.orgkind.' + d.side)) + '</td><td>' + esc(t('adm.level.' + d.scopeLevel)) + '</td><td class="num">' + holders + '</td><td class="num">' + d.grants.length + '</td><td class="num">' + (d.eligible || []).length + '</td>' +
        '<td><button type="button" class="btn btn-secondary btn-sm" data-pact="adm-role" data-v="' + esc(r) + '" aria-pressed="' + (sel ? 'true' : 'false') + '">' + esc(t('adm.perms.show')) + '<span class="visually-hidden"> · ' + esc(roleName(r)) + '</span></button></td></tr>';
    });
    var detail = '';
    if (a.role && R[a.role]) {
      var d = R[a.role], uniq = function (arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }).sort(); };
      detail = card(esc(roleName(a.role)), '<div class="card-b stack"><h3 class="sub-h">' + esc(t('adm.perms.grants')) + ' <span class="pill plain num">' + uniq(d.grants).length + '</span></h3><ul class="plain cols">' + uniq(d.grants).map(function (g) { return '<li>' + esc(U().actLabel(g)) + '</li>'; }).join('') + '</ul>' +
        (d.eligible && d.eligible.length ? '<h3 class="sub-h">' + esc(t('adm.perms.eligible')) + '</h3><p class="field-hint">' + esc(t('adm.perms.eligible.d')) + '</p><ul class="plain cols">' + uniq(d.eligible).map(function (g) { return '<li>' + esc(U().actLabel(g)) + '</li>'; }).join('') + '</ul>' : '') + '</div>', '', 'adm-role-detail');
    }
    var auths = ds().authorities.slice().sort(function (x, y) { return String(x.id).localeCompare(String(y.id)); });
    var arows = auths.map(function (d) {
      var live = d.status === 'active' && !d.revokedAt;
      return '<tr><td><span class="mono">' + esc(d.id) + '</span></td><td>' + esc(person(d.userId)) + '</td><td>' + esc(U().actLabel(d.action)) + '</td><td>' + esc(scopeText(d.scope)) + '</td><td>' + esc(fd(d.validFrom)) + ' – ' + esc(fd(d.validTo || d.validUntil)) + '</td>' +
        '<td>' + pill(live ? 'ok' : 'plain', t('adm.auth.' + (d.revokedAt ? 'revoked' : d.status))) + (d.revokeReason ? '<br><span class="muted">' + esc(d.revokeReason) + '</span>' : '') + '</td><td>' + esc(person(d.grantedBy)) + '</td>' +
        '<td>' + (live ? opener('adm-rev.' + d.id, t('adm.revoke'), false) : '') + '</td></tr>';
    });
    var revForm = '';
    var rk = F().key || ''; if (/^adm-rev\./.test(rk)) { var did = rk.slice(8), dd = ds().authorities.filter(function (x) { return x.id === did; })[0]; if (dd) revForm = formWrap(rk, t('adm.revoke') + ' · ' + dd.id, '<p class="field-hint">' + esc(t('adm.revoke.note', { who: person(dd.userId), what: U().actLabel(dd.action) })) + '</p>' + input('reason', t('dlg.reason'), 'textarea'), t('adm.revoke'), { danger: true }); }
    var grantForm = isOpen('adm-grant') ? grantAuthorityForm(u) : '';
    return pageHead('roles', opener('adm-grant', t('adm.grant'), true)) + (grantForm ? '<div class="card"><div class="card-b">' + topForm(grantForm) + '</div></div>' : '') + '<div class="notice">' + ic('info') + '<span>' + esc(t('adm.roles.rule')) + '</span></div>' +
      card(esc(t('adm.roles.catalogue')) + ' <span class="pill plain num">' + rows.length + '</span>', table([t('adm.role'), t('adm.kind'), t('adm.level'), t('adm.users'), t('adm.perms.grants'), t('adm.perms.eligible'), ''], rows)) + detail +
      card(esc(t('adm.auth.title')) + ' <span class="pill plain num">' + auths.length + '</span>', (revForm ? '<div class="card-b">' + revForm + '</div>' : '') + (auths.length ? table([t('misc.ref'), t('adm.person'), t('adm.action'), t('adm.scope'), t('adm.valid'), t('f.status'), t('adm.grantedBy'), ''], arows) : emptyBox('shield', t('adm.auth.none'), '')));
  }

  // =====================================================================================================
  // AUDIT AND ACCESS
  // =====================================================================================================
  function auditRows(a) {
    var q = a.aq.trim().toLowerCase();
    return ds().audit.slice().sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); }).filter(function (e) {
      if (a.aactor && e.actor !== a.aactor) return false;
      if (a.aaction && String(e.action).split('.')[0] !== a.aaction) return false;
      if (q && (String(e.action) + ' ' + (e.record ? e.record.kind + ' ' + e.record.id : '') + ' ' + (e.reason || '') + ' ' + person(e.actor) + ' ' + detailText(e.detail)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function detailText(d) { if (!d) return ''; try { return Object.keys(d).map(function (k) { var v = d[k]; return k + ': ' + (v && typeof v === 'object' ? JSON.stringify(v) : v); }).join(' · '); } catch (e) { return ''; } }
  function auditPage(u) {
    if (!can(u, 'admin.audit.view')) return denied();
    var a = A_(), all = ds().audit, list = auditRows(a), shown = list.slice(0, a.alimit);
    var actors = {}, areas = {}; all.forEach(function (e) { actors[e.actor] = 1; areas[String(e.action).split('.')[0]] = 1; });
    var rows = shown.map(function (e) {
      return '<tr><td class="nowrap">' + esc(fdt(e.at)) + '</td><td>' + esc(person(e.actor)) + '</td><td><span class="mono">' + esc(e.action) + '</span></td><td>' + (e.record ? '<span class="mono">' + esc(e.record.kind + ' ' + e.record.id) + '</span>' : '—') + '</td><td>' + esc(e.reason || '') + (e.detail ? '<br><span class="muted">' + esc(detailText(e.detail)) + '</span>' : '') + '</td></tr>';
    });
    var more = list.length > shown.length ? '<div class="card-b"><button type="button" class="btn btn-secondary" data-pact="adm-more">' + esc(t('adm.audit.more', { n: list.length - shown.length })) + '</button></div>' : '';
    return pageHead('audit', '<button type="button" class="btn btn-secondary" data-pact="adm-audit-csv">' + pic('documents') + esc(t('adm.audit.csv')) + '</button>') + '<div class="notice">' + ic('info') + '<span>' + esc(t('adm.audit.rule')) + '</span></div>' +
      '<section class="card card-b act-tools">' + liveSearch('adm-aq', a.aq) +
      pbSel('adm-aactor', 'aactor', t('adm.actor'), [['', t('f.all')]].concat(Object.keys(actors).map(function (k) { return [k, person(k)]; })), a.aactor) +
      pbSel('adm-aaction', 'aaction', t('adm.area'), [['', t('f.all')]].concat(Object.keys(areas).sort().map(function (k) { return [k, k]; })), a.aaction) + '</section>' +
      '<p class="muted" role="status">' + esc(t('rq.count', { n: list.length, m: all.length })) + '</p>' +
      card(esc(t('adm.audit.title')) + ' <span class="pill plain num">' + list.length + '</span>', list.length ? table([t('adm.when'), t('adm.actor'), t('adm.action'), t('adm.record'), t('adm.reasonDetail')], rows) + more : emptyBox('audit', t('adm.audit.none'), t('adm.audit.none.d')));
  }
  function csvCell(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function exportAuditCsv() {
    var rows = [['at', 'actor', 'action', 'record', 'reason', 'detail']].concat(auditRows(A_()).map(function (e) { return [e.at, person(e.actor), e.action, e.record ? e.record.kind + ' ' + e.record.id : '', e.reason || '', detailText(e.detail)]; }));
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit-log.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    U().toast(t('adm.audit.exported'));
  }

  // =====================================================================================================
  // SYSTEM SETTINGS (read-only view of the deployment configuration)
  // =====================================================================================================
  function human(k) { var w = String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); }
  function settingValue(v) {
    if (v === true) return pill('ok', t('adm.set.on')); if (v === false) return pill('plain', t('adm.set.off'));
    if (v == null || v === '') return pill('warn', t('adm.set.unset'));
    if (Array.isArray(v)) return v.length ? esc(v.join(', ')) : pill('warn', t('adm.set.unset'));
    if (typeof v === 'object') { var n = Object.keys(v).length; return n ? esc(t('adm.set.entries', { n: n })) : pill('warn', t('adm.set.unset')); }
    return esc(String(v));
  }
  function settingsPage(u) {
    if (!can(u, 'admin.settings')) return denied();
    var cfg = U().CFG || {}, pol = cfg.policy || {};
    function section(title, obj) {
      var keys = Object.keys(obj).filter(function (k) { return typeof obj[k] !== 'function'; });
      return card(esc(title) + ' <span class="pill plain num">' + keys.length + '</span>', '<div class="card-b">' + kv(keys.map(function (k) { return [human(k), settingValue(obj[k])]; })) + '</div>');
    }
    var top = {}, subs = [];
    Object.keys(pol).forEach(function (k) { var v = pol[k]; if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && k !== 'responseTargets' && k !== 'routing') subs.push(k); else top[k] = v; });
    var unset = 0; Object.keys(pol).forEach(function (k) { var v = pol[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) unset++; });
    return pageHead('settings') + '<div class="notice warn">' + ic('alert') + '<span>' + esc(t('adm.settings.rule', { n: unset })) + '</span></div>' +
      card(esc(t('adm.set.deploy')), '<div class="card-b">' + kv([[t('adm.set.dataSource'), esc(cfg.dataSource || '—')], [t('adm.set.fixture'), settingValue(!!U().FIXTURE)], [t('adm.set.users'), String(ds().users.length)], [t('adm.set.audit'), String(ds().audit.length)]]) + '</div>') +
      section(t('adm.set.general'), top) + subs.map(function (k) { return section(t('adm.set.section', { name: human(k) }), pol[k]); }).join('');
  }

  // =====================================================================================================
  // SUPPORT
  // =====================================================================================================
  var CATS = ['access', 'data', 'report', 'other'];
  function ticketDetail(u, x, isAdm) {
    var thread = [{ by: x.userId, at: x.createdAt, text: x.message, staff: false }].concat(x.replies || []);
    var items = thread.map(function (m) { return '<li class="' + (m.staff ? 'staff' : 'cust') + '"><b>' + esc(person(m.by)) + '</b> <span class="muted">' + esc(fdt(m.at)) + (m.staff ? ' · ' + esc(t('adm.sup.staff')) : '') + '</span><p>' + esc(m.text) + '</p></li>'; }).join('');
    var statusBtns = isAdm ? ['open', 'in_progress', 'resolved'].filter(function (k) { return k !== x.status; }).map(function (k) { return '<button type="button" class="btn btn-secondary" data-pact="sup-status" data-v="' + esc(x.id + '|' + k) + '">' + esc(t('adm.sup.mark.' + k)) + '</button>'; }).join('') : '';
    var key = 'sup-reply.' + x.id;
    var closed = x.status === 'resolved' && !isAdm;
    var replyForm = formWrap(key, t('adm.sup.reply'), input('message', t('adm.sup.message'), 'textarea', { rows: 3 }), t('adm.sup.reply.send'));
    var form = closed ? (isOpen(key) ? replyForm : '<p class="field-hint">' + esc(t('adm.sup.resolved.note')) + '</p>' + opener(key, t('adm.sup.reopen'), false)) : replyForm;
    return card(esc(x.ref) + ' · ' + esc(x.subject) + ' ' + pill(x.status === 'resolved' ? 'ok' : 'info', t('adm.sup.status.' + x.status)), '<div class="card-b stack"><ul class="plain thread">' + items + '</ul>' + (statusBtns ? '<div class="btn-stack">' + statusBtns + '</div>' : '') + form + '</div>', '', 'adm-ticket');
  }
  function supportPage(u) {
    var cfg = U().CFG || {}, ch = (cfg.support && cfg.support.channels) || [], isAdm = can(u, 'admin.users');
    var all = ds().supportTickets || [], mine = (isAdm ? all : all.filter(function (x) { return x.userId === u.id; })).slice().reverse();
    var sel = A_().tk ? all.filter(function (x) { return x.id === A_().tk && (isAdm || x.userId === u.id); })[0] : null;
    var rows = mine.map(function (x) { return '<tr' + (sel && sel.id === x.id ? ' aria-selected="true"' : '') + '><td><span class="mono">' + esc(x.ref) + '</span></td><td><button type="button" class="linkbtn" data-pact="sup-open" data-v="' + esc(x.id) + '">' + esc(x.subject) + '</button>' + ((x.replies || []).length ? ' <span class="pill plain num">' + (x.replies || []).length + '</span>' : '') + '<br><span class="muted">' + esc(x.message.length > 120 ? x.message.slice(0, 120) + '…' : x.message) + '</span></td><td>' + esc(t('adm.sup.cat.' + x.category)) + '</td>' + (isAdm ? '<td>' + esc(person(x.userId)) + '</td>' : '') + '<td>' + pill(x.status === 'resolved' ? 'ok' : 'info', t('adm.sup.status.' + x.status)) + '</td><td>' + esc(fdt(x.createdAt)) + '</td></tr>'; });
    var form = isOpen('sup-new') ? formWrap('sup-new', t('adm.sup.new'), select('category', t('adm.sup.category'), CATS.map(function (c) { return [c, t('adm.sup.cat.' + c)]; })) + input('subject', t('adm.sup.subject'), 'text') + input('message', t('adm.sup.message'), 'textarea', { rows: 4, hint: t('adm.sup.message.hint') }), t('adm.sup.send')) : '';
    var detail = sel ? ticketDetail(u, sel, isAdm) : '';
    return pageHead('support', opener('sup-new', t('adm.sup.new'), true)) + topForm(form) +
      '<div class="grid-2">' + card(esc(t('adm.sup.contact')), '<div class="card-b">' + (ch.length ? '<ul class="plain">' + ch.map(function (c) { return '<li><b>' + esc(c.label) + '</b> · ' + esc(c.value) + '</li>'; }).join('') + '</ul>' : emptyBox('support', t('adm.sup.nochannels'), t('adm.sup.nochannels.d'))) + '</div>') +
      card(esc(t('adm.sup.safety.t')), '<div class="card-b"><p>' + esc(t('adm.sup.safety.d')) + '</p></div>') + '</div>' +
      detail + card(esc(t(isAdm ? 'adm.sup.all' : 'adm.sup.mine')) + ' <span class="pill plain num">' + mine.length + '</span>', mine.length ? table([t('misc.ref'), t('adm.sup.subject'), t('adm.sup.category')].concat(isAdm ? [t('adm.person')] : []).concat([t('f.status'), t('adm.when')]), rows) : emptyBox('support', t('adm.sup.none'), t('adm.sup.none.d')));
  }

  // =====================================================================================================
  // EVENTS
  // =====================================================================================================
  function capture(form) {
    var f = F(), fd_ = new FormData(form), v = {};
    Array.from(fd_.keys()).forEach(function (k) { v[k] = String(fd_.get(k) || '').trim(); });
    f.values = Object.assign({}, f.values, v); return f.values;
  }
  function errText(code) { var k = 'err.' + code, v = U().t(k); return v === k ? t('err.generic', { code: code }) : v; }
  function onAct(act, el) {
    var v = el.getAttribute('data-v'), a = A_();
    switch (act) {
      case 'adm-sel': a.sel = a.sel === v ? null : v; U().render(); if (a.sel) { var d = document.getElementById('adm-detail'); if (d) { d.scrollIntoView({ block: 'nearest' }); var hh = d.querySelector('h2'); if (hh) hh.focus(); } } return true;
      case 'adm-role': a.role = a.role === v ? null : v; U().render(); return true;
      case 'adm-more': a.alimit += 40; U().render(); return true;
      case 'adm-users-org': a.uorg = v; a.uq = ''; a.urole = ''; a.ustatus = ''; U().go('users'); return true;
      case 'adm-audit-csv': exportAuditCsv(); return true;
      case 'sup-open': a.tk = a.tk === v ? null : v; U().render(); var tkEl = document.getElementById('adm-ticket'); if (a.tk && tkEl) { tkEl.scrollIntoView({ block: 'nearest' }); var th = tkEl.querySelector('h2'); if (th) th.focus(); } return true;
      case 'sup-status': { var sp = v.split('|'); var rs = API().dispatch('support.setStatus', me().id, { id: sp[0], status: sp[1] }); U().toast(rs.ok ? t('adm.done.supstatus') : errText(rs.code)); U().render(); return true; }
      case 'adm-activate': { var r = API().dispatch('admin.user.setStatus', me().id, { id: v, status: 'active' }); if (r.ok) U().toast(t('adm.done.activate')); else U().toast(t('err.' + r.code) === 'err.' + r.code ? t('err.generic', { code: r.code }) : t('err.' + r.code)); U().render(); return true; }
    }
    return false;
  }
  function onChange(el) {
    if (el.hasAttribute('data-f6live') && el.form && /^adm-/.test(el.form.getAttribute('data-f6form') || '')) {
      var f = F(); capture(el.form);
      if (el.name === 'orgId') { f.values.role = ''; f.values.projectId = ''; } if (el.name === 'role' && /^adm-invite/.test(el.form.getAttribute('data-f6form'))) f.values.projectId = ''; if (el.name === 'action') f.values.userId = '';
      U().render(); var again = document.getElementById(el.id); if (again) again.focus(); return true;
    }
    return false;
  }
  function onInput(el) {
    var a = A_(), key = el.id === 'adm-q' ? 'uq' : el.id === 'adm-aq' ? 'aq' : null;
    if (!key) return false; a[key] = el.value; var c = el.selectionStart; U().render(); var n = document.getElementById(el.id); if (n) { n.focus(); try { n.setSelectionRange(c, c); } catch (e) {} } return true;
  }
  function onSubmit(form) {
    var key = form.getAttribute('data-f6form') || ''; if (!/^(adm-|sup-)/.test(key)) return false;
    var f = F(); if (f.key !== key) { openForm(key); f = F(); }
    var v = capture(form); f.errors = {}; f.serverError = null; f.detail = null;
    var kind = key.split('.')[0], id = key.split('.').slice(1).join('.');
    if (kind === 'adm-invite') {
      need(v.name && v.name.length >= 2, 'name', 'adm.err.name'); need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || ''), 'email', 'adm.err.email'); need(v.orgId, 'orgId', 'wiz.err.choose'); need(v.role, 'role', 'wiz.err.choose');
      var def = A().ROLES[v.role]; if (def && def.scopeLevel !== 'global') need(v.projectId, 'projectId', 'wiz.err.choose');
      if (invalid()) return true;
      run('admin.user.invite', { name: v.name, email: v.email, orgId: v.orgId, role: v.role, projectId: v.projectId }, t('adm.done.invite'), function (r) { A_().sel = r.id; U().render(); }); return true;
    }
    if (kind === 'adm-susp') {
      need(String(v.reason || '').length >= 5, 'reason', 'rd.err.reason'); if (invalid()) return true;
      run('admin.user.setStatus', { id: id, status: 'suspended', reason: v.reason }, t('adm.done.suspend')); return true;
    }
    if (kind === 'adm-rev') {
      need(String(v.reason || '').length >= 5, 'reason', 'rd.err.reason'); if (invalid()) return true;
      run('admin.authority.revoke', { id: id, reason: v.reason }, t('adm.done.revoke')); return true;
    }
    if (kind === 'adm-role') {
      need(v.role, 'role', 'wiz.err.choose'); var rd = A().ROLES[v.role]; if (rd && rd.scopeLevel !== 'global') need(v.projectId, 'projectId', 'wiz.err.choose'); need(String(v.reason || '').length >= 5, 'reason', 'rd.err.reason'); if (invalid()) return true;
      run('admin.user.setRole', { id: id, role: v.role, projectId: v.projectId, reason: v.reason }, t('adm.done.role'), function (r) { U().toast(r.inert && r.inert.length ? t('adm.done.role.inert', { n: r.inert.length }) : t('adm.done.role')); U().render(); }); return true;
    }
    if (kind === 'adm-orgnew') { need(String(v.name || '').length >= 2, 'name', 'adm.err.orgname'); if (invalid()) return true; run('admin.org.create', { name: v.name, nameAr: v.nameAr }, t('adm.done.org')); return true; }
    if (kind === 'adm-orgedit') { need(String(v.name || '').length >= 2, 'name', 'adm.err.orgname'); if (invalid()) return true; run('admin.org.update', { id: id, name: v.name, nameAr: v.nameAr }, t('adm.done.orgedit')); return true; }
    if (kind === 'adm-grant') {
      need(v.action, 'action', 'wiz.err.choose'); need(v.userId, 'userId', 'wiz.err.choose'); need(v.projectId, 'projectId', 'wiz.err.choose'); need(v.validTo, 'validTo', 'adm.err.validTo'); need(v.nominatedBy, 'nominatedBy', 'wiz.err.choose'); if (invalid()) return true;
      run('admin.authority.grant', { action: v.action, userId: v.userId, projectId: v.projectId, validFrom: v.validFrom, validTo: v.validTo, nominatedBy: v.nominatedBy }, t('adm.done.grant')); return true;
    }
    if (kind === 'sup-reply') { need(String(v.message || '').length >= 2, 'message', 'adm.err.reply'); if (invalid()) return true; run('support.reply', { id: id, message: v.message }, t('adm.done.reply'), function () { U().render(); }); return true; }
    if (kind === 'sup-new') {
      need(v.category, 'category', 'wiz.err.choose'); need(String(v.subject || '').length >= 3, 'subject', 'adm.err.subject'); need(String(v.message || '').length >= 10, 'message', 'adm.err.message'); if (invalid()) return true;
      run('support.request', { category: v.category, subject: v.subject, message: v.message }, t('adm.done.support')); return true;
    }
    return false;
  }

  P.extend({
    modules: { users: usersPage, orgs: orgsPage, roles: rolesPage, audit: auditPage, settings: settingsPage, support: supportPage },
    onAct: onAct, onChange: onChange, onInput: onInput, onSubmit: onSubmit
  });
})();
