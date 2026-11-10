# ANTG Task — Agency Agents persona review of preSift (Batch 2 of 3: Trust, Security & ATS fit)

**Project:** `/home/fupazuzi/projects/b2b-assessment-engine` (preSift)
**Author:** A2 (Hermes), supervising on behalf of P.
**Precondition:** Agency Agents suite installed in `.agents/rules/` (282 personas, all
`trigger: manual`); index in `AGENTS.md`. Verified by A2.

## What the app is

preSift = B2B psychometric candidate pre-screening SaaS (ICAR-16 fluid intelligence, IRT-3PL;
WLEIS-16 emotional intelligence). React 19 + Vite + Firebase (Hosting, Cloud Functions,
Firestore, Auth). Live: https://presift.web.app. Markets EU (Greece first) + USA.
Scoring is deterministic (IRT + answer key); there is NO AI at runtime and NO face capture.
Note for compliance: the "emotion" task has the CANDIDATE judge other people's faces — it is
not emotion detection of the candidate.

## Your personas for THIS batch (load them ONE AT A TIME)

1. `specialized-data-privacy-officer` → `.agents/rules/specialized-data-privacy-officer.md`
2. `security-appsec-engineer` → `.agents/rules/security-appsec-engineer.md`
3. `engineering-ats-validator-architect` → `.agents/rules/engineering-ats-validator-architect.md`

## Method (sequential — no parallel loops)

For each persona, in order:

1. Read only that persona's rule file. Never concatenate the catalog.
2. Inspect through that persona's lens. Sources:
   - `firestore.rules` (note: currently DEV/DEMO open mode, production rules commented out)
   - `functions/src/**` (session.ts, psychometrics.ts, submission.ts, seeder.ts, callables)
   - `src/pages/**`, `src/contexts/**`, `src/lib/**`
   - `README.md`, `BLUEPRINT.md`, `docs/PRODUCT_SHEET.md`
   - `.env` / config presence (do NOT print secrets — report the pattern only)
   - You MAY fetch https://presift.web.app
3. Write `.agents/reviews/<slug>-review.md`:
   - `# <Persona Name> — preSift review`
   - `Persona:` / `Specialization:`
   - `## What I inspected`
   - `## Findings` (numbered, concrete, cite file/line or screen)
   - `## Prioritized recommendations` (High / Medium / Low + why + rough effort)
   - `## What I would NOT change`
   For the privacy officer: explicitly assess GDPR exposure and whether the product sits
   INSIDE or OUTSIDE the EU AI Act (given deterministic scoring, no AI runtime, no face
   capture) — and flag any wording/marketing that would create the opposite impression.
   For ATS fit: assess the ATS-validator angle — integration path, data contract, buyer value.
4. Pace chained tool calls with a 2–3 s gap. Move to the next persona.

## Scope lock (this task only)

You may **create/modify ONLY** `<repo>/.agents/reviews/**`. Everything else READ-ONLY
(do not touch `.agents/rules/`, `AGENTS.md`, `GEMINI.md`, `src/**`, `functions/**`,
`firestore.rules`, configs, tests). Report problems; do not fix them. No commit/deploy/revert.

## Deliverable

Three review files, plus a final message: files written, one-line headline per persona,
total High-priority items. Then STOP — A2 verifies.
