# RGS Client Portal (prototype)

A static, no-build web portal: one `index.html`, plain JavaScript modules and invented demo data (`fixtures/`). English and Arabic (right-to-left). It is the executable specification for the production system described in [`docs/PRODUCTION-PLAN.md`](../docs/PRODUCTION-PLAN.md).

> Everything runs in the browser. Sign-in is a persona picker, nothing is sent to a server, and access rules are enforced client-side only. Do not put real data in it.

## Run it

```bash
npm run serve        # then open http://localhost:8080
```

Pick a persona on the sign-in page (13 are provided: customer viewer/requester/approver, general manager, operations manager, project manager, site officer, service supervisor, QA/QC inspector, HSE officer, document controller, portal administrator). "Reset demo records" in the user menu restores the fixtures.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Markup and all CSS (design tokens at the top, the "framed sheet" shell layer near the end) |
| `app.js` | Shell, sign-in, routing, rendering |
| `rbac.js` | Roles, scopes, delegated authority and the permission check |
| `store.js` | Read model: visibility rules, derived status, registers |
| `api.js` | Command layer: every change is one audited, permission-checked, all-or-nothing command |
| `pages*.js`, `pages-admin.js` | Screens, one file per area |
| `i18n*.js` | English and Arabic strings (Arabic awaits native-speaker review) |
| `fixtures/demo-fixtures.js` | Invented demo records |
| `3d/` | The code-built RGS badge shown on the sign-in screen (sources and build) |
| `tests/` | Automated checks (below) |

## Tests

```bash
npx playwright install chromium   # once
npm test                          # crawl, workflows, mobile, accessibility
```

| Command | Checks |
|---|---|
| `npm run test:crawl` | Every persona opens every screen it can reach with no script or console errors |
| `npm run test:workflows` | Approvals, request wizard to triage, inspection verification, upload keeps typed text, user suspend/sign-in block/audit, customer support request |
| `npm run test:mobile` | At 390px: no sideways page scroll, no text under 12px, no buttons or fields under 44px |
| `npm run test:a11y` | axe-core WCAG 2.0/2.1 A and AA plus best practice, light and dark, no violations allowed |

The same four run in CI (`.github/workflows/portal-checks.yml`). To use a browser already installed on your machine, set `PW_CHROMIUM_PATH` to its executable.

## Hosting the demo

The demo is deployed to Vercel as `rgs-client-portal-demo` from this folder (no build step). It is private (Vercel login required) and follows the `claude/brave-hawking-95alzj` branch. The production system will **not** run on Vercel: data must stay in Saudi Arabia (see the plan).
