# PreSift Remediation — Iteration 10 (fix stale E2E specs after landing/pricing refactor)

Act as Principal Full-Stack Engineer and QA Lead. The controller (A1) verified the current state: 76/76 unit tests green, `tsc --noEmit` clean for web + functions, `vite build` exit 0, and the Aug-10 task commits (`216569f` landing refactor, `7f5d9c2`/`1930636` hero removals, `f56c705` Add Client flow + hamburger nav) are all committed on `main`. A Playwright E2E run against the LIVE site (`PLAYWRIGHT_BASE_URL=https://presift.web.app`) yields **3 passed / 5 failed (exit 1)** — and all 5 failures are STALE E2E specs that still assert the pre-refactor UI (verified via live-DOM probe: the deployed UI is correct, zero app bugs). **This iteration: update the 2 stale E2E spec files to the current UI, prove green against the live URL, and stop. No source-code changes.**

## CodeGraph (mandatory, before + after)

- **Before coding:** refresh/read the CodeGraph index for this repo so you navigate the current file graph (the repo has been through many iterations; the index may be stale).
- **After completing + green run:** update/sync the CodeGraph index to reflect the final state of `e2e/landing.spec.ts` and `e2e/dashboard.spec.ts`.
- Report the sync outcome in one line at the end.

## Scope (hard rule)

Edit ONLY:
- `e2e/landing.spec.ts`
- `e2e/dashboard.spec.ts`

Do NOT touch any source file (`src/**`, `functions/**`, `firestore.rules`), do NOT touch `e2e/test-session.spec.ts` (it passes as-is), do NOT touch `playwright.config.ts`. Do NOT add assertions for the not-yet-deployed features (hamburger menu, Admin Add Client dialog) — live is one commit behind; keep the suite aligned to what is verifiable against live.

## Why each test fails (root cause, verified)

1. **Landing tests (2 fails):** the specs assert UI that was REMOVED by the landing refactor: `B2B Psychometric Screening Engine` badge, `Start Free Trial (5 Credits)` button, `View Demo Dashboard →` button, `€5` unit-price badge, stepper buttons (`−5`/`−`/`+`/`+5`), `Berlin, Germany` billing input, `Checkout — €…` button — all moved off the landing page to the new `/pricing` page (`src/pages/PaymentPage.tsx`).
2. **Dashboard tests (3 fails):** the specs start with `page.goto('/?demo=true')` then click `Recruiter Login`. Since the refactor, the DevToolbar (`src/components/DevToolbar.tsx`) has a public-route guard: `const isPublicRoute = location.pathname === '/' || location.pathname === '/pricing'` and `if (!isDemo || isPublicRoute) return null;` → the toolbar (and its `🧑💼 Recruiter Login` button) is NOT rendered on `/` anymore. The login flow must be exercised on a non-public route (`/dashboard?demo=true`).

## What the CURRENT UI is (verified facts — write specs against these)

### Landing page `/` (`src/pages/LandingPage.tsx`)
- Nav: ghost buttons `Dashboard` → `/dashboard`, `Admin` → `/admin`, and a `Pricing` link → `/pricing`.
- Hero `<h1>`: `Stop interviewing candidates who look good on paper but fail under pressure.`
- Subtext paragraph: `Screen fluid intelligence & stress resilience in 10 minutes. Reduce bad hires by filtering candidates objectively before the first interview.`
- Primary CTA: link `Get Started` → `/pricing`.
- Footer: `© 2026 PreSift. All rights reserved. GDPR Compliant.`
- NO badge, NO pricing card, NO stepper, NO billing fields, NO feature grid on this page.

### Payment page `/pricing` (`src/pages/PaymentPage.tsx`) — where pricing UI lives now
- Unit price `€5` per credit; numeric stepper: buttons `−5`, `−`, `+`, `+5` and a number input (default value `5`, min 1, max 200).
- Fields: Company Name, Email, VAT, Billing Address (placeholder `Berlin, Germany`).
- Checkout button label pattern: `Checkout — €<total>` (e.g. `Checkout — €25.00` at default 5 credits; after two `+5` clicks = 15 credits → `Checkout — €75.00`).
- Submitting calls the `createCheckoutSession` callable and redirects to Stripe hosted checkout (test mode) → assert URL matches `checkout.stripe.com` (keep the existing dialog-capture pattern).

### DevToolbar (`src/components/DevToolbar.tsx`) — demo login flow
- Renders only when `?demo=true` (or dev mode) AND pathname is not `/` or `/pricing`.
- `🧑💼 Recruiter Login` → sets `presift_demo_session` (demo recruiter, 5 credits) + `presift_uid`, navigates to `/dashboard`, reloads.
- `🌱 Seed Demo Data` → calls `seedDemoData` callable, navigates to `/dashboard`, reloads.
- `🌙 Dark` theme toggle button also present.

### Dashboard `/dashboard` (`src/pages/DashboardPage.tsx`)
- Heading: `Recruiter Dashboard`.
- With demo session active: candidates table shows seeded candidates (e.g. `Alice Strong`, `Harry Flag`), balance shows `5 Credits`.
- Candidate row has a `View` button opening the drawer with sections `Cognitive (ICAR)`, `Emotional Intelligence`, `Custom Interview Prompts`.
- Header also has a hamburger (lucide `Menu` icon) — do NOT assert it (not deployed yet).

## Task

Rewrite `e2e/landing.spec.ts` and `e2e/dashboard.spec.ts` so every test:
1. Matches the CURRENT UI facts above (keep the same test-count/describe structure; adjust selectors and flows only).
2. For landing: assert hero/nav/footer on `/`; move all pricing/checkout assertions to a `/pricing` flow (goto `/pricing`, stepper interactions, billing fill, checkout → Stripe redirect).
3. For dashboard: replace the `/?demo=true` + login-click prologue with `page.goto('/dashboard?demo=true')` and click `Recruiter Login` there (toolbar is visible on that route), then proceed with seed + drawer assertions as before.
4. Keeps AAA comment wrappers (`// Arrange`, `// Act`, `// Assert`) and the existing dialog/console capture helpers.
5. Must not introduce naked try/catch — handle errors explicitly (the existing Stripe-checkout catch that rethrows with dialog context is fine).

## Proof (mandatory, verbatim)

Run against the live site and paste the FULL output:
- `cd /home/fupazuzi/projects/b2b-assessment-engine && PLAYWRIGHT_BASE_URL=https://presift.web.app npx playwright test`
- Target: **8 passed (exit 0)** across `landing.spec.ts` (2), `dashboard.spec.ts` (3), `test-session.spec.ts` (3).
- If a test still fails, diagnose via the generated `test-results/*/error-context.md` page snapshot and re-align the spec to the ACTUAL live DOM — do not "fix" the app.

Also paste:
- `git diff --stat e2e/` (the changed spec files only)

## Stop condition

Suite green against live (8/8), diff limited to the 2 spec files, nothing else touched. Report exactly what changed per test and the verbatim run output.
