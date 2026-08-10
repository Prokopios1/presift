# PreSift — Product Sheet

**PreSift** is a B2B psychometric pre-screening platform: candidates complete a short assessment, recruiters receive scored intelligence profiles with structured interview prompts.

*Generated: 2026-08-07 · Source: CodeGraph index (48 files, 338 symbols, 710 edges) + live Hermes test run.*

---

## 1. Core Value Proposition

- **ICAR-16** cognitive engine (fluid intelligence) + **WLEIS-16** emotional intelligence engine.
- Server-side item parameterization → every candidate gets a **unique session** (no answer-key leakage, no memorized item reuse).
- Recruiter dashboard with **ICAR + 4-domain WLEIS breakdown**, status pipeline, and **GDPR delete**.
- **Paywalled credits** with Stripe-style B2B invoice generation (mock checkout).

## 2. Features

### Assessment Engine
- **ICAR-16**: 16 items across 4 domains (Numerical: Letter & Number Series, Verbal Reasoning, Abstract Pattern/Rule Inference, Spatial Mental Rotation). Dichotomous scoring.
- **WLEIS-16**: 16 items across 4 subscales — SEA (Self-Emotion Appraisal), OEA (Others' Emotion Appraisal), UOE (Use of Emotion), ROE (Regulation of Emotion). 7-point Likert (1–7), reverse-scored items (8 − original).
- **IRT 3PL scoring**: difficulty (b), discrimination (a), guessing (c) per item; EAP theta estimation (quadrature over [−6, 6], step 0.025) with MLE fallback; standard score mapped to **normed scale (mean 100, SD 15)**.
- **Server-side parameterization**: prompt/option templates with randomized variables (integer/float/string/expression rules), seeded per-session via `crypto.getRandomValues`, Fisher–Yates shuffling, uniqueness enforced.
- **Anti-cheat**: templates & answer keys server-side only; client receives only a fully resolved session instance.

### Recruiter Dashboard
- Candidate table with **Completion Date + Status** (Shortlisted / Interviewing / Rejected toggles).
- **4×4 WLEIS breakdown** (SEA / OEA / UOE / ROE raw scores) in candidate drawer.
- **ICAR 4-domain breakdown** in the drawer.
- **Dynamic interview prompts** generated from score profile (e.g., low OEA → "Tell me about a situation where you had to read the room…").
- **Top Up Credits** + **Create Assessment Link** (Firebase HTTP callables), paywall state when balance ≤ 0.
- **Export PDF** button; **GDPR Delete** with confirmation (rules restrict delete to owner recruiter).

### Candidate Flow
- Landing page → assessment link → **TestPage** with auto-save & resume (localStorage + Firestore answers), timers, progress.
- **Demo mode**: `?demo=true` DevToolbar with mock session, auto-fill & submit.

### Platform
- Dark/light **ThemeToggle** (global mount).
- **DevToolbar** test kit (mock recruiter login, demo session injection).
- **B2B invoice** generation (`generateB2BInvoice` callable, company/email/VAT fields).
- **Abandoned-session sweeper**: scheduled `checkAbandonedSessions` (pub/sub, every 24h).

## 3. Architecture

```
presift-web/
├── src/                      # React 19 + Vite + Tailwind 4 + shadcn/ui
│   ├── App.tsx               # Router: / (Landing), /dashboard, /test/:assessmentId, /demo
│   ├── pages/                # LandingPage, DashboardPage, TestPage, DemoPage
│   ├── components/           # DevToolbar, ThemeToggle, ui/* (badge, button, card, dialog, drawer, table…)
│   ├── lib/                  # firebase.ts (client SDK), utils.ts
│   └── __tests__/            # Vitest + Testing Library (jsdom)
└── functions/                # Firebase Cloud Functions (Node, TypeScript → lib/)
    ├── src/index.ts          # Callables: generateB2BInvoice, topUpCredits,
    │                         #   createAssessmentLink, startSession, submitAssessment
    │                         # + pubsub: checkAbandonedSessions
    ├── src/psychometrics.ts  # IRT 3PL: transformLikert, estimateTheta, mapToScale, scoreWleis, evaluateCandidate
    ├── src/session.ts        # resolveSession: parameterized item resolution, seeding, shuffling
    ├── src/submission.ts     # validateSubmission (strict typing, forbidden keys), processSubmission
    ├── src/seeder.ts         # buildDemoData: full ScoringResult demo payload
    ├── src/data/presift-bank.json  # Item bank v1.0.0 (norming + anti-cheat metadata)
    └── src/__tests__/        # Backend unit tests
```

**Backend**: Firebase (Firestore + Cloud Functions, `onCall` HTTPS callables; emulator support).
**Frontend**: React 19, TypeScript, Vite 8, Tailwind 4, Radix/shadcn UI, Recharts, Zod, react-hook-form.
**Infrastructure**: `firestore.rules` with recruiter-ownership + session-token binding (protected fields: keys, createdAt, assessmentId).

**API surface (6 endpoints + 1 scheduled job):** `startSession`, `submitAssessment`, `createAssessmentLink`, `topUpCredits`, `generateB2BInvoice`, `integrity`, `checkAbandonedSessions` (24h cron).

## 4. System State (verified 2026-08-07)

**CodeGraph index:** 48 files · 338 nodes · 710 edges (28 components, 14 interfaces, 50 functions, 5 routes) — in sync (`codegraph status` clean).

**Hermes Tester run (live, `npm run verify` + `npm run build`):**

| Check | Result |
|---|---|
| oxlint (104 rules, 51 files) | ✅ 0 errors, 0 warnings |
| tsc --noEmit | ✅ clean |
| Vitest | ✅ **66/66 tests, 12 files** |
| `npm run build` | ✅ exit 0, 772ms |

Test coverage map:
- psychometrics (16) · submission (11) · session-parameterization (8) · session (7) · seeder (6) · submission-strict (5) · seeder-schema (3) · DevToolbar (3) · TestPage (3) · DevToolbar-wiring (2) · LandingPage (1) · DashboardPage (1)

**Known non-blocking finding:** main JS bundle 1,193 kB minified (357 kB gzip) exceeds Vite's 500 kB warning — suggest code-splitting / lazy routes later. Cosmetic only; build is production-ready.

**Verdict: ✅ PASS / PASS — system is green and deployable.**
