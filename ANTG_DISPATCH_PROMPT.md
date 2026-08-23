# ANTG Agent Dispatch Prompt — Recruiter Workflow, RBAC, Credit Mechanics

Read `ANTIGRAVITY_RECRUITER_WORKFLOW_TASK.md` in this repo as your source of truth (it is the full current-state brief). Implement ALL of its changes in the preSift project `/home/fupazuzi/projects/b2b-assessment-engine`. Deliver functional code directly; keep explanations minimal.

Project state: HEAD = `c0d3d70` (fix(emulators)). Working tree is clean. Touch ONLY the files listed — anything else is out of scope unless you confirm first.

## Changes to implement

### 1. Access Control — RBAC (recruiters blocked from /admin)
- `src/App.tsx`: wrap `/admin` and `/admin/clients/:clientId` in a guard. If the current user's role is not admin/owner (read from `users/{uid}` via Firestore and/or the demo session `localStorage['presift_uid']`), render an access-denied view or redirect away from `/admin`. Recruiters must have ZERO access to admin routes/views.
- `src/components/AppSidebar.tsx`: hide the `Owner / Admin` nav item unless the current user is admin/owner (same role signal).

### 2. €1 Promo Tier in credit purchase
- `src/pages/PaymentPage.tsx`: add a selectable **€1 Promo Tier** option to the purchase options (separate from the €5/credit stepper). Map to a natural credit count and reflect in the checkout amount.
- `functions/src/stripe.ts` + `functions/src/index.ts`: support the €1 promo price via the `createCheckoutSession` callable. Keep the existing €5/credit path intact. Metadata must still carry `credits` for fulfillment correctness.
- Do NOT regress the existing registration pre-population (companyName/email/vat/billingAddress auto-fill from `users/{uid}`).

### 3. Candidate Detail Page (Page 4)
- Move the comprehensive report the Dashboard drawer renders today (ICAR/WLEIS breakdown, fit badge, integrity flags, anti-cheating/duration, custom interview prompts, Export PDF) into a dedicated routed page `/candidate/:candidateId`.
- Dashboard candidate row click must navigate to `/candidate/:candidateId` (not open the drawer).
- Keep the candidate list + row selection/edit/archive/delete/shortlist behavior intact on the Dashboard.

### 4. Global Back/Forward navigation
- Ensure every workflow page (Landing `/`, Register `/register`, Dashboard `/dashboard`, Payment `/pricing`, Candidate Detail `/candidate/:candidateId`, candidate-facing test route `/test/:assessmentId`) has functional **Back** and **Forward** controls wired via react-router (`useNavigate` back/forward or configured `Link`s to the logical previous/next step). Do not rely on browser chrome alone.

### 5. Schema / report-status field
- Add `reportStatus: 'pending' | 'completed'` (or reuse/extend existing) to the `candidates` doc, set when an assessment is submitted. Apply via `functions/src` (submission handler) + any `firestore.rules`/index changes required.
- Include migration instructions for Hermes to apply to the Firestore emulator. Do NOT run deploy yourself — flag it.

## Hard constraints
- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Minimal, modular changes. Record the flow + changes to Codegraph.
- **Do NOT commit. Do NOT deploy.**

## Evidence checklist (mandatory — answer every item)
1. `npm run verify` — paste VERBATIM output.
2. `npm run build` — paste VERBATIM output (build success is the real gate).
3. Every changed file: path + lines changed, confirmed on disk (`ls -la` / `stat` with timestamps).
4. Route map before/after (`src/App.tsx`) confirming admin guard + new `/candidate/:candidateId` route.
5. Exact `createCheckoutSession` input/output contract + how the €1 promo tier maps to credits/amount.
6. Schema/status field: name, where written on submission, rules/index change.
7. State exactly which files you modified, with timestamps.

Report format: per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
