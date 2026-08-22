# Antigravity Task: PreSift — Smile Assessment FIX ROUND (6 findings from QA)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch ONLY the files listed below.

**Context:** The smile-assessment implementation (bank config, `functions/src/smile.ts`, session/submission/index wiring, TestPage third test) was verified by an independent QA pass. It works (110/110 tests, all builds green) but QA found 6 specific issues. Fix exactly these — nothing else.

---

## Fix 1 (BUG) — `src/pages/TestPage.tsx`: `totalTrials` → `total`
The Stage C summary renders `{smileRes.score} / {smileRes.totalTrials}`, but `SmileScoringResult` (in `functions/src/smile.ts`) has **`total`**, not `totalTrials`. Fix the property access so the summary shows `N / 20` instead of `N / undefined`. Verify against the actual interface — do not guess.

## Fix 2 (SCALE BUG) — `functions/src/index.ts`: OEA scale mismatch
`index.ts` computes `rawOea = scoreResult.wleis.rawScores.OEA / 4`. `rawScores.OEA` is a SUM of 4 Likert items (each 1–7 after reverse scoring), so `rawOea` becomes a **1–7 mean**, but `calibrateWLEIS` in `smile.ts` assumes a **1–5 scale** (normalizedAccuracy ∈ [1,5], clamps to 5.0). Result: any OEA mean > 5 always reads "overestimating" and clamps.
Fix so the scales match. Recommended: convert the 1–7 OEA mean to the 1–5 calibration scale before calling `calibrateWLEIS`, e.g. `rawOea5 = 1 + ((mean1to7 - 1) / 6) * 4` (linear 1–7 → 1–5). Keep `scoreResult.smile.calibration.rawOea` meaningful (document which scale it is in a code comment). Do NOT change `smile.ts` unless truly necessary.

## Fix 3 (SCOPE CREEP) — `src/pages/TestPage.tsx`: restore Firestore answer sync
The smile section edit REMOVED the pre-existing Firestore answer sync (the `getDoc`/`updateDoc` on the sessions doc that persisted ICAR/WLEIS progress). The task said "preserve all existing behavior". Restore that sync exactly as it was before (check git diff / previous TestPage content), and make sure the smile section does NOT remove or bypass it. If the sync was intentionally moved, put it back in the same place/behavior as the pre-smile version.

## Fix 4 (FORBIDDEN NOISE) — `functions/src/data/presift-bank.json`: revert reformat
The earlier run expanded compact JSON arrays into multi-line (~1000+ lines of pure formatting noise; semantically equal to HEAD except for `smileTask`). The task explicitly forbade this. Revert the file to its ORIGINAL formatting (compact arrays) while KEEPING the `smileTask` block exactly as it is now (authoritative intervals + ground truth — do not touch the data). Confirm with: `git diff functions/src/data/presift-bank.json | grep -c '^[+-]'` should be a small number (~45ish, i.e. only smileTask insertion), not 1200+.

## Fix 5 (MISSING TEST) — `functions/src/__tests__/submission-integration.test.ts`: smile happy path
Add tests asserting:
- A candidate submission WITH valid `smileAnswers` stores `scoreResult.smile` containing `score`, `total`, `accuracy`, `calibration` (with `calibratedOeaScore`, `bias`, `level`).
- A submission WITHOUT `smileAnswers` stores NO smile block (backward compat).
AAA style with comment zones, matching existing test style in that file. Do not break existing tests.

## Fix 6 (MISSING TEST) — `src/__tests__/TestPage.test.tsx`: Stage A render
Add a minimal test asserting the smile **Stage A instructions screen** renders (e.g. text mentioning the smile task / Genuine / Fake, or the Start button). No heavy video mocking — if the harness can't render the smile section without video, assert on the instructions content in the least invasive way possible and state what you did in the report.

## Minor polish (only if trivial, no new files)
- Stage B `<video>`: add `preload="auto"` (if not present).
- Stage A copy: mention the Duchenne criterion ("genuine smile reaches the eyes") — text-only tweak.

## Explicitly out of scope
- `functions/src/smile.ts` logic changes (unless Fix 2 truly requires it — then explain), scoring formulas, bank data, firestore.rules, auth, pricing, Dashboard/Admin pages, anything not listed above.

## Constraints
- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you ran it and have the output.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory)
- [ ] `npm run verify` — VERBATIM output (must stay 110 passing, or explain any delta)
- [ ] `npm run build` — VERBATIM output
- [ ] `npm --prefix functions run build` — VERBATIM output (must be clean)
- [ ] `npm test` in `functions/` — VERBATIM output (new integration tests pass)
- [ ] `git diff --stat functions/src/data/presift-bank.json` — show the reformat is reverted (small diff, only smileTask)
- [ ] Fix 1 confirmed: no `totalTrials` references remain in TestPage (grep)
- [ ] Every changed file: path + diff/lines, confirmed on disk
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-fix summary (Fix 1..6) + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
