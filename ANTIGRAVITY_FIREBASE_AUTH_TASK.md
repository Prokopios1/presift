# Antigravity Task: PreSift — Wire Firebase Auth (email/password) + real recruiter profile

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.
**This task SUPERSEDES `ANTIGRAVITY_RECRUITER_PROFILE_TASK.md`** (its profile requirements are folded in here, now auth-based).

**Context:** PreSift currently has NO authentication — pages render with a hardcoded `RECRUITER_ID = 'demo_recruiter'`, callables fall back to `allowAnonDemo()`, and Firestore rules lock writes but allow anonymous reads. P. wants real Firebase Auth (email/password): recruiters and admins sign in, the recruiter dashboard shows the recruiter's first name, the sidebar has a Profile section, and the profile page shows email + a working change-password option. Candidate link flow (test page) stays anonymous — it uses callables only.

**Changes:**

1. `src/lib/firebase.ts` — add `getAuth(app)` export (keep emulator connects for dev/test as-is).
2. NEW `src/lib/auth.ts` (or `src/hooks/useAuth.ts` if the repo prefers hooks) — auth service: `onAuthStateChanged` subscription, current user, `signIn(email, password)`, `signOut()`, `changePassword(newPassword)` (wraps `auth.currentUser.updatePassword`), `refreshUserDoc()` (reads `users/<uid>` → role/name/company).
3. NEW `src/pages/LoginPage.tsx` — email + password form, error display (wrong-credentials, network), loading state, redirect to `/dashboard` (recruiter) or `/admin` (admin/owner) after sign-in, based on the `role` field in `users/<uid>`.
4. `src/App.tsx` — add `/login` route; wrap protected routes with a route guard: `/dashboard` requires an authenticated user with role `recruiter` (or admin), `/admin` requires role `admin`/`owner`; unauthenticated → redirect to `/login`; unknown role → sign-out + redirect. `/profile` requires any authenticated recruiter/admin.
5. `src/pages/DashboardPage.tsx` — replace hardcoded `RECRUITER_ID` with the signed-in user: read `users/<auth.uid>`, use its `role` (recruiter sees only own candidates via `where('recruiterId','==',uid)`; admin sees all candidates). Show the recruiter's FIRST NAME under the header (e.g., "Recruiter: {firstName}" — first token of `name`; fallback companyName → email prefix). Keep all existing candidate-management UI working.
6. `src/pages/AdminPage.tsx` — same: use `auth.uid` for owner/admin identity; keep Add Client flow, but the NEW client creation (see #7) must create the auth account too.
7. `functions/src/index.ts` — auth-gate the admin/recruiter callables (replacing `allowAnonDemo()` for these):
   - `createAssessmentLink`, `deleteCandidate`, `updateCandidateStatus`, `updateCandidate`, `bulkDeleteCandidates`, `updateRecruiterProfile`, `topUpCredits`, NEW `createRecruiterAccount` — all REQUIRE `_context.auth` (throw `unauthenticated`) and enforce role from `users/<uid>.role` (`recruiter` or `admin`; `createRecruiterAccount` + `topUpCredits` admin-only).
   - `startSession` and `submitAssessment` REMAIN anonymous (candidate flow) — do not gate them.
   - NEW `createRecruiterAccount({email, name?, companyName?, initialPassword})` (admin-only): validates email + password (min 8), creates the Firebase Auth account via `admin.auth().createUser({email, password})`, writes the `users/<uid>` doc (role: 'recruiter', credits: 0, email, name, companyName, vatId: '', totals 0), returns the uid. Handle `auth/email-already-exists` → `already-exists` HttpsError.
   - `updateRecruiterProfile({name, companyName?})` — as previously specced but now requires auth; operates on `users/<_context.auth.uid>`.
   - Keep explicit validation and meaningful `HttpsError` codes; no naked try/catch.
8. `functions/src/` — NEW provision script (not exported as a callable; a standalone script under `scripts/` or `functions/scripts/`): `provisionAccounts.ts` — creates Auth accounts + `users` docs for `prokopios@presift.app` (owner/admin) and `demo_recruiter@presift.app` (recruiter) if they don't exist, using provided or generated temporary passwords (printed to stdout, NEVER logged elsewhere). Run via Admin SDK against prod (Hermes executes; see handoff).
9. `src/pages/ProfilePage.tsx` (NEW) + `src/components/AppSidebar.tsx` + `src/App.tsx` route — Profile section:
   - Sidebar: add `{ label: 'Profile', href: '/profile' }` (below 'Buy Credits').
   - Page: shows email (read-only "Mail"), name + company (editable via `updateRecruiterProfile`), credits/vatId/role (read-only), and **Change password** (new + confirm, min 8, client validation) → `auth.currentUser.updatePassword` → success/error feedback. Sign-out button. Layout pattern as other pages (`<AppSidebar />` + `<main className="flex-1 w-full pl-0 md:pl-60">`).
10. `src/pages/DemoPage.tsx` + `src/components/DevToolbar.tsx` — mock-login helpers stay dev/test-only (already gated out of prod bundle); remove nothing from prod behavior.
11. `firestore.rules` — enable the drafted `isAdmin`/`isOwner` helpers and tighten reads: `users`: read if authenticated (and owner for the list view); `candidates`: read if authenticated (recruiter sees own via `recruiterId == uid` OR admin/owner sees all), writes remain functions-only; `sessions` + `assessments`: fully server-managed (no client access); keep the candidate test-page working (it only uses callables). Test the rules with the rules test suite.
12. Tests:
   - `functions/src/__tests__/` — update callable tests to pass auth contexts; new tests: `createRecruiterAccount` (happy path, duplicate email, weak password, non-admin rejected), `updateRecruiterProfile` auth-required, existing tests still green.
   - `src/__tests__/` — login page validation, route-guard behavior (unauthenticated → /login), sidebar 'Profile' item renders.
   - `e2e/` — update specs that assumed mock login: they must sign in through the real `/login` page (use the provisioned e2e test account) or be marked dev-only; list every sync explicitly.

**Explicitly out of scope:** candidate management feature (already shipped), seeder, pricing page, anything not listed.

**Constraints:**
- Explicit error handling only — no naked try/catch; meaningful `HttpsError` codes.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.
- Do NOT create real Auth accounts during implementation — the provision script is written but EXECUTED by Hermes in the handoff step, not by you.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` in `functions/` — paste VERBATIM output (auth-gated tests must pass)
- [ ] Rules test suite passes (firestore-rules tests)
- [ ] Every changed file: path + the diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.

---

## Handoff (Hermes, after A1 verification) — setup + deploy

1. Enable the Email/Password sign-in provider on project `presift` (Identity Toolkit admin API `projects.defaultConfig` with `signIn.email.enabled=true` — use the project's service account; if the API route is blocked, tell P. the exact console click-path instead).
2. Run the provision script: create Auth accounts for `prokopios@presift.app` (owner/admin) and `demo_recruiter@presift.app` (recruiter) with generated temporary passwords → print the passwords ONCE for P.; also create an `e2e@presift.app` test account for the Playwright suite.
3. `firebase deploy --only functions,firestore:rules,hosting --project presift`.
4. Live smoke: sign in via the deployed app with the provisioned recruiter account (or REST `identitytoolkit` signInWithPassword) → dashboard shows first name; change-password round-trip works; anonymous REST write on `candidates` still 403; candidate link flow (startSession/submitAssessment) still works anonymously.
5. Report everything to /tmp/presift_auth_deploy.md.
