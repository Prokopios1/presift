# ANTG Task — Agency Agents persona review of preSift (Batch 1 of 3: Product, UX, Recruitment domain)

**Project:** `/home/fupazuzi/projects/b2b-assessment-engine` (preSift)
**Author:** A2 (Hermes), supervising on behalf of P.
**Precondition:** The Agency Agents suite is installed in `.agents/rules/` (282 personas,
each `trigger: manual`). See `AGENTS.md` for the index. A2 verified this.

## What the app is

preSift = B2B psychometric candidate pre-screening SaaS. Recruiters invite candidates to a
short assessment (ICAR-16 fluid intelligence via IRT-3PL + WLEIS-16 emotional intelligence);
recruiters get scored intelligence profiles with structured interview prompts.
Stack: React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui, Firebase (Hosting SPA,
Cloud Functions callables, Firestore, Auth). Live: https://presift.web.app
Markets: EU (Greece first) + USA. Buyers: small-business owners (5–50 staff, no HR),
small-company HR (1–3), independent recruiters. Also has an ATS-validator capability.

## Your personas for THIS batch (load them ONE AT A TIME)

1. `product-manager`  → `.agents/rules/product-manager.md`
2. `design-ux-researcher` → `.agents/rules/design-ux-researcher.md`
3. `specialized-recruitment-specialist` → `.agents/rules/specialized-recruitment-specialist.md`

## Method (sequential — no parallel loops)

For each persona, in order:

1. Read the persona rule file (e.g. `.agents/rules/product-manager.md`). Load only that
   one persona; never concatenate the catalog.
2. Inspect the app through that persona's lens. Sources to read:
   - `README.md`, `BLUEPRINT.md`, `docs/PRODUCT_SHEET.md`, `docs/screens/` (list them)
   - `src/pages/*.tsx` (LandingPage, DemoPage, TestPage, ThankYouPage, DashboardPage,
     CandidateDetailPage, RecruiterGuidePage, RegisterPage, PaymentPage, ProfilePage, Admin*)
   - `src/components/**`, `src/locales/en.json` + `src/locales/gr.json`
   - `functions/src/**` (scoring + API surface) — read-only
   - `public/**`
   - You MAY fetch https://presift.web.app for the live view if useful.
3. Write `.agents/reviews/<slug>-review.md` with this shape:
   - `# <Persona Name> — preSift review`
   - `Persona: <name>` / `Specialization: <one line>`
   - `## What I inspected` (the concrete files/URLs)
   - `## Findings` (numbered, concrete, tied to specific screens/files)
   - `## Prioritized recommendations` (High / Medium / Low, each with why + rough effort)
   - `## What I would NOT change` (honest: what is already good)
   Be specific and opinionated, in the persona's voice. No generic filler.
4. Move to the next persona. Pace steps with a 2–3 s gap between chained tool calls.

## Scope lock (this task only)

You may **create/modify ONLY**:

- `<repo>/.agents/reviews/**` (new directory — one `<slug>-review.md` per persona above)

Everything else is READ-ONLY: do not touch `.agents/rules/`, `.agents/README.md`,
`AGENTS.md`, `GEMINI.md`, `src/**`, `functions/**`, `docs/**`, configs, tests. If you find
a bug elsewhere, REPORT it in the review — do not fix it. No commits, no deploys, no
reverts, no `git checkout/reset/restore`.

## Deliverable

Three review files for batch 1, plus a short final message: files written, one-line
headline per persona, and total High-priority items. Then STOP — A2 verifies.
