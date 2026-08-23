# PROJECT_STATE — Checkpoint 2026-08-23 (resume-safe after context wipe)

Repo: `/home/fupazuzi/projects/b2b-assessment-engine` (preSift, B2B assessment engine).
HEAD: **`c8f0479`** "feat: implement recruiter workflow, admin guard, candidate report, and 1€ promo tier". Working tree **clean** (all committed).

## 1. Current Architecture & Core Stack
- React + TypeScript + Vite frontend; Firebase Auth / Firestore / Cloud Functions backend; Stripe payments.
- Firestore security rules: `users` write:false (only Cloud Functions write); AdminGuard + server-enforced `role==='admin'|'owner'`.
- Emulators: Firestore :8081, Functions :5001 (JDK21). Vite default port (no port in config; 5173→5174 fallback).
- Roles: Recruiter (buy credits → register → pricing → dashboard → candidate links → report) and Admin (guard → add client → credit audit).

## 2. Completed & Verified Features
- AdminGuard RBAC + AppSidebar hides admin links for non-admins.
- 1€ promo tier (PaymentPage `credits===1` → €1; stripe.ts `isPromo ? 100 : qty*500`).
- Candidate Detail report page (`/candidate/:candidateId`), `reportStatus:"completed"`.
- Global Back/Forward nav via react-router.
- VAT/Billing removed from RegisterPage (only Name/Email/Company; backend+PaymentPage untouched).
- Campaign Wizard: AssessmentWizardPage + CampaignsPage + backend `createCampaign` callable.
- Tests: **204/204 pass** (31 files), tsc clean, builds exit 0.

## 3. Auth & Infrastructure State
- **Firebase CLI re-authenticated**: `marketingopen10@gmail.com` — `firebase projects:list` works (was `invalid_grant`, now fixed). Deployable.
- Build verified clean (frontend + functions). Deploy/SMOKE to Firebase `presift` still outstanding.

## 4. Immediate Next Steps / Pending Work
- Deploy committed `c8f0479` to Firebase `presift` (`firebase deploy --only hosting,functions`), then smoke-test `https://presift.web.app` (HTTP 200 + bundle markers).
- Human-test AFTER deploy: Campaign Wizard flow, module billing rules, candidate dispatch method (both were implemented by ANTG interpretation — **P. still must confirm final decision**).
- Remaining UI/form pre-population polish (PaymentPage JSX pre-fill) if any.

## 5. Don't Repeat / Already Solved
- PaymentPage JSX fix — already applied; don't re-touch.
- Verification cron (`bbd3b601`) disabled per P. — DON'T resume/re-enable without P. saying "check now". It failed auto-deploy early on dead auth; auth now fixed.
- Firebase >1000 msgs of stale-buffer corruption (TestPage.tsx) — always `git diff HEAD` + `git show HEAD:<file>|head` when user says "reverted", not just status.
