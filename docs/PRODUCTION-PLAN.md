# RGS Client Portal — production plan

Status: **approved decisions recorded 2 Nov 2026** (§1 and §1a). Nothing here is built yet except the front-end prototype in `rgs-portal/`, which is the executable specification.

## 1. Decisions taken

| Topic | Decision |
|---|---|
| Goal | Production system for RGS staff and customer companies |
| Size | Under 50 users, small number of projects |
| Schedule | **Staged release approved** (§5): first live ≈ week 8, rest over months 3–6 |
| Stack | TypeScript (Next.js / Node) + PostgreSQL |
| Hosting | Microsoft Azure, Saudi Arabia region (confirm region and service availability) |
| Sign-in | Staff: company single sign-on (Microsoft Entra ID). Customers: email + password with MFA. |
| Data at launch | Start empty; users enter everything |
| Files | Object storage in the Saudi region (Azure Blob), checksum + malware scan |
| Notifications | In-portal, email, WhatsApp/SMS, push (installable web app) |
| Field use | Undecided; start with a responsive web app, revisit after crew feedback |
| Compliance | Saudi PDPL, ISO 27001-style controls, record retention periods |
| AI | **Left out of launch**; the rule-based briefing stays. Revisit when a Saudi-region option and a PDPL basis exist (risk R1) |
| Git | One pull request per stage into `main` |
| RGS decision owner | **Not assigned yet** (see §6): the main blocker |


## 1a. Build decisions (answered 2 Nov 2026)

| Topic | Decision |
|---|---|
| Code location | New `app/` folder in this repo; `rgs-portal/` stays as the executable spec and its tests keep running |
| Infrastructure as code | Bicep; RGS IT runs the templates, the builder never holds cloud credentials |
| Database library | Drizzle ORM on PostgreSQL, SQL migrations reviewed in pull requests |
| Customer sign-in | Microsoft Entra External ID (email + password + MFA, invitation only, in-region) |
| Staff sign-in | Microsoft Entra ID single sign-on |
| Sessions | MFA for everyone; 30 minute idle timeout; 12 hour maximum session |
| Email | Azure Communication Services Email, from a verified RGS domain |
| Working week | Sunday to Thursday (Friday and Saturday are the weekend); time zone Asia/Riyadh |
| Retention | 10 years after project closure for project records and the audit log (configurable per record type) |
| Project setup | Operations and project managers create projects, packages, areas and milestones; the administrator can override |
| Files | 100 MB maximum; PDF, images, Office files and DWG; checksum and malware scan |
| Environments | Dev, staging and production |
| Address | A subdomain of RGS's domain (e.g. `portal.<rgs-domain>`); RGS IT adds the DNS record |
| Pull requests | One per stage into `main` |

### Stage 0 deliverables (built on branch `claude/stage-0-foundations`)

1. `app/` Next.js + TypeScript skeleton with strict TypeScript, linting, unit and end-to-end test runners, and the Sunday–Thursday working-calendar helper.
2. Drizzle schema and migrations for organisations, users, role assignments, delegated authorities, projects, audit log and support requests; append-only audit table; row-level-security policies.
3. A port of `rbac.js` as a server module, with the prototype's permission tests converted into automated server tests (the prototype stays the oracle).
4. `infra/` Bicep templates for dev, staging and production: PostgreSQL, Blob storage, App Service, Key Vault, Entra app registrations (documented), Communication Services, monitoring, backups.
5. CI: lint, type-check, tests, migration check and a Bicep validation on every push.
6. A runbook for RGS IT: what to deploy, in what order, and which values they must supply.

## 2. Target architecture

- **Web app**: Next.js (App Router), server-rendered; the existing portal screens are ported screen by screen. English and Arabic with full right-to-left support.
- **API**: Next.js route handlers (or a separate Node service) exposing the same commands the prototype already uses (`request.create`, `document.publish`, …). Each command is one transaction, checks permission, writes the audit entry, and returns the new state. The prototype's `api.js` is the executable specification.
- **Permissions**: the prototype's `rbac.js` rules move to the server unchanged in meaning (role + scope + delegated authority + organisation boundary). **The browser never decides access.** PostgreSQL row-level security as a second layer.
- **Database**: Azure Database for PostgreSQL (Saudi region). Append-only audit table. Soft deletes only.
- **Files**: Azure Blob Storage, private, short-lived signed links, SHA-256 on upload, Defender malware scan before a file becomes visible.
- **Identity**: Entra ID for staff; Entra External ID (or equivalent) for customers with email + password + MFA. No passwords in our database.
- **Notifications**: queue + worker; email via Azure Communication Services; WhatsApp/SMS via an approved provider; web push for the installable web app.
- **Observability**: structured logs, error tracking, uptime checks, daily backups with a tested restore.
- **AI**: server-side only, receives only records the requesting user may already open, every call logged. See R1 before enabling.

## 3. Stages (one pull request each)

| Stage | Contents | Depends on |
|---|---|---|
| 0. Foundations | Repo layout, CI, environments, database schema and migrations, seed of roles/organisations, secrets handling, Azure resources as code | Azure subscription |
| 1. Identity, users, roles, audit | Sign-in (SSO + customer MFA), invitations, user/role/authority administration, audit log, support requests | Stage 0 |
| 2. Requests, approvals, instructions | Request wizard, triage, instructions/changes, customer decisions | Stage 1 |
| 3. Documents, inspections, handover | Document control, review and publish, inspections, findings, corrective actions, handover | Stage 2 |
| 4. Progress, reports, commitments | Progress, daily updates, commitments, reports, oversight | Stage 3 |
| 5. Notifications and AI | Email/WhatsApp/push, Claude assistant | Stages 1–4 |
| 6. Hardening and go-live | Penetration test, PDPL review, backup restore drill, load test, runbooks | All |

Front-end work that does not depend on the backend continues in parallel (§7).

## 4. Compliance design notes

- **PDPL**: record of processing, lawful basis and consent for notification channels, access and erasure request handling, breach-notification procedure, data stays in the Kingdom (R1 is the exception to resolve).
- **ISO 27001-style**: documented access reviews (the Roles screen is the evidence), append-only audit log, least privilege, separation of duties (already enforced in the prototype: nobody approves their own work), encryption in transit and at rest, backups and restore tests.
- **Retention**: configurable per record type; legal hold; retention clock starts at project closure. Periods to be confirmed by RGS (§6).

## 5. Timeline: what is realistic

All four launch areas (identity and audit, requests and approvals, documents/inspections/handover, progress/reports/commitments) plus Saudi-region infrastructure, notifications, an AI assistant and PDPL controls **cannot be delivered and safely tested in 1–2 months** by one team, even with the prototype as a specification.

Suggested split:

- **Weeks 1–8 (first live release)**: Stages 0–2 plus support, with Stage 3 read-only. Real sign-in, users, roles, audit, requests, approvals and instructions in production for the initial group.
- **Months 3–4**: Stage 3 fully (documents, inspections, handover).
- **Months 4–6**: Stage 4, Stage 5, Stage 6 hardening.

If a hard date for everything is fixed, the options are to cut scope (e.g. defer the AI assistant and WhatsApp) or add people. Tell me which.

## 6. Open items needing an RGS owner

No RGS decision owner is assigned. These block go-live and should have a name next to each:

1. Policy values now left "Not configured": response targets by priority, document review routing per project and category, instruction lifecycle sign-off, retention periods, working calendar.
2. Support contact details (phone, email, hours) and the emergency number.
3. Native-speaker review of all Arabic text (about 700 strings).
4. Data-protection officer / PDPL owner and the written lawful-basis decisions.
5. Azure subscription, Entra tenant administrator, domain name and email sender address.
6. WhatsApp Business account owner and message templates.
7. Who may hold delegated technical authorities and who nominates them.

## 7. Parallel front-end work (no backend dependency)

- Finish the administration screens (grant authority, edit user role, organisations, staff side of support).
- Commit the automated checks (crawl, accessibility, workflow tests) and run them in CI on every push.
- Arabic and right-to-left pass on every screen.
- README, repository clean-up, favicon.

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Claude API data residency.** Sending record content to the Anthropic API sends personal and project data outside the Kingdom, which PDPL restricts. | Decide before Stage 5: (a) a deployment of Claude in a Saudi region if one is available through Azure/AWS, (b) strip personal data and use rule-based answers only, or (c) obtain a documented cross-border transfer basis. Do not enable the assistant until chosen. |
| R2 | Timeline (§5). | Staged release; cut scope explicitly. |
| R3 | No decision owner. | Name one this week. |
| R4 | Prototype rules are browser-only and untested against concurrency. | Rebuild enforcement on the server and port the prototype's workflow checks as automated tests first. |
| R5 | Customers on personal email accounts. | Customer MFA by authenticator app or SMS; invitation-only, no self-registration. |
| R6 | Azure Saudi region service gaps. | Confirm availability of Database for PostgreSQL, Blob, Communication Services and Entra External ID in the target region in Stage 0. |

## 9. Stage 0 status

Built and tested (see `app/`, `infra/`, `docs/RUNBOOK.md`):

- **Access rules ported to the server** with a parity test against the prototype: identical decisions for every person, action and record (over 20,000 combinations), ten account-change scenarios and 5,000+ grant cases. The rule tables are generated from the prototype and CI fails if they drift.
- **Database**: schema and migrations; the application login sees nothing without a signed-in identity; **row-level security** matches the TypeScript rules for projects, packages and areas for every demo person; support requests are private to their author and administrators.
- **Audit log**: append-only (update, delete and truncate are refused even for the owner), hash-chained, with a verification function that finds a tampered entry.
- **Integrity rules in the database**: no self-granted authority, authority at most 12 months, nomination required, only delegable actions can be delegated, role side must match the person's organisation, case-insensitive unique emails and organisation names.
- **Both test databases**: the same 27 database tests pass on in-memory PostgreSQL and on real PostgreSQL 16.
- **Working calendar** (Sunday to Thursday, Riyadh time), **environment validation**, **health endpoint** with security headers, a bundled **migration tool**.
- **Bicep templates** for dev, staging and production compile and validate; **not yet deployed** (needs RGS IT and the open items in §6).

Not in Stage 0 (Stage 1 next): sign-in (Entra), invitation and user administration commands, the audited command layer that writes data, and the first screens.
