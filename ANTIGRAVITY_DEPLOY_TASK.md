# Antigravity Task: Deploy PreSift Live to Firebase (marketingopen10@gmail.com)

## Context

Project: `/home/fupazuzi/PreSift/presift-web` — React + Vite + TS frontend, Firebase Functions (TypeScript, compiled to `functions/lib`), Firestore, Firebase Hosting.

Goal: deploy the app to Firebase so it is **live and fully testable** — both E2E (Playwright against the live URL) and human testing.

Key facts already verified on this machine:
- gcloud is already authenticated as `marketingopen10@gmail.com` (ADC present at `~/.config/gcloud/application_default_credentials.json`); the Firebase CLI (`firebase`) is NOT logged in yet (`firebase login:list` → no accounts, but `firebase projects:list` works via gcloud).
- The account already has a Firebase project: **ID `presift`** (display name "PreSift"). Deploy there.
- Firebase emulators are currently running locally (functions :5001, firestore :8080) — they do NOT block deployment; you may leave them running or stop them.
- `.firebaserc` currently says `demo-presift` — must be updated to the live project.
- Local E2E suite: `e2e/`, `playwright.config.ts`, script `test:e2e`. Currently 8 specs, 6 passing locally (2 known failures are the subject of a SEPARATE task — do not fix them here unless they block deployment).

## Decisions (user-approved, do not deviate)

1. **Project**: deploy to existing Firebase project `presift` (ID: `presift`).
2. **Billing**: enable/confirm **Blaze plan** (pay-as-you-go) on the project. NOTE: enabling billing requires a payment method — if the CLI cannot do this non-interactively, report exactly what manual step the user must do in the Firebase console (billing page URL), and continue with everything that CAN be deployed. Do not silently skip it.
3. **Firestore rules**: leave `firestore.rules` exactly as-is (demo-relaxed). Do NOT harden them in this task.
4. **Anonymous demo bypass**: add a config-driven bypass so the demo works live without Firebase Auth (see Required Changes below).
5. **E2E parameterization**: `playwright.config.ts` must read `baseURL` from `process.env.PLAYWRIGHT_BASE_URL`, defaulting to `http://localhost:5174` when unset.
6. **Stripe**: stays mocked (PDF receipt). Real Stripe is a later, separate task — do not touch.

## Required Changes

### A. Frontend Firebase config (`src/lib/firebase.ts`)
- Currently hardcodes `projectId: "demo-presift"`, `apiKey: "fake-api-key"` and connects to emulators in dev mode.
- Fetch the REAL SDK config for the live project (e.g., `firebase apps:sdkconfig` or the Firebase console → Project settings → Your apps → Web app) and use it for production builds.
- Preserve the emulator connection ONLY for `import.meta.env.MODE === 'development'` (and test). Production build must use real config with NO emulator connections.
- Keep a `.env.development`-style separation if it makes the dev flow cleaner, but do not break `npm run dev` + emulators locally (local E2E must still work).

### B. Anonymous demo bypass (three cloud functions in `functions/src/index.ts`)
Apply the same pattern `generateB2BInvoice` already uses (`allowAnon`) to:
- `generateB2BInvoice` (already has it — verify it works live, see env note below),
- `topUpCredits`,
- `createAssessmentLink`.

Implementation: a single shared helper, e.g. `const allowAnonDemo = () => process.env.ALLOW_ANON_DEMO === 'true' || process.env.FUNCTIONS_EMULATOR === 'true';` — then each function throws `unauthenticated` only when `!context.auth && !allowAnonDemo()`. No hardcoded secrets, no weakening beyond what the env flag enables.

**CRITICAL — env var delivery:** the functions read `process.env.*` directly (NOT `functions.config()`). On Cloud Functions (gen 1), arbitrary `process.env` vars must be set via `firebase functions:config:set` AND read through `functions.config()`, OR set as runtime env vars. Do ONE of:
- (Preferred, minimal diff) Refactor the three functions to read `functions.config().demo?.allow_anon === 'true'` (set via `firebase functions:config:set demo.allow_anon=true`), and keep the emulator check (`process.env.FUNCTIONS_EMULATOR === 'true'`) so local E2E still works; OR
- If you can set true runtime environment variables on the deployed function (Cloud Functions gen 2 / `env` field in `firebase.json` functions config), use that. Explain what you did.

Verify the live checkout works without login after deploy (see Verification).

### C. Assessment link origin (`functions/src/index.ts` → `createAssessmentLink`)
- Currently returns `process.env.VITE_APP_URL || "http://localhost:5173"` — live links would point at localhost. Set the origin to the live hosting URL (`https://presift.web.app` or whatever the deployed URL is) via the same config mechanism as B (functions.config or runtime env). Prefer `https://presift.web.app`.

### D. Deploy configuration
- Update `.firebaserc` default project to `presift`.
- Ensure `firebase.json` hosting block is correct: `public: "dist"`, rewrite `** → /index.html` (already present — verify).
- Add `"predeploy"` for hosting if missing? (functions predeploy already runs `npm --prefix functions run build` — verify it rebuilds `functions/lib` so your source edits deploy.)
- Build the frontend: `npm run build` (tsc + vite) → `dist/`.

### E. Playwright live parameterization (`playwright.config.ts`)
- `use.baseURL` must be `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174'`.
- Keep everything else unchanged. Local run stays: `npx playwright test`.
- Live run becomes: `PLAYWRIGHT_BASE_URL=https://presift.web.app npx playwright test` — note in the final report that the live run may have environment-specific failures (e.g., DevToolbar only shows in dev mode unless `?demo=true`, clipboard/alert behavior) — report them honestly, do not hack the specs to hide them.

### F. Auth/login for deployment
- `firebase login` is browser-OAuth (the password alone is NOT accepted by the CLI). Since gcloud is already authenticated as marketingopen10@gmail.com, FIRST try deploying directly (`firebase use presift && firebase deploy`) — if it works via ADC, no login needed.
- If the CLI demands a login: run `firebase login --no-localhost`, print the URL for the user to open in a browser, and wait. If that's impossible in your environment, use `firebase login:ci` and explain the token flow. Report exactly what you did and what (if anything) the user must approve manually.

## Deployment Steps (order)

1. Confirm auth works (`firebase use presift`, `firebase projects:list` shows presift).
2. Make changes A–E.
3. `cd /home/fupazuzi/PreSift/presift-web && npm run build` (frontend) and `cd functions && npm run build` (backend).
4. `firebase functions:config:set demo.allow_anon=true` (or equivalent env mechanism) — do this BEFORE deploy so the deployed functions have the flag.
5. `firebase deploy --only hosting,functions,firestore:rules` (deploy rules as-is per decision 3).
6. Smoke-test the live URL with curl: homepage 200, and the callable endpoints respond (e.g., POST to the live `generateB2BInvoice` URL without auth returns a PDF receipt, not "Must be logged in").
7. Run local unit suite + local E2E to confirm nothing regressed locally.

## Verification (show verbatim output for each)

- `cd /home/fupazuzi/PreSift/presift-web && npm run verify` → green
- `cd /home/fupazuzi/PreSift/presift-web && npx playwright test --reporter=list` → local suite: expect same result as before your changes (6 pass / 2 known failures — do NOT fix those here)
- `PLAYWRIGHT_BASE_URL=https://<live-url> npx playwright test --reporter=list` → report honestly which specs pass/fail live and WHY (note: DevToolbar is dev-only by default; landing page, checkout dialog, and static content should work; dashboard needs `?demo=true` or a seeded session — document how a human tester should access the dashboard live, e.g. URL `https://presift.web.app/dashboard?demo=true`)
- curl checks on the live URL (homepage 200; anonymous callable works; document the exact URLs used)

## Constraints

- Explicit error handling; no naked try/catch swallowing. Log real errors.
- Do NOT modify: `firestore.rules`, the e2e specs (except `playwright.config.ts` baseURL), the 2 known-failure fixes (separate task).
- Do NOT hardcode secrets. Do NOT print or commit any real API keys/tokens. The real SDK config goes into `src/lib/firebase.ts` (or .env files that are git-ignored) — never into this report.
- Stripe untouched.
- If anything requires a manual human step (billing card, browser OAuth login, console approval), STOP and report exactly what the user must do, with the exact URL/button path.

## Final Report

Return: per-file change list, the live URL(s) (hosting + any function endpoints), how to test live as a human (exact URLs incl. dashboard), how to run live E2E, verbatim outputs of all verification commands, and any manual steps the user must complete (billing, login, console config).
