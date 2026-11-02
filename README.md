# Sovara

The RGS Client Portal and the tooling used to build it.

| Path | What it is |
|---|---|
| [`rgs-portal/`](rgs-portal/README.md) | **The product.** Static prototype of the portal (English and Arabic), its automated tests and the code-built 3D badge. |
| [`docs/PRODUCTION-PLAN.md`](docs/PRODUCTION-PLAN.md) | Plan to turn the prototype into a production system (TypeScript, PostgreSQL, Azure in Saudi Arabia). |
| `.github/workflows/portal-checks.yml` | CI: runs the portal tests on every push. |
| `react-bits-lab/` | Optional playground for [React Bits](https://github.com/DavidHDev/react-bits) components (Vite + React). **Not used by the portal.** |
| `gate-bench/` | Early benchmark page used to compare design directions. Reference only. |
| `design-references/` | Design-system references (awesome-design-md) used while designing. |
| `.claude/skills/`, `.agents/skills/` | Agent skills installed for this project (design review, accessibility, 3D, graphing). `skills-lock.json` pins them. |
| `graphify-out/` | Generated knowledge graph of the repo (`graphify query "<question>"`). Rebuilt with `graphify update .`; large diffs here are expected. |
| `AGENTS.md`, `CLAUDE.md` | Instructions for coding agents working in this repo. |

## Quick start

```bash
npm install
npx playwright install chromium
npm run serve     # portal at http://localhost:8080
npm test          # crawl, workflows, admin, Arabic, mobile, accessibility
```

See [`rgs-portal/README.md`](rgs-portal/README.md) for the portal's structure and what each test covers.

## Status

Prototype only: sign-in is a persona picker and all data is invented and kept in the browser. Nothing here is production-ready until the backend stages in the plan are built.

## Demo hosting

A private demo is hosted on Vercel (`rgs-client-portal-demo`). Production must be hosted in Saudi Arabia (see the plan).
