# Antigravity Task: PreSift — Recruiter identity + profile section

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** P. wants (a) the recruiter's FIRST NAME visible under the Recruiter Dashboard, and (b) a Profile section in the vertical sidebar menu that leads to a profile page containing the recruiter's email AND a password-change option. Current state: the recruiter user doc (`users/demo_recruiter`) has NO name field (fields: email, credits, companyName, vatId, totalSpent, totalPurchased, role). Firestore rules are locked — user writes are functions-only — so profile updates MUST go through a new callable. NOTE ON PASSWORD: the app has NO Firebase Auth wired yet (mock localStorage sessions only). Implement the password change via Firebase Admin SDK (look up the recruiter by email, then `updateUser` with the new password), with validation (min 8 chars, confirm-match). Add a visible note in the UI that a proper secure flow requires account authentication (Firebase Auth), which is a separate follow-up — the callable works standalone for the demo.

**Changes:**

1. `functions/src/index.ts` — add callables:
   - `updateRecruiterProfile({name, companyName?})`:
     - Validates: `name` required, trimmed, non-empty, max 80 chars; `companyName` optional (trimmed, max 120); throws `HttpsError("invalid-argument")` otherwise; `not-found` if the user doc is missing.
     - Applies the update to the recruiter's own user doc. Determine "own" the same way the app already identifies the active recruiter (`RECRUITER_ID = 'demo_recruiter'` pattern / the caller's uid when auth exists). Only the fields provided are updated; nothing else is touched.
     - Explicit error handling, no naked try/catch; follow existing callable patterns in the file.
   - `changeRecruiterPassword({email, currentPassword?, newPassword, confirmPassword})`:
     - Validates email format; `newPassword` min 8 chars and === `confirmPassword` (throw `invalid-argument` otherwise).
     - Uses Firebase Admin Auth: `admin.auth().getUserByEmail(email)` then `admin.auth().updateUser(uid, { password: newPassword })`. Handle `auth/user-not-found` → `not-found` HttpsError.
     - `currentPassword` (if provided) is accepted for forward-compat with Firebase Auth but NOT enforced while auth is unwired — add a code comment documenting this and the security follow-up.
     - Explicit error handling, no naked try/catch.
2. `functions/src/seeder.ts` — NOT in scope (seeder is emulator-only now). Do not touch.
3. `src/pages/DashboardPage.tsx` — show the recruiter's FIRST NAME under the dashboard header: fetch `users/demo_recruiter` (already fetched for balance) and render the recruiter first name (fallback: companyName, then email prefix if name missing) — e.g., a small "Recruiter: {firstName}" line under the page title (derive firstName as the part before the first space). Keep it subtle, reuse existing card/typography classes.
4. `src/components/AppSidebar.tsx` — add a nav item `{ label: 'Profile', href: '/profile' }` to the nav list (place it below 'Buy Credits', above 'Home / Landing'). Keep the existing responsive `hidden md:flex` behavior.
5. `src/pages/ProfilePage.tsx` (NEW) — profile page:
   - Reads `users/demo_recruiter` on mount (email, name, companyName, credits, vatId, role).
   - Displays read-only fields (email, credits, vatId, role) and an **Edit** form for Name (+ Company if desired) → saves via `updateRecruiterProfile` callable → updates local state; success/error feedback (no silent failures).
   - **Change password section** (required): Email shown read-only at top ("Mail"); a "Change password" form with New password + Confirm password inputs → calls `changeRecruiterPassword` callable with the recruiter's email → success/error feedback; validation on client (min 8 chars, match). Include a small note: "Secure login (Firebase Auth) is a follow-up; this demo flow updates the account password server-side."
   - Uses existing UI components (Card, Input, Button, Dialog or inline form) and the same page layout pattern as other pages (`<AppSidebar />` + `<main className="flex-1 w-full pl-0 md:pl-60">`).
6. `src/App.tsx` — register the `/profile` route (same pattern as the other routes; keep the `/demo` dev-only guard as-is).
7. Tests:
   - `functions/src/__tests__/` — new tests for `updateRecruiterProfile` (valid update, empty name rejection, over-length rejection, missing doc) and `changeRecruiterPassword` (short-password rejection, mismatch rejection, bad email, user-not-found → not-found, happy path with mocked admin.auth). AAA style with comment zones, matching the existing tests.
   - `src/__tests__/` — add/adjust a test for the new sidebar item ('Profile' button renders) and ProfilePage render if a testable pattern exists; do not over-engineer.
   - `e2e/` — allowed to sync specs ONLY where this change breaks existing selectors; list any sync explicitly.

**Explicitly out of scope:** `firestore.rules`, candidate management, pricing page copy, auth, anything not listed above.

**Constraints:**
- Explicit error handling only — no naked try/catch. Meaningful `HttpsError` codes.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` in `functions/` — paste VERBATIM output (new callable tests must pass)
- [ ] Every changed file: path + the diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
