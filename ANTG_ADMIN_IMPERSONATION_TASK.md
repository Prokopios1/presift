# TASK: Admin identity consistency + impersonation mode (CT2 workforce) (new session)

## Context (fresh — ignore prior session context)

Repo: b2b-assessment-engine (preSift), root = /home/fupazuzi/projects/b2b-assessment-engine.
You (ANTG) are the only one who writes code. Per role split: A1 controls/verifies, A2
inspects, and YOU commit AFTER A2 inspects, then YOU deploy. Do NOT commit until A2 sign-off.

Execute this through your CT2 workforce: Architect plans, Coder implements, Controller
reviews each part before moving on, DevOps runs the verification commands. Keep ALL
edits in one sequential lane — do not parallelize parts that touch the same file.

## Verified root cause (A2 live-audited presift.web.app 2026-08-30 — evidence below)

The admin account `admin1@oooops.eu` (uid NrCoiU0rTmUJGGtdeWz2AXygVwS2) has the Firebase
Auth custom claim `admin: true`, but its Firestore `users/NrCoi...` doc says `role: "recruiter"`.
Three independent "is admin" checks disagree — this is the whole mess:

| Check | Uses | Result for admin1 |
|---|---|---|
| `AuthContext` (src/contexts/AuthContext.tsx, guards) | token claim | admin ✅ |
| `AppSidebar` (src/components/AppSidebar.tsx) | users-doc role | recruiter ❌ |
| `resolveRecruiterId` (functions/src/utils/auth.ts) + `topUpCredits` + `createAssessmentLink` | users-doc role | recruiter ❌ |

Live-reproduced symptom: admin1 impersonating any recruiter → "Generate Assessment Link"
→ alert "Failed to create link." = `functions/permission-denied` "You do not have
permission to perform this action on behalf of another user." (HTTP 403). Root: the
payload `recruiterId` differs from caller uid → `resolveRecruiterId` checks
`callerDoc.data()?.role !== 'admin'` → the doc says recruiter → deny.

Second live finding: the Administrator Dashboard customer table (`AdminPage.tsx` filter
`u.role !== 'admin'`) lists admin1's own account as a customer row (email admin1@oooops.eu,
5 credits). Admin's sidebar shows NO "Admin Dashboard" link (AppSidebar doc-role check).

## What to do (CT2: Architect plan first, then implement sequentially)

1. **ONE admin definition everywhere — claims-based.** In functions, replace users-doc
   role checks with the token claim:
   - `resolveRecruiterId` (functions/src/utils/auth.ts): caller must be admin via
     `context.auth?.token?.admin === true` (NOT users-doc role). For the "target is
     another admin" guard, check the TARGET's claim via Admin SDK
     (`admin.auth().getUser(targetId)` → `customClaims?.admin === true`) instead of the
     target doc role.
   - `topUpCredits` + `createAssessmentLink` (functions/src/index.ts): the
     `doc.data()?.role === "admin"` blocks → use the caller's token claim.
   - `AppSidebar` (src/components/AppSidebar.tsx): role from `useAuth()` (claims-first)
     instead of re-reading the users doc.
2. **AdminPage customer table** (src/pages/AdminPage.tsx): exclude the current user's own
   uid from the recruiter list (in addition to the existing `role !== 'admin'` filter) so
   the admin never appears as his own customer. Keep showing all other non-admin accounts.
3. **Impersonation entry point (the missing UI):** add an "Impersonate" action (icon
   button, e.g. Eye/UserRound from lucide-react, with tooltip) on each non-admin customer
   row in AdminPage. Clicking it calls `setTargetId(accountId)` from
   `useImpersonation()` (src/contexts/ImpersonationContext.tsx — already exists,
   sessionStorage-backed) and navigates to `/dashboard`. The orange
   ImpersonationBanner + "Exit Impersonation" + RecruiterGuard + DashboardPage
   `targetId || user.uid` wiring ALREADY work — do not rebuild them.
4. **Do NOT touch:** bank JSON, scoring, session logic, TestPage, PaymentPage copy.
   Do NOT add impersonation UI anywhere except AdminPage.

## Verify (DevOps engine)

- `npm run verify` green (lint + tsc + unit tests).
- Add/update a unit test: `resolveRecruiterId` allows a claim-admin caller to act on
  behalf of a non-admin recruiter; blocks a doc-role-'recruiter' caller; blocks
  impersonating a claim-admin target.
- Manual (emulator or live): admin1 impersonates a recruiter → dashboard shows the
  recruiter's data + banner → "Generate Assessment Link" succeeds and creates the
  candidate under the recruiter's id.

## Report to A2

Diff summary + `npm run verify` output + which tests were added/changed.
Do NOT commit until A2 sign-off. After sign-off: commit, then
`firebase deploy --only hosting,firestore:rules,functions`, report the live URL.
