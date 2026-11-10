# ANTG Task — Agency Agents persona review of preSift (Batch 3 of 3: Marketing, Growth & Commercial)

**Project:** `/home/fupazuzi/projects/b2b-assessment-engine` (preSift)
**Author:** A2 (Hermes), supervising on behalf of P.
**Precondition:** Agency Agents suite installed in `.agents/rules/` (282 personas, all
`trigger: manual`); index in `AGENTS.md`. Verified by A2.

## What the app is

preSift = B2B psychometric candidate pre-screening SaaS. Recruiters invite candidates; get
scored intelligence profiles + structured interview prompts. React 19 + Vite + Firebase.
Live: https://presift.web.app. Markets: EU (Greece FIRST) + USA.
Buyers: small-business owners (5–50 staff, no HR), small-company HR (1–3), independent
recruiters. Pricing/credits model exists (credit packs, VAT invoice generation).
Constraint for ALL marketing advice: preSift must NEVER be marketed as "AI" — scoring is
deterministic (IRT + answer key), no AI at runtime, no face capture. Any claim of that
kind is both inaccurate and a compliance risk.
There is also a Greek-language landing + Greek UI (default locale `gr`).

## Your personas for THIS batch (load them ONE AT A TIME)

1. `marketing-seo-specialist` → `.agents/rules/marketing-seo-specialist.md`
2. `marketing-content-creator` → `.agents/rules/marketing-content-creator.md`
3. `marketing-growth-hacker` → `.agents/rules/marketing-growth-hacker.md`
4. `marketing-linkedin-content-creator` → `.agents/rules/marketing-linkedin-content-creator.md`
5. `paid-media-paid-social-strategist` → `.agents/rules/paid-media-paid-social-strategist.md`

## Method (sequential — no parallel loops)

For each persona, in order:

1. Read only that persona's rule file. Never concatenate the catalog.
2. Inspect through that persona's lens. Sources:
   - `src/pages/LandingPage.tsx`, `DemoPage.tsx`, `RegisterPage.tsx`, `PaymentPage.tsx`,
     `RecruiterGuidePage.tsx`, `ThankYouPage.tsx`
   - `src/locales/en.json` + `src/locales/gr.json` (messaging, EN + GR)
   - `docs/PRODUCT_SHEET.md`, `docs/screens/` (list), `public/**`
   - `README.md`, `BLUEPRINT.md`
   - You MAY fetch https://presift.web.app (both the landing and the GR copy if reachable).
3. Write `.agents/reviews/<slug>-review.md`:
   - `# <Persona Name> — preSift review`
   - `Persona:` / `Specialization:`
   - `## What I inspected`
   - `## Findings` (numbered, concrete, cite screen/file/copy)
   - `## Prioritized recommendations` (High / Medium / Low + why + rough effort)
   - `## What I would NOT change`
   Channel-appropriate: LinkedIn persona focuses on the B2B HR/recruiter channel; paid-social
   on the paid funnel + creative; SEO on technical SEO + the site's crawlability (note the
   `.agents/rules/` AGENTS.md marketing-relevant angle if useful); content on messaging/voice
   in EN and GR; growth on acquisition loops and the free-demo funnel.
4. Pace chained tool calls with a 2–3 s gap. Move to the next persona.

## Scope lock (this task only)

You may **create/modify ONLY** `<repo>/.agents/reviews/**`. Everything else READ-ONLY
(do not touch `.agents/rules/`, `AGENTS.md`, `GEMINI.md`, `src/**`, `public/**`, configs,
tests). Report problems; do not fix them. No commit/deploy/revert.

## Deliverable

Five review files, plus a final message: files written, one-line headline per persona,
total High-priority items. Then STOP — A2 verifies.
