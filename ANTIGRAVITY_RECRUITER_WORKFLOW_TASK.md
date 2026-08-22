# Antigravity Task — Recruiter Workflow: Link Generation, 1€ Promo Tier, Candidate Detail Page, Admin Guard, Global Back/Forward Nav

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** Recruiter completes registration and needs a full operational loop: buy credits → generate a unique assessment link per candidate → candidate completes assessment → recruiter sees the updated candidate on their dashboard → drills into a dedicated Candidate Detail page with the full report. Recruiters must never reach the `/admin` routes. A 1€ Promo Tier is being added to credit purchase options, and every page in the workflow needs working Back/Forward navigation. Reports are recorded to Codegraph.

**Source of truth (current state, verified by A1 on disk):**
- Routes (`src/App.tsx`): `/` Landing, `/register` Register, `/admin` + `/admin/clients/:clientId` Admin, `/dashboard` Dashboard, `/test/:assessmentId` + `/assessment/:assessmentId` TestPage, `/pricing` PaymentPage (production-only DemoPage at `/demo`).
- `PaymentPage.tsx` already pre-populates companyName/email/vat/billingAddress from Firestore `users/{uid}` (uid read from `localStorage['presift_uid']`); `UNIT_PRICE = 5` (€5/credit), credits steer −1/−5/+1/+5 (min 1), total = `credits*UNIT_PRICE`, calls `httpsCallable(functions,'createCheckoutSession')` (name TBC — confirm in `functions/src/index.ts`).
- `functions/src/stripe.ts`: `amountCents = quantity * 500`, product name from a `label`, credits in session metadata, fulfillment increments `users/{uid}.credits`.
- `DashboardPage.tsx`: candidates from `collection(db,'candidates') where recruiterId == RECRUITER_ID` (RECRUITER_ID read from local demo session/presift_uid); row click opens a **Drawer detail panel** (full ICAR/WLEIS report, anti-cheating, prompts, Export PDF). This panel is the candidate detail today — the task must move/expose it as a routed Candidate Detail Page (Page 4).
- `AppSidebar.tsx`: hardcoded nav item `{ label: 'Owner / Admin', href: '/admin', ... }` — currently NOT role-gated (visible to everyone). This is the admin-leak vector to fix.
- No promo tier exists anywhere (`grep` for `1€/promo` on PaymentPage + `stripe.ts` = no hits).
- No candidate report-status field found beyond the workflow `status` string (Shortlisted/Interviewing/Rejected) in the Dashboard.

## Changes

### 1. Access Control — Recruiters blocked from `/admin`
- `src/App.tsx`: add a guard route wrapper around `/admin` and `/admin/clients/:clientId`. If the current user's role is not admin/owner (read from `users/{uid}` via Firestore and/or the demo session), render an access-denied page (or redirect away from `/admin`). Confirmed rule: recruiters must NOT view or access admin routes/views.
- `src/components/AppSidebar.tsx`: hide the `Owner / Admin` nav item unless the current user is admin/owner (same role signal).

### 2. 1€ Promo Tier in credit purchase
- `src/pages/PaymentPage.tsx`: add a **1€ Promo Tier** option to the purchase options (e.g. a selectable tier card separate from the €5/credit stepper). Determine natural quantity mapping and reflect it in the checkout amount.
- `functions/src/stripe.ts` + `functions/src/index.ts`: support the promo tier price (e.g. `1€` for a bundled promo credit count) via the `createCheckoutSession` callable. Keep the existing 5€/credit path intact. Metadata must still carry `credits` for fulfillment correctness.
- Keep the existing registration pre-population behavior verified working (do not regress companyName/email/vat/billingAddress auto-fill).

### 3. Candidate Detail Page (Page 4)
- Move the comprehensive report the Dashboard drawer renders today (ICAR/WLEIS breakdowns, fit badge, integrity flags, anti-cheating/duration, custom interview prompts, Export PDF) into a dedicated routed page, e.g. `/candidate/:candidateId`. Dashboard candidate click should navigate to it (not open the drawer). Candidate Detail page must include full report + metrics as specified.
- Keep the candidate list + row selection/edit/archive/delete/shortlist behavior intact on the Dashboard.

### 4. Global Back/Forward navigation
- Ensure every workflow page (Landing `/`, Register `/register`, Dashboard `/dashboard`, Payment `/pricing`, Candidate Detail `/candidate/:candidateId`, TestPage candidate-facing route) has functional **Back** and **Forward** controls wired via react-router (`useNavigate` back/forward or configured `Link`s to the logical previous/next step in the journey). Do not rely on browser chrome alone.

### 5. Schema / report-status field
- Add candidate report-status if needed to drive the "completed → appears updated on dashboard" state: a field such as `reportStatus: 'pending' | 'completed'` (or reuse/extend existing) on the `candidates` doc, set when an assessment is submitted. Apply via `functions/src` (submission handler) + any `firestore.rules`/index changes required. Include migration instructions for Hermes to apply to the Firestore emulator (do not run deploy yourself — flag it).

## Explicitly out of scope
- Do NOT redesign visual styling of the existing pages beyond what this flow requires.
- Do NOT touch `scripts/`, `e2e/` Playwright specs, `DeployToolbar`, `DemoPage` admin fixture, or unrelated existing behavior.
- Do NOT deploy. State DB/schema changes and let Hermes apply + verify.
- Do NOT reuse old screenshots or artifacts as evidence for new work.

## Constraints
- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Minimal, modular changes. Record the flow + changes to Codegraph.

## Evidence Checklist (mandatory — every item must be answered)
- [ ] `npm run verify` — paste VERBATIM output.
- [ ] `npm run build` — paste VERBATIM output. **Build success is the real gate** (root tsconfig.json is solution-style `"files": []`).
- [ ] Every changed file: path + the diff/lines changed, confirmed present on disk (`ls -la` / `stat`).
- [ ] Route map before/after (`src/App.tsx`) confirming admin guard + new `/candidate/:candidateId` route.
- [ ] Exact `createCheckoutSession` input/output contract + how promo tier maps to credits/amount.
- [ ] Schema/status field: name, where written on submission, rules change.
- [ ] State exactly which files you modified, with timestamps.
- [ ] If screenshots required: state Hermes will capture them; save raw files to repo and give paths (never link sandbox `file://` paths).

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
