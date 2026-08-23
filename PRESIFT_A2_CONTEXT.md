# preSift — LEAN CONTEXT for A2/Hermes (daily refresh)

Repo: `/home/fupazuzi/projects/b2b-assessment-engine` (preSift, B2B assessment engine)
Dev: Vite on `:5174` · Emulators Firestore `:8081`, Functions `:5001` (JDK21). 5173 = OOMOL (unrelated).

## Roles + WORKFLOW (user rule 2026-08-23: deploy-first, human-test-after)
- A1 (OpenClaw main): controller/verifier ONLY — never edits source/commits.
- ANTG (Antigravity): only coder, carries `*_TASK.md`. Commits ONLY after A2 sign-off.
- A2 (you, Hermes): inspect + verify → **on PASS, DEPLOY to Firebase (presift)**, then the HUMAN tests after deployment. NO-COMMIT during inspection. Do NOT deploy on FAIL (code back to ANTG).
- Deploy does NOT require a commit first — deploy the current working tree (build then `firebase deploy` to project `presift`).
- Commit preconditions (user): server e2e verify + codegraph mapping before commit.

## Current live state
- HEAD: `8ae5601` (whitelist `?next=` in RegisterPage).
- Recent commits: `b559c9c` (gate Buy Units behind register), `5b86ad4` (1€ promo tier + RBAC + candidate detail + fwd/back nav + reportStatus), `53a0b1a`, `c0d3d70` (emulators), `b8e29ef`.
- 1€ promo tier exists (`isPromo = credits===1` in PaymentPage + functions/src/stripe.ts). DECISION: keep UNBOUNDED (no per-account gate).
- Register funnel: Landing Buy Units → `/register?next=/pricing` → `/pricing`. Session keys `presift_uid`/`presift_demo_session` in localStorage — signed-in users skip register (by design).
- **DONE (A2-verified PASS 2026-08-23):** VAT + Billing Address removed from RegisterPage.tsx + test (working tree, 2 files / 36 deletions). Remaining fields Name/Email/Company only; backend + PaymentPage untouched. Next per workflow: A2 DEPLOYS (firebase, project presift) → human tests after deploy.

## Tools/harness
- A2 run auto-invoked every 4 min by cron (preSift ANTG->A2 verify+deploy loop, Slack announce). Fresh isolated session each run.
- Verify: `cd <repo> && git diff --stat && npx tsc --noEmit && npm test && npm run build` (report verbatim).
- Windows/context economy: do NOT dump full file reads; `git diff --stat` + targeted greps only. Keep any visible reply ≤ a status line + brief table.

## Standing directives
- English only. 12-year-old-level explanations for human replies. Minimum token spend.
- Never commit in A2 verify runs. A2 deploys on PASS (working tree), then human tests after deploy. Inspect/verify with targeted greps, not full dumps.
