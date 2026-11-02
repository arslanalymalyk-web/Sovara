# Graph Report - Sovara  (2026-11-02)

## Corpus Check
- 61 files · ~269,174 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 881 nodes · 3036 edges · 28 communities (20 shown, 8 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 394 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- pages.js group
- pages-stage5.js group
- pages-stage3.js group
- createApi() group
- pages-stage4.js group
- app.js group
- pages-stage6.js group
- pages-stage6b.js group
- create() group
- build.mjs group
- pages-stage3b.js group
- docVisible() group
- briefing() group
- canSee() group
- allowed() group
- ponytail-help skill group
- readiness() group
- inbox() group
- rbac.js group
- /graphify trigger group

## God Nodes (most connected - your core abstractions)
1. `create()` - 172 edges
2. `esc()` - 73 edges
3. `t()` - 73 edges
4. `createApi()` - 68 edges
5. `ST()` - 51 edges
6. `U()` - 45 edges
7. `ST()` - 33 edges
8. `ST()` - 31 edges
9. `recLink()` - 30 edges
10. `packagePage()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `AGENTS.md (Ponytail lazy senior dev mode)` --semantically_similar_to--> `ponytail skill`  [INFERRED] [semantically similar]
  AGENTS.md → .claude/skills/ponytail/SKILL.md
- `Smallest complete change rule` --rationale_for--> `ponytail skill`  [INFERRED]
  AGENTS.md → .claude/skills/ponytail/SKILL.md
- `canAny()` --indirect_call--> `D()`  [INFERRED]
  rgs-portal/app.js → gate-bench/build.mjs
- `denialFor()` --indirect_call--> `D()`  [INFERRED]
  rgs-portal/app.js → gate-bench/build.mjs
- `renderApp()` --indirect_call--> `D()`  [INFERRED]
  rgs-portal/app.js → gate-bench/build.mjs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Ponytail skill suite** — claude_skills_ponytail_skill, claude_skills_ponytail_review_skill, claude_skills_ponytail_audit_skill, claude_skills_ponytail_debt_skill, claude_skills_ponytail_gain_skill, claude_skills_ponytail_help_skill [EXTRACTED 1.00]

## Communities (28 total, 8 thin omitted)

### Community 0 - "pages.js group"
Cohesion: 0.10
Nodes (106): actionButton(), actionRowCompact(), actionsForRecord(), actionsPage(), comTable(), sel(), activityBody(), activityPage() (+98 more)

### Community 1 - "pages-stage5.js group"
Cohesion: 0.10
Nodes (74): aiInspection(), aiQualityCard(), API(), areaName(), caForm(), calendar(), can(), canAnywhere() (+66 more)

### Community 2 - "pages-stage3.js group"
Cohesion: 0.10
Nodes (72): addFiles(), API(), areaName(), areaOptions(), canCreateAny(), choiceCards(), doneFileIds(), draftReply() (+64 more)

### Community 3 - "createApi() group"
Cohesion: 0.05
Nodes (53): createApi(), addComment(), addMessage(), allow(), bump(), caMove(), canDecide(), caNeed() (+45 more)

### Community 4 - "pages-stage4.js group"
Cohesion: 0.11
Nodes (60): API(), areaName(), blobUrl(), can(), CATS(), catTag(), checkLine(), checksPage() (+52 more)

### Community 5 - "app.js group"
Cohesion: 0.12
Nodes (54): D(), accessCard(), actLabel(), aiCard(), applyEnv(), authoritiesOf(), byId(), canAny() (+46 more)

### Community 6 - "pages-stage6.js group"
Cohesion: 0.11
Nodes (51): addLineForm(), API(), areaName(), can(), canAnywhere(), currentDupId(), decRow(), dupDetail() (+43 more)

### Community 7 - "pages-stage6b.js group"
Cohesion: 0.13
Nodes (45): API(), audienceFor(), candidates(), captureForm(), cmNewPage(), commitmentDetail(), commitmentsPage(), csvFor() (+37 more)

### Community 8 - "create() group"
Cohesion: 0.07
Nodes (35): create(), audienceFor(), changes(), correctives(), countedUpdates(), dependencyProblem(), depNode(), docRes() (+27 more)

### Community 9 - "build.mjs group"
Cohesion: 0.09
Nodes (36): add(), at(), BAYS, BLOCK_PAD, body, CART, cartridge(), CRADLE_PAD (+28 more)

### Community 10 - "pages-stage3b.js group"
Cohesion: 0.18
Nodes (38): actionDecision(), API(), areaList(), authorityBlock(), authorityCards(), decisionForm(), decisionPage(), decisionRow() (+30 more)

### Community 11 - "docVisible() group"
Cohesion: 0.13
Nodes (28): custDocVisible(), customerReviewRequired(), customerReviewSetting(), custRevVisible(), dcWorkspace(), docCentre(), docChecks(), docControls() (+20 more)

### Community 12 - "briefing() group"
Cohesion: 0.15
Nodes (26): actionsFor(), actionStatus(), actionView(), allActions(), awaitingCustomer(), briefing(), commitmentRegister(), commitments() (+18 more)

### Community 13 - "canSee() group"
Cohesion: 0.11
Nodes (23): today(), activity(), aiQuality(), canSee(), caOverdue(), chainFinding(), chainFor(), correctiveList() (+15 more)

### Community 14 - "allowed() group"
Cohesion: 0.21
Nodes (22): allowed(), authorityFor(), caControls(), can(), cmControls(), dailyUpdateAccess(), dupControls(), dupReviewer() (+14 more)

### Community 15 - "ponytail-help skill group"
Cohesion: 0.18
Nodes (16): AGENTS.md (Ponytail lazy senior dev mode), Never cut list (validation, security, accessibility), shortcut: comment convention, ponytail-audit skill, Audit findings groups (Must fix, Should fix, Nice to have), ponytail-debt skill, Shortcut debt ledger, ponytail-gain skill (+8 more)

### Community 16 - "readiness() group"
Cohesion: 0.20
Nodes (16): acceptanceFlags(), decisionFlags(), get(), handoverDashboard(), handoverSetting(), hpCurrentIssued(), hpVersions(), manifestCheck() (+8 more)

### Community 17 - "inbox() group"
Cohesion: 0.15
Nodes (14): aiContext(), decisionCheck(), inbox(), instructions(), instructionView(), notesFor(), pendingCustomerDecisions(), pendingDecisions() (+6 more)

### Community 18 - "rbac.js group"
Cohesion: 0.39
Nodes (11): aiCan(), byId(), can(), canAnywhere(), canGrant(), deny(), inWindow(), isView() (+3 more)

### Community 20 - "/graphify trigger group"
Cohesion: 0.40
Nodes (5): Root CLAUDE.md (graphify rules), Claude project instructions (.claude/CLAUDE.md), /graphify trigger, graphify-out knowledge graph, graphify query-first rule

## Knowledge Gaps
- **8 isolated node(s):** `Claude project instructions (.claude/CLAUDE.md)`, `Never cut list (validation, security, accessibility)`, `Root CLAUDE.md (graphify rules)`, `Audit findings groups (Must fix, Should fix, Nice to have)`, `Shortcut debt ledger` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `person()` connect `pages.js group` to `pages-stage3.js group`, `pages-stage4.js group`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Are the 149 inferred relationships involving `create()` (e.g. with `store.js` and `acceptanceFlags()`) actually correct?**
  _`create()` has 149 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Claude project instructions (.claude/CLAUDE.md)`, `Never cut list (validation, security, accessibility)`, `Root CLAUDE.md (graphify rules)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pages.js group` be split into smaller, more focused modules?**
  _Cohesion score 0.10075969612155138 - nodes in this community are weakly interconnected._
- **Why does `uid()` connect `createApi() group` to `pages.js group`, `readiness() group`?**
  _High betweenness centrality (0.222) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `createApi()` (e.g. with `api.js` and `dispatch()`) actually correct?**
  _`createApi()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `pages-stage5.js group` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._