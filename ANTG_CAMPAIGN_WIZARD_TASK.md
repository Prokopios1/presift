# ANTG Task: Recruiter Campaign Wizard (`/assessments/new`)

Controller (A1) grounded this against the live repo. **Read this fully before coding.** Keep working tree hygiene: there is an UNCOMMITTED VAT/Billing removal on `src/pages/RegisterPage.tsx` + its test (A2-verified PASS, awaiting deploy). Do NOT revert, clobber, or re-edit those two files — build on top of them.

## Goal
Shift the recruiter experience from a **flat candidate-link list** to a **campaign-driven workflow**. A recruiter creates a named assessment **campaign** (e.g. "Backend Engineer — Q1"), defines the role, picks modules, and dispatches candidates — all in one guided wizard, instead of creating loose one-off links.

Same underlying backend hooks; this is primarily NEW UI + a campaign grouping layer in Firestore. Do not invent new scoring/monitoring engines.

## Current facts (verified — trust these)
- **Repo:** `/home/fupazuzi/projects/b2b-assessment-engine`. HEAD `8ae5601`.
- **Router** (`src/App.tsx`): routes `/`, `/register`, `/dashboard`, `/candidate/:candidateId`, `/test/:assessmentId`, `/assessment/:assessmentId`, `/demo` (dev), `/pricing`, `/admin`, `/admin/clients/:clientId`. Global back/forward via react-router.
- **Dashboard today** (`src/pages/DashboardPage.tsx`): a flat candidates table + a single **"Create New Link"** dialog that gathers `roleTitle`, `candidateName`, `candidateEmail` and calls `createAssessmentLink` (deducts 1 credit, returns a link). Candidate rows carry `roleTitle`/`appliedRole`, `name`, `email`, `archived`, `reportStatus`. Bulk select + bulk delete (`bulkDeleteCandidates`), edit (`updateCandidate`), archive, copy link. Sidebar filters.
- **Backend callables already exist** (`functions/src/index.ts`): `registerRecruiter`, `createClient`, `createAssessmentLink` (takes `{roleTitle, candidateName, candidateEmail}`, deducts 1 credit on the recruiter user doc, returns link), `startSession`, `submitAssessment`, `topUpCredits`, `generateB2BInvoice`, `bulkDeleteCandidates`, `updateCandidate`.
- **Firestore collections:** `users`, `candidates`, `sessions`, `assessments`, `users/<id>/creditAuditLog`.
- **Candidate doc fields in use:** `id`, `name`, `email`, `roleTitle`/`appliedRole`, `recruiterId`, `archived`, `reportStatus`, `createdAt`. No `campaign`/`department`/`positionTitle` field yet.
- **Module engines:** ICAR-16 (fluid intelligence, 4 domains) + WLEIS-16 (EQ, 4 subscales), server-side scored. Not in scope to change.
- **Credits/pricing:** 1 credit = €1 promo (`isPromo=credits===1`), else €5/credit; slider 1–200 on `/pricing`. `createAssessmentLink` already deducts 1 credit per candidate.

## Deliverables — Campaign Wizard

### 1. Campaign grouping layer (Firestore)
Add a **`campaigns`** collection so candidates can be grouped:
- Document shape: `{ id, recruiterId, positionTitle, department, moduleIds: ['icar16']|['wleis16']|['icar16','wleis16'], status: 'open'|'closed', createdAt, candidateCount }`.
- On candidate creation via a campaign, set `candidateDoc.campaignId = <campaignId>` (add a `campaignId` field to candidate docs).
- Dashboard candidates should be filterable/groupable by campaign.

### 2. New route + wizard page
- Add route **`/assessments/new`** → `AssessmentWizardPage` (new file `src/pages/AssessmentWizardPage.tsx`). Add to `src/App.tsx`.
- Also add a **campaigns landing** route, e.g. `/assessments` → list of the recruiter's campaigns (cards: positionTitle, department, module chips, candidateCount, status) with "+ New Assessment" CTA. (Optional but recommended to make campaigns visible.)
- **Dashboard CTA:** replace/augment the flat "Create New Link" button with a prominent **"+ Create New Assessment"** that goes to `/assessments/new`.

### 3. Three-step wizard (`/assessments/new`)
Guided multi-step flow (use a local stepper state; no backend wizard callables needed):
- **Step 1 — Define position:** `positionTitle` (required) + `department`. Live validation (non-empty positionTitle).
- **Step 2 — Select modules:** checkboxes/toggle cards for **ICAR-16** (fluid intelligence) and **WLEIS-16** (emotional intelligence), with transparent credit preview (1 credit per candidate per assessment — confirm exact cost; if both modules selected, state whether it's 1 total or 2 credits and keep it consistent with backend deduction). At least 1 module required.
- **Step 3 — Dispatch candidates:** add candidate rows inline (name + email, at least one), OR generate a **role-specific secure invite link** (reuse `createAssessmentLink` per candidate). Review summary (campaign name, modules, candidate count, total credits) then create.
- On submit: create the campaign doc, create/attach candidate docs, deduct credits (reuse `createAssessmentLink` per candidate — do NOT write a new credit-deduction path unless you also verify balance guard), then navigate to `/assessments` (the campaign list).

### 4. Backlink the dashboard
- Candidate table shows its **campaign / position title** (already partially via `roleTitle`). Map by `campaignId` to show the campaign name. Optionally filter by campaign.

### 5. Backend (minimal, explicit)
- Add `createAssessmentLink` support for an optional `campaignId` + `positionTitle` passthrough so wizard-created links stamp the candidate's campaign. Do NOT change credit math. Do NOT change scoring.
- Add a **`createCampaign`** HTTPS callable (Firebase): validates `positionTitle` (required, string), `department` (optional), `moduleIds` (non-empty array subset of `['icar16','wleis16']`), `recruiterId` (from auth or `demo_recruiter` via `allowAnonDemo()`), creates the campaign doc. If you implement `bulk-create-candidate-dispatches`, keep it explicit + atomic-ish (no naked try/catch; throw `HttpsError` with clear codes; check balance before any deduction).

### 6. Tests
- Add unit tests (Vitest + Testing Library) for the wizard: validation of each step (empty position rejected, no-module rejected, candidate email format), the 3-step navigation, and that submit calls the right callables. Add backend test for `createCampaign` (happy path, missing position → `invalid-argument`, bad `moduleIds` → `invalid-argument`). Follow AAA layout, test null/empty/bad-type natively. Match existing test style in `src/__tests__/` and `functions/src/__tests__/`.

## Constraints
- **Do NOT touch** `src/pages/RegisterPage.tsx` + its test (uncommitted VAT removal) except to leave them as-is.
- **Do NOT change** scoring engines, `PaymentPage.tsx`, `/pricing`, credit pricing, `firestore.rules`, `functions/src/index.ts` existing credit math or VAT/billing fields.
- Explicit error handling; **no naked try/catch**; no hardcoded secrets.
- After implementing: run `npx tsc --noEmit`, `npm test`, `npm run build` — all must pass. Fix your own errors before handing off.
- Leave the tree dirty (do NOT commit) for A2 verification.

## Not in scope
- No new scoring/monitoring engines. No campaign templates/duplication. No cross-recruiter sharing. No email delivery automation (links are copied by the recruiter).
