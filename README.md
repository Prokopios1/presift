# B2B Assessment Engine (PreSift) — Candidate Pre-Screening Platform

> B2B psychometric pre-screening: candidates complete a short assessment, recruiters receive scored intelligence profiles with structured interview prompts.
> **Firebase project:** `presift` · **Live:** https://presift.web.app · **Status:** prod-deployable, pre-launch (66/66 unit tests green)

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript, Tailwind 4, shadcn/ui (Radix), Recharts, Zod, react-hook-form |
| Backend | Firebase Cloud Functions (Node.js + TypeScript) — 5 HTTPS callables + 1 HTTP + 1 pubsub cron |
| DB | Firestore: `users`, `candidates`, `sessions`, `assessments`, `users/{id}/creditAuditLog` |
| Hosting | Firebase Hosting SPA (`dist/`), rewrite `**` → `index.html`, `/api/integrity` → CF |
| Auth | Firebase Auth (planned; `firestore.rules` currently in DEV/DEMO open mode — production rules commented in `firestore.rules`) |
| Storage | Bucket configured, unused |

## Core Scoring Engines (`functions/src/`)

- **ICAR-16** — fluid intelligence; IRT 3PL (difficulty b, discrimination a, guessing c), EAP theta over [−6, 6] step 0.025 with MLE fallback, mapped to normed scale (μ=100, σ=15). Domains: Numerical, Verbal, Abstract, Spatial.
- **WLEIS-16** — emotional intelligence, 4 subscales (SEA/OEA/UOE/ROE), 7-point Likert with reverse scoring (8 − x).
- **Anti-cheat** — server-side item parameterization (`crypto.getRandomValues` seeding + Fisher–Yates shuffle); clients receive only a fully resolved session instance; answer keys never leave the server; submission validation rejects tampered `correctAnswerKey`.

## API Surface

| Endpoint | Type | Purpose |
|---|---|---|
| `startSession` | callable | Instantiate + seed unique assessment session |
| `submitAssessment` | callable | Validate + score submission (ICAR + WLEIS) |
| `createAssessmentLink` | callable | Recruiter creates candidate invite |
| `topUpCredits` | callable | Credit purchase (mock Stripe) |
| `generateB2BInvoice` | callable | Company/email/VAT invoice generation |
| `integrity` | HTTP | Hosting rewrite health check |
| `checkAbandonedSessions` | pubsub | 24h sweep of abandoned sessions |

## Structure

```
b2b-assessment-engine/
├── src/                    # React app
│   ├── App.tsx             # Router: /, /admin, /dashboard, /test/:id, /assessment/:id, /demo
│   ├── pages/              # LandingPage, DashboardPage, AdminPage, TestPage, DemoPage
│   ├── components/         # DevToolbar (dev-only), ThemeToggle, ui/* (shadcn)
│   └── lib/                # firebase.ts (client SDK + emulator wiring)
├── functions/
│   ├── src/index.ts        # All 7 endpoints
│   ├── src/psychometrics.ts# IRT 3PL + WLEIS scoring
│   ├── src/session.ts      # Parameterized item resolution, seeding, shuffling
│   ├── src/submission.ts   # Strict validation, forbidden-key guards
│   ├── src/seeder.ts       # Demo data
│   └── src/data/presift-bank.json  # Item bank v1.0.0
├── e2e/                    # Playwright suite (emulators + live dev server)
├── firestore.rules         # ⚠️ DEV open rules active; PROD rules commented (enable before launch)
├── firestore.indexes.json
├── docs/                   # PRODUCT_SHEET.md (canonical product doc)
├── schema.json             # Item-bank JSON schema (draft-07)
└── scoring.ts              # Standalone IRT reference module (root-level copy)
```

## Setup & Execution

```bash
cd projects/b2b-assessment-engine

# 1. Install
npm install
npm --prefix functions install

# 2. Local dev (Vite + Firebase emulators)
npm run dev                      # frontend on :5174
firebase emulators:start         # functions :5001, firestore :8080 (project demo-presift)

# 3. Verify (lint + tsc + unit tests)
npm run verify                   # oxlint + tsc --noEmit + vitest (66 tests)

# 4. E2E (needs emulators + dev server running)
npm run test:e2e                 # Playwright, 8 tests

# 5. Deploy
npm run build && npm --prefix functions run build
firebase use presift
firebase deploy
```

**Env requirements:** Node 18+ (functions: Node 20 runtime), Firebase CLI 15.x, `firebase login`; local `.firebaserc` targets `demo-presift` for emulator runs and `presift` for prod deploys. No runtime env vars required (mock billing).

## ⚠️ Bundle Audit — 1.19 MB Main JS (`dist/assets/index-BTa2XC11.js`, 1,211,264 B minified / ~357 kB gzip)

Vite's 500 kB warning exceeded. All 6 routes are statically imported in `App.tsx`; heavy deps: `firebase` (12.x), `recharts`, `react-hook-form`, `zod`, Radix/shadcn.

### Code-Splitting Plan (priority order)

| Module | Route/Trigger | Est. weight | Action |
|---|---|---|---|
| `DashboardPage` (+ Recharts, drawer, table) | `/dashboard` | ~250–350 kB | `React.lazy` — recruiter-only route |
| `TestPage` (+ timers, autosave) | `/test/:id`, `/assessment/:id` | ~80–120 kB | `React.lazy` — candidate-only route |
| `AdminPage` | `/admin` | small | `React.lazy` |
| `DemoPage` + `DevToolbar` | `/demo` | ~40 kB | `React.lazy`; **exclude from prod entirely** via `import.meta.env.DEV` guard |
| B2B invoice dialog | `generateB2BInvoice` click | small | `import()` on dialog open |
| Vendor split | global | ~500 kB (firebase + react) | `manualChunks`: `firebase`, `react-vendor`, `ui` chunks; long-cache headers |

**Implementation:** wrap route elements in `<Suspense fallback={<PageLoader/>}>`; keep `LandingPage` + router + firebase core eager for first paint. Target: first-load JS < 250 kB gzip.

## Decoupling Log (2026-08-09)

Moved from `/home/fupazuzi/PreSift/` → `projects/b2b-assessment-engine/`:

- `presift-web/` (entire React + functions codebase) → engine root (flattened)
- `BLUEPRINT.md` (Iteration 4), `DELIVERY_REPORT.md` (Iteration 7) → engine root (newer copies)
- `PRODUCT_SHEET.md` → `docs/`
- `schema.json`, `scoring.ts`, `mcp_config.json.bak` → engine root
- Stale Iteration-3 doc copies and the empty `PreSift/` shell → pending removal (awaiting approval)

Vizoman meme assets / dwell-time code are NOT present anywhere in this repo (verified by grep). `Desktop/hockey/` raw meme images were moved to `projects/vizoman/raw/` for provenance.
