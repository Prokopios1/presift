# Antigravity Task: PreSift — Complete Smile Assessment WIRING (bank fix + integration)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below.

**Context:** A previous partial run created `functions/src/smile.ts` (validateSmileAnswers / scoreSmileTask / calibrateWLEIS — GOOD, keep it) and `functions/src/__tests__/smile.test.ts`, plus a `smileTask` block in `presift-bank.json`. But the work is INCOMPLETE and the bank data is WRONG:

1. **Bank trial intervals are invented** — the agent used made-up values (e.g. trial 1: 0.0–4.2). The real intervals come from the source video's 19 detected scene cuts (ffmpeg scene detection on `public/assets/video/smile-4-presift.mp4`, 80.81s total). MUST be corrected to the authoritative list below.
2. **Trial IDs use `smile-01`** — spec requires `smile_01` … `smile_20` (underscore, zero-padded). Must match the IDs used by the client flow.
3. **No wiring exists**: `startSession` does not return `smileTask`, `submitAssessment` does not accept/score smile answers, `TestPage` has no third test section. The candidate flow must present the smile test as a third test after ICAR and WLEIS with exactly three stages: A) instructions, B) 20 video trials, C) calibration summary.

**Ground truth (AUTHORITATIVE — from P.'s official answer key, do not change):**
Trials 1–20: `G F F F G G F G F G G F F F G G G F G F` (G=genuine, F=fake).
Trial 3 = FAKE, trial 12 = FAKE.

**Authoritative trial intervals (start–end seconds; end of trial N = start of trial N+1):**

| Trial | start | end | GT |
|---|---|---|---|
| smile_01 | 0.00 | 3.88 | genuine |
| smile_02 | 3.88 | 7.80 | fake |
| smile_03 | 7.80 | 12.16 | fake |
| smile_04 | 12.16 | 16.08 | fake |
| smile_05 | 16.08 | 20.72 | genuine |
| smile_06 | 20.72 | 24.72 | genuine |
| smile_07 | 24.72 | 29.72 | fake |
| smile_08 | 29.72 | 33.44 | genuine |
| smile_09 | 33.44 | 36.84 | fake |
| smile_10 | 36.84 | 40.84 | genuine |
| smile_11 | 40.84 | 43.96 | genuine |
| smile_12 | 43.96 | 48.24 | fake |
| smile_13 | 48.24 | 52.04 | fake |
| smile_14 | 52.04 | 57.60 | fake |
| smile_15 | 57.60 | 62.36 | genuine |
| smile_16 | 62.36 | 66.52 | genuine |
| smile_17 | 66.52 | 70.16 | genuine |
| smile_18 | 70.16 | 73.88 | fake |
| smile_19 | 73.88 | 77.32 | genuine |
| smile_20 | 77.32 | 80.81 | fake |

---

## Changes

### 1. `functions/src/data/presift-bank.json` — FIX the `smileTask` block
- Replace the existing `smileTask.trials` array with the authoritative 20 trials above: `{ "trialId": "smile_01", "start": 0.00, "end": 3.88, "groundTruth": "genuine" }` … `{ "trialId": "smile_20", "start": 77.32, "end": 80.81, "groundTruth": "fake" }`.
- Keep `"videoUrl": "/assets/video/smile-4-presift.mp4"`. Add `"totalTrials": 20`.
- Do NOT reformat/restyle other parts of the file (the earlier run also produced a 1000+ line reformat of `banks` — revert that noise if it's in the working tree, keep the file's original formatting elsewhere).

### 2. `functions/src/session.ts` — expose smileTask (client-safe)
- Extend `resolveSession`'s return with `smileTask: { videoUrl: string; trials: Array<{ trialId: string; start: number; end: number }> }` — strip `groundTruth` (anti-cheat: ground truth must NEVER reach the client). Keep all existing ICAR/WLEIS behavior byte-identical.

### 3. `functions/src/index.ts` — startSession + submitAssessment
- `startSession`: include `smileTask` (from the bank, sans groundTruth) in the returned payload alongside `items` / `wleisItems` / `sessionId` / `sessionToken`.
- `submitAssessment`: accept optional `smileAnswers` (`Array<{ trialId, perceived: 'genuine'|'fake', rtMs }>`). If present:
  - validate via `validateSmileAnswers` (already in `smile.ts`) against the bank's smileTask trials;
  - read the candidate's WLEIS OEA raw score from the session/candidate data and call `scoreSmileTask(answers, trials, rawOea)` (already in `smile.ts`);
  - merge `scoreResult.smile = <result>` into the stored candidate result (same merge path as ICAR/WLEIS).
  - If absent → behave exactly as before (backward compatible; existing tests must pass).
- Keep explicit error handling (no naked try/catch), meaningful `HttpsError` codes.

### 4. `src/pages/TestPage.tsx` — third test, three stages
Integrate the smile test as a third section after ICAR and WLEIS. Preserve all existing behavior/timers/anti-cheat/localStorage resume.
- **Stage A — Instructions screen:** explain the task: "You will watch 20 short video clips of people smiling. Decide for each: is the smile GENUINE (real, reaches the eyes — a Duchenne smile) or FAKE (polite/social, mouth only)?" + Start button.
- **Stage B — 20 video trials:** one at a time; `<video src="/assets/video/smile-4-presift.mp4" preload="auto" muted playsInline>`, seek to `start`, play, pause at `end` via `timeupdate`; buttons **Genuine** / **Fake** + **Replay clip**; progress "Clip X of 20"; record `{ trialId, perceived, rtMs }`; allow skip (record rtMs, perceived can be required — no skip needed unless trivial); after trial 20 → Stage C.
- **Stage C — Calibration summary:** after `submitAssessment` (extend the existing submit call to include `smileAnswers`), show: "Smile Perception Accuracy: X% (N/20 correct)", WLEIS OEA self-report vs calibrated score, bias direction (overestimating/underestimating/balanced) and level (High/Moderate/Slight) from `scoreResult.smile.calibration`, plus a Finish button → navigate home. If no WLEIS result → show accuracy only with a note.
- Keep the existing localStorage resume pattern for the smile section (e.g. `assessment_${id}_smile`), consistent with the ICAR/WLEIS sections.

### 5. Tests
- `functions/src/__tests__/smile.test.ts` (exists) — verify it matches the authoritative data; add cases if needed: all-correct → 100%, all-wrong → 0%, null/invalid perceived rejected, duplicate trial rejected, wrong count rejected, calibration over/under/balanced boundaries.
- Extend `functions/src/__tests__/submitAssessment.test.ts` (or submission-integration): happy path with smileAnswers → stored result contains `scoreResult.smile` with calibration; absent smileAnswers → no smile block (backward compat).
- `src/__tests__/TestPage.test.tsx`: minimal — Stage A instructions render (no heavy video mocking; if harness can't render video, state that explicitly in the report).
- `e2e/`: sync specs ONLY if selectors break; list explicitly. No new e2e flows.

## Explicitly out of scope
- Recruiter/Admin dashboards (DashboardPage/AdminPage untouched), firestore.rules, auth, pricing, ICAR/WLEIS scoring formulas, anything not listed.

## Constraints
- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you ran it and have output.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory)
- [ ] `npm run verify` — VERBATIM output
- [ ] `npm run build` — VERBATIM output
- [ ] `npm --prefix functions run build` — VERBATIM output
- [ ] `npm test` in `functions/` — VERBATIM output (smile tests pass)
- [ ] `python3 -c "import json; d=json.load(open('functions/src/data/presift-bank.json')); print(' '.join(t['groundTruth'][0].upper() for t in d['smileTask']['trials']))"` — must print `G F F F G G F G F G G F F F G G G F G F`
- [ ] Every changed file: path + diff/lines, confirmed on disk
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
