# TASK: Fix stale "ICAR-16" copy in PaymentPage (new session)

## Context (fresh — ignore prior session context)

Repo: b2b-assessment-engine (preSift), root = /home/fupazuzi/projects/b2b-assessment-engine.
You (ANTG) are the only one who writes code. Per role split: A1 controls/verifies, A2
inspects, and YOU commit AFTER A2 inspects. For THIS task: implement it, then A2 will
inspect, then you commit. Do NOT commit until A2 sign-off.

## Recent changes already committed + deployed (A2 informs you — do NOT redo)

The ICAR item bank was reduced from 16 to 12 items and the hardcoded counts were fixed.
These are DONE, live on https://presift.web.app, and NOT part of your task:

1. Commit `b24aeee` — "Update ICAR test items and adjust scoring": removed the 4 spatial
   ICAR items (ICAR-S-01..04) from `functions/src/data/presift-bank.json` by ID.
   Cognitive bank is now 12 items: ICAR-N-01..04, ICAR-V-01..04, ICAR-A-01..04.
   WLEIS is UNCHANGED at 16 items.
2. Commit `9f6b183` — "Fix hardcoded ICAR/WLEIS item counts to match reduced bank
   (16 -> dynamic)" (authored by A2/Hermes): replaced the hardcoded `16` in
   `functions/src/submission.ts` (`validateSubmission`) and in 3 test files
   (`session.test.ts`, `submission.test.ts`, `session-parameterization.test.ts`) with
   dynamic `bank.cognitive.items.length` / `bank.wleis.items.length`. All 138 function
   tests pass.
3. Deployed to live: `firebase deploy --only hosting,firestore:rules,functions` —
   startSession/submitAssessment now serve and validate 12 ICAR items at
   https://presift.web.app (homepage 200, functions reachable).

## Task: fix the one remaining stale copy

`src/pages/PaymentPage.tsx` line 314 still advertises the old count:

```tsx
"Full ICAR-16 cognitive assessment",
```

The assessment is now 12 items. Change `"Full ICAR-16 cognitive assessment"` to
`"Full ICAR-12 cognitive assessment"` (12 = bank.cognitive.items.length; matches the
existing "WLEIS-16" naming pattern on the line right below it).

## Scope guardrails

- DO NOT touch line 315 ("Full WLEIS-16 ...") — WLEIS is still 16 items.
- DO NOT touch the bank JSON, scoring, session logic, or any tests.
- The `localStorage` session cache on TestPage is a KNOWN behavior (old cached sessions
  show 16 until cleared) — deliberately left as-is; do NOT add a cache-version fix in
  this task.
- Verify before reporting: `grep -rn "ICAR-16" src/` returns no matches (excluding
  node_modules), and `npm run verify` stays green.

## What to do

1. Edit `src/pages/PaymentPage.tsx` line 314 (one string change).
2. Run `grep -rn "ICAR-16" src/ --include="*.tsx" --include="*.ts"` → expect no matches.
3. Run `npm run verify` → expect green (lint + tsc + unit tests).
4. Report the diff to A2 for inspection. Do NOT commit until A2 sign-off.
