/*
 * Deployment configuration.
 *   dataSource: 'fixtures' — loads fixtures/demo-fixtures.js (invented records) and shows a fixture banner.
 *               'api'      — production path. The server API is not built yet, so the app shows a
 *                            "server not connected" state and no records rather than inventing any.
 *
 * policy — every value here is a placeholder for RGS to confirm. Nothing below is an RGS commitment.
 */
var RGS_CONFIG = {
  dataSource: 'fixtures',
  policy: {
    // Target response times in working days, by priority. Empty = not configured: triage must enter a date.
    responseTargets: {},
    // Request types whose completion needs a designated verifier before the customer is asked to acknowledge.
    verificationRequired: ['site_issue', 'inspection', 'handover_support'],
    // Suggested owner role per request type (triage can choose someone else and the choice is recorded).
    routing: { info: 'project_manager', document: 'document_controller', inspection: 'qa_qc_inspector', site_issue: 'service_supervisor', scope_change: 'project_manager', handover_support: 'project_manager' },
    // Self-approval: a person may never decide on an instruction they issued or work they submitted.
    allowSelfApproval: false,
    // Instruction lifecycle shown as PROPOSED until RGS signs it off as procedure.
    lifecycleStatus: 'proposed',
    // Drafts older than this many days are flagged in the request centre (not deleted).
    draftStaleDays: 14,
    // ---- Stage 4: document control (all PROPOSED, for RGS to confirm) ----
    documents: {
      categories: ['drawing', 'method_statement', 'specification', 'material_submission', 'itp', 'inspection_record', 'certificate', 'report', 'handover_record'],
      // Review outcomes (decided 13 Oct 2026). A revision's review closes when every REQUIRED reviewer has recorded one;
      // the strictest stands: rejected > revise_resubmit > accepted_comments > accepted. Optional reviewers never block.
      reviewOutcomes: ['accepted', 'accepted_comments', 'revise_resubmit', 'rejected'],
      publishableOutcomes: ['accepted', 'accepted_comments'],
      transmittalPurposes: ['for_information', 'for_review', 'for_construction', 'for_acceptance'],
      maxFileMB: 50,
      // Reminder period for acknowledging a transmittal, in calendar days. A reminder only: an unanswered
      // acknowledgement never implies acceptance.
      acknowledgeReminderDays: 7,
      // Review routing per project AND category: 'customer_required' or 'rgs_only', e.g.
      //   { p1: { material_submission: 'customer_required', method_statement: 'rgs_only' } }
      // NOT CONFIGURED (missing entry) blocks issuance with "Review routing not configured"; it never bypasses
      // customer review silently. Empty until RGS confirms the rules.
      reviewRouting: {},
      // Required document sets per service package. Empty means none configured; the portal never invents them.
      // Demo fixtures may add an EXAMPLE set (clearly labelled) for review.
      requirements: {}
    },
    evidence: { maxFileMB: 25 },
    // ---- Stage 5: inspections, findings and corrective actions (all PROPOSED, for RGS to confirm) ----
    inspections: {
      types: ['hold_point', 'surveillance', 'release', 'scaffold_inspection', 'pre_handover', 'reinspection'],
      // Item results. Fail and Not applicable need a reason; a required item left Not assessed blocks submission.
      results: ['pass', 'fail', 'na', 'not_assessed'],
      // The person who recorded the field assessment may not also verify it, unless RGS approves a policy allowing it.
      allowSelfVerification: false,
      // Customers see an inspection only after someone authorised publishes it.
      customerPublication: 'explicit'
    },
    findings: {
      classifications: ['observation', 'nonconformance', 'hse_concern'],
      severities: ['low', 'medium', 'high', 'critical'],   // proposed severity; not an RGS scale yet
      // Escalation rules by classification/severity. Empty = not configured: escalation is manual, to a named person.
      escalation: {}
    },
    corrective: {
      // An action owner may never verify their own closure unless RGS approves a policy allowing it.
      allowSelfVerification: false
    },
    // ---- Stage 6: progress, commitments, reports, handover and release (all PROPOSED, for RGS to confirm) ----
    progress: {
      // Methods a package may use. A package has a method only through an approved progress configuration
      // record; without one the portal shows "Progress method not configured" and never invents a percentage.
      methods: ['weighted_milestones', 'quantities'],
      // Approved milestone weights in a package must total exactly this value.
      weightTotal: 100,
      // A daily update is reviewed by the package supervisor, or by the project manager when the supervisor wrote it.
      reviewRouting: 'supervisor_then_pm'
    },
    dependencies: {
      // Overdue rules (deterministic): an open dependency is overdue when its resolution target has passed, and
      // flagged when the predecessor's forecast is later than the dependent's forecast. No schedule impact is calculated.
      flagSequenceConflict: true
    },
    reports: {
      types: ['progress', 'commitments', 'quality', 'handover'],
      // The reviewer must be someone other than the author.
      separateReviewer: true
    },
    handover: {
      // Requirements per package, from project-approved criteria. Empty = "Handover requirements not configured".
      // Shape: { wp4: [{ type: 'document', category: 'handover_record' }, { type: 'inspection', inspectionType: 'pre_handover' }, ...] }
      requirements: {}
    },
    release: {
      // Release prerequisites per package. Empty = release unavailable ("Release prerequisites not configured").
      // Shape: { wp4: ['readiness_complete', 'internal_review', 'customer_acceptance'] }
      prerequisites: {}
    }
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = RGS_CONFIG; else window.RGS_CONFIG = RGS_CONFIG;
