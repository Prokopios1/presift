# Antigravity Task: Fix 2 Remaining E2E Failures in presift-web

## Context

Project: `/home/fupazuzi/PreSift/presift-web` — React + Vite + TS frontend, Firebase Functions (TypeScript) backend, Firestore. A Playwright E2E suite was added (`e2e/`, `playwright.config.ts`, `npm run test:e2e`). It runs against the live dev server (localhost:5174) and Firebase emulators (functions :5001, firestore :8080, project `demo-presift` via `.firebaserc`). **The emulators are currently running.** Unit suite (`npm run verify`) is green.

Run E2E with: `cd /home/fupazuzi/PreSift/presift-web && npx playwright test --reporter=list`

Current status: **6 of 8 E2E tests pass**. Fix exactly the 2 failures below. Do not regress the 6 passing tests. Do not change the test specs to weaken assertions — the app behavior is what needs fixing.

## Failure 1 — Dashboard does not refresh after "Seed Demo Data"

**Failing test:** `e2e/dashboard.spec.ts` → "seed demo data populates candidates table"

**Observed:** After clicking DevToolbar → "Seed Demo Data", the dashboard still shows "Balance 0 Credits" and an empty candidates table (15s timeout). Expected: `Alice Strong` visible, `5 Credits` visible.

**Root cause:** `src/components/DevToolbar.tsx` → `handleSeedData()` calls `seedDemoData()` then `navigate('/dashboard')`. When the user is already on `/dashboard`, navigating to the same route does NOT remount `DashboardPage`, so its `useEffect` data fetch (in `src/pages/DashboardPage.tsx`) never re-runs. Note: `handleMockLogin` already works around this by calling `window.location.reload()` after navigate.

**Required fix (choose one, keep it minimal and clean):**
- After a successful seed, force a full data refresh on the dashboard. Preferred: in `handleSeedData`, after `navigate('/dashboard')`, call `window.location.reload()` (mirrors `handleMockLogin`), OR
- Better (no reload flicker): lift the data fetch into a refreshable function in `DashboardPage` and expose a way for the DevToolbar to trigger a refetch (e.g., a custom `dashboard:refresh` window event that `DashboardPage` listens for, or refetch on route location change via `useLocation` key).

Also verify the same refresh gap does not apply to credit balance after "Mock Recruiter Login" (that one reloads, so it is fine).

## Failure 2 — Reload mid-test does not resume into active question view

**Failing test:** `e2e/test-session.spec.ts` → "reload mid-test resumes from localStorage"

**Observed:** After starting `/test/:id`, answering 1 question, then `page.reload()`, the app shows the "Psychometric Assessment" start screen again (consent checkbox, "Begin Assessment" disabled) instead of resuming the active test. Session data IS restored (Session ID visible), but `started` state resets to `false`.

**Root cause:** `src/pages/TestPage.tsx` — `started` is initialized `useState(false)` and is not persisted. On reload, `fetchSession` restores `sessionData`, `icarAnswers`, `wleisAnswers`, and `currentQuestion` from `localStorage`/Firestore, but because `started === false`, the component renders the consent/intro screen.

**Required fix:**
- Persist `started` across reloads: store it in `localStorage` (e.g., `assessment_${assessmentId}_started`) whenever it becomes `true`, read it back in the initial state, and clear it on successful submit (alongside the existing `localStorage.removeItem` calls in `submitTest`).
- The resume should land the candidate on the correct question with their saved answers (already handled by existing restore logic).
- Keep the anti-cheat/`useEffect` behavior intact (context menu/copy blocking, blur flag, timers).

## Constraints & Verification

1. Use explicit error handling — no naked try/catch swallowing; log real errors.
2. After changes, run and show evidence of ALL of the following:
   - `cd /home/fupazuzi/PreSift/presift-web && npm run verify` (lint + tsc + unit tests)
   - `cd /home/fupazuzi/PreSift/presift-web && npx playwright test --reporter=list` → expect 8/8 passed
3. If a cloud function file is touched (`functions/src/*.ts`), rebuild it: `cd /home/fupazuzi/PreSift/presift-web/functions && npm run build` (emulator runs compiled `lib/`, not `src/`).
4. Do not modify `firestore.rules`, `.firebaserc`, `playwright.config.ts`, or the e2e specs unless a genuine product bug demands it (and then explain why).
5. Report back: what changed, per-file, and the verbatim test output for both commands.
