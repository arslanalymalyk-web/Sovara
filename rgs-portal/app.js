/* RGS Client Portal — Stage 1 interface. Plain JS, no build step. */
(function () {
  'use strict';
  var A = window.RGSAccess, I = window.RGSi18n, CFG = window.RGS_CONFIG || { dataSource: 'fixtures' };
  // Fixtures load only when configured; otherwise no records are shown (the server API is not built yet).
  var FIXTURE = CFG.dataSource === 'fixtures' && !!window.RGSFixtures;
  var D = FIXTURE ? window.RGSFixtures : { now: new Date().toISOString(), orgs: [], users: [], personas: [], projects: [], packages: [], areas: [], assignments: [], authorities: [] };
  var ST = window.RGSStore.create(D, A, CFG);
  // Stage 3 command layer. Records it changes are kept in this browser only (see api.js header).
  var PKEY = 'rgs.records.v3';
  var API = window.RGSApi.createApi(D, A, ST, { persist: function (data) { try { localStorage.setItem(PKEY, JSON.stringify({ label: D.label, data: data })); } catch (e) {} } });
  (function loadPersisted() {
    if (!FIXTURE) return;
    try {
      var snap = JSON.parse(localStorage.getItem(PKEY) || 'null');
      if (!snap || snap.label !== D.label) return; // stale or foreign snapshot: start from fixtures
      API.MUTABLE.forEach(function (k) { if (snap.data && snap.data[k]) D[k] = snap.data[k]; });
      ST.reindex();
    } catch (e) {}
  })();
  var root = document.getElementById('root');

  // ---------------------------------------------------------------- state
  function load(k, d) { try { var v = localStorage.getItem('rgs.' + k); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { if (v == null) localStorage.removeItem('rgs.' + k); else localStorage.setItem('rgs.' + k, v); } catch (e) {} }
  var S = {
    lang: load('lang', 'en'), theme: load('theme', 'system'), userId: load('user', null),
    route: 'home', project: 'all', navOpen: false, menuOpen: false, loading: false,
    login: { email: '', password: '', errors: {}, busy: false, note: '' },
    tester: { user: 'u-qa', action: 'inspection.signoff', record: 'pkg:wp1', ai: false },
    grant: { user: 'u-qa', action: 'inspection.signoff', project: 'p1', nominatedBy: 'u-om', validTo: '2027-06-30' }
  };
  if (S.userId && !byId(D.users, S.userId)) S.userId = null;

  // ---------------------------------------------------------------- helpers
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function t(k) { var d = I.T[S.lang] || I.T.en; return d[k] != null ? d[k] : (I.T.en[k] != null ? I.T.en[k] : k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(obj, f) { return S.lang === 'ar' && obj[f + 'Ar'] ? obj[f + 'Ar'] : obj[f]; }
  function user() { return byId(D.users, S.userId); }
  function org(u) { return byId(D.orgs, u.orgId); }
  function isCustomer(u) { return org(u).kind === 'customer'; }
  function initials(n) { return n.split(/\s+/).filter(Boolean).map(function (p) { return p.replace(/^Al-/, '')[0]; }).slice(0, 2).join('').toUpperCase(); }
  // One formatter per locale: building it per call cost ~40x more and runs for every date on every screen.
  var DATE_FMT = {};
  function fmtDate(s) { try { var k = S.lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB'; return (DATE_FMT[k] = DATE_FMT[k] || new Intl.DateTimeFormat(k, { day: 'numeric', month: 'short', year: 'numeric' })).format(new Date(s)); } catch (e) { return s; } }
  function toast(msg) { var el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 3600); }

  var ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    projects: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
    services: '<path d="M4 20V4M20 20V4M4 8h16M4 14h16M10 4v16"/>',
    sitemap: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    requests: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
    instructions: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    approvals: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', send: '<path d="M3 11l18-8-8 18-2-8z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', folder: '<path d="M3 6h6l2 2h10v11H3z"/>', upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    documents: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    inspections: '<path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8.5 14l2.5 2.5 4.5-5"/>',
    corrective: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    hse: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 9v6M9 12h6"/>',
    commitments: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15l2 2 4-4"/>',
    handover: '<path d="M3 12h4l3-3 4 1 3 3h4"/><path d="M7 12l4 4 3-1 3 2"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    knowledge: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
    ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    support: '<path d="M4 13a8 8 0 0116 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>',
    orgs: '<path d="M4 21V5l8-2v18M12 8h8v13"/><path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/>',
    roles: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0110-5.5"/><path d="M17 13l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
    audit: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1.3z"/>',
    ds: '<circle cx="8" cy="8" r="4"/><rect x="13" y="4" width="7" height="7" rx="1"/><path d="M4 20l4-6 4 6zM13 14h7v6h-7z"/>',
    model: '<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="10" width="7" height="5" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v8M10 18.5h4V15M10 5.5h7.5V10"/>',
    matrix: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    tester: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3"/><path d="M7 15h10"/>',
    arch: '<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v6M17.5 9v6"/>',
    states: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 14h4M7 17h7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
    bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    building: '<path d="M4 21V3h10v18M14 9h6v12M7 7h4M7 11h4M7 15h4M17 13h1M17 17h1M2 21h20"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    lockx: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4M10 14l4 4M14 14l-4 4"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
    cloudx: '<path d="M7 18a4 4 0 01-.5-8A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/><path d="M10 12l4 4M14 12l-4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
  };
  function ic(n, cls) { return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || '') + '</svg>'; }

  // ---------------------------------------------------------------- modules
  var TECH = Object.keys(A.ACTIONS).filter(function (k) { return A.ACTIONS[k].kind === 'technical'; });
  // id, group, requires(any), stage, reference screens
  var MODULES = [
    { id: 'home', icon: 'home', group: 'workspace', requires: [], stage: 1, refs: [] },
    { id: 'projects', icon: 'projects', group: 'delivery', requires: ['project.view'], stage: 2, refs: ['03', '04'] },
    { id: 'actions', icon: 'approvals', group: 'customer', requires: ['project.view'], stage: 2, refs: ['14', '20'], customerOnly: true },
    { id: 'activity', icon: 'reports', group: 'delivery', requires: ['project.view'], stage: 2, refs: ['20'] },
    { id: 'services', icon: 'services', group: 'delivery', requires: ['package.view'], stage: 3, refs: ['05', '06', '07', '08', '09'] },
    { id: 'sitemap', icon: 'sitemap', group: 'delivery', requires: ['package.view'], stage: 3, refs: ['10'] },
    { id: 'progress', icon: 'reports', group: 'delivery', requires: ['package.view'], stage: 6, refs: ['04', '20'] },
    { id: 'dailyupdates', icon: 'camera', group: 'delivery', requires: ['progress.report', 'progress.review', 'progress.publish'], stage: 6, refs: ['33'], staffOnly: true },
    { id: 'commitments', icon: 'commitments', group: 'delivery', requires: ['commitment.view'], stage: 6, refs: ['20'] },
    { id: 'dependencies', icon: 'link', group: 'delivery', requires: ['dependency.view'], stage: 6, refs: ['20'], staffOnly: true },
    { id: 'handover', icon: 'handover', group: 'delivery', requires: ['handover.view'], stage: 6, refs: ['21'] },
    { id: 'oversight', icon: 'projects', group: 'workspace', requires: ['oversight.view'], stage: 6, refs: ['30', '31'], staffOnly: true },
    { id: 'requests', icon: 'requests', group: 'customer', requires: ['request.view'], stage: 3, refs: ['11', '12'] },
    { id: 'triage', icon: 'inspections', group: 'customer', requires: ['request.triage'], stage: 3, refs: ['11'], staffOnly: true },
    { id: 'instructions', icon: 'instructions', group: 'customer', requires: ['instruction.view'], stage: 3, refs: ['13'] },
    { id: 'approvals', icon: 'approvals', group: 'customer', requires: TECH.concat(['request.verify', 'instruction.review']), stage: 3, refs: ['14'], staffLabel: 'nav.signoffs' },
    { id: 'notifications', icon: 'bell', group: 'support', requires: [], stage: 3, refs: [], hidden: true },
    { id: 'documents', icon: 'documents', group: 'documents', requires: ['document.view'], stage: 4, refs: ['15', '16'] },
    { id: 'evidence', icon: 'camera', group: 'documents', requires: ['package.view'], stage: 4, refs: ['06', '10'] },
    { id: 'docreview', icon: 'inspections', group: 'documents', requires: ['document.review'], stage: 4, refs: ['16'], staffOnly: true },
    { id: 'doccontrol', icon: 'approvals', group: 'documents', requires: ['document.control'], stage: 4, refs: ['37'], staffOnly: true },
    { id: 'docchecks', icon: 'ai', group: 'documents', requires: ['document.control', 'ai.document_check'], stage: 4, refs: ['27'], staffOnly: true },
    { id: 'inspections', icon: 'inspections', group: 'quality', requires: ['inspection.view'], stage: 5, refs: ['17', '18'] },
    { id: 'findings', icon: 'flag', group: 'quality', requires: ['corrective.view'], stage: 5, refs: ['19'] },
    { id: 'corrective', icon: 'corrective', group: 'quality', requires: ['corrective.view'], stage: 5, refs: ['19'] },
    { id: 'qaqc', icon: 'check', group: 'quality', requires: ['inspection.schedule', 'inspection.signoff', 'corrective.close'], stage: 5, refs: ['35'], staffOnly: true },
    { id: 'checklists', icon: 'reports', group: 'quality', requires: ['template.manage', 'inspection.view.internal'], stage: 5, refs: ['18'], staffOnly: true },
    { id: 'hse', icon: 'hse', group: 'quality', requires: ['hse.view'], stage: 5, refs: ['36'] },
    { id: 'reports', icon: 'reports', group: 'insight', requires: ['report.view'], stage: 6, refs: ['22'] },
    { id: 'ai', icon: 'ai', group: 'insight', requires: ['ai.view'], stage: 7, refs: ['25', '26', '27', '28', '29'] },
    { id: 'knowledge', icon: 'knowledge', group: 'insight', requires: ['project.view'], stage: 6, refs: ['23', '24'] },
    { id: 'users', icon: 'users', group: 'admin', requires: ['admin.users'], stage: 3, refs: ['38'] },
    { id: 'orgs', icon: 'orgs', group: 'admin', requires: ['admin.users'], stage: 3, refs: ['38'] },
    { id: 'roles', icon: 'roles', group: 'admin', requires: ['admin.roles'], stage: 3, refs: ['39'] },
    { id: 'audit', icon: 'audit', group: 'admin', requires: ['admin.audit.view'], stage: 3, refs: ['40'] },
    { id: 'settings', icon: 'settings', group: 'admin', requires: ['admin.settings'], stage: 6, refs: ['38'] },
    { id: 'support', icon: 'support', group: 'support', requires: ['support.use'], stage: 6, refs: ['41'] },
    { id: 'ds', icon: 'ds', group: 'review', requires: [], stage: 1, refs: [], review: true },
    { id: 'model', icon: 'model', group: 'review', requires: [], stage: 1, refs: [], review: true },
    { id: 'matrix', icon: 'matrix', group: 'review', requires: [], stage: 1, refs: ['39'], review: true },
    { id: 'tester', icon: 'tester', group: 'review', requires: [], stage: 1, refs: [], review: true },
    { id: 'states', icon: 'states', group: 'review', requires: [], stage: 1, refs: [], review: true },
    { id: 'arch', icon: 'arch', group: 'review', requires: [], stage: 1, refs: ['40'], review: true }
  ];
  var MODULE_BY = {}; MODULES.forEach(function (m) { MODULE_BY[m.id] = m; });
  // Role focus: modules pulled into the Workspace group for that role.
  var FOCUS = {
    general_manager: ['oversight', 'projects', 'reports'], operations_manager: ['oversight', 'triage', 'approvals'],
    project_manager: ['triage', 'progress', 'commitments'], site_officer: ['dailyupdates', 'inspections', 'requests'],
    service_supervisor: ['dailyupdates', 'requests', 'services'], qa_qc_inspector: ['qaqc', 'inspections', 'corrective'],
    hse_officer: ['hse', 'findings', 'corrective'], document_controller: ['doccontrol', 'documents', 'docchecks'], portal_admin: ['users', 'roles', 'audit'],
    customer_approver: ['approvals', 'requests'], customer_requester: ['requests'], customer_viewer: ['projects']
  };
  var GROUPS_STAFF = ['workspace', 'delivery', 'customer', 'quality', 'documents', 'insight', 'admin', 'support', 'review'];
  var CUSTOMER_ORDER = ['home', 'projects', 'progress', 'requests', 'approvals', 'instructions', 'actions', 'commitments', 'activity', 'documents', 'evidence', 'inspections', 'findings', 'reports', 'handover', 'ai', 'support'];

  var accessCache = {};
  function canAny(uid, action) { var k = uid + '|' + action; if (!(k in accessCache)) accessCache[k] = A.canAnywhere(D, uid, action); return accessCache[k]; }
  function moduleAllowed(uid, m) { if (m.customerOnly && !ST.isCustomer(uid)) return false; if (m.staffOnly && ST.isCustomer(uid)) return false; return !m.requires.length || m.requires.some(function (a) { return canAny(uid, a); }); }
  function navLabel(m, u) { return t(m.staffLabel && u && !isCustomer(u) ? m.staffLabel : 'nav.' + m.id); }

  function navFor(u) {
    var visible = MODULES.filter(function (m) { return !m.hidden && moduleAllowed(u.id, m); });
    var focus = (FOCUS[u.role] || []).filter(function (id) { return visible.some(function (m) { return m.id === id; }); });
    var out = [];
    if (isCustomer(u)) {
      out.push({ items: CUSTOMER_ORDER.map(function (id) { return MODULE_BY[id]; }).filter(function (m) { return visible.indexOf(m) >= 0; }) });
    } else {
      GROUPS_STAFF.filter(function (g) { return g !== 'review'; }).forEach(function (g) {
        var items;
        if (g === 'workspace') items = [MODULE_BY.home].concat(focus.map(function (id) { return MODULE_BY[id]; }));
        else items = visible.filter(function (m) { return m.group === g && focus.indexOf(m.id) < 0; });
        if (items.length) out.push({ group: g, items: items });
      });
    }
    out.push({ group: 'review', items: visible.filter(function (m) { return m.review; }) });
    return out;
  }

  // Most informative denial for a module the user cannot open.
  function denialFor(u, m) {
    var rank = { authority_expired: 6, authority: 5, scope: 4, org_boundary: 3, role: 2, no_role: 1 };
    var best = null;
    m.requires.forEach(function (a) {
      // only the user's own projects: another organisation's project would always report a boundary, hiding the real reason
      var own = ST.visibleProjects(u.id), pool = own.length ? own : D.projects;
      var targets = A.ACTIONS[a].kind === 'admin' ? [null] : pool.map(function (p) { return { projectId: p.id }; });
      targets.forEach(function (r) {
        var res = A.can(D, u.id, a, r);
        if (!res.allowed && (!best || (rank[res.code] || 0) > (rank[best.code] || 0))) best = res;
      });
    });
    return best || { code: 'role', trace: [] };
  }

  // ---------------------------------------------------------------- action labels
  var ACT = {
    'portfolio.view': ['See project portfolio', 'عرض محفظة المشاريع'], 'project.view': ['View project workspace', 'عرض مساحة المشروع'],
    'project.meta.view': ['See project names for membership', 'عرض أسماء المشاريع لإدارة العضوية'],
    'package.view': ['View service work packages', 'عرض حزم أعمال الخدمات'], 'package.update': ['Update package progress', 'تحديث تقدم الحزمة'],
    'photo.upload': ['Upload progress photos', 'رفع صور التقدم'], 'request.view': ['View requests', 'عرض الطلبات'],
    'request.create': ['Raise a request', 'رفع طلب'], 'request.respond': ['Respond to requests', 'الرد على الطلبات'],
    'instruction.view': ['View instructions', 'عرض التعليمات'], 'instruction.issue': ['Issue a customer instruction', 'إصدار تعليمة من العميل'],
    'instruction.acknowledge': ['Acknowledge instructions', 'الإقرار باستلام التعليمات'], 'customer.approve': ['Approve submissions for the customer', 'اعتماد التقديمات نيابة عن العميل'],
    'document.view': ['View issued documents', 'عرض الوثائق الصادرة'], 'document.view.draft': ['View drafts and superseded revisions', 'عرض المسودات والمراجعات الملغاة'],
    'document.acknowledge': ['Acknowledge receipt of documents', 'الإقرار باستلام الوثائق'], 'evidence.upload': ['Upload site evidence', 'رفع أدلة الموقع'],
    'inspection.customer_signoff': ['Sign off inspections for the customer', 'اعتماد التفتيش عن العميل'], 'activity.internal.view': ['See internal activity', 'رؤية النشاط الداخلي'],
    'request.triage': ['Triage requests', 'فرز الطلبات'], 'request.note.view': ['Read internal request notes', 'قراءة ملاحظات الطلبات الداخلية'], 'request.note.write': ['Write internal request notes', 'كتابة ملاحظات الطلبات الداخلية'],
    'request.verify': ['Verify request completion', 'التحقق من إنجاز الطلبات'], 'request.acknowledge': ['Confirm request outcomes', 'تأكيد نتائج الطلبات'], 'request.cancel': ['Cancel requests', 'إلغاء الطلبات'], 'request.edit': ['Edit submitted requests', 'تعديل الطلبات المرسلة'],
    'instruction.create': ['Draft instructions', 'صياغة التعليمات'], 'instruction.revise': ['Revise instructions', 'مراجعة التعليمات'], 'instruction.cancel': ['Cancel instructions', 'إلغاء التعليمات'],
    'instruction.review': ['Review instructions for RGS', 'مراجعة التعليمات عن RGS'], 'instruction.authorise': ['Authorise execution of instructions', 'التصريح بتنفيذ التعليمات'], 'instruction.execute': ['Carry out authorised instructions', 'تنفيذ التعليمات المصرّح بها'],
    'instruction.view.internal': ['See internal instructions', 'رؤية التعليمات الداخلية'], 'document.review': ['Review assigned document revisions', 'مراجعة مراجعات الوثائق المسندة'],
    'document.publish': ['Publish documents to customers', 'نشر الوثائق للعملاء'], 'document.comment.internal': ['Read and write internal document comments', 'قراءة الملاحظات الداخلية على الوثائق وكتابتها'],
    'evidence.view.internal': ['See internal site evidence', 'رؤية أدلة الموقع الداخلية'],
    'document.upload': ['Upload documents', 'رفع الوثائق'], 'document.control': ['Control revisions and transmittals', 'ضبط المراجعات والإرساليات'],
    'document.approve': ['Technically approve documents', 'الاعتماد الفني للوثائق'], 'inspection.view': ['View inspections', 'عرض التفتيش'],
    'inspection.record': ['Record inspection results', 'تسجيل نتائج التفتيش'], 'inspection.signoff': ['Sign off inspections', 'اعتماد التفتيش'],
    'corrective.view': ['View corrective actions', 'عرض الإجراءات التصحيحية'], 'corrective.raise': ['Raise corrective actions', 'رفع إجراء تصحيحي'],
    'corrective.respond': ['Respond with closure evidence', 'الرد بأدلة الإغلاق'], 'corrective.close': ['Verify and close corrective actions', 'التحقق من الإجراءات التصحيحية وإغلاقها'],
    'hse.view': ['View HSE records', 'عرض سجلات السلامة'], 'hse.record': ['Record HSE observations', 'تسجيل ملاحظات السلامة'],
    'hse.permit.approve': ['Approve permits to work', 'اعتماد تصاريح العمل'], 'commitment.view': ['View commitments', 'عرض الالتزامات'],
    'commitment.manage': ['Manage commitments and milestones', 'إدارة الالتزامات والمعالم'], 'handover.view': ['View handover status', 'عرض حالة التسليم'],
    'handover.prepare': ['Prepare handover packages', 'إعداد حزم التسليم'], 'handover.signoff': ['Sign off handover for RGS', 'اعتماد التسليم عن RGS'],
    'handover.accept': ['Accept handover for the customer', 'قبول التسليم عن العميل'], 'report.view': ['View reports', 'عرض التقارير'],
    'report.export': ['Export reports', 'تصدير التقارير'], 'ai.view': ['Read AI briefings', 'قراءة ملخصات الذكاء الاصطناعي'],
    'ai.ask': ['Ask the project assistant', 'سؤال مساعد المشروع'], 'ai.document_check': ['Run AI document checks', 'تشغيل الفحص الآلي للوثائق'],
    'support.use': ['Contact support', 'التواصل مع الدعم'], 'admin.users': ['Manage users and organisations', 'إدارة المستخدمين والمنظمات'],
    'admin.roles': ['Assign roles and project membership', 'إسناد الأدوار وعضوية المشاريع'], 'admin.authority.grant': ['Record delegated authority on nomination', 'تسجيل الصلاحيات المفوضة بناءً على ترشيح'],
    'admin.audit.view': ['Review audit history', 'مراجعة سجل التدقيق'], 'admin.settings': ['Change system settings', 'تغيير إعدادات النظام'],
    // Stage 5
    'inspection.schedule': ['Schedule inspections', 'جدولة الفحوصات'], 'inspection.amend': ['Amend verified inspections', 'تعديل الفحوصات المُتحقق منها'],
    'inspection.publish': ['Publish inspections to the customer', 'نشر الفحوصات للعميل'], 'inspection.witness': ['Witness inspections when invited', 'شهود الفحوصات عند الدعوة'],
    'inspection.view.internal': ['See internal inspections', 'رؤية الفحوصات الداخلية'], 'template.manage': ['Manage checklist templates', 'إدارة قوالب قوائم الفحص'],
    'finding.raise': ['Raise findings', 'رفع الملاحظات'], 'finding.manage': ['Manage findings', 'إدارة الملاحظات'], 'finding.view.internal': ['See internal findings', 'رؤية الملاحظات الداخلية'],
    'corrective.manage': ['Manage corrective actions', 'إدارة الإجراءات التصحيحية'], 'hse.stopwork': ['Stop work (by assigned authority)', 'إيقاف العمل (بصلاحية مسندة)'], 'hse.release': ['Release work after HSE stop (by assigned authority)', 'استئناف العمل بعد إيقاف السلامة (بصلاحية مسندة)'],
    // Stage 6
    'progress.report': ['Submit daily updates', 'إرسال التحديثات اليومية'], 'progress.review': ['Review daily updates', 'مراجعة التحديثات اليومية'],
    'progress.publish': ['Publish progress to the customer', 'نشر التقدم للعميل'], 'progress.verify': ['Verify milestone completion', 'التحقق من إنجاز المعالم'],
    'progress.baseline': ['Change baselines, weights and planned quantities', 'تغيير خطوط الأساس والأوزان والكميات المخططة'], 'dependency.view': ['View dependencies', 'عرض الاعتماديات'],
    'dependency.manage': ['Manage dependencies and blockers', 'إدارة الاعتماديات والعوائق'], 'report.prepare': ['Prepare customer reports', 'إعداد تقارير العملاء'],
    'report.review': ['Review customer reports', 'مراجعة تقارير العملاء'], 'report.issue': ['Issue customer reports', 'إصدار تقارير العملاء'],
    'handover.review': ['Review handover readiness (internal)', 'مراجعة جاهزية التسليم (داخلية)'], 'handover.acknowledge': ['Acknowledge receipt of handover packages', 'الإقرار باستلام حزم التسليم'],
    'asset.release': ['Authorise technical release for use (by assigned authority)', 'التصريح الفني بالإفراج للاستخدام (بصلاحية مسندة)'], 'oversight.view': ['See management oversight', 'عرض الإشراف الإداري']
  };
  function actLabel(a) { var x = ACT[a]; return x ? (S.lang === 'ar' ? x[1] : x[0]) : a; }
  var MODULE_OF_ACTION = { projects: 'projects', packages: 'services', requests: 'requests', instructions: 'instructions', approvals: 'approvals', documents: 'documents', inspections: 'inspections', corrective: 'corrective', hse: 'hse', commitments: 'commitments', handover: 'handover', reports: 'reports', ai: 'ai', support: 'support', admin: 'admin' };

  // ---------------------------------------------------------------- theme / lang
  function applyEnv() {
    var h = document.documentElement;
    h.lang = S.lang; h.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    if (S.theme === 'system') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', S.theme);
    document.title = t('app.name');
  }

  // ---------------------------------------------------------------- shared bits
  function langSwitch() {
    return '<div class="langswitch" role="group" aria-label="' + esc(t('top.lang')) + '">' +
      '<button type="button" data-act="lang" data-v="en" aria-pressed="' + (S.lang === 'en') + '" lang="en">EN</button>' +
      '<button type="button" data-act="lang" data-v="ar" aria-pressed="' + (S.lang === 'ar') + '" lang="ar">العربية</button></div>';
  }
  var badgeModule;
  function mountBadge3D() {
    var host = document.querySelector('[data-badge3d]');
    if (!host || !window.WebGLRenderingContext) return;
    badgeModule = badgeModule || import('./3d/dist/badge-embed.js').catch(function () { return null; });
    badgeModule.then(function (m) { var h = document.querySelector('[data-badge3d]'); if (m && h) { try { m.mountRGSBadge(h); } catch (e) { /* keep the PNG */ } } });
  }
  function logos(cls) {
    // The flat PNG stays as the fallback; mountBadge3D() swaps in the 3D badge when WebGL and the module are available.
    return '<span class="badge3d" data-badge3d role="img" aria-label="RGS"><img class="logo-rgs" src="assets/rgs-logo.png" alt="" width="134" height="134"></span>' +
      '<span class="divider" aria-hidden="true"></span>' +
      '<img class="logo-gc" src="assets/global-construction-logo.png" alt="Global Construction" width="246" height="114">';
  }

  // ---------------------------------------------------------------- login
  function renderLogin() {
    var L0 = S.login, e = L0.errors;
    var personas = (D.personas || []).map(function (id) { return byId(D.users, id); }).filter(Boolean);
    var cust = personas.filter(function (u) { return org(u).kind === 'customer'; });
    var staff = personas.filter(function (u) { return org(u).kind === 'rgs'; });
    function opts(list) { return list.map(function (u) { return '<option value="' + u.id + '"' + (byId(D.users, u.id).email === L0.email ? ' selected' : '') + '>' + esc(t('role.' + u.role)) + ' — ' + esc(u.name) + '</option>'; }).join(''); }
    return '<main class="login">' +
      '<section class="login-hero" aria-label="RGS">' +
        '<img class="bg" src="assets/login-hero.jpg" alt="" aria-hidden="true">' +
        '<div><div class="welcome">' + esc(t('login.welcome')) + '</div>' +
        '<h1>' + (S.lang === 'ar' ? 'بوابة عملاء <b>RGS</b>' : '<b>RGS</b> Client Portal') + '</h1>' +
        '<div class="svc-line">' + A.SERVICES.map(function (s) { return '<span>' + esc(t('svc.' + s)) + '</span>'; }).join('') + '</div></div>' +
        '<p class="foot">' + esc(t('app.tagline')) + '</p>' +
      '</section>' +
      '<section class="login-panel"><div class="login-card">' +
        '<div class="row-between"><span></span>' + langSwitch() + '</div>' +
        '<div class="logo-row">' + logos() + '</div>' +
        '<div class="stack"><h2 id="login-title">' + esc(t('login.title')) + '</h2><p style="color:var(--muted)">' + esc(t('login.sub')) + '</p></div>' +
        (FIXTURE ? '' : '<div class="notice warn" role="alert">' + ic('alert') + '<span>' + esc(t('data.offline')) + '</span></div>') +
        '<form id="login-form" class="stack" novalidate aria-labelledby="login-title">' +
          '<div class="demo-box"><div class="row-between"><b style="font-size:var(--fs-sm)">' + esc(t('login.demo')) + '</b></div>' +
            '<p class="field-hint">' + esc(t('login.demo.note')) + '</p>' +
            '<div class="field"><label for="persona">' + esc(t('login.persona')) + '</label>' +
            '<select id="persona" class="select"><option value="">' + esc(t('login.persona.pick')) + '</option>' +
            '<optgroup label="' + esc(t('login.grp.customer')) + '">' + opts(cust) + '</optgroup>' +
            '<optgroup label="' + esc(t('login.grp.staff')) + '">' + opts(staff) + '</optgroup></select></div></div>' +
          '<div class="field"><label for="email">' + esc(t('login.email')) + '</label><div class="control">' + ic('mail') +
            '<input id="email" class="input" type="email" autocomplete="username" inputmode="email" dir="ltr" value="' + esc(L0.email) + '"' + (e.email ? ' aria-invalid="true" aria-describedby="email-err"' : '') + '></div>' +
            (e.email ? '<div id="email-err" class="field-error">' + ic('alert') + esc(t(e.email)) + '</div>' : '') + '</div>' +
          '<div class="field"><label for="password">' + esc(t('login.password')) + '</label><div class="control">' + ic('lock') +
            '<input id="password" class="input" type="password" autocomplete="current-password" dir="ltr" value="' + esc(L0.password) + '" style="padding-inline-end:48px"' + (e.password ? ' aria-invalid="true" aria-describedby="pw-err"' : '') + '>' +
            '<button type="button" class="iconbtn" data-act="togglepw" aria-label="' + esc(t('login.show')) + '" style="position:absolute;inset-inline-end:4px">' + ic('eye') + '</button></div>' +
            (e.password ? '<div id="pw-err" class="field-error">' + ic('alert') + esc(t(e.password)) + '</div>' : '') + '</div>' +
          '<div class="row-between"><label class="check"><input id="remember" type="checkbox"> ' + esc(t('login.remember')) + '</label>' +
            '<button type="button" class="linkbtn" data-act="forgot">' + esc(t('login.forgot')) + '</button></div>' +
          (L0.note ? '<div class="notice" role="status">' + ic('info') + '<span>' + esc(L0.note) + '</span></div>' : '') +
          '<button class="btn btn-primary btn-block" type="submit"' + (L0.busy ? ' aria-disabled="true"' : '') + '>' +
            (L0.busy ? '<span class="spin" aria-hidden="true"></span>' + esc(t('login.signing')) : esc(t('login.submit')) + ic('arrow', 'flip')) + '</button>' +
          '<div class="or">' + esc(t('login.or')) + '</div>' +
          '<button type="button" class="btn btn-secondary btn-block" data-act="sso">' + ic('building') + esc(t('login.sso')) + '</button>' +
        '</form>' +
        '<p style="text-align:center;font-size:var(--fs-sm);color:var(--muted);border-top:1px solid var(--line);padding-top:var(--s4)">' + esc(t('login.help')) + ' <button type="button" class="linkbtn" data-act="support">' + esc(t('login.support')) + '</button></p>' +
      '</div></section></main>';
  }

  function submitLogin() {
    var L0 = S.login; L0.errors = {}; L0.note = '';
    var email = (document.getElementById('email').value || '').trim(); var pw = document.getElementById('password').value || '';
    L0.email = email; L0.password = pw;
    if (!email) L0.errors.email = 'login.err.email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) L0.errors.email = 'login.err.emailfmt';
    if (!pw) L0.errors.password = 'login.err.password';
    var u = D.users.filter(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })[0];
    if (!L0.errors.email && !u) L0.errors.email = 'login.err.unknown';
    if (Object.keys(L0.errors).length) { render(); var f = document.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
    L0.busy = true; render();
    setTimeout(function () {
      L0.busy = false; L0.password = ''; S.userId = u.id; save('user', u.id); S.project = 'all';
      accessCache = {}; go('home');
    }, 650);
  }

  // ---------------------------------------------------------------- app shell
  var BUILT = ['home', 'projects', 'actions', 'activity', 'requests', 'triage', 'instructions', 'approvals', 'notifications', 'ds', 'model', 'matrix', 'tester', 'states', 'arch'];
  function isBuilt(m) { return BUILT.indexOf(m.id) >= 0 || !!(window.RGSPages && window.RGSPages.hasModule && window.RGSPages.hasModule(m.id)); }
  // Keyboard and screen-reader access for scrollable tables and icon-only header cells.
  function enhanceA11y() {
    Array.prototype.forEach.call(document.querySelectorAll('.tablewrap, .lifecycle'), function (w) { if (w.scrollWidth > w.clientWidth || w.scrollHeight > w.clientHeight) { w.tabIndex = 0; w.setAttribute('role', 'region'); if (!w.hasAttribute('aria-label')) w.setAttribute('aria-label', (document.querySelector('h1') || {}).textContent || 'Table'); } });
    Array.prototype.forEach.call(document.querySelectorAll('th'), function (th) { if (!th.textContent.trim() && !th.querySelector('[aria-label]')) th.innerHTML = '<span class="visually-hidden">' + (S.lang === 'ar' ? 'إجراءات' : 'Actions') + '</span>'; });
  }
  function renderApp() {
    var u = user(), cust = isCustomer(u), o = org(u);
    var groups = navFor(u);
    var nav = groups.map(function (g) {
      var items = g.items.filter(function (m) { return !(m.review && cust) && (isBuilt(m) || u.role === 'portal_admin'); });
      if (!items.length) return '';
      return (g.group ? '<div class="nav-group">' + esc(t('grp.' + g.group)) + '</div>' : '') +
        items.map(function (m) {
          return '<a href="#' + m.id + '" data-route="' + m.id + '"' + (navCurrent() === m.id ? ' aria-current="page"' : '') + '>' + ic(m.icon) + '<span>' + esc(navLabel(m, u)) + '</span>' +
            (isBuilt(m) ? '' : '<span class="stage" title="' + esc(t('mod.planned')) + ' ' + m.stage + '">' + esc(t('nav.soon')) + '</span>') + '</a>';
        }).join('');
    }).join('');
    var projects = A.visibleProjects(D, u.id);
    var scopeSel = projects.length > 1 ? '<label class="visually-hidden" for="scope">' + esc(t('top.scope')) + '</label><select id="scope" class="select scope-select"><option value="all">' + esc(t('top.allprojects')) + '</option>' +
      projects.map(function (p) { return '<option value="' + p.id + '"' + (S.project === p.id ? ' selected' : '') + '>' + esc(p.code + ' · ' + L(p, 'name')) + '</option>'; }).join('') + '</select>' : '';
    var themeLabel = t('misc.' + S.theme);
    return '<div class="app' + (S.navOpen ? ' nav-open' : '') + '">' +
      '<aside class="rail" id="rail" aria-label="' + esc(t('app.name')) + '">' +
        '<div class="rail-head"><div class="logos"><img class="logo-rgs" src="assets/rgs-logo.png" alt="RGS" width="134" height="134">' +
          '<span class="logo-plate"><img class="logo-gc" src="assets/global-construction-logo.png" alt="Global Construction" width="246" height="114"></span></div>' +
          '<div><div class="appname">' + esc(t('app.name')) + '</div><div class="shellname">' + esc(t(cust ? 'shell.customer' : 'shell.staff')) + '</div></div></div>' +
        '<nav class="nav" aria-label="Main">' + nav + '</nav>' +
        '<div class="rail-foot"><div class="motto">' + (S.lang === 'ar' ? 'أصول أكثر أمانًا<br>ومستقبل أقوى' : 'Safer assets,<br>stronger tomorrows') + '</div></div>' +
      '</aside><div class="scrim" data-act="closenav"></div>' +
      '<div class="main">' +
        (FIXTURE ? '' : '<div class="proto-strip">' + ic('info') + '<span>' + esc(t('data.offline')) + '</span></div>') +
        '<header class="topbar">' +
          '<button class="iconbtn only-mobile" data-act="opennav" aria-label="' + esc(t('top.menu')) + '" aria-controls="rail" aria-expanded="' + S.navOpen + '">' + ic('menu') + '</button>' +
          '<div class="search control">' + ic('search') + '<label class="visually-hidden" for="q">' + esc(t('top.search')) + '</label><input id="q" class="input" type="search" placeholder="' + esc(t('top.search')) + '"></div>' +
          scopeSel +
          '<div class="top-actions">' +
            '<button class="iconbtn" data-act="lang" data-v="' + (S.lang === 'en' ? 'ar' : 'en') + '" aria-label="' + esc(t('top.lang')) + '" title="' + (S.lang === 'en' ? 'العربية' : 'English') + '">' + ic('globe') + '</button>' +
            (function () { var n = ST.unread(u.id); return '<button class="iconbtn" data-route="notifications" aria-label="' + esc(t('top.notifications') + (n ? ' (' + n + ')' : '')) + '" title="' + esc(t('top.notifications')) + '">' + ic('bell') + (n ? '<span class="badge-dot num" aria-hidden="true">' + n + '</span>' : '') + '</button>'; })() +
            '<div class="usermenu"><button class="userbtn" data-act="menu" aria-haspopup="true" aria-expanded="' + S.menuOpen + '">' +
              '<span class="avatar' + (cust ? ' customer' : '') + '">' + esc(initials(u.name)) + '</span><span class="who"><b>' + esc(u.name) + '</b><span>' + esc(t('role.' + u.role)) + '</span></span>' + ic('down') + '</button>' +
              (S.menuOpen ? '<div class="menu" role="menu">' +
                '<div class="menu-row" style="cursor:default"><span style="color:var(--muted)">' + esc(L(o, 'name')) + '</span></div><hr>' +
                '<button role="menuitem" data-act="theme">' + ic('sun') + '<span style="flex:1">' + esc(t('top.theme')) + '</span><b>' + esc(themeLabel) + '</b></button>' +
                '<button role="menuitem" data-act="lang" data-v="' + (S.lang === 'en' ? 'ar' : 'en') + '">' + ic('globe') + '<span style="flex:1">' + esc(t('top.lang')) + '</span><b>' + (S.lang === 'en' ? 'العربية' : 'English') + '</b></button>' +
                '<button role="menuitem" data-act="signout">' + ic('swap') + '<span style="flex:1">' + esc(t('top.switch')) + '</span></button>' +
                (FIXTURE ? '<button role="menuitem" data-act="resetdemo">' + ic('cloudx') + '<span style="flex:1">' + esc(t('demo.reset')) + '</span></button>' : '') +
                '<button role="menuitem" data-act="signout">' + ic('logout', 'flip') + '<span style="flex:1">' + esc(t('top.signout')) + '</span></button></div>' : '') +
            '</div></div></header>' +
        '<main class="content" id="content" tabindex="-1">' + renderRoute(u) + '</main>' +
      '</div></div>';
  }

  function routeBase(r) { return String(r || 'home').split('.')[0]; }
  function navCurrent() {
    var b = routeBase(S.route);
    if (MODULE_BY[b]) return b;
    return window.RGSPages && window.RGSPages.navFor ? window.RGSPages.navFor(b) : 'home';
  }
  function renderRoute(u) {
    var base = routeBase(S.route);
    if (!MODULE_BY[base] && window.RGSPages && window.RGSPages.handles(base)) {
      if (S.loading) return loadingState();
      return window.RGSPages.render(base, S.route.split('.').slice(1), u);
    }
    var m = MODULE_BY[base] || MODULE_BY.home;
    if (!moduleAllowed(u.id, m)) return deniedState(denialFor(u, m), m);
    if (S.loading) return loadingState();
    switch (m.id) {
      case 'home': return ST.isCustomer(u.id) ? window.RGSPages.render('overview', [], u) : renderHome(u);
      case 'projects': return window.RGSPages.render('directory', [], u);
      case 'actions': return window.RGSPages.render('actions', [], u);
      case 'activity': return window.RGSPages.render('activity', [], u);
      case 'requests': return window.RGSPages.render('requests', [], u);
      case 'triage': return window.RGSPages.render('triage', [], u);
      case 'instructions': return window.RGSPages.render('instructions', [], u);
      case 'approvals': return window.RGSPages.render('approvals', [], u);
      case 'notifications': return window.RGSPages.render('notifications', [], u);
      case 'ds': return renderDS();
      case 'model': return renderModel();
      case 'matrix': return renderMatrix();
      case 'tester': return renderTester();
      case 'states': return renderStates();
      case 'arch': return renderArch();
      default: return window.RGSPages && window.RGSPages.hasModule && window.RGSPages.hasModule(m.id) ? window.RGSPages.render(m.id, S.route.split('.').slice(1), u) : renderModule(u, m);
    }
  }

  // ---------------------------------------------------------------- states
  function loadingState() {
    return '<div aria-busy="true" aria-label="' + esc(t('st.loading')) + '" class="grid">' +
      '<div class="skel" style="height:200px;border-radius:var(--r-lg)"></div>' +
      '<div class="grid g-3">' + [0, 1, 2].map(function () { return '<div class="card card-b stack"><div class="skel" style="height:18px;width:50%"></div><div class="skel" style="height:12px"></div><div class="skel" style="height:12px;width:80%"></div><div class="skel" style="height:12px;width:65%"></div></div>'; }).join('') + '</div>' +
      '<p class="visually-hidden" role="status">' + esc(t('st.loading.d')) + '</p></div>';
  }
  function emptyState() {
    return '<div class="state">' + '<div class="glyph">' + ic('inbox') + '</div><h2>' + esc(t('st.empty.t')) + '</h2><p>' + esc(t('st.empty.d')) + '</p>' +
      '<div class="actions"><button class="btn btn-primary" data-act="toast" data-msg="' + esc(t('mod.planned')) + ' 4">' + esc(t('st.empty.a')) + '</button></div></div>';
  }
  function errorState() {
    return '<div class="state err" role="alert"><div class="glyph">' + ic('cloudx') + '</div><h2>' + esc(t('st.error.t')) + '</h2><p>' + esc(t('st.error.d')) + '</p>' +
      '<p class="mono" style="font-size:var(--fs-xs)">' + esc(t('st.error.ref')) + ': ERR-DOC-504-7F3A</p>' +
      '<div class="actions"><button class="btn btn-primary" data-act="retry">' + esc(t('st.error.a')) + '</button><button class="btn btn-secondary" data-route="support">' + esc(t('nav.support')) + '</button></div></div>';
  }
  function deniedState(res, m) {
    return '<div class="card"><div class="state denied" role="alert"><div class="glyph">' + ic('lockx') + '</div><h2>' + esc(t('st.denied.t')) + '</h2><p>' + esc(t('st.denied.d')) + '</p>' +
      '<div class="reason"><b>' + esc(t('st.denied.why')) + ':</b> ' + esc(t('reason.' + res.code)) + (m ? ' <span class="mono" style="color:var(--muted)">(' + esc(navLabel(m, user())) + ' · ' + esc(res.code) + ')</span>' : '') + '</div>' +
      '<div class="actions"><button class="btn btn-primary" data-route="home">' + esc(t('st.denied.a')) + '</button><button class="btn btn-secondary" data-act="toast" data-msg="' + esc(t('st.denied.requested')) + '">' + esc(t('st.denied.b')) + '</button></div></div></div>';
  }

  // ---------------------------------------------------------------- home
  function scopeChips(u) {
    var asg = D.assignments.filter(function (a) { return a.userId === u.id; });
    var chips = [];
    if (asg.some(function (a) { return a.scope.projectId === '*'; })) chips.push(t('home.scope.all'));
    else chips.push(t('home.projects') + ': ' + A.visibleProjects(D, u.id).length);
    asg.forEach(function (a) {
      if (a.scope.areaId) chips.push(t('home.scope.area') + ': ' + L(byId(D.areas, a.scope.areaId), 'name'));
      if (a.scope.service) chips.push(t('home.scope.service') + ': ' + t('svc.' + a.scope.service));
    });
    return chips;
  }
  function authoritiesOf(u) { return D.authorities.filter(function (d) { return d.userId === u.id; }); }
  function accessCard(u) {
    var asg = D.assignments.filter(function (a) { return a.userId === u.id; });
    var rows = asg.map(function (a) {
      var p = a.scope.projectId === '*' ? null : byId(D.projects, a.scope.projectId);
      var sub = [];
      if (a.scope.areaId) sub.push(t('home.scope.area') + ': ' + L(byId(D.areas, a.scope.areaId), 'name'));
      if (a.scope.service) sub.push(t('home.scope.service') + ': ' + t('svc.' + a.scope.service));
      return '<div class="list-row"><span class="sev info"></span><div class="t"><b>' + (p ? '<span class="mono">' + esc(p.code) + '</span> ' + esc(L(p, 'name')) : esc(t('home.scope.all'))) + '</b><span>' + esc(t('role.' + a.role)) + (sub.length ? ' · ' + esc(sub.join(' · ')) : '') + '</span></div></div>';
    }).join('');
    var now = new Date(D.now);
    var auths = authoritiesOf(u).map(function (d) {
      var p = byId(D.projects, d.scope.projectId), live = new Date(d.validTo) >= now;
      return '<div class="list-row"><span class="sev ' + (live ? 'ok' : 'crit') + '"></span><div class="t"><b>' + esc(actLabel(d.action)) + '</b><span><span class="mono">' + esc(d.id) + '</span> · ' + esc(p.code) + (d.scope.service ? ' · ' + esc(t('svc.' + d.scope.service)) : '') + '</span></div>' +
        '<span class="pill ' + (live ? 'ok' : 'crit') + '">' + esc(live ? t('home.until') + ' ' + fmtDate(d.validTo) : t('home.expired')) + '</span></div>';
    }).join('');
    return '<section class="card"><div class="card-h"><h2>' + esc(t('home.access')) + '</h2>' + ic('shield') + '</div>' +
      '<p class="field-hint" style="padding:var(--s3) var(--s5) 0">' + esc(t('home.access.d')) + '</p>' +
      '<div class="list">' + rows + '</div>' +
      '<div class="card-h" style="border-top:1px solid var(--line)"><h3>' + esc(t('home.authority')) + '</h3></div>' +
      (auths ? '<div class="list">' + auths + '</div>' : '<p class="card-b field-hint">' + esc(t('home.noauthority')) + '</p>') + '</section>';
  }
  // Staff home cards: every figure comes from the record store (store.js).
  function todayCard(u) { return window.RGSPages.staffOpenItems(u); }
  function aiCard(u) { return canAny(u.id, 'ai.view') ? window.RGSPages.briefingCard(u) : ''; }
  var SVC_IMG = { scaffolding: 'assets/svc-scaffolding.jpg', insulation: 'assets/svc-insulation.jpg', waterproofing: 'assets/svc-waterproofing.jpg', fireproofing: 'assets/svc-fireproofing.jpg' };
  function packagesCard(u) {
    var pk = ST.visiblePackages(u.id).filter(function (w) { return S.project === 'all' || w.projectId === S.project; });
    if (!pk.length) return '';
    return '<section class="card"><div class="card-h"><h2>' + esc(t('home.packages')) + '</h2></div><div class="list">' +
      pk.map(function (w) {
        var p = byId(D.projects, w.projectId), a = byId(D.areas, w.areaId), pr = ST.packageProgress(w.id, u.id);
        return '<a class="pkg rowlink" href="#package.' + w.id + '" data-route="package.' + w.id + '"><img src="' + SVC_IMG[w.service] + '" alt="" aria-hidden="true" loading="lazy" decoding="async"><div class="t"><b>' + esc(t('svc.' + w.service)) + ' \u00b7 ' + esc(L(a, 'name')) + '</b><span class="mono">' + esc(w.code) + '</span> <span>\u00b7 ' + esc(L(p, 'name')) + '</span>' +
          window.RGSPages.bar(pr.pct) + '</div><b class="num" style="text-align:end">' + esc(window.RGSPages.pctText(pr)) + '</b></a>';
      }).join('') + '</div></section>';
  }
  function projectsCard(u) {
    var ps = ST.visibleProjects(u.id).filter(function (p) { return S.project === 'all' || p.id === S.project; });
    if (!ps.length) return '';
    return '<section class="card"><div class="card-h"><h2>' + esc(t('nav.projects')) + '</h2><a class="linkbtn" href="#projects" data-route="projects">' + esc(t('dir.title')) + '</a></div><div class="tablewrap"><table class="tbl-projects"><thead><tr><th>' + esc(t('misc.code')) + '</th><th>' + esc(t('nav.projects')) + '</th><th>' + esc(t('f.type')) + '</th><th>' + esc(t('f.health')) + '</th><th class="num">' + esc(t('misc.progress')) + '</th></tr></thead><tbody>' +
      ps.map(function (p) { return '<tr><td class="mono"><a href="#project.' + p.id + '" data-route="project.' + p.id + '">' + esc(p.code) + '</a></td><td><b>' + esc(L(p, 'name')) + '</b><br><span style="color:var(--muted)">' + esc(L(p, 'location')) + '</span></td><td>' + esc(t('ptype.' + p.type)) + '</td><td>' + window.RGSPages.healthPill(ST.projectHealth(p.id)) + '</td><td class="num"><div class="proj-bar">' + (function (pr) { return pr.pct === null || pr.pct === undefined ? '' : '<div class="progress" role="progressbar" aria-valuenow="' + pr.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(t('misc.progress')) + '"><i style="width:' + pr.pct + '%"></i></div>'; })(ST.projectProgress(p.id, u.id)) + '<b>' + esc(window.RGSPages.pctText(ST.projectProgress(p.id, u.id))) + '</b></div></td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }
  function modulesCard(u) {
    var mods = MODULES.filter(function (m) { return !m.review && !m.hidden && m.id !== 'home' && moduleAllowed(u.id, m); });
    return '<section class="stack"><h2 style="font-size:var(--fs-lg)">' + esc(t('home.modules')) + '</h2><div class="grid g-auto">' +
      mods.map(function (m) { return '<a class="module-tile" href="#' + m.id + '" data-route="' + m.id + '"><div class="top">' + ic(m.icon) + '<span class="pill plain">' + esc(t('misc.stage')) + ' ' + m.stage + '</span></div><b>' + esc(navLabel(m, u)) + '</b><span>' + esc(t('mod.refs')) + ': ' + m.refs.join(', ') + '</span></a>'; }).join('') + '</div></section>';
  }
  function renderHome(u) {
    var o = org(u);
    var chips = ['<span class="chip brand">' + esc(t('role.' + u.role)) + '</span>', '<span class="chip">' + esc(L(o, 'name')) + '</span>']
      .concat(scopeChips(u).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }));
    var banner = '<section class="mast"><div><p class="greet">' + esc(t('home.hello')) + ' ' + esc(u.name.split(' ')[0]) + '</p>' +
      '<h1>' + esc(S.lang === 'ar' ? 'مساحة عمل ' + t('role.' + u.role) : t('role.' + u.role) + ' workspace') + '</h1>' +
      '<div class="chips">' + chips.join('') + '</div></div>' +
      '<figure><img src="assets/banner.jpg" alt="" aria-hidden="true"><span class="illus-tag">' + esc(t('img.illustrative')) + '</span></figure></section>';
    if (u.role === 'portal_admin') {
      return banner + '<div class="notice">' + ic('shield') + '<span>' + esc(t('home.noadmincontent')) + '</span></div>' +
        '<div class="grid g-home"><div class="grid">' + accessCard(u) + '</div><div class="grid"></div></div>' + modulesCard(u);
    }
    return banner +
      '<div class="grid g-home"><div class="grid">' + projectsCard(u) + todayCard(u) + packagesCard(u) + '</div><div class="grid">' + accessCard(u) + aiCard(u) + '</div></div>';
  }

  // ---------------------------------------------------------------- planned module page
  function renderModule(u, m) {
    var actions = Object.keys(A.ACTIONS).filter(function (a) { var mm = A.ACTIONS[a].module; return (MODULE_OF_ACTION[mm] === m.id) || (m.id === 'services' && mm === 'packages') || (['users', 'orgs', 'roles', 'audit', 'settings'].indexOf(m.id) >= 0 && mm === 'admin') || (m.id === 'approvals' && A.ACTIONS[a].kind === 'technical'); });
    if (m.id === 'sitemap') actions = ['package.view', 'package.update', 'photo.upload'];
    if (m.id === 'knowledge') actions = ['project.view'];
    var rows = actions.map(function (a) {
      var ok = canAny(u.id, a), tech = A.ACTIONS[a].kind === 'technical' || A.ACTIONS[a].kind === 'delegable';
      var eligible = tech && D.assignments.some(function (x) { return x.userId === u.id && A.ROLES[x.role].eligible.indexOf(a) >= 0; });
      var cls = ok ? (tech ? 'a' : 'y') : 'n', lab = ok ? t(tech ? 'perm.auth' : 'perm.yes') : t(eligible ? 'perm.authneeded' : 'perm.no');
      return '<tr><td>' + esc(actLabel(a)) + '<br><span class="mono" style="color:var(--muted);font-size:11px">' + esc(a) + '</span></td><td><span class="mk ' + cls + '" aria-hidden="true">' + (ok ? (tech ? 'A' : '✓') : '–') + '</span> ' + esc(lab) + '</td></tr>';
    }).join('');
    return '<div class="page-h"><div><span class="eyebrow">' + esc(t('mod.planned')) + ' ' + m.stage + '</span><h1>' + esc(navLabel(m, u)) + '</h1>' +
      (m.refs.length ? '<p>' + esc(t('mod.refs')) + ': <span class="mono">' + m.refs.join(' · ') + '</span></p>' : '') + '</div><span class="pill brand">' + esc(t('misc.stage')) + ' ' + m.stage + '</span></div>' +
      '<div class="grid g-2"><section class="card"><div class="state"><div class="glyph">' + ic(m.icon) + '</div><h2>' + esc(t('mod.empty.t')) + '</h2><p>' + esc(t('mod.empty.d')) + '</p></div></section>' +
      '<section class="card"><div class="card-h"><h2>' + esc(t('mod.yourperms')) + '</h2></div><div class="tablewrap"><table><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  // ---------------------------------------------------------------- design system
  function renderDS() {
    var sw = [['--nav-bg', 'Navy navigation'], ['--brand-orange', 'RGS orange (logo)'], ['--accent', 'Action orange'], ['--bg', 'Page'], ['--surface', 'Surface'], ['--line', 'Line'], ['--ink', 'Ink'], ['--muted', 'Muted'], ['--ok', 'Success'], ['--warn', 'Warning'], ['--crit', 'Critical'], ['--info', 'Information']];
    var cs = getComputedStyle(document.documentElement);
    return pageH('nav.ds', 'Tokens and components every later module builds on. Colours are sampled from the supplied logo and benchmark; the darker action orange keeps white button text at 4.5:1 contrast.') +
      '<section class="card"><div class="card-h"><h2>Colour</h2></div><div class="card-b grid g-auto" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">' +
      sw.map(function (s) { return '<div class="sw"><i style="background:var(' + s[0] + ')"></i><b>' + s[1] + '</b><span>' + s[0] + ' ' + esc(cs.getPropertyValue(s[0]).trim()) + '</span></div>'; }).join('') + '</div></section>' +
      '<div class="grid g-2"><section class="card"><div class="card-h"><h2>Typography</h2></div><div class="card-b typescale">' +
        '<div><code>display 2.75</code><span style="font-family:var(--font-display);font-size:var(--fs-3xl);font-weight:700;line-height:1">Tank farm handover</span></div>' +
        '<div><code>h1 1.875</code><span style="font-family:var(--font-display);font-size:var(--fs-2xl);font-weight:700">Project workspace</span></div>' +
        '<div><code>h2 1.0625/600</code><span style="font-size:var(--fs-lg);font-weight:600">Approval queue</span></div>' +
        '<div><code>body 0.9375</code><span>Scaffold tag checks are due before the 07:00 permit briefing.</span></div>' +
        '<div><code>small 0.8125</code><span style="font-size:var(--fs-sm);color:var(--muted)">Updated 12 Oct 2026 by site officer</span></div>' +
        '<div><code>mono</code><span class="mono">WP-P1-SCF-01 · ITP-INS-102 Rev C</span></div>' +
        '<div><code>arabic</code><span lang="ar" dir="rtl" style="font-family:\'IBM Plex Sans Arabic\',sans-serif;font-size:var(--fs-lg)">تسليم سقالات منطقة الخزانات</span></div>' +
        '<p class="field-hint" style="padding-top:var(--s3)">Display: Barlow Semi Condensed (industrial signage feel). Body: IBM Plex Sans with IBM Plex Sans Arabic, so both scripts share proportions. Data: IBM Plex Mono for record codes.</p></div></section>' +
      '<section class="card"><div class="card-h"><h2>Buttons and status</h2></div><div class="card-b stack">' +
        '<div class="row"><button class="btn btn-primary">Submit for approval</button><button class="btn btn-secondary">Save draft</button><button class="btn btn-ghost">Cancel</button></div>' +
        '<div class="row"><button class="btn btn-primary btn-sm">Small</button><button class="btn btn-danger btn-sm">Stop work</button><button class="btn btn-primary btn-sm" aria-disabled="true"><span class="spin" aria-hidden="true"></span>Saving…</button><button class="btn btn-secondary btn-sm" disabled>Disabled</button></div>' +
        '<div class="row"><span class="pill ok">Approved</span><span class="pill warn">Response required</span><span class="pill crit">Overdue</span><span class="pill info">Under review</span><span class="pill brand">Handover</span><span class="pill">Draft</span><span class="tag-sample">Sample</span></div>' +
        '<div class="row" style="gap:var(--s4)"><span>Spacing</span>' + [4, 8, 12, 16, 24, 32, 40].map(function (n) { return '<span title="' + n + 'px" style="display:inline-block;width:' + n + 'px;height:' + n + 'px;background:var(--accent-soft);border:1px solid var(--accent)"></span>'; }).join('') + '</div>' +
      '</div></section></div>' +
      '<div class="grid g-2"><section class="card"><div class="card-h"><h2>Form controls</h2></div><div class="card-b stack">' +
        '<div class="field"><label for="ds1">Package reference</label><input id="ds1" class="input" value="WP-P1-INS-02"><span class="field-hint">Format: WP-project-service-number</span></div>' +
        '<div class="field"><label for="ds2">Service</label><select id="ds2" class="select">' + A.SERVICES.map(function (s) { return '<option>' + esc(t('svc.' + s)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="ds3">Required by</label><input id="ds3" class="input" aria-invalid="true" aria-describedby="ds3e" value="31 Sep 2026"><div id="ds3e" class="field-error">' + ic('alert') + 'Enter a real date, for example 30 Sep 2026.</div></div>' +
        '<div class="field"><label for="ds4">Description</label><textarea id="ds4" class="textarea">Add lap detail at T-102 base and termination photos.</textarea></div>' +
        '<div class="row"><label class="check"><input type="checkbox" checked id="ds5"> Notify customer approver</label><label class="check"><input type="radio" name="ds6" id="ds6" checked> Normal</label><label class="check"><input type="radio" name="ds6" id="ds7"> Urgent</label><label class="toggle"><input type="checkbox" id="ds8" checked><span class="track"></span> Hold point</label></div>' +
      '</div></section>' +
      '<section class="card"><div class="card-h"><h2>Cards and navigation</h2></div><div class="card-b stack">' +
        '<div class="card" style="box-shadow:none"><div class="list"><div class="list-row"><span class="sev warn"></span><div class="t"><b>Review insulation method statement</b><span class="mono">MS-INS-02 Rev B</span> <span>· due 15 Oct</span></div><span class="pill warn">2 days</span></div></div></div>' +
        '<div style="background:var(--nav-bg);border-radius:var(--r-md);padding:var(--s3)" class="nav"><a href="#ds" aria-current="page">' + ic('home') + '<span>Active item</span></a><a href="#ds">' + ic('documents') + '<span>Default item</span><span class="stage">S5</span></a></div>' +
        '<p class="field-hint">Cards set off one object; lists inside them use a severity stripe so state reads at a glance without colour alone (text label always present).</p>' +
      '</div></section></div>';
  }
  function pageH(key, desc) { return '<div class="page-h"><div><span class="eyebrow">' + esc(t('grp.review')) + '</span><h1>' + esc(t(key)) + '</h1><p>' + esc(desc) + '</p></div></div>'; }

  // ---------------------------------------------------------------- data model
  function entity(name, fields) {
    return '<section class="card card-b entity stack"><h3>' + name + '</h3><ul>' + fields.map(function (f) { return '<li><code>' + f[0] + '</code><em>' + f[1] + '</em></li>'; }).join('') + '</ul></section>';
  }
  function renderModel() {
    return pageH('nav.model', 'Record hierarchy and core entities. Every operational record carries organisation, project, area and service keys so one access rule applies everywhere.') +
      '<section class="card card-b stack"><h2 style="font-size:var(--fs-lg)">Record hierarchy</h2><div class="hier">' +
        '<div class="node n1"><span class="eyebrow">1</span><b>Organisation</b><span>RGS or a customer. Hard boundary for customer users.</span></div>' +
        '<div class="node n2"><span class="eyebrow">2</span><b>Project</b><span>Industrial, infrastructure / non-industrial, commercial or residential.</span></div>' +
        '<div class="node n3"><span class="eyebrow">3</span><b>Site area / asset</b><span>Nestable: area › unit › asset (tank, pipe rack, roof).</span></div>' +
        '<div class="node n4"><span class="eyebrow">4</span><b>Service work package</b><span>One service on one area: scaffolding, insulation, waterproofing or fireproofing.</span></div>' +
      '</div><p class="field-hint">Requests, instructions, documents, photos, inspections, corrective actions, commitments and handover items attach to a project and, where known, an area and work package.</p></section>' +
      '<div class="grid g-auto" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">' +
        entity('organisation', [['id', 'uuid'], ['kind', 'rgs | customer | subcontractor'], ['name_en / name_ar', 'text'], ['status', 'active | suspended']]) +
        entity('project', [['id', 'uuid'], ['customer_org_id', '→ organisation'], ['code', 'PRJ-IND-0142'], ['type', 'industrial | infrastructure | commercial | residential'], ['name_en / name_ar', 'text'], ['location', 'text + geo'], ['status', 'mobilising | execution | handover | closed']]) +
        entity('site_area', [['id', 'uuid'], ['project_id', '→ project'], ['parent_id', '→ site_area (nullable)'], ['kind', 'area | unit | asset'], ['code', 'U4-PR-02'], ['name_en / name_ar', 'text']]) +
        entity('work_package', [['id', 'uuid'], ['project_id', '→ project'], ['area_id', '→ site_area'], ['service', 'scaffolding | insulation | waterproofing | fireproofing'], ['code', 'WP-P1-SCF-01'], ['status', 'planned | active | complete | handed_over']]) +
        entity('app_user', [['id', 'uuid (= identity provider subject)'], ['org_id', '→ organisation'], ['email', 'unique'], ['status', 'invited | active | suspended'], ['mfa_required', 'bool']]) +
        entity('role_assignment', [['user_id', '→ app_user'], ['role', 'one of 12 roles'], ['project_id', '→ project | * (GM, admin)'], ['area_id', 'optional narrowing'], ['service', 'optional narrowing'], ['valid_from / valid_to', 'timestamptz'], ['status', 'active | revoked']]) +
        entity('delegated_authority', [['id', 'DA-0301'], ['user_id', '→ app_user'], ['action', 'technical approval type'], ['project / area / service', 'scope'], ['nominated_by', 'manager or customer org'], ['granted_by', '→ admin (≠ holder)'], ['valid_from / valid_to', 'max 12 months'], ['limits', 'jsonb (e.g. value, discipline)'], ['status', 'active | revoked']]) +
        entity('file_object', [['id', 'uuid'], ['owner record', 'polymorphic ref'], ['storage_key', 'private bucket path'], ['sha256', 'integrity'], ['mime / size', 'validated'], ['scan_status', 'pending | clean | infected'], ['captured_at / geo', 'photos']]) +
        entity('audit_event', [['id', 'bigserial'], ['at', 'timestamptz'], ['actor_id / acting_as', 'user, role, authority id'], ['action', 'e.g. inspection.signoff'], ['record ref', 'type + id + revision'], ['before / after hash', 'sha256'], ['reason', 'text (required for sign-off)'], ['ip / user_agent', 'text'], ['prev_hash', 'tamper-evident chain']]) +
      '</div>' +
      '<section class="card card-b stack"><h2 style="font-size:var(--fs-lg)">Workflow records planned for later stages</h2><div class="tablewrap"><table><thead><tr><th>Entity</th><th>Key links</th><th>Stage</th></tr></thead><tbody>' +
        [['request, request_response', 'project, area, package, requester', '4'], ['instruction, change_record', 'project, issued_by (approver), acknowledged_by', '4'], ['approval_request', 'record ref, required authority, decision, signer', '4'], ['document, document_revision, transmittal', 'project, package, revision status, supersedes', '5'], ['inspection, inspection_result, itp_hold_point', 'package, inspector, evidence files, sign-off', '5'], ['corrective_action', 'source inspection/HSE, owner, closure evidence, verifier', '5'], ['hse_observation, permit_to_work', 'area, permit approver authority', '5'], ['commitment, milestone', 'project, owner, due, baseline', '6'], ['handover_item, handover_certificate', 'package, RGS signer, customer acceptor', '6'], ['ai_finding, ai_evidence_link', 'record refs + revision, reviewer, status proposed | confirmed | dismissed', '7']]
          .map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  // ---------------------------------------------------------------- matrix
  function renderMatrix() {
    var roles = A.ROLE_ORDER;
    var groups = {};
    Object.keys(A.ACTIONS).forEach(function (a) { var m = A.ACTIONS[a].module; (groups[m] = groups[m] || []).push(a); });
    var head = '<tr><th>Action</th>' + roles.map(function (r) { return '<th class="rot c" title="' + esc(t('role.' + r)) + '">' + esc(t('role.' + r)) + '</th>'; }).join('') + '</tr>';
    var scopeRow = '<tr><td><b>Normal scope</b></td>' + roles.map(function (r) { return '<td class="c" style="font-size:11px;color:var(--muted)">' + A.ROLES[r].scopeLevel + '</td>'; }).join('') + '</tr>';
    var body = Object.keys(groups).map(function (g) {
      return '<tr class="grp"><td colspan="' + (roles.length + 1) + '">' + esc(g) + '</td></tr>' + groups[g].map(function (a) {
        return '<tr><td>' + esc(actLabel(a)) + '<br><span class="mono" style="font-size:11px;color:var(--muted)">' + a + '</span></td>' + roles.map(function (r) {
          var R = A.ROLES[r], y = R.grants.indexOf(a) >= 0, e = R.eligible.indexOf(a) >= 0;
          return '<td class="c"><span class="mk ' + (y ? 'y' : e ? 'a' : 'n') + '" title="' + (y ? 'Granted in scope' : e ? 'Only with delegated authority' : 'Not available') + '">' + (y ? '✓' : e ? 'A' : '–') + '</span></td>';
        }).join('') + '</tr>';
      }).join('');
    }).join('');
    return pageH('nav.matrix', 'Generated from the same rules the access checks use, so the table cannot drift from the code. A role grants an action only inside its assigned organisation, project, area and service.') +
      '<div class="legend"><span><span class="mk y">✓</span> Granted within assigned scope</span><span><span class="mk a">A</span> Eligible: needs a delegated authority record for the specific project, area or service</span><span><span class="mk n">–</span> Not available</span></div>' +
      '<div class="notice warn">' + ic('shield') + '<span>The portal administrator manages people, roles and authority records but holds no technical sign-off and cannot open technical records. Nobody can grant authority to themselves, every grant needs a nomination and an end date (12 months at most), and expired authority stops working automatically.</span></div>' +
      '<section class="card"><div class="tablewrap" style="max-height:72vh"><table class="matrix"><thead>' + head + '</thead><tbody>' + scopeRow + body + '</tbody></table></div></section>';
  }

  // ---------------------------------------------------------------- tester
  function renderTester() {
    var T0 = S.tester, G = S.grant;
    var rec = T0.record.split(':'), resource = rec[0] === 'pkg' ? { packageId: rec[1] } : rec[0] === 'prj' ? { projectId: rec[1] } : null;
    var res = T0.ai ? A.aiCan(D, T0.user, T0.action, resource) : A.can(D, T0.user, T0.action, resource);
    var grantRes = A.canGrant(D, 'u-adm', { userId: G.user, action: G.action, scope: { projectId: G.project }, nominatedBy: G.nominatedBy || null, validTo: G.validTo || null });
    function userOpts(sel) { return D.users.map(function (u) { return '<option value="' + u.id + '"' + (u.id === sel ? ' selected' : '') + '>' + esc(t('role.' + u.role) + ' — ' + u.name) + '</option>'; }).join(''); }
    var recOpts = '<option value="none"' + (T0.record === 'none' ? ' selected' : '') + '>No record (global action)</option>' +
      D.projects.map(function (p) {
        return '<optgroup label="' + esc(p.code + ' ' + p.name + ' · ' + byId(D.orgs, p.customerOrgId).name) + '"><option value="prj:' + p.id + '"' + (T0.record === 'prj:' + p.id ? ' selected' : '') + '>Project level</option>' +
          D.packages.filter(function (w) { return w.projectId === p.id; }).map(function (w) { return '<option value="pkg:' + w.id + '"' + (T0.record === 'pkg:' + w.id ? ' selected' : '') + '>' + esc(w.code + ' · ' + t('svc.' + w.service) + ' · ' + byId(D.areas, w.areaId).name) + '</option>'; }).join('') + '</optgroup>';
      }).join('');
    var actOpts = Object.keys(A.ACTIONS).map(function (a) { return '<option value="' + a + '"' + (a === T0.action ? ' selected' : '') + '>' + esc(a + ' — ' + actLabel(a)) + '</option>'; }).join('');
    return pageH('nav.tester', 'Run any person, action and record through the access rules and see why it is allowed or refused. Try the QA/QC inspector on a scaffolding package, or the administrator on a sign-off.') +
      '<div class="grid g-2"><section class="card"><div class="card-h"><h2>Check an action</h2></div><div class="card-b stack">' +
        '<div class="field"><label for="tu">Person</label><select id="tu" class="select" data-bind="tester.user">' + userOpts(T0.user) + '</select></div>' +
        '<div class="field"><label for="ta">Action</label><select id="ta" class="select" data-bind="tester.action">' + actOpts + '</select></div>' +
        '<div class="field"><label for="tr">Record</label><select id="tr" class="select" data-bind="tester.record">' + recOpts + '</select></div>' +
        '<label class="toggle"><input id="tai" type="checkbox" data-bind="tester.ai"' + (T0.ai ? ' checked' : '') + '><span class="track"></span> Ask the AI assistant to do it on this person’s behalf</label>' +
        '<div class="result ' + (res.allowed ? 'yes' : 'no') + '" role="status"><b>' + (res.allowed ? '✓ Allowed' : '✕ Refused') + ' <span class="mono" style="font-weight:400">' + esc(res.code) + '</span></b><span>' + esc(t('reason.' + res.code)) + '</span><ol>' + res.trace.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>' +
      '</div></section>' +
      '<section class="card"><div class="card-h"><h2>Check a delegated authority grant</h2><span class="pill plain">Grantor: Portal administrator</span></div><div class="card-b stack">' +
        '<div class="field"><label for="gu">Recipient</label><select id="gu" class="select" data-bind="grant.user">' + userOpts(G.user) + '</select></div>' +
        '<div class="field"><label for="ga">Authority</label><select id="ga" class="select" data-bind="grant.action">' + TECH.map(function (a) { return '<option value="' + a + '"' + (a === G.action ? ' selected' : '') + '>' + esc(actLabel(a)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="gp">Project</label><select id="gp" class="select" data-bind="grant.project">' + D.projects.map(function (p) { return '<option value="' + p.id + '"' + (p.id === G.project ? ' selected' : '') + '>' + esc(p.code + ' ' + p.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="grid g-2"><div class="field"><label for="gn">Nominated by</label><select id="gn" class="select" data-bind="grant.nominatedBy"><option value=""' + (!G.nominatedBy ? ' selected' : '') + '>No nomination</option><option value="u-om"' + (G.nominatedBy === 'u-om' ? ' selected' : '') + '>Operations manager</option><option value="org-nb"' + (G.nominatedBy === 'org-nb' ? ' selected' : '') + '>Customer organisation</option><option value="u-adm"' + (G.nominatedBy === 'u-adm' ? ' selected' : '') + '>The administrator</option></select></div>' +
        '<div class="field"><label for="gv">Valid until</label><input id="gv" class="input" type="date" data-bind="grant.validTo" value="' + esc(G.validTo) + '"></div></div>' +
        '<div class="result ' + (grantRes.allowed ? 'yes' : 'no') + '" role="status"><b>' + (grantRes.allowed ? '✓ Grant can be recorded' : '✕ Grant refused') + ' <span class="mono" style="font-weight:400">' + esc(grantRes.code) + '</span></b><ol>' + grantRes.trace.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>' +
        '<p class="field-hint">Checks only; nothing is saved. Sample date is 13 Oct 2026.</p>' +
      '</div></section></div>';
  }

  // ---------------------------------------------------------------- states page
  function renderStates() {
    var u = user();
    return pageH('nav.states', 'The four system states every module reuses. Each one tells people what happened and what they can do next.') +
      '<div class="grid g-2">' +
        '<section class="card"><div class="card-h"><h2>Loading</h2><button class="btn btn-secondary btn-sm" data-act="simload">Replay page load</button></div><div class="card-b">' + loadingState().replace('<div class="skel" style="height:200px;border-radius:var(--r-lg)"></div>', '').replace('grid g-3', 'grid') + '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Empty</h2></div>' + emptyState() + '</section>' +
        '<section class="card"><div class="card-h"><h2>Error</h2></div>' + errorState() + '</section>' +
        '<section class="card"><div class="card-h"><h2>Access denied</h2><a class="btn btn-secondary btn-sm" href="#audit" data-route="audit">Open an admin page</a></div>' + deniedState({ code: isCustomer(u) ? 'org_boundary' : 'authority' }, null).replace('<div class="card">', '<div>') + '</section>' +
      '</div>';
  }

  // ---------------------------------------------------------------- architecture
  function renderArch() {
    function sec(title, items) { return '<section class="card card-b prose"><h2 style="font-size:var(--fs-lg)">' + title + '</h2><ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></section>'; }
    return pageH('nav.arch', 'Recommended production architecture. Nothing on this page is running yet; Stage 2 implements it.') +
      '<div class="grid g-2">' +
      sec('Application', ['TypeScript web app (Next.js or similar) serving this interface, with all data access through a server API. No business rule lives only in the browser.', 'Host in a cloud region inside Saudi Arabia to meet the Personal Data Protection Law and customer data-residency terms. Confirm the chosen provider’s KSA region and services before contracting.', 'Separate development, staging and production environments; production data never copied to lower environments.']) +
      sec('Authentication', ['OpenID Connect identity provider (for example Microsoft Entra ID with B2B guests for customer organisations, or Keycloak if RGS wants self-hosting).', 'Company SSO for RGS staff; invitation-only accounts for customers, linked to one organisation. No self-registration.', 'MFA required for approvers, managers and administrators; recommended for all.', 'Sessions in secure, httpOnly, SameSite cookies; short access tokens; idle timeout; device sign-out from the admin console.', 'Step-up re-authentication before any technical sign-off; the signature records person, authority id, time, reason and record revision.']) +
      sec('Authorisation', ['One policy module on the server (the rules in this prototype’s rbac.js) decides every request: organisation boundary → role in scope → delegated authority for technical approvals.', 'PostgreSQL row-level security as a second line: every table carries org, project, area and service keys, and policies read the caller’s memberships.', 'Administrator role manages users, roles and authority records only. It is excluded from technical sign-off and from technical record content; grants need a nomination and expire within 12 months.', 'Quarterly access recertification; automatic expiry of authority; suspended accounts lose all sessions.']) +
      sec('Database', ['PostgreSQL 16+ (managed service) with UUID keys, bilingual name fields and timestamptz everywhere.', 'Controlled records are never edited in place: revisions are new rows; superseded revisions stay readable to authorised roles.', 'Point-in-time recovery, encrypted backups, tested restore at least quarterly.']) +
      sec('Private file storage', ['Private object storage (S3-compatible or Azure Blob) with no public access; customer-managed encryption keys.', 'Uploads and downloads use short-lived pre-signed URLs issued only after the permission check, so a leaked link stops working within minutes.', 'Files are virus-scanned and quarantined until clean; SHA-256 checksum, MIME and size validated; photo capture time and location kept as evidence.', 'Issued documents and signed records stored with versioning and retention lock (write-once) so evidence cannot be silently replaced.']) +
      sec('Audit history', ['Append-only audit_event table written in the same transaction as the change; the application database role has no UPDATE or DELETE rights on it.', 'Each event stores actor, role and authority used, record and revision, before/after hashes, reason, IP and device; events are hash-chained so tampering is detectable.', 'Copies stream to a security monitoring service; retention set with RGS legal (contract and statutory periods).', 'Access governance screens (reference 40) read from this log; exports are themselves audited.']) +
      sec('AI guardrails', ['The assistant runs as the signed-in person: retrieval is filtered by the same access rules before anything reaches the model.', 'Every finding stores links to its evidence (record, revision, page or photo). Findings stay “proposed” until an authorised person confirms or dismisses them.', 'The AI service account has read access only. It cannot record inspections, approve, sign off or close actions.', 'Prompts, sources used and outputs are logged to the audit history; customer data is not used to train models.']) +
      sec('Quality gates', ['The 12 permission tests shipped with this stage run in CI and block release on failure; Stage 2 adds API and row-level security tests for every role.', 'Accessibility (WCAG 2.2 AA), Arabic RTL and mobile checks in CI; penetration test before the first customer goes live.']) +
      '</div>';
  }

  // ---------------------------------------------------------------- render + events
  var wasDlg = false, wasMenu = false;
  function render() {
    applyEnv();
    var keepScroll = window.scrollY;
    root.innerHTML = S.userId ? renderApp() + (S.dialog ? window.RGSPages.renderDialog(user()) : '') : renderLogin();
    if (S.userId && S.dialog) window.RGSPages.afterDialogRender();
    if (keepScroll) window.scrollTo(0, keepScroll);
    // Motion plays once per arrival: a re-render from typing or a click inside an open dialog must not replay it.
    var dlgOpen = !!(S.userId && S.dialog), dlg = document.getElementById('dlg');
    if (dlgOpen && !wasDlg && dlg) { dlg.classList.add('dlg-enter'); var scrim = document.querySelector('.dlg-scrim'); if (scrim) scrim.classList.add('dlg-enter'); }
    wasDlg = dlgOpen;
    var menu = document.querySelector('.menu'); if (menu && !wasMenu) menu.classList.add('menu-enter'); wasMenu = !!menu;
    var view = document.getElementById('content'); if (S.enter && !S.loading && view) view.classList.add('enter'); S.enter = false;
    enhanceA11y();
    if (!S.userId) mountBadge3D();
  }
  function go(route, fromHistory) {
    route = String(route || 'home');
    if (!/^[A-Za-z0-9._~-]+$/.test(route)) route = 'home';
    var b = routeBase(route);
    if (!MODULE_BY[b] && !(window.RGSPages && window.RGSPages.handles(b))) route = 'home';
    S.dialog = null;
    S.route = route; S.navOpen = false; S.menuOpen = false; S.loading = true;
    // a new history entry per page, so the browser Back button walks the journey in reverse
    if (!fromHistory && location.hash.slice(1) !== route) { try { history.pushState(null, '', '#' + route); } catch (e) {} }
    render(); window.scrollTo(0, 0);
    clearTimeout(go.t); go.t = setTimeout(function () { S.loading = false; S.enter = true; render(); var c = document.getElementById('content'); if (c) c.focus({ preventScroll: true }); }, 320);
  }

  root.addEventListener('click', function (ev) {
    var pa = ev.target.closest('[data-pact]');
    if (pa && window.RGSPages.onAct(pa.getAttribute('data-pact'), pa, ev)) return;
    var r = ev.target.closest('[data-route]');
    if (r) { ev.preventDefault(); go(r.getAttribute('data-route')); return; }
    var el = ev.target.closest('[data-act]'); if (!el) { if (S.menuOpen && !ev.target.closest('.usermenu')) { S.menuOpen = false; render(); } return; }
    var act = el.getAttribute('data-act');
    if (act === 'lang') { S.lang = el.getAttribute('data-v'); save('lang', S.lang); S.menuOpen = false; render(); }
    else if (act === 'theme') { S.theme = { system: 'light', light: 'dark', dark: 'system' }[S.theme]; save('theme', S.theme); render(); }
    else if (act === 'menu') { S.menuOpen = !S.menuOpen; render(); }
    else if (act === 'opennav') { S.navOpen = true; render(); var f = document.querySelector('.nav a'); if (f) f.focus(); }
    else if (act === 'closenav') { S.navOpen = false; render(); }
    else if (act === 'resetdemo') { try { localStorage.removeItem(PKEY); } catch (e) {} location.hash = '#home'; location.reload(); }
    else if (act === 'signout') { S.dialog = null; S.userId = null; save('user', null); S.menuOpen = false; S.route = 'home'; S.login = { email: '', password: '', errors: {}, busy: false, note: '' }; try { history.replaceState(null, '', '#'); } catch (e) {} render(); }
    else if (act === 'togglepw') { var p = document.getElementById('password'); var show = p.type === 'password'; p.type = show ? 'text' : 'password'; el.setAttribute('aria-label', t(show ? 'login.hide' : 'login.show')); }
    else if (act === 'forgot') { S.login.note = t('login.forgot.msg'); render(); }
    else if (act === 'sso') { S.login.note = t('login.sso.msg'); render(); }
    else if (act === 'support') { toast(S.lang === 'ar' ? 'الدعم: support@rgs.example (عنوان نموذجي)' : 'Support: support@rgs.example (sample address)'); }
    else if (act === 'notify') { toast(S.lang === 'ar' ? 'تتوفر الإشعارات في المرحلة 4.' : 'Notifications arrive in Stage 4.'); }
    else if (act === 'toast') { toast(el.getAttribute('data-msg')); }
    else if (act === 'retry') { toast(S.lang === 'ar' ? 'محاكاة: أعيدت المحاولة.' : 'Simulated: retried.'); }
    else if (act === 'simload') { go('states'); }
  });
  root.addEventListener('submit', function (ev) {
    if (ev.target.id === 'login-form') { ev.preventDefault(); if (!S.login.busy) submitLogin(); return; }
    if (window.RGSPages.onSubmit(ev.target)) ev.preventDefault();
  });
  root.addEventListener('input', function (ev) { if (ev.target.hasAttribute('data-live')) window.RGSPages.onInput(ev.target); });
  root.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'persona') { var u = byId(D.users, el.value); S.login.email = u ? u.email : ''; S.login.password = u ? 'demo-password' : ''; S.login.errors = {}; render(); var b = document.querySelector('#login-form [type=submit]'); if (b && u) b.focus(); return; }
    if (el.id === 'scope') { S.project = el.value; render(); return; }
    if (window.RGSPages.onChange(el)) return;
    var bind = el.getAttribute('data-bind');
    if (bind) { var p = bind.split('.'); S[p[0]][p[1]] = el.type === 'checkbox' ? el.checked : el.value; render(); var again = document.getElementById(el.id); if (again) again.focus(); }
  });
  root.addEventListener('keydown', function (ev) {
    if (ev.target.id === 'q' && ev.key === 'Enter') { ev.preventDefault(); toast(t('top.searchsoon')); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (S.dialog) { window.RGSPages.closeDialog(); return; }
    if (S.menuOpen || S.navOpen) { S.menuOpen = false; S.navOpen = false; render(); }
  });
  function fromLocation() { var h = location.hash.slice(1) || 'home'; if (S.userId && h !== S.route) go(h, true); }
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);

  window.RGSUI = { S: S, ST: ST, D: D, A: A, API: API, CFG: CFG, FIXTURE: FIXTURE, navLabel: navLabel, MODULE_BY: MODULE_BY, t: t, esc: esc, ic: ic, L: L, fmtDate: fmtDate, toast: toast, user: user, org: org,
    go: go, render: render, actLabel: actLabel, loadingState: loadingState, emptyState: emptyState, errorState: errorState, deniedState: deniedState,
    byId: byId, SVC_IMG: SVC_IMG, initials: initials, canAny: canAny, moduleAllowed: moduleAllowed };
  var h0 = location.hash.slice(1);
  if (S.userId && h0 && /^[A-Za-z0-9._~-]+$/.test(h0) && (MODULE_BY[routeBase(h0)] || window.RGSPages.handles(routeBase(h0)))) S.route = h0;
  render();
  window.RGSApp = { state: S, go: go, render: render }; // exposed for automated tests
})();
