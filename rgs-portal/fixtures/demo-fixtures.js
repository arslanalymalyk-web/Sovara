/*
 * DEMO FIXTURES — invented records for prototype review only.
 *
 * Nothing in this file is an RGS, Global Construction or customer record.
 * Organisations, people, projects, documents, inspections, dates and
 * contact details are made up. The app loads this file only when
 * config.js sets dataSource: 'fixtures', and shows a permanent banner
 * while it is in use. A production build must not ship this file.
 *
 * Progress is NOT stored here. It is calculated by store.js from
 * milestone weights and completion records.
 */
(function (root) {
  'use strict';
  var F = {
    __fixture: true,
    label: 'Demo fixtures v6 (Stage 6)',
    now: '2026-10-13T09:00:00+03:00',

    orgs: [
      { id: 'org-rgs', kind: 'rgs', name: 'RGS', nameAr: 'آر جي إس' },
      { id: 'org-nb', kind: 'customer', name: 'Northbay Petrochemicals (fixture)', nameAr: 'نورث باي للبتروكيماويات (تجريبي)' },
      { id: 'org-wh', kind: 'customer', name: 'Al Waha Developments (fixture)', nameAr: 'الواحة للتطوير (تجريبي)' }
    ],

    projects: [
      { id: 'p1', code: 'PRJ-IND-0142', customerOrgId: 'org-nb', type: 'industrial', name: 'Unit 4 Turnaround', nameAr: 'صيانة الوحدة 4',
        location: 'Jubail', locationAr: 'الجبيل', status: 'execution', reportingDate: '2026-10-11', start: '2026-06-01', plannedCompletion: '2027-01-31',
        repId: 'u-pm', team: ['u-pm', 'u-so', 'u-ss', 'u-ss2', 'u-ss3', 'u-ss4', 'u-qa', 'u-hse', 'u-dc'], cover: 'assets/proj-refinery.jpg' },
      { id: 'p2', code: 'PRJ-INF-0087', customerOrgId: 'org-nb', type: 'infrastructure', name: 'Marine Jetty Pipe Rack', nameAr: 'حامل أنابيب الرصيف البحري',
        location: 'Ras Al-Khair', locationAr: 'رأس الخير', status: 'execution', reportingDate: '2026-10-11', start: '2026-08-15', plannedCompletion: '2027-03-31',
        repId: 'u-pm2', team: ['u-pm2', 'u-ss', 'u-ss3', 'u-qa', 'u-hse', 'u-dc'], cover: 'assets/proj-jetty.jpg' },
      { id: 'p3', code: 'PRJ-COM-0031', customerOrgId: 'org-wh', type: 'commercial', name: 'Business Park Tower B', nameAr: 'البرج ب – مجمع الأعمال',
        location: 'Riyadh', locationAr: 'الرياض', status: 'mobilising', reportingDate: '2026-10-04', start: '2026-10-01', plannedCompletion: '2027-05-30',
        repId: 'u-pm2', team: ['u-pm2', 'u-ss4', 'u-dc'], cover: 'assets/proj-commercial.jpg' },
      { id: 'p4', code: 'PRJ-RES-0019', customerOrgId: 'org-wh', type: 'residential', name: 'Garden Villas Phase 2', nameAr: 'فلل الحديقة – المرحلة 2',
        location: 'Dammam', locationAr: 'الدمام', status: 'handover', reportingDate: '2026-10-11', start: '2026-03-01', plannedCompletion: '2026-10-31',
        repId: 'u-om', team: ['u-om', 'u-ss4'], cover: 'assets/proj-residential.jpg' }
    ],

    // Site areas / assets. plan = schematic position on a 100 x 60 grid (not to scale).
    areas: [
      { id: 'a1', projectId: 'p1', kind: 'area', parentId: null, code: 'U4-TF', name: 'Tank farm', nameAr: 'منطقة الخزانات', plan: { x: 3, y: 5, w: 48, h: 32 } },
      { id: 'a6', projectId: 'p1', kind: 'asset', parentId: 'a1', code: 'T-104', name: 'Tank T-104', nameAr: 'الخزان T-104', plan: { x: 7, y: 12, w: 18, h: 21 } },
      { id: 'a7', projectId: 'p1', kind: 'asset', parentId: 'a1', code: 'T-105', name: 'Tank T-105', nameAr: 'الخزان T-105', plan: { x: 29, y: 12, w: 18, h: 21 } },
      { id: 'a2', projectId: 'p1', kind: 'asset', parentId: null, code: 'U4-PR-02', name: 'Pipe rack PR-02', nameAr: 'حامل الأنابيب PR-02', plan: { x: 57, y: 6, w: 39, h: 12 } },
      { id: 'a8', projectId: 'p1', kind: 'area', parentId: null, code: 'U4-BW-2', name: 'Bund wall B-2', nameAr: 'جدار الحوض B-2', plan: { x: 3, y: 43, w: 48, h: 12 } },
      { id: 'a3', projectId: 'p2', kind: 'area', parentId: null, code: 'JT-N', name: 'North jetty', nameAr: 'الرصيف الشمالي', plan: { x: 5, y: 8, w: 60, h: 18 } },
      { id: 'a9', projectId: 'p2', kind: 'asset', parentId: null, code: 'JPR-1', name: 'Jetty pipe rack JPR-1', nameAr: 'حامل أنابيب الرصيف JPR-1', plan: { x: 10, y: 34, w: 80, h: 12 } },
      { id: 'a4', projectId: 'p3', kind: 'area', parentId: null, code: 'TB-RF', name: 'Roof and podium', nameAr: 'السطح والمنصة', plan: { x: 10, y: 8, w: 55, h: 34 } },
      { id: 'a5', projectId: 'p4', kind: 'area', parentId: null, code: 'GV-B3', name: 'Block 3 basements', nameAr: 'قبو المبنى 3', plan: { x: 10, y: 10, w: 45, h: 32 } }
    ],

    // weight = share of planned effort within the project, set at baseline by RGS planning.
    packages: [
      { id: 'wp1', projectId: 'p1', areaId: 'a1', service: 'scaffolding', code: 'WP-P1-SCF-01', supervisorId: 'u-ss', weight: 15,
        scope: 'Access scaffolding around tanks T-104 and T-105 for insulation works.', scopeAr: 'سقالات وصول حول الخزانين T-104 وT-105 لأعمال العزل.' },
      { id: 'wp2', projectId: 'p1', areaId: 'a1', service: 'insulation', code: 'WP-P1-INS-02', supervisorId: 'u-ss2', weight: 35,
        scope: 'Shell insulation and cladding replacement on tanks T-104 and T-105.', scopeAr: 'استبدال عزل وتكسية جسم الخزانين T-104 وT-105.' },
      { id: 'wp3', projectId: 'p1', areaId: 'a2', service: 'fireproofing', code: 'WP-P1-FPR-03', supervisorId: 'u-ss3', weight: 25,
        scope: 'Passive fire protection to pipe rack PR-02 steel, zones A and B.', scopeAr: 'حماية سلبية من الحريق لهيكل حامل الأنابيب PR-02، المنطقتان A وB.' },
      { id: 'wp4', projectId: 'p1', areaId: 'a2', service: 'scaffolding', code: 'WP-P1-SCF-04', supervisorId: 'u-ss', weight: 10,
        scope: 'Access scaffolding to pipe rack PR-02 for fireproofing works.', scopeAr: 'سقالات وصول لحامل الأنابيب PR-02 لأعمال الحماية من الحريق.' },
      { id: 'wp9', projectId: 'p1', areaId: 'a8', service: 'waterproofing', code: 'WP-P1-WPR-05', supervisorId: 'u-ss4', weight: 15,
        scope: 'Membrane waterproofing to bund wall B-2 internal faces.', scopeAr: 'عزل مائي بالأغشية للأوجه الداخلية لجدار الحوض B-2.' },
      { id: 'wp5', projectId: 'p2', areaId: 'a3', service: 'scaffolding', code: 'WP-P2-SCF-01', supervisorId: 'u-ss', weight: 40,
        scope: 'Access scaffolding along the north jetty.', scopeAr: 'سقالات وصول على امتداد الرصيف الشمالي.' },
      { id: 'wp6', projectId: 'p2', areaId: 'a9', service: 'fireproofing', code: 'WP-P2-FPR-02', supervisorId: 'u-ss3', weight: 60,
        scope: 'Passive fire protection to jetty pipe rack JPR-1 supports.', scopeAr: 'حماية سلبية من الحريق لدعامات حامل أنابيب الرصيف JPR-1.' },
      { id: 'wp7', projectId: 'p3', areaId: 'a4', service: 'waterproofing', code: 'WP-P3-WPR-01', supervisorId: 'u-ss4', weight: 100,
        scope: 'Roof and podium waterproofing.', scopeAr: 'عزل مائي للسطح والمنصة.' },
      { id: 'wp8', projectId: 'p4', areaId: 'a5', service: 'waterproofing', code: 'WP-P4-WPR-01', supervisorId: 'u-ss4', weight: 100,
        scope: 'Basement waterproofing, Block 3.', scopeAr: 'عزل مائي لقبو المبنى 3.' }
    ],

    // Milestones: weight within the package; complete only when completedAt is set.
    milestones: [
      { id: 'm1', packageId: 'wp1', name: 'Mobilisation and access plan', nameAr: 'التجهيز وخطة الوصول', weight: 10, planned: '2026-08-20', forecast: '2026-08-20', completedAt: '2026-08-19' },
      { id: 'm2', packageId: 'wp1', name: 'Erection complete', nameAr: 'اكتمال التركيب', weight: 40, planned: '2026-09-10', forecast: '2026-09-10', completedAt: '2026-09-11' },
      { id: 'm3', packageId: 'wp1', name: 'Inspected and tagged', nameAr: 'الفحص ووضع البطاقات', weight: 30, planned: '2026-09-12', forecast: '2026-09-12', completedAt: '2026-09-12' },
      { id: 'm4', packageId: 'wp1', name: 'Dismantled and area cleared', nameAr: 'الفك وتسليم المنطقة', weight: 20, planned: '2026-11-20', forecast: '2026-11-20', completedAt: null },
      { id: 'm5', packageId: 'wp2', name: 'Surface preparation released', nameAr: 'اعتماد تجهيز الأسطح', weight: 15, planned: '2026-09-15', forecast: '2026-09-15', completedAt: '2026-09-16' },
      { id: 'm6', packageId: 'wp2', name: 'T-104 insulation and cladding installed', nameAr: 'تركيب عزل وتكسية T-104', weight: 35, planned: '2026-10-08', forecast: '2026-10-08', completedAt: '2026-10-09' },
      { id: 'm7', packageId: 'wp2', name: 'T-105 insulation and cladding installed', nameAr: 'تركيب عزل وتكسية T-105', weight: 35, planned: '2026-10-25', forecast: '2026-10-25', completedAt: null },
      { id: 'm8', packageId: 'wp2', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 15, planned: '2026-11-05', forecast: '2026-11-05', completedAt: null },
      { id: 'm9', packageId: 'wp3', name: 'Steel surfaces released', nameAr: 'اعتماد أسطح الحديد', weight: 10, planned: '2026-10-10', forecast: '2026-10-11', completedAt: '2026-10-11' },
      { id: 'm10', packageId: 'wp3', name: 'Zone A applied', nameAr: 'التطبيق في المنطقة A', weight: 40, planned: '2026-10-28', forecast: '2026-11-04', completedAt: null },
      { id: 'm11', packageId: 'wp3', name: 'Zone B applied', nameAr: 'التطبيق في المنطقة B', weight: 35, planned: '2026-11-20', forecast: '2026-11-27', completedAt: null },
      { id: 'm12', packageId: 'wp3', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 15, planned: '2026-12-05', forecast: '2026-12-10', completedAt: null },
      { id: 'm13', packageId: 'wp4', name: 'Mobilisation and access plan', nameAr: 'التجهيز وخطة الوصول', weight: 10, planned: '2026-09-25', forecast: '2026-09-25', completedAt: '2026-09-24' },
      { id: 'm14', packageId: 'wp4', name: 'Erection complete', nameAr: 'اكتمال التركيب', weight: 50, planned: '2026-10-08', forecast: '2026-10-08', completedAt: '2026-10-08' },
      { id: 'm15', packageId: 'wp4', name: 'Inspected and tagged', nameAr: 'الفحص ووضع البطاقات', weight: 20, planned: '2026-10-10', forecast: '2026-10-10', completedAt: '2026-10-10' },
      { id: 'm16', packageId: 'wp4', name: 'Handed over for use', nameAr: 'التسليم للاستخدام', weight: 20, planned: '2026-10-14', forecast: '2026-10-17', completedAt: null },
      { id: 'm17', packageId: 'wp9', name: 'Substrate released', nameAr: 'اعتماد السطح الأساسي', weight: 20, planned: '2026-09-28', forecast: '2026-10-03', completedAt: '2026-10-03' },
      { id: 'm18', packageId: 'wp9', name: 'Membrane installed', nameAr: 'تركيب الغشاء', weight: 50, planned: '2026-10-30', forecast: '2026-10-30', completedAt: null },
      { id: 'm19', packageId: 'wp9', name: 'Protection layer installed', nameAr: 'تركيب طبقة الحماية', weight: 15, planned: '2026-11-10', forecast: '2026-11-10', completedAt: null },
      { id: 'm20', packageId: 'wp9', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 15, planned: '2026-11-18', forecast: '2026-11-18', completedAt: null },
      { id: 'm21', packageId: 'wp5', name: 'Mobilisation and access plan', nameAr: 'التجهيز وخطة الوصول', weight: 10, planned: '2026-09-01', forecast: '2026-09-01', completedAt: '2026-09-02' },
      { id: 'm22', packageId: 'wp5', name: 'Erection complete', nameAr: 'اكتمال التركيب', weight: 50, planned: '2026-10-08', forecast: '2026-10-20', completedAt: null },
      { id: 'm23', packageId: 'wp5', name: 'Inspected and tagged', nameAr: 'الفحص ووضع البطاقات', weight: 20, planned: '2026-10-12', forecast: '2026-10-22', completedAt: null },
      { id: 'm24', packageId: 'wp5', name: 'Dismantled and area cleared', nameAr: 'الفك وتسليم المنطقة', weight: 20, planned: '2027-03-10', forecast: '2027-03-10', completedAt: null },
      { id: 'm25', packageId: 'wp6', name: 'Steel surfaces released', nameAr: 'اعتماد أسطح الحديد', weight: 10, planned: '2026-10-30', forecast: '2026-10-30', completedAt: null },
      { id: 'm26', packageId: 'wp6', name: 'Application complete', nameAr: 'اكتمال التطبيق', weight: 75, planned: '2027-02-15', forecast: '2027-02-15', completedAt: null },
      { id: 'm27', packageId: 'wp6', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 15, planned: '2027-03-01', forecast: '2027-03-01', completedAt: null },
      { id: 'm28', packageId: 'wp7', name: 'Mobilisation', nameAr: 'التجهيز', weight: 10, planned: '2026-10-20', forecast: '2026-10-20', completedAt: null },
      { id: 'm29', packageId: 'wp7', name: 'Membrane installed', nameAr: 'تركيب الغشاء', weight: 60, planned: '2027-03-15', forecast: '2027-03-15', completedAt: null },
      { id: 'm30', packageId: 'wp7', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 30, planned: '2027-05-01', forecast: '2027-05-01', completedAt: null },
      { id: 'm31', packageId: 'wp8', name: 'Substrate released', nameAr: 'اعتماد السطح الأساسي', weight: 15, planned: '2026-04-10', forecast: '2026-04-10', completedAt: '2026-04-12' },
      { id: 'm32', packageId: 'wp8', name: 'Membrane installed', nameAr: 'تركيب الغشاء', weight: 55, planned: '2026-08-30', forecast: '2026-08-30', completedAt: '2026-08-28' },
      { id: 'm33', packageId: 'wp8', name: 'Final inspection and records issued', nameAr: 'الفحص النهائي وإصدار السجلات', weight: 15, planned: '2026-10-05', forecast: '2026-10-05', completedAt: '2026-10-06' },
      { id: 'm34', packageId: 'wp8', name: 'Handover accepted by customer', nameAr: 'قبول العميل للتسليم', weight: 15, planned: '2026-10-20', forecast: '2026-10-20', completedAt: null }
    ],

    // Service-specific scope registers. Statuses are factual states, not acceptance criteria.
    register: [
      { id: 'sr1', packageId: 'wp1', ref: 'SCF-TF-001', location: 'T-104 north elevation', locationAr: 'الواجهة الشمالية T-104', purpose: 'Shell insulation access', status: 'in_use' },
      { id: 'sr2', packageId: 'wp1', ref: 'SCF-TF-002', location: 'T-104 south elevation', locationAr: 'الواجهة الجنوبية T-104', purpose: 'Shell insulation access', status: 'in_use' },
      { id: 'sr3', packageId: 'wp1', ref: 'SCF-TF-003', location: 'T-105 full height', locationAr: 'كامل ارتفاع T-105', purpose: 'Shell insulation access', status: 'in_use' },
      { id: 'sr4', packageId: 'wp4', ref: 'SCF-PR-001', location: 'PR-02 zone A, levels 1–2', locationAr: 'PR-02 المنطقة A، المستويان 1–2', purpose: 'Fireproofing access', status: 'erected' },
      { id: 'sr5', packageId: 'wp4', ref: 'SCF-PR-002', location: 'PR-02 zone B, levels 1–2', locationAr: 'PR-02 المنطقة B، المستويان 1–2', purpose: 'Fireproofing access', status: 'erected' },
      { id: 'sr6', packageId: 'wp2', ref: 'T-104-SHELL', location: 'T-104 shell, courses 1–6', locationAr: 'جسم T-104، الحلقات 1–6', purpose: 'System per approved specification', status: 'installed' },
      { id: 'sr7', packageId: 'wp2', ref: 'T-105-SHELL', location: 'T-105 shell, courses 1–6', locationAr: 'جسم T-105، الحلقات 1–6', purpose: 'System per approved specification', status: 'in_progress' },
      { id: 'sr8', packageId: 'wp3', ref: 'PR02-ZA', location: 'Zone A columns and beams', locationAr: 'أعمدة وجسور المنطقة A', purpose: 'System per approved specification', status: 'released' },
      { id: 'sr9', packageId: 'wp3', ref: 'PR02-ZB', location: 'Zone B columns and beams', locationAr: 'أعمدة وجسور المنطقة B', purpose: 'System per approved specification', status: 'not_started' },
      { id: 'sr10', packageId: 'wp9', ref: 'BW2-INT', location: 'Bund wall B-2 internal faces', locationAr: 'الأوجه الداخلية لجدار B-2', purpose: 'System per approved specification', status: 'released' },
      { id: 'sr11', packageId: 'wp5', ref: 'SCF-JT-001', location: 'North jetty bays 1–8', locationAr: 'الرصيف الشمالي الخلايا 1–8', purpose: 'Survey and maintenance access', status: 'in_progress' },
      { id: 'sr12', packageId: 'wp6', ref: 'JPR1-SUP', location: 'JPR-1 supports', locationAr: 'دعامات JPR-1', purpose: 'System per approved specification', status: 'not_started' },
      { id: 'sr13', packageId: 'wp7', ref: 'TB-ROOF', location: 'Main roof', locationAr: 'السطح الرئيسي', purpose: 'System per approved specification', status: 'not_started' },
      { id: 'sr14', packageId: 'wp8', ref: 'B3-BASE', location: 'Block 3 basement walls and slab', locationAr: 'جدران وأرضية قبو المبنى 3', purpose: 'System per approved specification', status: 'installed' }
    ],

    // Documents. customerVisible=false or status 'draft' never reaches customer views.
    documents: [
      { id: 'd1', number: 'SPEC-P1-INS-001', title: 'Insulation specification (customer-issued)', type: 'specification', projectId: 'p1', packageIds: ['wp2'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-05-20', status: 'approved', by: 'org-nb', note: 'Issued by customer' }, { rev: '2', date: '2026-08-02', status: 'approved', by: 'org-nb', note: 'Customer revision' }] },
      { id: 'd7', number: 'SPEC-P1-FPR-001', title: 'Fireproofing specification (customer-issued)', type: 'specification', projectId: 'p1', packageIds: ['wp3'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-06-10', status: 'approved', by: 'org-nb', note: 'Issued by customer' }] },
      { id: 'd8', number: 'SPEC-P1-SCF-001', title: 'Scaffolding design basis (customer-issued)', type: 'specification', projectId: 'p1', packageIds: ['wp1', 'wp4'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-06-02', status: 'approved', by: 'org-nb', note: 'Issued by customer' }] },
      { id: 'd9', number: 'SPEC-P1-WPR-001', title: 'Waterproofing specification (customer-issued)', type: 'specification', projectId: 'p1', packageIds: ['wp9'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-07-01', status: 'approved', by: 'org-nb', note: 'Issued by customer' }] },
      { id: 'd2', number: 'MS-P1-INS-002', title: 'Method statement – tank insulation', type: 'method_statement', projectId: 'p1', packageIds: ['wp2'], status: 'approved', customerVisible: true, source: 'rgs',
        revisions: [{ rev: 'A', date: '2026-08-20', status: 'returned', by: 'u-pm', note: 'Returned by customer with comments' }, { rev: 'B', date: '2026-09-02', status: 'approved', by: 'u-pm', note: 'Approved by customer' }] },
      { id: 'd3', number: 'ITP-P1-INS-003', title: 'Inspection and test plan – tank insulation', type: 'itp', projectId: 'p1', packageIds: ['wp2'], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-10-10', status: 'issued', by: 'u-dc', note: 'Issued for information' }] },
      { id: 'd10', number: 'DRW-P1-SCF-011', title: 'Scaffold arrangement drawing – tank farm', type: 'drawing', projectId: 'p1', packageIds: ['wp1'], status: 'approved', customerVisible: true, source: 'rgs',
        revisions: [{ rev: 'A', date: '2026-08-05', status: 'superseded', by: 'u-dc', note: 'First issue' }, { rev: 'B', date: '2026-08-12', status: 'superseded', by: 'u-dc', note: 'T-105 platform added' }, { rev: 'C', date: '2026-08-18', status: 'approved', by: 'u-dc', note: 'Approved' }] },
      { id: 'd6', number: 'HO-P1-SCF-04', title: 'Scaffold handover record – pipe rack PR-02', type: 'handover_record', projectId: 'p1', packageIds: ['wp4'], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-10-11', status: 'issued', by: 'u-pm', note: 'Issued for customer acceptance' }] },
      { id: 'd4', number: 'RPT-P1-0009', title: 'Monthly progress report – September 2026', type: 'report', projectId: 'p1', packageIds: [], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-10-05', status: 'issued', by: 'u-pm', note: 'Issued' }] },
      { id: 'd5', number: 'RPT-P1-0008', title: 'Monthly progress report – August 2026', type: 'report', projectId: 'p1', packageIds: [], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-09-04', status: 'issued', by: 'u-pm', note: 'Issued' }] },
      { id: 'd11', number: 'MS-P1-FPR-002', title: 'Method statement – fireproofing PR-02 (draft)', type: 'method_statement', projectId: 'p1', packageIds: ['wp3'], status: 'draft', customerVisible: false, source: 'rgs',
        revisions: [{ rev: 'P1', date: '2026-10-12', status: 'draft', by: 'u-pm', note: 'Internal draft' }] },
      { id: 'd20', number: 'SPEC-P2-FPR-001', title: 'Fireproofing specification (customer-issued)', type: 'specification', projectId: 'p2', packageIds: ['wp6'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-08-01', status: 'approved', by: 'org-nb', note: 'Issued by customer' }] },
      { id: 'd22', number: 'SPEC-P2-SCF-001', title: 'Scaffolding design basis (customer-issued)', type: 'specification', projectId: 'p2', packageIds: ['wp5'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-08-01', status: 'approved', by: 'org-nb', note: 'Issued by customer' }] },
      { id: 'd21', number: 'RPT-P2-0004', title: 'Monthly progress report – September 2026', type: 'report', projectId: 'p2', packageIds: [], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-10-06', status: 'issued', by: 'u-pm2', note: 'Issued' }] },
      { id: 'd30', number: 'SPEC-P3-WPR-001', title: 'Waterproofing specification (customer-issued)', type: 'specification', projectId: 'p3', packageIds: ['wp7'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-09-15', status: 'approved', by: 'org-wh', note: 'Issued by customer' }] },
      { id: 'd40', number: 'SPEC-P4-WPR-001', title: 'Waterproofing specification (customer-issued)', type: 'specification', projectId: 'p4', packageIds: ['wp8'], status: 'approved', customerVisible: true, source: 'customer',
        revisions: [{ rev: '1', date: '2026-02-20', status: 'approved', by: 'org-wh', note: 'Issued by customer' }] },
      { id: 'd41', number: 'HO-P4-WPR-01', title: 'Waterproofing handover record – Block 3', type: 'handover_record', projectId: 'p4', packageIds: ['wp8'], status: 'issued', customerVisible: true, source: 'rgs',
        revisions: [{ rev: '0', date: '2026-10-06', status: 'issued', by: 'u-om', note: 'Issued for customer acceptance' }] }
    ],

    // Inspections. result: accepted | observations | rejected | null (scheduled). Criteria live in the linked ITP / specification.
    inspections: [
      { id: 'i1', ref: 'INS-P1-0009', packageId: 'wp1', areaId: 'a1', title: 'Scaffold inspection after erection – tank farm', planned: '2026-09-12', performed: '2026-09-12', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-09-12', authority: 'DA-0305' }, customerSignoffRequired: false, basisDocId: 'd8' },
      { id: 'i3', ref: 'INS-P1-0013', packageId: 'wp2', areaId: 'a6', title: 'ITP surveillance – T-104 cladding', planned: '2026-10-07', performed: '2026-10-07', inspectorId: 'u-qa', result: 'observations', rgsSignoff: { by: 'u-qa', at: '2026-10-07', authority: 'DA-0301' }, customerSignoffRequired: false, basisDocId: 'd3' },
      { id: 'i2', ref: 'INS-P1-0012', packageId: 'wp2', areaId: 'a6', title: 'ITP hold point – T-104 insulation', planned: '2026-10-09', performed: '2026-10-09', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-10-09', authority: 'DA-0301' }, customerSignoffRequired: true, basisDocId: 'd3' },
      { id: 'i4', ref: 'INS-P1-0014', packageId: 'wp4', areaId: 'a2', title: 'Scaffold inspection before handover – PR-02', planned: '2026-10-10', performed: '2026-10-10', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-10-10', authority: 'DA-0305' }, customerSignoffRequired: false, basisDocId: 'd8' },
      { id: 'i5', ref: 'INS-P1-0015', packageId: 'wp3', areaId: 'a2', title: 'Surface release inspection – PR-02 zone A', planned: '2026-10-11', performed: '2026-10-11', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-10-11', authority: 'DA-0302' }, customerSignoffRequired: true, basisDocId: 'd7' },
      { id: 'i6', ref: 'INS-P1-0016', packageId: 'wp2', areaId: 'a7', title: 'ITP hold point – T-105 insulation', planned: '2026-10-21', performed: null, inspectorId: 'u-qa', result: null, rgsSignoff: null, customerSignoffRequired: true, basisDocId: 'd3' },
      { id: 'i7', ref: 'INS-P1-0010', packageId: 'wp9', areaId: 'a8', title: 'Substrate release – bund wall B-2', planned: '2026-09-28', performed: '2026-09-28', inspectorId: 'u-qa', result: 'rejected', rgsSignoff: { by: 'u-qa', at: '2026-09-28', authority: 'DA-0306' }, customerSignoffRequired: false, basisDocId: 'd9' },
      { id: 'i8', ref: 'INS-P1-0011', packageId: 'wp9', areaId: 'a8', title: 'Substrate re-inspection – bund wall B-2', planned: '2026-10-03', performed: '2026-10-03', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-10-03', authority: 'DA-0306' }, customerSignoffRequired: false, basisDocId: 'd9' },
      { id: 'i20', ref: 'INS-P2-0003', packageId: 'wp5', areaId: 'a3', title: 'Scaffold inspection – jetty bays 1–4', planned: '2026-09-30', performed: '2026-09-30', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: null, customerSignoffRequired: false, basisDocId: 'd22' },
      { id: 'i21', ref: 'INS-P2-0004', packageId: 'wp6', areaId: 'a9', title: 'Surface release inspection – JPR-1', planned: '2026-10-28', performed: null, inspectorId: 'u-qa', result: null, rgsSignoff: null, customerSignoffRequired: true, basisDocId: 'd20' },
      { id: 'i40', ref: 'INS-P4-0007', packageId: 'wp8', areaId: 'a5', title: 'Final inspection – Block 3 basement', planned: '2026-10-02', performed: '2026-10-02', inspectorId: 'u-qa', result: 'accepted', rgsSignoff: { by: 'u-qa', at: '2026-10-02', authority: 'DA-0307' }, customerSignoffRequired: false, basisDocId: 'd40' }
    ],

    correctiveActions: [
      { id: 'ca1', ref: 'CA-P1-021', packageId: 'wp2', areaId: 'a6', title: 'Cladding overlap gaps at T-104 north seam', sourceInspectionId: 'i3', raisedBy: 'u-qa', raisedAt: '2026-10-07', ownerId: 'u-ss2', due: '2026-10-15', status: 'in_progress', closedAt: null, verifiedBy: null },
      { id: 'ca2', ref: 'CA-P1-019', packageId: 'wp9', areaId: 'a8', title: 'Substrate not ready for membrane at B-2 east end', sourceInspectionId: 'i7', raisedBy: 'u-qa', raisedAt: '2026-09-28', ownerId: 'u-ss4', due: '2026-10-02', status: 'closed', closedAt: '2026-10-03', verifiedBy: 'u-qa' },
      { id: 'ca3', ref: 'CA-P1-022', packageId: 'wp1', areaId: 'a1', title: 'Toe board missing on SCF-TF-002 level 3', sourceInspectionId: null, raisedBy: 'u-hse', raisedAt: '2026-10-12', ownerId: 'u-ss', due: '2026-10-14', status: 'awaiting_verification', closedAt: null, verifiedBy: null },
      { id: 'ca20', ref: 'CA-P2-005', packageId: 'wp5', areaId: 'a3', title: 'Ladder access gate missing at bay 3', sourceInspectionId: 'i20', raisedBy: 'u-qa', raisedAt: '2026-09-30', ownerId: 'u-ss', due: '2026-10-10', status: 'in_progress', closedAt: null, verifiedBy: null }
    ],

    // Requests (Stage 3 shape). status: draft | submitted | clarification_requested | in_review | completion_submitted |
    // resolved | closed | cancelled | superseded | withdrawn. Conversation is customer-visible; internal notes live in requestNotes.
    requests: [
      { id: 'r1', ref: 'CR-P1-014', projectId: 'p1', packageId: 'wp2', areaId: 'a7', type: 'info', priority: 'normal', subject: 'Confirm access window for T-105 insulation',
        description: 'Please confirm when insulation access at T-105 starts so we can plan the area permit.', raisedBy: 'u-cr', raisedAt: '2026-10-06T08:30', status: 'resolved', triaged: true,
        ownerId: 'u-pm', verifierId: null, verificationRequired: false, responseDue: '2026-10-09', neededBy: '2026-10-10', instructionId: null, version: 4,
        messages: [{ id: 'm-r1-1', at: '2026-10-06T08:30', by: 'u-cr', text: 'Please confirm when insulation access at T-105 starts so we can plan the area permit.' },
                   { id: 'm-r1-2', at: '2026-10-09T11:45', by: 'u-pm', text: 'Access planned 14–25 Oct, day shift. Permit request submitted.' }],
        revisions: [{ rev: 1, at: '2026-10-06T08:30', by: 'u-cr', subject: 'Confirm access window for T-105 insulation', description: 'Please confirm when insulation access at T-105 starts so we can plan the area permit.', reason: 'Submitted' }],
        resolution: { at: '2026-10-09T11:45', by: 'u-pm', summary: 'Access planned 14–25 Oct, day shift. Permit request submitted.' }, completion: null, verification: null, acknowledgement: null,
        attachments: [], linkedDocs: [], related: [], duplicateReview: { outcome: 'none' }, escalations: [] },
      { id: 'r2', ref: 'CR-P1-016', projectId: 'p1', packageId: 'wp2', areaId: 'a6', type: 'document', priority: 'normal', subject: 'Additional photos of T-104 north seam repair',
        description: 'Please share close-up photos of the north seam after the cladding repair, before and after.', raisedBy: 'u-cr', raisedAt: '2026-10-10T09:30', status: 'submitted', triaged: false,
        ownerId: null, verifierId: null, verificationRequired: false, responseDue: null, neededBy: '2026-10-17', instructionId: null, version: 1,
        messages: [{ id: 'm-r2-1', at: '2026-10-10T09:30', by: 'u-cr', text: 'Please share close-up photos of the north seam after the cladding repair, before and after.' }],
        revisions: [{ rev: 1, at: '2026-10-10T09:30', by: 'u-cr', subject: 'Additional photos of T-104 north seam repair', description: 'Please share close-up photos of the north seam after the cladding repair, before and after.', reason: 'Submitted' }],
        resolution: null, completion: null, verification: null, acknowledgement: null,
        attachments: [], linkedDocs: [{ id: 'd3', rev: '0' }], related: [], duplicateReview: { outcome: 'none' }, escalations: [] },
      { id: 'r3', ref: 'CR-P1-011', projectId: 'p1', packageId: 'wp9', areaId: 'a8', type: 'info', priority: 'high', subject: 'Clarify bund wall programme after substrate rejection',
        description: 'The substrate was rejected on 28 Sep. What is the new membrane start date?', raisedBy: 'u-ca', raisedAt: '2026-09-29T10:00', status: 'closed', triaged: true,
        ownerId: 'u-pm', verifierId: null, verificationRequired: false, responseDue: '2026-10-01', neededBy: null, instructionId: null, version: 5,
        messages: [{ id: 'm-r3-1', at: '2026-09-29T10:00', by: 'u-ca', text: 'The substrate was rejected on 28 Sep. What is the new membrane start date?' },
                   { id: 'm-r3-2', at: '2026-10-01T09:20', by: 'u-pm', text: 'Re-inspection booked for 3 Oct; membrane start follows release.' }],
        revisions: [{ rev: 1, at: '2026-09-29T10:00', by: 'u-ca', subject: 'Clarify bund wall programme after substrate rejection', description: 'The substrate was rejected on 28 Sep. What is the new membrane start date?', reason: 'Submitted' }],
        resolution: { at: '2026-10-01T09:20', by: 'u-pm', summary: 'Re-inspection booked for 3 Oct; membrane start follows release.' }, completion: null, verification: null,
        acknowledgement: { at: '2026-10-02T08:00', by: 'u-ca' }, attachments: [], linkedDocs: [], related: [], duplicateReview: { outcome: 'none' }, escalations: [] },
      { id: 'r4', ref: 'CR-P1-018', projectId: 'p1', packageId: 'wp1', areaId: 'a7', type: 'scope_change', priority: 'normal', subject: 'Additional platform at T-105 nozzle N4',
        description: 'Our inspection team needs access to nozzle N4 on T-105. Please add a working platform at that level.', raisedBy: 'u-cr', raisedAt: '2026-10-07T13:00', status: 'in_review', triaged: true,
        ownerId: 'u-pm', verifierId: 'u-qa', verificationRequired: true, responseDue: '2026-10-16', neededBy: '2026-10-24', instructionId: 'ch3', version: 3,
        messages: [{ id: 'm-r4-1', at: '2026-10-07T13:00', by: 'u-cr', text: 'Our inspection team needs access to nozzle N4 on T-105. Please add a working platform at that level.' },
                   { id: 'm-r4-2', at: '2026-10-08T09:10', by: 'u-pm', text: 'We are preparing a controlled instruction for the extra platform. You will be asked to approve it before any work starts.' }],
        revisions: [{ rev: 1, at: '2026-10-07T13:00', by: 'u-cr', subject: 'Additional platform at T-105 nozzle N4', description: 'Our inspection team needs access to nozzle N4 on T-105. Please add a working platform at that level.', reason: 'Submitted' }],
        resolution: null, completion: null, verification: null, acknowledgement: null,
        attachments: [], linkedDocs: [{ id: 'd10', rev: 'C' }], related: [], duplicateReview: { outcome: 'none' }, escalations: [] },
      { id: 'r5', ref: 'CR-P1-019', projectId: 'p1', packageId: 'wp2', areaId: 'a6', type: 'site_issue', priority: 'high', subject: 'Loose cladding sheet on T-104 north side',
        description: 'A cladding sheet on the north side of T-104 is loose and moving in the wind near the top course.', raisedBy: 'u-ca', raisedAt: '2026-10-11T14:00', status: 'completion_submitted', triaged: true,
        ownerId: 'u-ss2', verifierId: 'u-qa', verificationRequired: true, responseDue: '2026-10-13', neededBy: null, instructionId: null, version: 4,
        messages: [{ id: 'm-r5-1', at: '2026-10-11T14:00', by: 'u-ca', text: 'A cladding sheet on the north side of T-104 is loose and moving in the wind near the top course.' },
                   { id: 'm-r5-2', at: '2026-10-12T16:00', by: 'u-ss2', text: 'Sheet refixed with additional rivets. Waiting for QA/QC verification before we close this.' }],
        revisions: [{ rev: 1, at: '2026-10-11T14:00', by: 'u-ca', subject: 'Loose cladding sheet on T-104 north side', description: 'A cladding sheet on the north side of T-104 is loose and moving in the wind near the top course.', reason: 'Submitted' }],
        resolution: null, completion: { at: '2026-10-12T16:00', by: 'u-ss2', summary: 'Sheet refixed with additional rivets on courses 5–6.', attachments: [] }, verification: null, acknowledgement: null,
        attachments: [], linkedDocs: [], related: [{ id: 'r2', relation: 'possible_duplicate', by: 'u-ca', at: '2026-10-11T14:00' }],
        duplicateReview: { outcome: 'continued', reason: 'This is a loose sheet, not the seam gap photos asked for in CR-P1-016.', candidates: ['r2'], by: 'u-ca', at: '2026-10-11T14:00' }, escalations: [] },
      { id: 'r20', ref: 'CR-P2-003', projectId: 'p2', packageId: 'wp5', areaId: 'a3', type: 'info', priority: 'normal', subject: 'Scaffold access for jetty survey team',
        description: 'Our survey team needs scaffold access to bays 5–8 on 21 Oct. Can this be arranged?', raisedBy: 'u-cr', raisedAt: '2026-10-08T09:10', status: 'in_review', triaged: true,
        ownerId: 'u-pm2', verifierId: null, verificationRequired: false, responseDue: '2026-10-15', neededBy: '2026-10-21', instructionId: null, version: 2,
        messages: [{ id: 'm-r20-1', at: '2026-10-08T09:10', by: 'u-cr', text: 'Our survey team needs scaffold access to bays 5–8 on 21 Oct. Can this be arranged?' }],
        revisions: [{ rev: 1, at: '2026-10-08T09:10', by: 'u-cr', subject: 'Scaffold access for jetty survey team', description: 'Our survey team needs scaffold access to bays 5–8 on 21 Oct. Can this be arranged?', reason: 'Submitted' }],
        resolution: null, completion: null, verification: null, acknowledgement: null, attachments: [], linkedDocs: [], related: [], duplicateReview: { outcome: 'none' }, escalations: [] }
    ],
    // INTERNAL notes. Never rendered, searched, notified or sent to AI for customer users.
    requestNotes: [
      { id: 'n1', requestId: 'r2', at: '2026-10-10T12:00', by: 'u-pm', text: 'Hold the photos until CA-P1-021 rework is complete; replacement sheets delayed by the supplier.', attachments: [] },
      { id: 'n2', requestId: 'r5', at: '2026-10-12T16:05', by: 'u-ss2', text: 'Probable wind damage. Check adjacent sheets on courses 4–6 during T-105 works.', attachments: [] },
      { id: 'n3', requestId: 'r4', at: '2026-10-08T09:00', by: 'u-pm', text: 'Platform adds about 2 days of crew time; confirm with ops before pricing discussion.', attachments: [] }
    ],

    // Controlled instructions (lifecycle proposed for RGS review):
    // draft → under_review → awaiting_approval → authorised → in_progress → ready_for_verification → closed; rejected | cancelled | superseded.
    // approvalRev = revision that decisions bind to; a material revision moves it and makes earlier decisions outdated.
    changes: [
      { id: 'ch1', ref: 'CH-P1-004', sharedWithCustomer: true, projectId: 'p1', packageIds: ['wp3', 'wp4'], areaIds: ['a2'], requestId: null, title: 'Resequence PR-02 fireproofing to follow scaffold modification',
        state: 'awaiting_approval', rev: 1, approvalRev: 1, version: 4, issuerId: 'u-pm', requiresCustomerApproval: true, approvalDue: '2026-10-15', raisedAt: '2026-10-06T10:00',
        scope: 'Modify scaffold SCF-PR-001 for steel clearance, then start zone A fireproofing.', summary: 'Zone A application starts after scaffold SCF-PR-001 is modified for clearance. Forecast start moves from 14 Oct to 21 Oct.',
        dependencies: ['Scaffold SCF-PR-001 modified for clearance (WP-P1-SCF-04)'], scheduleImpact: { days: 7, note: 'Zone A start 14 Oct → 21 Oct' }, docRefs: [{ id: 'd7', rev: '1' }, { id: 'd8', rev: '1' }],
        revisions: [
          { rev: 0, at: '2026-10-06T10:00', by: 'u-pm', material: true, reason: 'Initial issue', scope: 'Modify scaffold SCF-PR-001 for steel clearance, then start zone A fireproofing.', scheduleImpact: { days: 5, note: 'Zone A start 14 Oct → 19 Oct' }, areaIds: ['a2'], dependencies: ['Scaffold SCF-PR-001 modified for clearance (WP-P1-SCF-04)'] },
          { rev: 1, at: '2026-10-08T13:50', by: 'u-pm', material: true, reason: 'Scaffold survey added two days to the modification', scope: 'Modify scaffold SCF-PR-001 for steel clearance, then start zone A fireproofing.', scheduleImpact: { days: 7, note: 'Zone A start 14 Oct → 21 Oct' }, areaIds: ['a2'], dependencies: ['Scaffold SCF-PR-001 modified for clearance (WP-P1-SCF-04)'] }],
        decisions: [
          { id: 'dc1', type: 'internal_review', rev: 0, outcome: 'approve', by: 'u-om', at: '2026-10-06T15:00', reason: '', status: 'outdated' },
          { id: 'dc2', type: 'internal_review', rev: 1, outcome: 'approve', by: 'u-om', at: '2026-10-08T14:00', reason: 'Two extra days accepted.', status: 'valid' }],
        completion: null, supersededBy: null, supersedes: null, cancelReason: null },
      { id: 'ch2', ref: 'CH-P1-002', sharedWithCustomer: true, projectId: 'p1', packageIds: ['wp1'], areaIds: ['a7'], requestId: null, title: 'Add platform at T-105 for nozzle access',
        state: 'closed', rev: 0, approvalRev: 0, version: 9, issuerId: 'u-pm', requiresCustomerApproval: true, approvalDue: '2026-08-17', raisedAt: '2026-08-10T09:00',
        scope: 'Additional platform added to the tank farm scaffold arrangement (drawing Rev B).', summary: 'Additional platform added to the tank farm scaffold arrangement (drawing Rev B).',
        dependencies: [], scheduleImpact: { days: 0, note: 'No programme impact' }, docRefs: [{ id: 'd10', rev: 'B' }],
        revisions: [{ rev: 0, at: '2026-08-10T09:00', by: 'u-pm', material: true, reason: 'Initial issue', scope: 'Additional platform added to the tank farm scaffold arrangement (drawing Rev B).', scheduleImpact: { days: 0, note: 'No programme impact' }, areaIds: ['a7'], dependencies: [] }],
        decisions: [
          { id: 'dc3', type: 'internal_review', rev: 0, outcome: 'approve', by: 'u-om', at: '2026-08-11T10:00', reason: '', status: 'valid' },
          { id: 'dc4', type: 'customer_approval', rev: 0, outcome: 'approve', by: 'u-ca', at: '2026-08-14T11:00', reason: '', authority: 'DA-0101', status: 'valid' },
          { id: 'dc5', type: 'execution_authorisation', rev: 0, outcome: 'approve', by: 'u-om', at: '2026-08-15T08:00', reason: '', authority: 'DA-0501', status: 'valid' },
          { id: 'dc6', type: 'technical_signoff', rev: 0, outcome: 'approve', by: 'u-qa', at: '2026-09-12T12:00', reason: '', authority: 'DA-0305', status: 'valid' },
          { id: 'dc7', type: 'completion_acceptance', rev: 0, outcome: 'approve', by: 'u-ca', at: '2026-09-14T09:00', reason: '', authority: 'DA-0102', status: 'valid' }],
        completion: { at: '2026-09-11T17:00', by: 'u-ss', note: 'Platform installed and tagged.', attachments: [] }, supersededBy: null, supersedes: null, cancelReason: null },
      { id: 'ch3', ref: 'CH-P1-005', sharedWithCustomer: false, projectId: 'p1', packageIds: ['wp1'], areaIds: ['a7'], requestId: 'r4', title: 'Working platform at T-105 nozzle N4',
        state: 'under_review', rev: 0, approvalRev: 0, version: 2, issuerId: 'u-pm', requiresCustomerApproval: true, approvalDue: '2026-10-16', raisedAt: '2026-10-08T09:30',
        scope: 'Add one working platform with ladder access at nozzle N4 level on SCF-TF-003.', summary: 'Extra platform requested in CR-P1-018.',
        dependencies: ['Drawing DRW-P1-SCF-011 revised to Rev D'], scheduleImpact: { days: 2, note: 'About 2 crew-days; no change to T-105 insulation dates' }, docRefs: [{ id: 'd10', rev: 'C' }],
        revisions: [{ rev: 0, at: '2026-10-08T09:30', by: 'u-pm', material: true, reason: 'Initial issue', scope: 'Add one working platform with ladder access at nozzle N4 level on SCF-TF-003.', scheduleImpact: { days: 2, note: 'About 2 crew-days; no change to T-105 insulation dates' }, areaIds: ['a7'], dependencies: ['Drawing DRW-P1-SCF-011 revised to Rev D'] }],
        decisions: [], completion: null, supersededBy: null, supersedes: null, cancelReason: null },
      { id: 'ch20', ref: 'CH-P2-002', sharedWithCustomer: true, projectId: 'p2', packageIds: ['wp6'], areaIds: ['a9'], requestId: null, title: 'Add fireproofing to JPR-1 east supports',
        state: 'awaiting_approval', rev: 0, approvalRev: 0, version: 3, issuerId: 'u-pm2', requiresCustomerApproval: true, approvalDue: '2026-10-12', raisedAt: '2026-10-05T11:00',
        scope: 'Extend fireproofing to four additional east supports on JPR-1.', summary: 'Customer-requested extension of fireproofing to four additional supports.',
        dependencies: [], scheduleImpact: { days: 4, note: 'Adds 4 days to application complete' }, docRefs: [{ id: 'd20', rev: '1' }],
        revisions: [{ rev: 0, at: '2026-10-05T11:00', by: 'u-pm2', material: true, reason: 'Initial issue', scope: 'Extend fireproofing to four additional east supports on JPR-1.', scheduleImpact: { days: 4, note: 'Adds 4 days to application complete' }, areaIds: ['a9'], dependencies: [] }],
        decisions: [{ id: 'dc8', type: 'internal_review', rev: 0, outcome: 'approve', by: 'u-om', at: '2026-10-05T15:00', reason: '', status: 'valid' }],
        completion: null, supersededBy: null, supersedes: null, cancelReason: null }
    ],

    // Commitments between RGS and the customer. Status is derived (store.js), except riskReason flags.
    commitments: [
      { id: 'c1', ref: 'C-P1-017', projectId: 'p1', packageId: 'wp2', party: 'rgs', ownerId: 'u-ss2', text: 'Complete T-105 insulation and cladding', textAr: 'إكمال عزل وتكسية T-105', promised: '2026-10-25', revised: null, doneAt: null, riskReason: null },
      { id: 'c2', ref: 'C-P1-018', projectId: 'p1', packageId: 'wp2', party: 'rgs', ownerId: 'u-ss2', text: 'Close CA-P1-021 cladding gaps', textAr: 'إغلاق CA-P1-021 فجوات التكسية', promised: '2026-10-15', revised: null, doneAt: null, riskReason: null },
      { id: 'c3', ref: 'C-P1-019', projectId: 'p1', packageId: 'wp3', party: 'customer', ownerId: 'u-ca', text: 'Issue work permit for PR-02 zone B', textAr: 'إصدار تصريح العمل لـ PR-02 المنطقة B', promised: '2026-10-18', revised: null, doneAt: null, riskReason: null },
      { id: 'c4', ref: 'C-P1-020', projectId: 'p1', packageId: 'wp3', party: 'rgs', ownerId: 'u-pm', text: 'Start PR-02 zone A fireproofing', textAr: 'بدء الحماية من الحريق في PR-02 المنطقة A', promised: '2026-10-14', revised: '2026-10-21', doneAt: null, riskReason: 'Waiting for decision on change CH-P1-004', riskReasonAr: 'بانتظار القرار على التغيير CH-P1-004' },
      { id: 'c5', ref: 'C-P1-015', projectId: 'p1', packageId: null, party: 'rgs', ownerId: 'u-pm', text: 'Issue September progress report', textAr: 'إصدار تقرير تقدم سبتمبر', promised: '2026-10-05', revised: null, doneAt: '2026-10-05', riskReason: null },
      { id: 'c6', ref: 'C-P1-021', projectId: 'p1', packageId: 'wp9', party: 'rgs', ownerId: 'u-ss4', text: 'Bund wall B-2 membrane installed', textAr: 'تركيب غشاء جدار الحوض B-2', promised: '2026-10-30', revised: null, doneAt: null, riskReason: null },
      { id: 'c7', ref: 'C-P1-022', projectId: 'p1', packageId: 'wp4', party: 'rgs', ownerId: 'u-pm', text: 'Hand over PR-02 scaffold for use', textAr: 'تسليم سقالات PR-02 للاستخدام', promised: '2026-10-14', revised: '2026-10-17', doneAt: null, riskReason: 'Customer acceptance pending', riskReasonAr: 'بانتظار قبول العميل' },
      { id: 'c20', ref: 'C-P2-006', projectId: 'p2', packageId: 'wp5', party: 'rgs', ownerId: 'u-ss', text: 'Complete jetty scaffold erection', textAr: 'إكمال تركيب سقالات الرصيف', promised: '2026-10-08', revised: null, doneAt: null, riskReason: null },
      { id: 'c21', ref: 'C-P2-007', projectId: 'p2', packageId: 'wp5', party: 'customer', ownerId: 'u-cr', text: 'Confirm jetty survey date', textAr: 'تأكيد موعد مسح الرصيف', promised: '2026-10-20', revised: null, doneAt: null, riskReason: null },
      { id: 'c22', ref: 'C-P2-008', projectId: 'p2', packageId: 'wp5', requestId: 'r20', party: 'rgs', ownerId: 'u-pm2', text: 'Respond to request CR-P2-003', textAr: 'الرد على الطلب CR-P2-003', promised: '2026-10-15', revised: null, doneAt: null, riskReason: null },
      { id: 'c30', ref: 'C-P3-001', projectId: 'p3', packageId: 'wp7', party: 'rgs', ownerId: 'u-pm2', text: 'Mobilise waterproofing crew', textAr: 'تجهيز فريق العزل المائي', promised: '2026-10-20', revised: null, doneAt: null, riskReason: null },
      { id: 'c40', ref: 'C-P4-011', projectId: 'p4', packageId: 'wp8', party: 'rgs', ownerId: 'u-om', text: 'Issue Block 3 handover record', textAr: 'إصدار سجل تسليم المبنى 3', promised: '2026-10-06', revised: null, doneAt: '2026-10-06', riskReason: null },
      { id: 'c41', ref: 'C-P4-012', projectId: 'p4', packageId: 'wp8', party: 'customer', ownerId: 'u-wv', text: 'Joint walkdown of Block 3 basement', textAr: 'جولة مشتركة في قبو المبنى 3', promised: '2026-10-16', revised: null, doneAt: null, riskReason: null }
    ],

    // Actions awaiting the customer (change approvals are derived from instructions, not stored here). type decides the permission checked:
    // document_ack → document.acknowledge, change_approval → customer.approve,
    // inspection_signoff → inspection.customer_signoff, customer_acceptance → handover.accept
    actions: [
      { id: 'ACT-101', type: 'inspection_signoff', projectId: 'p1', packageId: 'wp2', record: { kind: 'inspection', id: 'i2' }, assigneeId: 'u-ca', due: '2026-10-14', doneAt: null, doneBy: null },
      { id: 'ACT-103', type: 'document_ack', projectId: 'p1', packageId: 'wp2', record: { kind: 'document', id: 'd3' }, assigneeId: null, due: '2026-10-16', doneAt: null, doneBy: null },
      { id: 'ACT-104', type: 'customer_acceptance', projectId: 'p1', packageId: 'wp4', record: { kind: 'document', id: 'd6' }, assigneeId: 'u-ca', due: '2026-10-17', doneAt: null, doneBy: null },
      { id: 'ACT-105', type: 'inspection_signoff', projectId: 'p1', packageId: 'wp3', record: { kind: 'inspection', id: 'i5' }, assigneeId: null, due: '2026-10-20', doneAt: null, doneBy: null },
      { id: 'ACT-106', type: 'document_ack', projectId: 'p1', packageId: null, record: { kind: 'document', id: 'd4' }, assigneeId: null, due: '2026-10-12', doneAt: null, doneBy: null },
      { id: 'ACT-098', type: 'document_ack', projectId: 'p1', packageId: null, record: { kind: 'document', id: 'd5' }, assigneeId: null, due: '2026-09-11', doneAt: '2026-09-07', doneBy: 'u-cr' },
      { id: 'ACT-202', type: 'document_ack', projectId: 'p2', packageId: null, record: { kind: 'document', id: 'd21' }, assigneeId: null, due: '2026-10-18', doneAt: null, doneBy: null },
      { id: 'ACT-401', type: 'customer_acceptance', projectId: 'p4', packageId: 'wp8', record: { kind: 'document', id: 'd41' }, assigneeId: null, due: '2026-10-20', doneAt: null, doneBy: null }
    ],

    // Site evidence records. file = null: fixtures carry no photographs, so none are shown as evidence.
    evidence: [
      { id: 'ev1', ref: 'PH-P1-0231', packageId: 'wp2', areaId: 'a6', capturedAt: '2026-10-07T10:42', capturedBy: 'u-qa', caption: 'T-104 north seam, cladding overlap', linked: { kind: 'inspection', id: 'i3' }, file: null },
      { id: 'ev2', ref: 'PH-P1-0236', packageId: 'wp2', areaId: 'a6', capturedAt: '2026-10-09T09:15', capturedBy: 'u-qa', caption: 'T-104 hold point, insulation before cladding', linked: { kind: 'inspection', id: 'i2' }, file: null },
      { id: 'ev3', ref: 'PH-P1-0240', packageId: 'wp4', areaId: 'a2', capturedAt: '2026-10-10T14:05', capturedBy: 'u-qa', caption: 'SCF-PR-001 tagged after inspection', linked: { kind: 'inspection', id: 'i4' }, file: null },
      { id: 'ev4', ref: 'PH-P1-0244', packageId: 'wp3', areaId: 'a2', capturedAt: '2026-10-11T08:30', capturedBy: 'u-qa', caption: 'PR-02 zone A steel after surface release', linked: { kind: 'inspection', id: 'i5' }, file: null },
      { id: 'ev5', ref: 'PH-P1-0247', packageId: 'wp1', areaId: 'a1', capturedAt: '2026-10-12T07:10', capturedBy: 'u-so', caption: 'Tank farm daily condition, SCF-TF-002', linked: { kind: 'corrective', id: 'ca3' }, file: null },
      { id: 'ev6', ref: 'PH-P1-0219', packageId: 'wp9', areaId: 'a8', capturedAt: '2026-10-03T11:20', capturedBy: 'u-qa', caption: 'Bund wall B-2 substrate after rework', linked: { kind: 'inspection', id: 'i8' }, file: null },
      { id: 'ev20', ref: 'PH-P2-0041', packageId: 'wp5', areaId: 'a3', capturedAt: '2026-09-30T13:00', capturedBy: 'u-qa', caption: 'Jetty bay 3 ladder access', linked: { kind: 'inspection', id: 'i20' }, file: null }
    ],

    // Activity log (fixture). visibility: customer | internal.
    activity: [
      { id: 'e1',  at: '2026-10-12T16:20', projectId: 'p1', packageId: 'wp3', actor: 'u-pm',  kind: 'doc_draft',      ref: { kind: 'document', id: 'd11' }, rev: 'P1', visibility: 'internal' },
      { id: 'e2',  at: '2026-10-12T11:05', projectId: 'p1', packageId: 'wp1', actor: 'u-hse', kind: 'ca_raised',      ref: { kind: 'corrective', id: 'ca3' }, visibility: 'customer' },
      { id: 'e3',  at: '2026-10-12T15:40', projectId: 'p1', packageId: 'wp1', actor: 'u-ss',  kind: 'ca_updated',     ref: { kind: 'corrective', id: 'ca3' }, visibility: 'customer' },
      { id: 'e4',  at: '2026-10-12T07:15', projectId: 'p1', packageId: 'wp1', actor: 'u-so',  kind: 'photo_added',    ref: { kind: 'evidence', id: 'ev5' }, visibility: 'customer' },
      { id: 'e5',  at: '2026-10-11T17:30', projectId: 'p1', packageId: 'wp4', actor: 'u-pm',  kind: 'doc_issued',     ref: { kind: 'document', id: 'd6' }, rev: '0', visibility: 'customer' },
      { id: 'e6',  at: '2026-10-11T12:10', projectId: 'p1', packageId: 'wp3', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i5' }, visibility: 'customer' },
      { id: 'e7',  at: '2026-10-11T12:00', projectId: 'p1', packageId: 'wp3', actor: 'u-ss3', kind: 'milestone_done', ref: { kind: 'milestone', id: 'm9' }, visibility: 'customer' },
      { id: 'e8',  at: '2026-10-11T09:00', projectId: 'p1', packageId: 'wp3', actor: 'u-om',  kind: 'crew_assigned',  ref: { kind: 'package', id: 'wp3' }, visibility: 'internal' },
      { id: 'e9',  at: '2026-10-10T15:00', projectId: 'p1', packageId: 'wp4', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i4' }, visibility: 'customer' },
      { id: 'e10', at: '2026-10-10T15:05', projectId: 'p1', packageId: 'wp4', actor: 'u-ss',  kind: 'milestone_done', ref: { kind: 'milestone', id: 'm15' }, visibility: 'customer' },
      { id: 'e11', at: '2026-10-10T10:00', projectId: 'p1', packageId: 'wp2', actor: 'u-dc',  kind: 'doc_issued',     ref: { kind: 'document', id: 'd3' }, rev: '0', visibility: 'customer' },
      { id: 'e12', at: '2026-10-10T09:30', projectId: 'p1', packageId: 'wp2', actor: 'u-cr',  kind: 'req_created',    ref: { kind: 'request', id: 'r2' }, visibility: 'customer' },
      { id: 'e13', at: '2026-10-09T16:00', projectId: 'p1', packageId: 'wp2', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i2' }, visibility: 'customer' },
      { id: 'e14', at: '2026-10-09T16:10', projectId: 'p1', packageId: 'wp2', actor: 'u-ss2', kind: 'milestone_done', ref: { kind: 'milestone', id: 'm6' }, visibility: 'customer' },
      { id: 'e15', at: '2026-10-09T11:45', projectId: 'p1', packageId: 'wp2', actor: 'u-pm',  kind: 'req_responded',  ref: { kind: 'request', id: 'r1' }, visibility: 'customer' },
      { id: 'e16', at: '2026-10-08T14:00', projectId: 'p1', packageId: 'wp3', actor: 'u-pm',  kind: 'chg_submitted',  ref: { kind: 'change', id: 'ch1' }, rev: '1', visibility: 'customer' },
      { id: 'e17', at: '2026-10-08T14:05', projectId: 'p1', packageId: 'wp3', actor: 'u-pm',  kind: 'commitment_revised', ref: { kind: 'commitment', id: 'c4' }, visibility: 'customer' },
      { id: 'e18', at: '2026-10-08T08:20', projectId: 'p1', packageId: 'wp3', actor: 'u-pm',  kind: 'note_internal',  ref: { kind: 'package', id: 'wp3' }, visibility: 'internal' },
      { id: 'e19', at: '2026-10-07T13:30', projectId: 'p1', packageId: 'wp2', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i3' }, visibility: 'customer' },
      { id: 'e20', at: '2026-10-07T13:40', projectId: 'p1', packageId: 'wp2', actor: 'u-qa',  kind: 'ca_raised',      ref: { kind: 'corrective', id: 'ca1' }, visibility: 'customer' },
      { id: 'e21', at: '2026-10-05T10:00', projectId: 'p1', packageId: null,  actor: 'u-pm',  kind: 'doc_issued',     ref: { kind: 'document', id: 'd4' }, rev: '0', visibility: 'customer' },
      { id: 'e22', at: '2026-10-03T12:00', projectId: 'p1', packageId: 'wp9', actor: 'u-qa',  kind: 'ca_closed',      ref: { kind: 'corrective', id: 'ca2' }, visibility: 'customer' },
      { id: 'e23', at: '2026-10-03T11:50', projectId: 'p1', packageId: 'wp9', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i8' }, visibility: 'customer' },
      { id: 'e24', at: '2026-10-12T10:00', projectId: 'p2', packageId: 'wp5', actor: 'u-pm2', kind: 'note_internal',  ref: { kind: 'package', id: 'wp5' }, visibility: 'internal' },
      { id: 'e25', at: '2026-10-08T09:10', projectId: 'p2', packageId: 'wp5', actor: 'u-cr',  kind: 'req_created',    ref: { kind: 'request', id: 'r20' }, visibility: 'customer' },
      { id: 'e26', at: '2026-10-06T15:00', projectId: 'p2', packageId: null,  actor: 'u-pm2', kind: 'doc_issued',     ref: { kind: 'document', id: 'd21' }, rev: '0', visibility: 'customer' },
      { id: 'e27', at: '2026-10-05T11:00', projectId: 'p2', packageId: 'wp6', actor: 'u-pm2', kind: 'chg_submitted',  ref: { kind: 'change', id: 'ch20' }, rev: '0', visibility: 'customer' },
      { id: 'e28', at: '2026-10-06T16:00', projectId: 'p4', packageId: 'wp8', actor: 'u-om',  kind: 'doc_issued',     ref: { kind: 'document', id: 'd41' }, rev: '0', visibility: 'customer' },
      { id: 'e29', at: '2026-10-02T14:00', projectId: 'p4', packageId: 'wp8', actor: 'u-qa',  kind: 'insp_recorded',  ref: { kind: 'inspection', id: 'i40' }, visibility: 'customer' },
      { id: 'e31', at: '2026-10-11T14:00', projectId: 'p1', packageId: 'wp2', actor: 'u-ca',  kind: 'req_created',    ref: { kind: 'request', id: 'r5' }, visibility: 'customer' },
      { id: 'e32', at: '2026-10-12T16:00', projectId: 'p1', packageId: 'wp2', actor: 'u-ss2', kind: 'req_completed',  ref: { kind: 'request', id: 'r5' }, visibility: 'customer' },
      { id: 'e33', at: '2026-10-07T13:00', projectId: 'p1', packageId: 'wp1', actor: 'u-cr',  kind: 'req_created',    ref: { kind: 'request', id: 'r4' }, visibility: 'customer' },
      { id: 'e34', at: '2026-10-08T09:30', projectId: 'p1', packageId: 'wp1', actor: 'u-pm',  kind: 'chg_draft',      ref: { kind: 'change', id: 'ch3' }, rev: '0', visibility: 'internal' },
      { id: 'e35', at: '2026-10-12T16:05', projectId: 'p1', packageId: 'wp2', actor: 'u-ss2', kind: 'note_added',     ref: { kind: 'request', id: 'r5' }, visibility: 'internal' },
      { id: 'e30', at: '2026-10-04T09:00', projectId: 'p3', packageId: 'wp7', actor: 'u-pm2', kind: 'note_internal',  ref: { kind: 'package', id: 'wp7' }, visibility: 'internal' }
    ],

    users: [
      { id: 'u-cv',  orgId: 'org-nb', role: 'customer_viewer',    name: 'Reem Al-Saleh',    email: 'viewer@northbay.example',   status: 'active', lastVisitAt: '2026-10-08T12:00' },
      { id: 'u-cr',  orgId: 'org-nb', role: 'customer_requester', name: 'Fahad Al-Otaibi',  email: 'requester@northbay.example', status: 'active', lastVisitAt: '2026-10-10T09:00' },
      { id: 'u-ca',  orgId: 'org-nb', role: 'customer_approver',  name: 'Huda Al-Mutairi',  email: 'approver@northbay.example', status: 'active', lastVisitAt: '2026-10-08T12:00' },
      { id: 'u-wv',  orgId: 'org-wh', role: 'customer_viewer',    name: 'Lina Al-Faisal',   email: 'viewer@alwaha.example',     status: 'active', lastVisitAt: '2026-10-05T12:00' },
      { id: 'u-gm',  orgId: 'org-rgs', role: 'general_manager',   name: 'Khalid Al-Harbi',  email: 'gm@rgs.example',  status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-om',  orgId: 'org-rgs', role: 'operations_manager', name: 'Nasser Al-Qahtani', email: 'ops@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00', phone: '+966 50 000 0101' },
      { id: 'u-pm',  orgId: 'org-rgs', role: 'project_manager',   name: 'Omar Siddiqui',    email: 'pm@rgs.example',  status: 'active', lastVisitAt: '2026-10-12T08:00', phone: '+966 50 000 0142' },
      { id: 'u-pm2', orgId: 'org-rgs', role: 'project_manager',   name: 'Hana Al-Zahrani',  email: 'pm2@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00', phone: '+966 50 000 0087' },
      { id: 'u-so',  orgId: 'org-rgs', role: 'site_officer',      name: 'Bilal Ahmed',      email: 'site@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-ss',  orgId: 'org-rgs', role: 'service_supervisor', name: 'Rajesh Nair',     email: 'supervisor@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-ss2', orgId: 'org-rgs', role: 'service_supervisor', name: 'Imran Qureshi',   email: 'ins.supervisor@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-ss3', orgId: 'org-rgs', role: 'service_supervisor', name: 'Ali Hassan',      email: 'fpr.supervisor@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-ss4', orgId: 'org-rgs', role: 'service_supervisor', name: 'Fahim Rahman',    email: 'wpr.supervisor@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-qa',  orgId: 'org-rgs', role: 'qa_qc_inspector',   name: 'Sara Haddad',      email: 'qaqc@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-hse', orgId: 'org-rgs', role: 'hse_officer',       name: 'Yousef Al-Dosari', email: 'hse@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-dc',  orgId: 'org-rgs', role: 'document_controller', name: 'Mariam Al-Shehri', email: 'doccontrol@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' },
      { id: 'u-adm', orgId: 'org-rgs', role: 'portal_admin',      name: 'Tariq Mahmood',    email: 'admin@rgs.example', status: 'active', lastVisitAt: '2026-10-12T08:00' }
    ],
    // Personas offered on the prototype sign-in page (one per role, plus a second customer org).
    personas: ['u-cv', 'u-cr', 'u-ca', 'u-wv', 'u-gm', 'u-om', 'u-pm', 'u-so', 'u-ss', 'u-qa', 'u-hse', 'u-dc', 'u-adm'],

    assignments: [
      { id: 'ra1',  userId: 'u-cv',  role: 'customer_viewer',    scope: { projectId: 'p1' } },
      { id: 'ra2',  userId: 'u-cr',  role: 'customer_requester', scope: { projectId: 'p1' } },
      { id: 'ra3',  userId: 'u-cr',  role: 'customer_requester', scope: { projectId: 'p2' } },
      { id: 'ra4',  userId: 'u-ca',  role: 'customer_approver',  scope: { projectId: 'p1' } },
      { id: 'ra20', userId: 'u-wv',  role: 'customer_viewer',    scope: { projectId: 'p3' } },
      { id: 'ra21', userId: 'u-wv',  role: 'customer_viewer',    scope: { projectId: 'p4' } },
      { id: 'ra5',  userId: 'u-gm',  role: 'general_manager',    scope: { projectId: '*' } },
      { id: 'ra6',  userId: 'u-om',  role: 'operations_manager', scope: { projectId: 'p1' } },
      { id: 'ra7',  userId: 'u-om',  role: 'operations_manager', scope: { projectId: 'p2' } },
      { id: 'ra8',  userId: 'u-om',  role: 'operations_manager', scope: { projectId: 'p3' } },
      { id: 'ra22', userId: 'u-om',  role: 'operations_manager', scope: { projectId: 'p4' } },
      { id: 'ra9',  userId: 'u-pm',  role: 'project_manager',    scope: { projectId: 'p1' } },
      { id: 'ra23', userId: 'u-pm2', role: 'project_manager',    scope: { projectId: 'p2' } },
      { id: 'ra24', userId: 'u-pm2', role: 'project_manager',    scope: { projectId: 'p3' } },
      { id: 'ra10', userId: 'u-so',  role: 'site_officer',       scope: { projectId: 'p1', areaId: 'a1' } },
      { id: 'ra11', userId: 'u-ss',  role: 'service_supervisor', scope: { projectId: 'p1', service: 'scaffolding' } },
      { id: 'ra25', userId: 'u-ss',  role: 'service_supervisor', scope: { projectId: 'p2', service: 'scaffolding' } },
      { id: 'ra26', userId: 'u-ss2', role: 'service_supervisor', scope: { projectId: 'p1', service: 'insulation' } },
      { id: 'ra27', userId: 'u-ss3', role: 'service_supervisor', scope: { projectId: 'p1', service: 'fireproofing' } },
      { id: 'ra28', userId: 'u-ss3', role: 'service_supervisor', scope: { projectId: 'p2', service: 'fireproofing' } },
      { id: 'ra29', userId: 'u-ss4', role: 'service_supervisor', scope: { projectId: 'p1', service: 'waterproofing' } },
      { id: 'ra30', userId: 'u-ss4', role: 'service_supervisor', scope: { projectId: 'p3', service: 'waterproofing' } },
      { id: 'ra31', userId: 'u-ss4', role: 'service_supervisor', scope: { projectId: 'p4', service: 'waterproofing' } },
      { id: 'ra12', userId: 'u-qa',  role: 'qa_qc_inspector',    scope: { projectId: 'p1' } },
      { id: 'ra13', userId: 'u-qa',  role: 'qa_qc_inspector',    scope: { projectId: 'p2' } },
      { id: 'ra32', userId: 'u-qa',  role: 'qa_qc_inspector',    scope: { projectId: 'p4' } },
      { id: 'ra14', userId: 'u-hse', role: 'hse_officer',        scope: { projectId: 'p1' } },
      { id: 'ra15', userId: 'u-hse', role: 'hse_officer',        scope: { projectId: 'p2' } },
      { id: 'ra16', userId: 'u-dc',  role: 'document_controller', scope: { projectId: 'p1' } },
      { id: 'ra17', userId: 'u-dc',  role: 'document_controller', scope: { projectId: 'p2' } },
      { id: 'ra18', userId: 'u-dc',  role: 'document_controller', scope: { projectId: 'p3' } },
      { id: 'ra19', userId: 'u-adm', role: 'portal_admin',       scope: { projectId: '*' } }
    ],

    authorities: [
      { id: 'DA-0101', userId: 'u-ca', action: 'customer.approve', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'org-nb', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      { id: 'DA-0102', userId: 'u-ca', action: 'handover.accept',  scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'org-nb', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      { id: 'DA-0103', userId: 'u-ca', action: 'inspection.customer_signoff', scope: { projectId: 'p1', service: 'insulation' }, grantedBy: 'u-adm', nominatedBy: 'org-nb', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      { id: 'DA-0201', userId: 'u-pm', action: 'document.approve', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-02-01', validTo: '2027-01-31' },
      { id: 'DA-0202', userId: 'u-pm', action: 'handover.signoff', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-02-01', validTo: '2027-01-31' },
      { id: 'DA-0301', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p1', service: 'insulation' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-03-01', validTo: '2027-02-28' },
      { id: 'DA-0302', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p1', service: 'fireproofing' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-03-01', validTo: '2027-02-28' },
      { id: 'DA-0303', userId: 'u-qa', action: 'corrective.close', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-03-01', validTo: '2027-02-28' },
      { id: 'DA-0304', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p2' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2025-09-01', validTo: '2026-09-30' },
      { id: 'DA-0305', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p1', service: 'scaffolding' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-03-01', validTo: '2027-02-28' },
      { id: 'DA-0306', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p1', service: 'waterproofing' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-03-01', validTo: '2027-02-28' },
      { id: 'DA-0307', userId: 'u-qa', action: 'inspection.signoff', scope: { projectId: 'p4' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      { id: 'DA-0501', userId: 'u-om', action: 'instruction.authorise', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'u-gm', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      { id: 'DA-0502', userId: 'u-om', action: 'instruction.authorise', scope: { projectId: 'p2' }, grantedBy: 'u-adm', nominatedBy: 'u-gm', status: 'active', validFrom: '2026-01-01', validTo: '2026-12-31' },
      // TEST EXAMPLE ONLY: delegated publishing for the P1 project manager, limited to listed categories.
      { id: 'DA-0601', userId: 'u-pm', action: 'document.publish', scope: { projectId: 'p1', categories: ['method_statement', 'material_submission'] }, grantedBy: 'u-adm', grantedAt: '2026-09-30T10:00', nominatedBy: 'u-om', status: 'active',
        validFrom: '2026-10-01', validTo: '2026-12-31', validUntil: '2026-12-31T23:59:00+03:00', timezone: 'Asia/Riyadh (UTC+3)', revokedAt: null, revokedBy: null, revocationReason: null, testExample: true },
      { id: 'DA-0401', userId: 'u-hse', action: 'hse.permit.approve', scope: { projectId: 'p1' }, grantedBy: 'u-adm', nominatedBy: 'u-om', status: 'active', validFrom: '2026-01-15', validTo: '2026-12-31' }
    ]
  };
  // Runtime collections written by the command layer (api.js).
  F.notifications = []; F.files = []; F.idempotency = {};
  // Audit trail (fixture seed): every delegated-authority grant recorded at its start date.
  F.audit = F.authorities.map(function (d, i) {
    return { id: 'au' + (i + 1), at: d.validFrom + 'T08:00', actor: d.grantedBy, action: 'authority.grant', record: { kind: 'authority', id: d.id },
      detail: { holder: d.userId, permission: d.action, scope: d.scope, validFrom: d.validFrom, validTo: d.validTo, nominatedBy: d.nominatedBy }, reason: 'Nominated by ' + d.nominatedBy };
  });

  // ---------------------------------------------------------------- Stage 4: document control and evidence
  // Upgrades the Stage 2 document records to the revision-controlled model. Every revision keeps its own
  // status; issued revisions carry publishedAt; nothing is overwritten. Fixture files are metadata only.
  (function () {
    var LEGACY = { approved: 'published', issued: 'published', returned: 'revise_resubmit', superseded: 'superseded', draft: 'draft' };
    var AREA = {}; F.packages.forEach(function (w) { AREA[w.id] = w.areaId; });
    var DC = { p1: 'u-dc', p2: 'u-dc', p3: 'u-dc' }; // P4 has no document controller assigned: shows as missing metadata
    F.documents.forEach(function (d) {
      var lastPub = -1;
      d.revisions.forEach(function (r, i) { if (r.status === 'approved' || r.status === 'issued') lastPub = i; });
      d.category = d.type; d.ownerId = DC[d.projectId] || null; d.areaId = d.packageIds.length ? AREA[d.packageIds[0]] : null;
      d.audience = d.customerVisible ? 'customer' : 'internal'; if (d.status === 'draft') d.audience = 'customer';
      d.links = []; d.version = 1;
      d.registeredAt = d.revisions[0].date + 'T09:00'; d.registeredBy = /^u-/.test(d.revisions[0].by) ? d.revisions[0].by : (DC[d.projectId] || 'u-pm');
      d.revisions.forEach(function (r, i) {
        var wasIssued = r.status === 'approved' || r.status === 'issued' || r.status === 'superseded';
        r.status = LEGACY[r.status] || r.status;
        if (r.status === 'published' && i !== lastPub) r.status = 'superseded';
        var by = /^u-/.test(r.by) ? r.by : (DC[d.projectId] || 'u-pm');
        r.fileId = null; r.submittedAt = r.date + 'T09:00'; r.submittedBy = by; r.reviewers = []; r.optionalReviewers = []; r.reviewDue = null; r.reviews = []; r.comments = [];
        r.publishedAt = wasIssued ? r.date + 'T12:00' : null; r.publishedBy = wasIssued ? (DC[d.projectId] || by) : null; r.transmittalId = null; r.withdrawn = null;
      });
    });
    var doc = function (id) { return F.documents.filter(function (d) { return d.id === id; })[0]; };
    // MS-P1-INS-002: Rev A returned, Rev B accepted and issued
    var d2 = doc('d2');
    d2.revisions[0].reviewers = ['u-qa']; d2.revisions[0].reviews = [{ by: 'u-qa', at: '2026-08-24T10:00', rev: 'A', outcome: 'revise_resubmit', reason: 'Customer comments on vapour barrier laps to be incorporated.' }];
    d2.revisions[0].comments = [{ id: 'dcm1', by: 'u-qa', at: '2026-08-24T10:00', text: 'Show vapour barrier lap of 50 mm minimum as stated in the specification.', visibility: 'customer' }];
    d2.revisions[1].reviewers = ['u-qa']; d2.revisions[1].reviews = [{ by: 'u-qa', at: '2026-09-01T15:00', rev: 'B', outcome: 'accepted', reason: '' }];
    // ITP-P1-INS-003: Rev 0 issued by transmittal; Rev 1 under review (must not replace Rev 0 for customers)
    var d3 = doc('d3');
    d3.revisions[0].transmittalId = 'tr1'; d3.revisions[0].reviewers = ['u-qa']; d3.revisions[0].reviews = [{ by: 'u-qa', at: '2026-10-09T16:00', rev: '0', outcome: 'accepted', reason: '' }];
    d3.links = [{ kind: 'request', id: 'r2' }];
    d3.revisions.push({ rev: '1', date: '2026-10-12', status: 'under_review', by: 'u-dc', note: 'Hold point HP-4 added for cladding', fileId: null,
      submittedAt: '2026-10-12T10:00', submittedBy: 'u-dc', reviewers: ['u-qa', 'u-pm'], optionalReviewers: ['u-hse'], reviewDue: '2026-10-15',
      reviews: [{ by: 'u-qa', at: '2026-10-13T09:00', rev: '1', outcome: 'accepted_comments', reason: 'HP-4 acceptance criteria should cite the specification clause.' }],
      comments: [{ id: 'dcm2', by: 'u-qa', at: '2026-10-13T09:00', text: 'Add the specification clause reference for HP-4 acceptance.', visibility: 'customer' },
        { id: 'dcm3', by: 'u-pm', at: '2026-10-13T09:40', text: 'Keep the 24-hour notice internal until the customer QA lead confirms HP-4 timing.', visibility: 'internal' }],
      publishedAt: null, publishedBy: null, transmittalId: null, withdrawn: null });
    // HO-P1-SCF-04: issued for acceptance by transmittal, acknowledged
    var d6 = doc('d6'); d6.revisions[0].transmittalId = 'tr2';
    // MS-P1-FPR-002: internal draft submitted for review, review overdue
    var d11 = doc('d11');
    d11.revisions[0].status = 'under_review'; d11.revisions[0].reviewers = ['u-qa', 'u-hse']; d11.revisions[0].reviewDue = '2026-10-10';
    d11.revisions[0].comments = [{ id: 'dcm4', by: 'u-hse', at: '2026-10-11T11:00', text: 'Confirm hot-work controls for the curing heaters before I record an outcome.', visibility: 'internal' }];
    // New Stage 4 records
    F.documents.push(
      { id: 'd12', number: 'MAT-P1-WPR-001', title: 'Material submission – bund wall membrane', type: 'material_submission', category: 'material_submission', projectId: 'p1', packageIds: ['wp9'], areaId: 'a8',
        source: 'rgs', ownerId: 'u-dc', audience: 'customer', links: [{ kind: 'inspection', id: 'i8' }], version: 3, registeredAt: '2026-10-06T09:00', registeredBy: 'u-pm', status: 'unpublished', customerVisible: false,
        revisions: [{ rev: '0', date: '2026-10-06', status: 'accepted', by: 'u-pm', note: 'Membrane data sheet and batch certificates', fileId: null, submittedAt: '2026-10-06T09:00', submittedBy: 'u-pm',
          reviewers: ['u-qa', 'u-ss4'], optionalReviewers: [], reviewDue: '2026-10-09', reviews: [{ by: 'u-qa', at: '2026-10-08T10:00', rev: '0', outcome: 'accepted', reason: '' }, { by: 'u-ss4', at: '2026-10-08T14:00', rev: '0', outcome: 'accepted', reason: '' }],
          comments: [], publishedAt: null, publishedBy: null, transmittalId: null, withdrawn: null }] },
      { id: 'd13', number: 'DRW-P1-INS-012', title: 'Cladding layout – T-104 north elevation', type: 'drawing', category: 'drawing', projectId: 'p1', packageIds: ['wp2'], areaId: null,
        source: 'rgs', ownerId: 'u-dc', audience: 'customer', links: [], version: 1, registeredAt: '2026-10-12T15:00', registeredBy: 'u-pm', status: 'unpublished', customerVisible: false,
        revisions: [{ rev: 'A', date: '2026-10-12', status: 'draft', by: 'u-pm', note: 'First issue for review', fileId: null, submittedAt: null, submittedBy: null, reviewers: [], optionalReviewers: [], reviewDue: null, reviews: [], comments: [],
          publishedAt: null, publishedBy: null, transmittalId: null, withdrawn: null }] }
    );
    // Transmittals (portal delivery only; no email service exists)
    F.transmittals = [
      { id: 'tr1', ref: 'TR-P1-001', projectId: 'p1', issuedAt: '2026-10-10T12:00', issuedBy: 'u-dc', purpose: 'for_information', note: 'ITP issued for information.',
        items: [{ docId: 'd3', number: 'ITP-P1-INS-003', rev: '0' }], recipients: ['u-ca', 'u-cr', 'u-cv'],
        deliveries: [{ userId: 'u-ca', at: '2026-10-10T12:00', channel: 'portal' }, { userId: 'u-cr', at: '2026-10-10T12:00', channel: 'portal' }, { userId: 'u-cv', at: '2026-10-10T12:00', channel: 'portal' }],
        acknowledgements: [], version: 1 },
      { id: 'tr2', ref: 'TR-P1-002', projectId: 'p1', issuedAt: '2026-10-11T12:00', issuedBy: 'u-dc', purpose: 'for_acceptance', note: 'Handover record for PR-02 scaffold.',
        items: [{ docId: 'd6', number: 'HO-P1-SCF-04', rev: '0' }], recipients: ['u-ca', 'u-cr'],
        deliveries: [{ userId: 'u-ca', at: '2026-10-11T12:00', channel: 'portal' }, { userId: 'u-cr', at: '2026-10-11T12:00', channel: 'portal' }],
        acknowledgements: [{ userId: 'u-ca', at: '2026-10-12T08:10' }], version: 2 }
    ];
    F.actions.forEach(function (a) { if (a.id === 'ACT-103') a.transmittalId = 'tr1'; });
    // Inspections record the basis revision they were performed against
    F.inspections.forEach(function (i) {
      if (!i.basisDocId) return;
      var d = doc(i.basisDocId), pub = d.revisions.filter(function (r) { return r.status === 'published'; })[0];
      i.basisRev = pub ? pub.rev : d.revisions[d.revisions.length - 1].rev;
    });
    // Unregistered upload waiting in the document inbox (metadata only)
    F.files.push({ id: 'f-inbox1', name: 'Coating thickness readings PR-02 zone A.pdf', size: 482113, type: 'application/pdf', sha256: '5b1d0c9e7a3f42d18c0e6b9a7d21f3c4e8a90b6d5f7c2e1a4b3d9c8e7f6a5b4c', uploadedBy: 'u-qa', at: '2026-10-12T16:20',
      owner: { kind: 'upload', userId: 'u-qa', projectId: 'p1', packageId: 'wp3' }, validation: 'ok', scan: 'not_available', quarantined: false });
    // Evidence: verified portal metadata vs details stated by the uploader
    F.evidence.forEach(function (e) {
      var w = F.packages.filter(function (x) { return x.id === e.packageId; })[0];
      e.projectId = w.projectId; e.uploadedBy = e.capturedBy; e.uploadedAt = e.capturedAt; e.capturedAtSource = 'stated'; e.audience = 'customer'; e.fileId = null; e.versions = []; e.version = 1;
    });
    F.evidence.push({ id: 'ev7', ref: 'PH-P1-0249', projectId: 'p1', packageId: 'wp2', areaId: 'a6', capturedAt: '2026-10-12T15:10', capturedBy: 'u-ss2', uploadedBy: 'u-ss2', uploadedAt: '2026-10-12T15:40', capturedAtSource: 'stated',
      caption: 'Damaged cladding sheets stacked before removal', linked: { kind: 'corrective', id: 'ca1' }, audience: 'internal', fileId: null, versions: [], version: 1, file: null });
    // EXAMPLE document sets for review only. These are NOT RGS requirements and are not in config.js.
    // TEST EXAMPLE ONLY: review routing for Project 1. Customer review only for material submissions; every other
    // P1 category is explicitly RGS-only. Projects 2-4 stay unconfigured, so issuance there is blocked.
    F.demoReviewRouting = { label: 'Test routing (demo fixture) — not an RGS rule', projects: { p1: { drawing: 'rgs_only', method_statement: 'rgs_only', specification: 'rgs_only', material_submission: 'customer_required',
      itp: 'rgs_only', inspection_record: 'rgs_only', certificate: 'rgs_only', report: 'rgs_only', handover_record: 'rgs_only' } } };
    F.transmittals.forEach(function (tr) { var d = new Date(tr.issuedAt.slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); tr.reminderAt = d.toISOString().slice(0, 10); tr.authority = null; });
    F.demoDocRequirements = { label: 'Example set for review (demo fixture) — not an RGS requirement', sets: { wp2: ['method_statement', 'itp', 'material_submission'], wp3: ['method_statement', 'itp'] } };
  })();

  // ---------------------------------------------------------------- Stage 5: inspections, findings, corrective actions
  // TEST TEMPLATES: check wording is generic and every acceptance criterion points to the project-approved document.
  // No technical thresholds, frequencies, certifications or regulatory requirements are invented here.
  (function () {
    var CRIT = 'Project-approved criterion to be entered from the referenced document';
    function item(key, text, spec, opts) { opts = opts || {}; return { key: key, text: text, spec: spec || '', clause: opts.clause || 'To be confirmed', evidence: opts.evidence || '', unit: opts.unit || null, criterion: opts.criterion || CRIT, witness: opts.witness || '', required: opts.required !== false }; }
    F.checklistTemplates = [
      { id: 'tpl-scf', service: 'scaffolding', name: 'Scaffold inspection', testExample: true, versions: [
        { version: 1, status: 'superseded', createdAt: '2026-03-01T09:00', createdBy: 'u-qa', activatedAt: '2026-03-01T09:00', note: 'First issue', items: [
          item('s1', 'Scaffold tag displayed and current', 'Project specification', { evidence: 'Photo of tag' }),
          item('s2', 'Base plates and sole boards as per approved design', 'Project specification', { evidence: 'Photo' }),
          item('s3', 'Guardrails, mid-rails and toe boards complete at working levels', 'Project specification', { evidence: 'Photo' }),
          item('s4', 'Ties and bracing as per the approved arrangement drawing', 'Approved arrangement drawing')] },
        { version: 2, status: 'active', createdAt: '2026-09-25T09:00', createdBy: 'u-qa', activatedAt: '2026-10-01T09:00', note: 'Access item added', items: [
          item('s1', 'Scaffold tag displayed and current', 'Project specification', { evidence: 'Photo of tag' }),
          item('s2', 'Base plates and sole boards as per approved design', 'Project specification', { evidence: 'Photo' }),
          item('s3', 'Guardrails, mid-rails and toe boards complete at working levels', 'Project specification', { evidence: 'Photo' }),
          item('s4', 'Ties and bracing as per the approved arrangement drawing', 'Approved arrangement drawing'),
          item('s5', 'Access ladder and gate in place at each working level', 'Project specification', { evidence: 'Photo' })] }] },
      { id: 'tpl-ins', service: 'insulation', name: 'Insulation hold point', testExample: true, versions: [
        { version: 1, status: 'active', createdAt: '2026-03-01T09:00', createdBy: 'u-qa', activatedAt: '2026-03-01T09:00', note: 'First issue', items: [
          item('n1', 'Surface prepared and dry before insulation', 'Project specification', { evidence: 'Photo' }),
          item('n2', 'Insulation thickness', 'Project specification', { unit: 'mm', evidence: 'Measurement record' }),
          item('n3', 'Vapour barrier lap', 'Project specification', { unit: 'mm', evidence: 'Photo' }),
          item('n4', 'Cladding overlaps and sealing', 'Project specification', { evidence: 'Photo', witness: 'Customer witness where named' })] }] },
      { id: 'tpl-fpr', service: 'fireproofing', name: 'Fireproofing inspection', testExample: true, versions: [
        { version: 1, status: 'active', createdAt: '2026-03-01T09:00', createdBy: 'u-qa', activatedAt: '2026-03-01T09:00', note: 'First issue', items: [
          item('f1', 'Surface release accepted before application', 'Project specification', { evidence: 'Photo' }),
          item('f2', 'Applied thickness', 'Project specification', { unit: 'mm', evidence: 'Measurement record' }),
          item('f3', 'Mesh or reinforcement installed where the specification requires it', 'Project specification', { required: false })] }] },
      { id: 'tpl-wpr', service: 'waterproofing', name: 'Waterproofing inspection', testExample: true, versions: [
        { version: 1, status: 'active', createdAt: '2026-03-01T09:00', createdBy: 'u-qa', activatedAt: '2026-03-01T09:00', note: 'First issue', items: [
          item('w1', 'Substrate condition accepted', 'Project specification', { evidence: 'Photo' }),
          item('w2', 'Membrane laps and terminations', 'Project specification', { unit: 'mm', evidence: 'Photo' }),
          item('w3', 'Test result recorded where the project ITP requires a test', 'Project specification', { required: false })] }] }
    ];
    F.checklistTemplates.forEach(function (tp) { tp.version = 1; tp.label = 'Test template — content to be confirmed by RGS'; });
    var TPL = { scaffolding: 'tpl-scf', insulation: 'tpl-ins', fireproofing: 'tpl-fpr', waterproofing: 'tpl-wpr' };
    var PKG = {}; F.packages.forEach(function (w) { PKG[w.id] = w; });
    function tplItems(tid, v) { var tp = F.checklistTemplates.filter(function (x) { return x.id === tid; })[0]; return JSON.parse(JSON.stringify(tp.versions.filter(function (x) { return x.version === v; })[0].items)); }
    function typeOf(title) { return /re-inspection/i.test(title) ? 'reinspection' : /hold point/i.test(title) ? 'hold_point' : /surveillance/i.test(title) ? 'surveillance' : /release/i.test(title) ? 'release' : /before handover|final/i.test(title) ? 'pre_handover' : 'scaffold_inspection'; }
    var FAIL = { i3: 'n4', i7: 'w1', i20: 's3' };
    F.inspections.forEach(function (i) {
      var w = PKG[i.packageId];
      i.projectId = w.projectId; i.type = typeOf(i.title); i.templateId = TPL[w.service]; i.templateVersion = 1; i.items = tplItems(i.templateId, 1);
      i.scope = i.title; i.attendees = [i.inspectorId]; i.prerequisites = []; i.docRefs = i.basisDocId ? [{ id: i.basisDocId, rev: i.basisRev }] : [];
      i.requestId = null; i.reinspectionOf = null; i.correctiveActionId = null; i.rev = 1; i.amendments = []; i.version = 1; i.witnesses = []; i.createdBy = 'u-qa'; i.createdAt = i.planned + 'T08:00';
      i.results = {};
      if (i.performed) {
        i.items.forEach(function (it) { i.results[it.key] = { result: FAIL[i.id] === it.key ? 'fail' : (it.required ? 'pass' : 'na'), reason: FAIL[i.id] === it.key ? 'See finding' : (it.required ? '' : 'Not specified for this area'), note: '', measurement: null, evidence: [] }; });
        i.field = { by: i.inspectorId, at: i.performed + 'T10:00', rev: 1 };
        i.verification = i.rgsSignoff ? { by: i.rgsSignoff.by, at: i.rgsSignoff.at + 'T16:00', authority: i.rgsSignoff.authority, rev: 1, outcome: { accepted: 'accepted', observations: 'accepted_observations', rejected: 'rejected' }[i.result] || 'accepted' } : null;
        i.status = i.rgsSignoff ? 'completed' : 'awaiting_review';
      } else { i.field = null; i.verification = null; i.status = 'scheduled'; }
      i.publishedAt = i.performed ? i.performed + 'T17:00' : i.planned + 'T08:00'; i.publishedBy = 'u-qa';
    });
    F.evidence.forEach(function (e) { if (e.linked && e.linked.kind === 'inspection') { var i = F.inspections.filter(function (x) { return x.id === e.linked.id; })[0]; var k = FAIL[i.id] || i.items[0].key; if (i.results[k]) i.results[k].evidence.push(e.id); } });
    var ins = function (id) { return F.inspections.filter(function (x) { return x.id === id; })[0]; };
    ins('i8').reinspectionOf = 'i7'; ins('i8').correctiveActionId = 'ca2';
    ins('i6').attendees = ['u-qa', 'u-ca']; ins('i6').prerequisites = [{ text: 'Insulation complete at T-105 north elevation', met: false }]; // witness appointment for the customer
    // New Stage 5 records: a field draft in progress (internal) and a submitted assessment awaiting verification
    F.inspections.push(
      { id: 'i9', ref: 'INS-P1-0017', projectId: 'p1', packageId: 'wp1', areaId: 'a1', title: 'Weekly scaffold inspection – tank farm', type: 'scaffold_inspection', scope: 'All scaffolds on SCF-TF-001 to SCF-TF-003',
        planned: '2026-10-13', performed: null, inspectorId: 'u-so', result: null, rgsSignoff: null, customerSignoffRequired: false, basisDocId: 'd10', basisRev: 'C', docRefs: [{ id: 'd10', rev: 'C' }, { id: 'd8', rev: '1' }],
        templateId: 'tpl-scf', templateVersion: 2, items: tplItems('tpl-scf', 2), attendees: ['u-so'], prerequisites: [], requestId: null, reinspectionOf: null, correctiveActionId: null,
        results: { s1: { result: 'pass', reason: '', note: '', measurement: null, evidence: [] }, s2: { result: 'pass', reason: '', note: '', measurement: null, evidence: [] }, s3: { result: 'not_assessed', reason: '', note: 'Level 3 closed; recheck after toe boards fitted', measurement: null, evidence: [] } },
        field: null, verification: null, status: 'in_progress', rev: 1, amendments: [], witnesses: [], version: 3, publishedAt: null, publishedBy: null, createdBy: 'u-qa', createdAt: '2026-10-12T15:00' },
      { id: 'i10', ref: 'INS-P1-0018', projectId: 'p1', packageId: 'wp2', areaId: 'a6', title: 'Insulation thickness check – T-104 south', type: 'surveillance', scope: 'T-104 south elevation, rings 1–3',
        planned: '2026-10-12', performed: '2026-10-12', inspectorId: 'u-so', result: null, rgsSignoff: null, customerSignoffRequired: false, basisDocId: 'd1', basisRev: '2', docRefs: [{ id: 'd1', rev: '2' }, { id: 'd3', rev: '0' }],
        templateId: 'tpl-ins', templateVersion: 1, items: tplItems('tpl-ins', 1), attendees: ['u-so'], prerequisites: [], requestId: null, reinspectionOf: null, correctiveActionId: null,
        results: { n1: { result: 'pass', reason: '', note: '', measurement: null, evidence: [] }, n2: { result: 'pass', reason: '', note: 'Readings at 6 points', measurement: '50', evidence: [] },
          n3: { result: 'pass', reason: '', note: '', measurement: '75', evidence: [] }, n4: { result: 'na', reason: 'Cladding not yet installed on south elevation', note: '', measurement: null, evidence: [] } },
        field: { by: 'u-so', at: '2026-10-12T14:20', rev: 1 }, verification: null, status: 'awaiting_review', rev: 1, amendments: [], witnesses: [], version: 4, publishedAt: null, publishedBy: null, createdBy: 'u-qa', createdAt: '2026-10-11T09:00' }
    );
    // Findings register (classification and severity are PROPOSED values)
    F.findings = [
      { id: 'f1', ref: 'FN-P1-001', projectId: 'p1', packageId: 'wp2', areaId: 'a6', inspectionId: 'i3', itemKey: 'n4', source: 'inspection', classification: 'nonconformance', severity: 'medium',
        description: 'Cladding overlap gaps at the T-104 north seam.', evidence: ['ev1'], ownerId: 'u-ss2', targetDate: '2026-10-15', containment: 'Seam taped; no further cladding over the gap until corrected.',
        customerVisible: true, status: 'action_raised', correctiveActionIds: ['ca1'], raisedBy: 'u-qa', raisedAt: '2026-10-07T11:00', escalations: [], version: 2 },
      { id: 'f2', ref: 'FN-P1-002', projectId: 'p1', packageId: 'wp9', areaId: 'a8', inspectionId: 'i7', itemKey: 'w1', source: 'inspection', classification: 'nonconformance', severity: 'medium',
        description: 'Substrate not ready for membrane at the B-2 east end.', evidence: [], ownerId: 'u-ss4', targetDate: '2026-10-02', containment: 'Membrane work held at B-2 east end.',
        customerVisible: true, status: 'closed', correctiveActionIds: ['ca2'], raisedBy: 'u-qa', raisedAt: '2026-09-28T12:00', escalations: [], version: 3 },
      { id: 'f3', ref: 'FN-P1-003', projectId: 'p1', packageId: 'wp1', areaId: 'a1', inspectionId: null, itemKey: null, source: 'observation', classification: 'hse_concern', severity: 'high',
        description: 'Toe board missing on SCF-TF-002 level 3.', evidence: ['ev5'], ownerId: 'u-ss', targetDate: '2026-10-14', containment: 'Level 3 closed to access and the tag changed.',
        customerVisible: false, status: 'action_raised', correctiveActionIds: ['ca3'], raisedBy: 'u-hse', raisedAt: '2026-10-12T07:30', escalations: [{ to: 'u-om', by: 'u-hse', at: '2026-10-12T07:45', reason: 'Fall-from-height exposure; operations informed.' }], version: 2 },
      { id: 'f4', ref: 'FN-P1-004', projectId: 'p1', packageId: 'wp2', areaId: 'a6', inspectionId: null, itemKey: null, source: 'observation', classification: 'observation', severity: 'low',
        description: 'Laydown area at T-104 untidy; offcuts not segregated.', evidence: ['ev7'], ownerId: 'u-ss2', targetDate: '2026-10-16', containment: '',
        customerVisible: false, status: 'open', correctiveActionIds: [], raisedBy: 'u-hse', raisedAt: '2026-10-12T16:00', escalations: [], version: 1 },
      { id: 'f20', ref: 'FN-P2-001', projectId: 'p2', packageId: 'wp5', areaId: 'a3', inspectionId: 'i20', itemKey: 's3', source: 'inspection', classification: 'nonconformance', severity: 'medium',
        description: 'Ladder access gate missing at bay 3.', evidence: ['ev20'], ownerId: 'u-ss', targetDate: '2026-10-10', containment: 'Bay 3 access barricaded.',
        customerVisible: true, status: 'action_raised', correctiveActionIds: ['ca20'], raisedBy: 'u-qa', raisedAt: '2026-09-30T15:00', escalations: [], version: 2 }
    ];
    // Corrective actions upgraded to the proposed lifecycle (history keeps every decision)
    var CA = {
      ca1: { findingId: 'f1', status: 'in_progress', verifierId: 'u-qa', cause: 'Overlap set out short on the last three sheets.', actionPlan: 'Replace three sheets with correct overlap and reseal.', completion: null,
        history: [{ at: '2026-10-07T11:10', by: 'u-qa', from: null, to: 'open', reason: 'Raised from FN-P1-001' }, { at: '2026-10-07T12:00', by: 'u-pm', from: 'open', to: 'assigned', reason: 'Assigned to insulation supervisor' },
          { at: '2026-10-08T09:00', by: 'u-ss2', from: 'assigned', to: 'action_proposed', reason: 'Replace three sheets' }, { at: '2026-10-08T15:00', by: 'u-ss2', from: 'action_proposed', to: 'in_progress', reason: 'Replacement sheets ordered' }] },
      ca2: { findingId: 'f2', status: 'closed', verifierId: 'u-qa', cause: 'Curing compound residue on the substrate.', actionPlan: 'Grind and clean east end; re-inspect substrate.', completion: { by: 'u-ss4', at: '2026-10-02T16:00', note: 'East end ground and cleaned.', evidence: ['ev6'] },
        reinspectionId: 'i8', verification: { by: 'u-qa', at: '2026-10-03T12:00', authority: 'DA-0303', outcome: 'confirmed', reason: 'Re-inspection INS-P1-0011 accepted.' },
        history: [{ at: '2026-09-28T12:10', by: 'u-qa', from: null, to: 'open', reason: 'Raised from FN-P1-002' }, { at: '2026-09-28T13:00', by: 'u-pm', from: 'open', to: 'assigned', reason: '' },
          { at: '2026-09-29T09:00', by: 'u-ss4', from: 'assigned', to: 'in_progress', reason: 'Grinding started' }, { at: '2026-10-02T16:00', by: 'u-ss4', from: 'in_progress', to: 'ready_for_verification', reason: 'East end ground and cleaned.' },
          { at: '2026-10-03T12:00', by: 'u-qa', from: 'ready_for_verification', to: 'closed', reason: 'Re-inspection INS-P1-0011 accepted.' }] },
      ca3: { findingId: 'f3', status: 'ready_for_verification', verifierId: 'u-qa', cause: 'Toe board removed for material lift and not refitted.', actionPlan: 'Refit toe boards; add check to handover of lifting zones.',
        completion: { by: 'u-ss', at: '2026-10-12T15:30', note: 'Toe boards refitted on level 3.', evidence: ['ev5'] },
        history: [{ at: '2026-10-12T07:35', by: 'u-hse', from: null, to: 'open', reason: 'Raised from FN-P1-003' }, { at: '2026-10-12T07:40', by: 'u-hse', from: 'open', to: 'assigned', reason: 'Scaffold supervisor' },
          { at: '2026-10-12T08:30', by: 'u-ss', from: 'assigned', to: 'in_progress', reason: '' }, { at: '2026-10-12T15:30', by: 'u-ss', from: 'in_progress', to: 'ready_for_verification', reason: 'Toe boards refitted on level 3.' }] },
      ca20: { findingId: 'f20', status: 'in_progress', verifierId: 'u-qa', cause: '', actionPlan: 'Fit self-closing gate at bay 3.', completion: null,
        history: [{ at: '2026-09-30T15:10', by: 'u-qa', from: null, to: 'open', reason: 'Raised from FN-P2-001' }, { at: '2026-10-01T08:00', by: 'u-ss', from: 'open', to: 'in_progress', reason: '' }] }
    };
    F.correctiveActions.forEach(function (c) {
      var x = CA[c.id], f = F.findings.filter(function (y) { return y.id === x.findingId; })[0];
      Object.assign(c, { projectId: f.projectId, findingId: f.id, containment: f.containment, reinspectionId: null, verification: null, version: c.status === 'closed' ? 6 : 4, decisions: [] }, x);
    });
  })();

  // ---------------------------------------------------------------- Stage 6: progress, commitments, reports, handover
  // TEST SETTINGS (isolated, labelled): progress configurations, handover requirements, release prerequisites and the two
  // asset-release authority records below are examples for review. None of them is an RGS procedure.
  (function () {
    function pkg(id) { return F.packages.filter(function (w) { return w.id === id; })[0]; }
    function proj(id) { return F.projects.filter(function (p) { return p.id === id; })[0]; }
    // Milestones: owner, location, baseline (planned), forecast, actual (verified) completion, evidence; reported
    // progress is kept apart from verified completion and from customer acceptance.
    var MS_EVIDENCE = { m13: ['ev9'], m14: ['ev8'], m15: ['ev3'], m31: ['ev41'], m32: ['ev42'], m33: ['ev42'], m5: ['ev2'], m6: ['ev1'], m17: ['ev6'] };
    F.milestones.forEach(function (m) {
      var w = pkg(m.packageId), p = proj(w.projectId);
      m.ownerId = w.supervisorId; m.areaId = w.areaId; m.evidence = MS_EVIDENCE[m.id] || [];
      m.reported = m.completedAt ? { by: w.supervisorId, at: m.completedAt + 'T15:00', updateId: null } : null;
      m.verifiedBy = m.completedAt ? p.repId : null; m.verifiedAt = m.completedAt ? m.completedAt + 'T17:00' : null;
      m.baselineHistory = []; m.forecastHistory = []; m.acceptance = null; m.version = 1;
    });
    var m22 = F.milestones.filter(function (m) { return m.id === 'm22'; })[0];
    m22.baselineHistory.push({ at: '2026-09-20T10:00', by: 'u-pm2', from: '2026-10-01', to: '2026-10-08', reason: 'Jetty access permit for bays 7–12 issued a week late by the port authority' });
    m22.forecastHistory.push({ at: '2026-10-09T09:00', by: 'u-ss', from: '2026-10-08', to: '2026-10-20', reason: 'Bays 9–12 waiting for access permit' });
    F.evidence.push(
      { id: 'ev8', ref: 'PH-P1-0241', projectId: 'p1', packageId: 'wp4', areaId: 'a2', capturedAt: '2026-10-08T16:20', capturedBy: 'u-ss', uploadedBy: 'u-ss', uploadedAt: '2026-10-08T16:40', capturedAtSource: 'stated',
        caption: 'PR-02 zone A and B scaffolds erected', linked: { kind: 'milestone', id: 'm14' }, audience: 'customer', fileId: null, versions: [], version: 1, file: null },
      { id: 'ev9', ref: 'PH-P1-0226', projectId: 'p1', packageId: 'wp4', areaId: 'a2', capturedAt: '2026-09-24T09:10', capturedBy: 'u-ss', uploadedBy: 'u-ss', uploadedAt: '2026-09-24T09:30', capturedAtSource: 'stated',
        caption: 'PR-02 access plan briefed and laydown set out', linked: { kind: 'milestone', id: 'm13' }, audience: 'customer', fileId: null, versions: [], version: 1, file: null },
      { id: 'ev41', ref: 'PH-P4-0102', projectId: 'p4', packageId: 'wp8', areaId: 'a5', capturedAt: '2026-04-12T11:00', capturedBy: 'u-ss4', uploadedBy: 'u-ss4', uploadedAt: '2026-04-12T11:30', capturedAtSource: 'stated',
        caption: 'Block 3 basement substrate released', linked: { kind: 'milestone', id: 'm31' }, audience: 'customer', fileId: null, versions: [], version: 1, file: null },
      { id: 'ev42', ref: 'PH-P4-0131', projectId: 'p4', packageId: 'wp8', areaId: 'a5', capturedAt: '2026-08-28T15:00', capturedBy: 'u-ss4', uploadedBy: 'u-ss4', uploadedAt: '2026-08-28T15:20', capturedAtSource: 'stated',
        caption: 'Block 3 membrane complete before protection', linked: { kind: 'milestone', id: 'm32' }, audience: 'customer', fileId: null, versions: [], version: 1, file: null });

    // TEST progress configurations. Weighted milestones use the milestone weights already approved at baseline;
    // WP-P2-SCF-01 uses completed quantities against approved planned quantities. WP-P3-WPR-01 has none, so it shows
    // "Progress method not configured".
    var LABEL = 'Test progress configuration (demo fixture) — not an RGS setting';
    F.progressConfigs = ['wp1', 'wp2', 'wp3', 'wp4', 'wp9', 'wp6', 'wp8'].map(function (id, n) {
      var w = pkg(id);
      return { id: 'pc' + (n + 1), packageId: id, projectId: w.projectId, method: 'weighted_milestones', status: 'approved', approvedBy: 'u-om', approvedAt: (proj(w.projectId).start) + 'T09:00',
        unit: null, lines: [], history: [], testExample: true, label: LABEL, version: 1 };
    });
    F.progressConfigs.push({ id: 'pc8', packageId: 'wp5', projectId: 'p2', method: 'quantities', status: 'approved', approvedBy: 'u-om', approvedAt: '2026-08-20T09:00', unit: 'm³',
      lines: [{ id: 'q5a', description: 'North jetty bays 1–6 scaffold erected', descriptionAr: 'سقالات الرصيف الشمالي الخانات 1–6 مركبة', planned: 1200, unit: 'm³' },
              { id: 'q5b', description: 'North jetty bays 7–12 scaffold erected', descriptionAr: 'سقالات الرصيف الشمالي الخانات 7–12 مركبة', planned: 1000, unit: 'm³' }],
      history: [{ at: '2026-09-20T10:00', by: 'u-pm2', change: 'planned', lineId: 'q5b', from: 900, to: 1000, reason: 'Bay 12 extended after the joint survey' }],
      testExample: true, label: LABEL, version: 2 });

    // Daily updates: reported → reviewed → published. Only reviewed (approved) quantities count for staff; customers
    // see only published updates.
    F.dailyUpdates = [
      { id: 'du1', ref: 'DU-P2-0001', projectId: 'p2', packageId: 'wp5', areaId: 'a3', date: '2026-10-09', authorId: 'u-ss', reviewerId: 'u-pm2', status: 'published',
        workDone: 'Bays 1–4 erected and boarded.', quantities: [{ lineId: 'q5a', qty: 600, unit: 'm³' }], milestoneIds: [], evidence: ['ev20'], blockers: '', next: 'Continue bays 5–6.',
        submittedAt: '2026-10-09T17:00', review: { by: 'u-pm2', at: '2026-10-10T08:30', outcome: 'approved', reason: '' }, publishedAt: '2026-10-10T09:00', publishedBy: 'u-pm2', history: [], version: 4 },
      { id: 'du2', ref: 'DU-P2-0002', projectId: 'p2', packageId: 'wp5', areaId: 'a3', date: '2026-10-11', authorId: 'u-ss', reviewerId: 'u-pm2', status: 'published',
        workDone: 'Bays 5–6 erected; bay 7 started.', quantities: [{ lineId: 'q5a', qty: 300, unit: 'm³' }, { lineId: 'q5b', qty: 300, unit: 'm³' }], milestoneIds: [], evidence: [], blockers: 'Access permit for bays 9–12 not yet issued.', next: 'Bays 7–8.',
        submittedAt: '2026-10-11T17:00', review: { by: 'u-pm2', at: '2026-10-12T08:10', outcome: 'approved', reason: '' }, publishedAt: '2026-10-12T08:30', publishedBy: 'u-pm2', history: [], version: 4 },
      { id: 'du3', ref: 'DU-P2-0003', projectId: 'p2', packageId: 'wp5', areaId: 'a3', date: '2026-10-12', authorId: 'u-ss', reviewerId: 'u-pm2', status: 'submitted',
        workDone: 'Bay 8 erected.', quantities: [{ lineId: 'q5b', qty: 150, unit: 'm³' }], milestoneIds: [], evidence: [], blockers: 'Access permit for bays 9–12 not yet issued.', next: 'Bays 9–10 once the permit is issued.',
        submittedAt: '2026-10-12T17:10', review: null, publishedAt: null, publishedBy: null, history: [], version: 2 },
      { id: 'du4', ref: 'DU-P1-0001', projectId: 'p1', packageId: 'wp2', areaId: 'a7', date: '2026-10-12', authorId: 'u-so', reviewerId: 'u-ss2', status: 'approved',
        workDone: 'T-105 cladding courses 1–8 installed on the north and east elevations.', quantities: [], milestoneIds: [], evidence: [], blockers: 'Scaffold access at T-105 west waits for the SCF-TF-003 platform change.', next: 'Continue T-105 west from 14 Oct.',
        submittedAt: '2026-10-12T16:30', review: { by: 'u-ss2', at: '2026-10-12T18:00', outcome: 'approved', reason: '' }, publishedAt: null, publishedBy: null, history: [], version: 3 }
    ];

    // Commitments: source record, original promise kept, current forecast, blocker, next action, reschedule history.
    var CM = {
      c1: { source: { kind: 'milestone', id: 'm7' }, next: 'Finish T-105 west once the scaffold platform is modified' },
      c2: { source: { kind: 'corrective', id: 'ca1' }, next: 'Replace three sheets and reseal' },
      c3: { source: { kind: 'change', id: 'ch1' }, next: 'Customer to issue the zone B permit' },
      c4: { source: { kind: 'change', id: 'ch1' }, blocker: 'Waiting for the customer decision on CH-P1-004', next: 'Start zone A within 2 days of the decision',
            history: [{ at: '2026-10-09T10:00', by: 'u-pm', from: '2026-10-14', to: '2026-10-21', reason: 'Waiting for decision on change CH-P1-004' }] },
      c5: { source: null, next: '' },
      c6: { source: { kind: 'milestone', id: 'm18' }, next: 'Membrane crew mobilises after substrate release' },
      c7: { source: { kind: 'document', id: 'd6', rev: '0' }, blocker: 'Customer acceptance of the PR-02 scaffold is pending', next: 'Joint walkdown and acceptance',
            history: [{ at: '2026-10-12T09:00', by: 'u-pm', from: '2026-10-14', to: '2026-10-17', reason: 'Customer acceptance pending' }] },
      c20: { source: { kind: 'milestone', id: 'm22' }, forecast: '2026-10-20', blocker: 'Access permit for bays 9–12', next: 'Erect bays 9–12 when the permit is issued' },
      c21: { source: null, next: 'Confirm survey date to RGS' },
      c22: { source: { kind: 'request', id: 'r20' }, next: 'Reply with the access plan' },
      c30: { source: { kind: 'milestone', id: 'm28' }, next: 'Crew induction on site' },
      c40: { source: { kind: 'document', id: 'd41', rev: '0' }, next: '' },
      c41: { source: null, next: 'Agree walkdown time' }
    };
    F.commitments.forEach(function (c) {
      var x = CM[c.id] || {};
      Object.assign(c, { source: x.source || (c.requestId ? { kind: 'request', id: c.requestId } : null), forecast: x.forecast || c.revised || c.promised, blocker: x.blocker || c.riskReason || '',
        next: x.next || '', history: x.history || [], visibility: 'customer', createdBy: c.ownerId, version: 1 });
    });
    F.commitments.push(
      { id: 'c8', ref: 'C-P1-023', projectId: 'p1', packageId: 'wp1', party: 'rgs', ownerId: 'u-qa', text: 'Verify toe-board rework on SCF-TF-002 (CA-P1-022)', textAr: 'التحقق من إعادة تركيب ألواح الحماية على SCF-TF-002 (CA-P1-022)',
        promised: '2026-10-14', revised: null, doneAt: null, riskReason: null, source: { kind: 'corrective', id: 'ca3' }, forecast: '2026-10-14', blocker: '', next: 'Site check with the supervisor',
        history: [], visibility: 'internal', createdBy: 'u-hse', version: 1 },
      { id: 'c9', ref: 'C-P1-024', projectId: 'p1', packageId: 'wp2', party: 'rgs', ownerId: 'u-qa', text: 'Return review of ITP-P1-INS-003 Rev 1', textAr: 'إعادة مراجعة ITP-P1-INS-003 المراجعة 1',
        promised: '2026-10-16', revised: null, doneAt: null, riskReason: null, source: { kind: 'document', id: 'd3', rev: '1' }, forecast: '2026-10-16', blocker: '', next: 'Complete the review in the document workspace',
        history: [], visibility: 'customer', createdBy: 'u-pm', version: 1 },
      { id: 'c10', ref: 'C-P1-025', projectId: 'p1', packageId: 'wp2', party: 'rgs', ownerId: 'u-qa', text: 'Hold point INS-P1-0016 with customer witness', textAr: 'نقطة التوقف INS-P1-0016 بحضور شاهد العميل',
        promised: '2026-10-21', revised: null, doneAt: null, riskReason: null, source: { kind: 'inspection', id: 'i6' }, forecast: '2026-10-21', blocker: 'Insulation at T-105 north elevation must be complete first', next: 'Confirm readiness two days ahead',
        history: [], visibility: 'customer', createdBy: 'u-pm', version: 1 });

    // Dependencies between packages and milestones. No schedule impact is calculated from these.
    F.dependencies = [
      { id: 'dep1', ref: 'DEP-P1-001', projectId: 'p1', predecessor: { kind: 'milestone', id: 'm15' }, dependent: { kind: 'milestone', id: 'm10' }, blocker: 'PR-02 scaffold inspected and tagged before fireproofing starts', ownerId: 'u-ss', resolutionTarget: '2026-10-10', status: 'resolved', resolvedAt: '2026-10-10T16:00', resolvedBy: 'u-pm', history: [], version: 2 },
      { id: 'dep2', ref: 'DEP-P1-002', projectId: 'p1', predecessor: { kind: 'milestone', id: 'm16' }, dependent: { kind: 'milestone', id: 'm10' }, blocker: 'Customer acceptance of the PR-02 scaffold before zone A application', ownerId: 'u-pm', resolutionTarget: '2026-10-12', status: 'open', resolvedAt: null, resolvedBy: null, history: [], version: 1 },
      { id: 'dep3', ref: 'DEP-P1-003', projectId: 'p1', predecessor: { kind: 'milestone', id: 'm7' }, dependent: { kind: 'milestone', id: 'm4' }, blocker: 'T-105 cladding finished before tank farm scaffold is dismantled', ownerId: 'u-ss2', resolutionTarget: '2026-10-25', status: 'open', resolvedAt: null, resolvedBy: null, history: [], version: 1 },
      { id: 'dep4', ref: 'DEP-P2-001', projectId: 'p2', predecessor: { kind: 'milestone', id: 'm22' }, dependent: { kind: 'milestone', id: 'm25' }, blocker: 'Jetty scaffold erected before steel release for fireproofing', ownerId: 'u-pm2', resolutionTarget: '2026-10-20', status: 'open', resolvedAt: null, resolvedBy: null, history: [], version: 1 }
    ];

    F.reports = [];  // reports are generated from records in the report centre, never typed in
    F.handoverPackages = [
      { id: 'hp1', ref: 'HP-P4-001', projectId: 'p4', packageId: 'wp8', pkgVersion: 1, status: 'issued', title: 'Block 3 basement waterproofing — handover package',
        manifest: [{ kind: 'document', id: 'd41', rev: '0' }, { kind: 'document', id: 'd40', rev: '1' }, { kind: 'inspection', id: 'i40', rev: 1 }, { kind: 'evidence', id: 'ev41', version: 1 }, { kind: 'evidence', id: 'ev42', version: 1 }],
        preparedBy: 'u-om', createdAt: '2026-10-06T10:00', review: { by: 'u-qa', at: '2026-10-06T15:00', outcome: 'ready', reason: 'Records complete for issue' },
        issuedAt: '2026-10-07T09:00', issuedBy: 'u-om', recipients: ['u-wv'], acknowledgements: [{ userId: 'u-wv', at: '2026-10-08T10:15' }], acceptance: null, amendReason: null, supersedes: null, supersededBy: null, history: [], version: 4 }
    ];
    F.releases = [];

    // TEST handover requirements and release prerequisites (isolated examples, labelled in the interface).
    var REQ = function (doc, insp, excl) {
      return [{ type: 'document', category: doc }, { type: 'inspection', inspectionType: insp }, { type: 'no_blocking_findings', classifications: ['nonconformance', 'hse_concern'] },
        { type: 'no_open_corrective' }, { type: 'customer_decisions' }, { type: 'completion_evidence', excludeMilestones: excl }, { type: 'acceptance' }];
    };
    F.demoHandoverRequirements = { label: 'Test handover requirements (demo fixture) — not RGS criteria', packages: { wp4: REQ('handover_record', 'pre_handover', ['m16']), wp8: REQ('handover_record', 'pre_handover', ['m34']), wp2: REQ('handover_record', 'pre_handover', []) } };
    F.demoReleasePrerequisites = { label: 'Test release prerequisites (demo fixture) — not RGS criteria', packages: { wp4: ['readiness_complete', 'internal_review', 'customer_acceptance'], wp8: ['readiness_complete', 'internal_review', 'customer_acceptance'] } };
    F.authorities.push(
      { id: 'DA-0701', userId: 'u-om', action: 'asset.release', scope: { projectId: 'p1' }, grantedBy: 'u-adm', grantedAt: '2026-09-30T10:00', nominatedBy: 'u-gm', status: 'active', validFrom: '2026-10-01', validTo: '2026-12-31', validUntil: '2026-12-31T23:59:00+03:00', timezone: 'Asia/Riyadh (UTC+3)', revokedAt: null, testExample: true },
      { id: 'DA-0702', userId: 'u-pm', action: 'asset.release', scope: { projectId: 'p1' }, grantedBy: 'u-adm', grantedAt: '2026-06-30T10:00', nominatedBy: 'u-om', status: 'active', validFrom: '2026-07-01', validTo: '2026-09-30', validUntil: '2026-09-30T23:59:00+03:00', timezone: 'Asia/Riyadh (UTC+3)', revokedAt: null, testExample: true });
  })();
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  else root.RGSFixtures = F;
})(typeof globalThis !== 'undefined' ? globalThis : this);
