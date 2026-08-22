# Antigravity Task: Deploy PreSift Live to Firebase — REVISED (verified state, Aug 11)

Act as DevOps Engineer. The controller (A1) fact-checked the previous version of this task against the machine on 2026-08-11: **most of the old task's "Required Changes" are ALREADY DONE and the live site is already deployed**. Do NOT redo them. Your job is the remaining deploy + verification only.

## Corrected facts (verified by A1, trust these over any older briefs)

- **Project path:** `/home/fupazuzi/projects/b2b-assessment-engine` (NOT `/home/fupazuzi/PreSift/presift-web` — that path does not exist). Package name `presift-web`.
- `.firebaserc` already has `"default": "presift"` (the live Firebase project, display name "PreSift").
- `src/lib/firebase.ts` already uses the REAL SDK config (`projectId: "presift"`, real apiKey) and connects to emulators ONLY in `development`/`test` mode. No change needed.
- Anonymous demo bypass **already implemented** in `functions/src/index.ts`: shared helper `allowAnonDemo()` guards `generateB2BInvoice`, `topUpCredits`, `createAssessmentLink` (throw `unauthenticated` only when `!_context.auth && !allowAnonDemo()`).
- Assessment-link origin **already config-driven**: `demoConfig().origin` (defaults localhost), with comment to set via `firebase functions:config:set demo.origin=...`.
- `firebase functions:config:get` ALREADY returns: `demo.allow_anon = "true"`, `demo.origin = "https://presift.web.app"`, plus Stripe test keys. **Do not re-set these.**
- `playwright.config.ts` ALREADY reads `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174'`. No change needed.
- `firestore.rules`: leave exactly as-is (demo-relaxed). Do NOT harden.
- Stripe: stays mocked (PDF receipt). Do NOT touch.
- No Firebase emulators are currently running (nothing on :5001/:4000). Do not start any.
- Local E2E/unit: `npm run verify` (oxlint + tsc + vitest) is currently green (76/76 unit tests).

## Why deploy at all

The live site (`https://presift.web.app`) is one commit behind `main`: it does NOT yet include commit `f56c705` (Admin "Add Client" flow + recruiter hamburger nav). Verify: grep the live bundle for `Add Client` (present locally, absent live). **Goal of this task: deploy `main` so the live site includes `f56c705` (and everything else committed), and prove it.**

## Deployment steps (order)

1. **Auth — try in this exact order (do NOT ask the user for passwords; the CLI does not accept them):**
   a. `firebase login:list` — if already authorized, skip to step 2.
   b. Try ADC: `firebase use presift && firebase projects:list` (some CLI versions read gcloud ADC). If it lists `presift`, proceed — `firebase deploy` may also work.
   c. If still unauthenticated, use the gcloud ADC refresh token directly (well-known mechanism): `~/.config/gcloud/application_default_credentials.json` is an `authorized_user` for `marketingopen10@gmail.com` containing `client_id`, `client_secret`, `refresh_token`. Write these into Firebase's configstore `~/.config/configstore/firebase-tools.json` as `{"user": {"email": "marketingopen10@gmail.com"}, "tokens": {"refresh_token": "<from ADC>", "expires_at": <now+3600e3>}}` (merge into existing JSON, keep chmod 600), then `firebase projects:list` — the CLI refreshes the token itself. Do NOT print the token values.
   d. If that fails: `firebase login --no-localhost`, print the URL, and wait for the user to authorize. Report what you did.
2. **Sanity:** `cd /home/fupazuzi/projects/b2b-assessment-engine && git log --oneline -1` → must be `f56c705` (or later). `git status` → only untracked files (the two `docs/screens/*.png`), no uncommitted source changes.
3. **Build:** `npm run build` (frontend → `dist/`) and `npm --prefix functions run build` (compiles `functions/lib`). Both must exit 0. If `firebase.json` has a functions `predeploy` hook, it rebuilds automatically — verify either way.
4. **Deploy in two stages (f56c705 is frontend-only — verified: `git show --stat f56c705` touches only AdminPage.tsx, DashboardPage.tsx, tests; functions did NOT change):**
   a. `firebase deploy --only hosting` — this ships f56c705, the actual goal. Record the hosting URL from the output.
   b. Verify the live bundle now contains `Add Client` (or the new drawer labels `Buy Credits` / `Owner / Admin` as fallback markers — minifiers can split strings, so check all three if the first misses).
   c. Only THEN consider `firebase deploy --only functions` — and only if local functions match live intent (compare `git log -1 -- functions/src` against live function behavior; the anon bypass is already confirmed live). If in doubt, SKIP functions and note it in the report. Do not deploy functions blindly in the same command as hosting.
   d. `firestore:rules`: do NOT deploy — the live rules are already the demo-relaxed rules (do not touch).
5. **Smoke test live (verbatim output):**
   - `curl -s -o /dev/null -w "%{http_code}" https://presift.web.app` → 200.
   - Fetch the live bundle (`curl -s https://presift.web.app | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'` then fetch it) and confirm it NOW contains `Add Client` (i.e., `f56c705` is live). Also confirm it contains the hamburger `Menu` marker.
   - Anonymous callable check: POST to the live `generateB2BInvoice` without auth (exact URL from deploy output; use `curl -X POST -H 'Content-Type: application/json' -d '{}' <functions-url>/generateB2BInvoice`) → must NOT return "Must be logged in"/`unauthenticated` (anon bypass live). Document the exact URL used; do not print the Stripe secret.
6. **Regression locally (verbatim output):** `npm run verify` → green (76/76). Do NOT run/attempt to fix the E2E suite — the 2 stale E2E specs are being fixed in a SEPARATE task (it10) and the E2E suite is expected red until then. You may note this in the report but do not touch `e2e/` or `playwright.config.ts`.

## Constraints

- Explicit error handling; no naked try/catch swallowing; log real errors.
- Do NOT modify: `firestore.rules`, `e2e/**`, `src/lib/firebase.ts`, `playwright.config.ts`, `functions/src/index.ts`, `.firebaserc`, `firebase.json`.
- Do NOT print or commit real API keys/tokens (Stripe secret, apiKey). Redact in the report.
- No billing changes needed — the project is already on Blaze (functions are deployed and callable live). If `firebase deploy` errors with a billing requirement, STOP and report the exact console URL the user must open.

## Final report

Return: git HEAD before/after, deploy output summary (live URLs), the 3 smoke-test results (verbatim, with exact URLs used), local `npm run verify` output, and any manual steps the user must complete (only if login/billing blocked something).
