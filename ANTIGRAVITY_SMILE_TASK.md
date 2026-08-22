# Antigravity Task: PreSift — 20-Trial Video Smile Assessment (third test) + WLEIS Bias Correction

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** P. wants a third objective assessment added to the candidate test flow, alongside the existing ICAR-16 (cognitive) and WLEIS-16 (emotional intelligence) tests. It is a **20-trial Duchenne/genuine-vs-fake smile perception task** built on a local source video, designed to *validate and calibrate the subjective WLEIS self-report* with an objective performance measure. The candidate flow MUST have exactly three stages:

- **A) User reads instructions** — an instructions screen explaining the task (watch each clip, judge whether the smile is GENUINE or FAKE).
- **B) User does the test** — 20 sequential video trials; each trial plays one clip segment and the user answers "Genuine" or "Fake".
- **C) App does the calibration** — after submission, the app computes smile-perception accuracy, compares it against the candidate's WLEIS self-report (specifically the OEA — Others' Emotion Appraisal — subscale), and shows a calibration summary (accuracy %, bias, calibrated OEA score).

**Anti-cheat principle (must be preserved):** ground truth NEVER reaches the client. The client receives only trial ids + time windows + the video URL. The `groundTruth` values live only in the server-side item bank and the scoring happens in Cloud Functions — exactly like the existing `SessionKey[]` design.

---

## 0. Video Asset (ALREADY DONE — verify, do not re-copy)

- Source: `~/Videos/smile-4-presift.mp4` (80.81 s, 314×286, 25 fps, h264+aac, 1,310,479 bytes, md5 `9bff669b467bf8f758c503fee6209bcd`).
- **Already copied** to `public/assets/video/smile-4-presift.mp4` (same md5 — verified on disk). Vite serves it at `/assets/video/smile-4-presift.mp4`.
- Your job: confirm the file exists at that path (`ls -la public/assets/video/`), do NOT re-copy or modify it.

## 1. Data Bank — `functions/src/data/presift-bank.json`

Add a top-level `"smileTask"` object (sibling of `"cognitive"` / `"wleis"`).

> ✅ **GROUND TRUTH = AUTHORITATIVE (from P.'s answer-key image, verified).** The labels below are final — do not change them. Official sequence: 1=G, 2=F, 3=F, 4=F, 5=G, 6=G, 7=F, 8=G, 9=F, 10=G, 11=G, 12=F, 13=F, 14=F, 15=G, 16=G, 17=G, 18=F, 19=G, 20=F.

```json
"smileTask": {
  "videoUrl": "/assets/video/smile-4-presift.mp4",
  "totalTrials": 20,
  "trials": [
    { "id": "smile_01", "startSec": 0.00,  "endSec": 3.88,  "groundTruth": "genuine" },
    { "id": "smile_02", "startSec": 3.88,  "endSec": 7.80,  "groundTruth": "fake"    },
    { "id": "smile_03", "startSec": 7.80,  "endSec": 12.16, "groundTruth": "fake"    },
    { "id": "smile_04", "startSec": 12.16, "endSec": 16.08, "groundTruth": "fake"    },
    { "id": "smile_05", "startSec": 16.08, "endSec": 20.72, "groundTruth": "genuine" },
    { "id": "smile_06", "startSec": 20.72, "endSec": 24.72, "groundTruth": "genuine" },
    { "id": "smile_07", "startSec": 24.72, "endSec": 29.72, "groundTruth": "fake"    },
    { "id": "smile_08", "startSec": 29.72, "endSec": 33.44, "groundTruth": "genuine" },
    { "id": "smile_09", "startSec": 33.44, "endSec": 36.84, "groundTruth": "fake"    },
    { "id": "smile_10", "startSec": 36.84, "endSec": 40.84, "groundTruth": "genuine" },
    { "id": "smile_11", "startSec": 40.84, "endSec": 43.96, "groundTruth": "genuine" },
    { "id": "smile_12", "startSec": 43.96, "endSec": 48.24, "groundTruth": "fake"    },
    { "id": "smile_13", "startSec": 48.24, "endSec": 52.04, "groundTruth": "fake"    },
    { "id": "smile_14", "startSec": 52.04, "endSec": 57.60, "groundTruth": "fake"    },
    { "id": "smile_15", "startSec": 57.60, "endSec": 62.36, "groundTruth": "genuine" },
    { "id": "smile_16", "startSec": 62.36, "endSec": 66.52, "groundTruth": "genuine" },
    { "id": "smile_17", "startSec": 66.52, "endSec": 70.16, "groundTruth": "genuine" },
    { "id": "smile_18", "startSec": 70.16, "endSec": 73.88, "groundTruth": "fake"    },
    { "id": "smile_19", "startSec": 73.88, "endSec": 77.32, "groundTruth": "genuine" },
    { "id": "smile_20", "startSec": 77.32, "endSec": 80.81, "groundTruth": "fake"    }
  ]
}
```

The time windows are the 19 real scene-change boundaries detected in the source video (ffprobe scene detection), so each trial maps exactly to one face clip. **Do not invent different intervals.** If `presift-bank.json` is large, keep the existing formatting/style of the file. Also add a `"smileTask"` mention to the file's notes if a notes field exists — cosmetic only.

## 2. New scoring module — `functions/src/smile.ts` (NEW FILE)

Pure, testable functions (no firebase imports — match the style of `psychometrics.ts`):

```ts
export type SmileJudgment = 'genuine' | 'fake';

export interface SmileTrialConfig { id: string; startSec: number; endSec: number; groundTruth: SmileJudgment; }
export interface SmileAnswer { trialId: string; judgment: SmileJudgment | null; }

export interface SmileScoringResult {
  correctCount: number;
  total: number;
  accuracyPct: number;          // round(correct/total * 100)
  perTrial: Array<{ trialId: string; judgment: SmileJudgment | null; correct: boolean | null }>;
}
```

- `validateSmileAnswers(payload: any, trials: SmileTrialConfig[])` — strict validation mirroring `validateSubmission` style in `submission.ts`:
  - exactly 20 answers, one per trial id; no duplicates; no unknown ids.
  - reject any answer object containing forbidden keys (`groundTruth`, `correct`, `correctAnswerKey`) — same forbidden-key guard pattern as ICAR/WLEIS.
  - `judgment` must be `null` or one of `'genuine' | 'fake'`.
  - throw `SmileError` (define a class like `SubmissionError`) with explicit messages.
- `scoreSmile(answers: SmileAnswer[], trials: SmileTrialConfig[]): SmileScoringResult` — counts correct, computes `accuracyPct`, builds per-trial correctness (`null` judgment → `correct: null`, counts as incorrect in total).
- `calibrateWLEIS(wleisOeaRaw: number | undefined, accuracyPct: number): { bias: number; calibratedOea: number; level: 'High' | 'Moderate' | 'Low' | 'N/A' }` — the calibration heuristic (v1, documented in code comments as tunable):
  - `OEA` raw range is 4–28 (4 items × 7 Likert max, min 1×4). If `wleisOeaRaw` is missing/undefined → return `{ bias: 0, calibratedOea: 0, level: 'N/A' }` (calibration not possible).
  - `oeaNorm = wleisOeaRaw / 28` (0..1); `accuracyNorm = accuracyPct / 100` (0..1).
  - `bias = oeaNorm - accuracyNorm` — positive means the candidate overestimates their ability to read others' emotions relative to objective performance; negative means underestimation. Round to 2 decimals.
  - `calibratedOea = Math.round(28 * (0.5 * oeaNorm + 0.5 * accuracyNorm))` — a 50/50 blend of self-report and objective performance, clamped to [4, 28].
  - `level`: `|bias| < 0.15` → `'High'` (self-report aligned with objective); `< 0.30` → `'Moderate'`; else `'Low'`.
  - Explicit doc comment: "v1 heuristic — coefficients to be tuned after pilot data (P. will review)."

## 3. Session resolution — `functions/src/session.ts`

- Extend `resolveSession`'s return (or add a sibling export `resolveSmileTask(bank)` — your choice, but keep the existing exports' behavior unchanged for ICAR/WLEIS) to also expose the **smile task without ground truth**:
  - `smileTask: { videoUrl: string; trials: Array<{ id: string; startSec: number; endSec: number }> }` — strip `groundTruth` before anything client-bound. The keys/ground truth must remain server-side only.
- Do NOT change the existing ICAR/WLEIS session-key logic or tests for it.

## 4. Submission — `functions/src/submission.ts`

- Extend `AssessmentSubmission` with `smileAnswers: SmileAnswer[]` (optional field).
- Extend `validateSubmission` to validate `payload.smileAnswers` when present (using `validateSmileAnswers` from `smile.ts`): if missing → default to empty array (backward compatible with existing tests); if present → strict validation.
- Extend `processSubmission` to accept the smile trials config and return the smile result inside `ScoringResult` (add optional `smile?: SmileScoringResult & { calibration: ... }`). Keep existing ICAR/WLEIS outputs byte-identical when smile data is absent (existing tests must not break).

## 5. Cloud Functions — `functions/src/index.ts`

- `startSession`: additionally return `smileTask` (videoUrl + trials sans groundTruth) alongside `items`/`wleisItems`/`sessionId`/`sessionToken`. Store the smile ground truth server-side: either inside the session doc (e.g. `smileKeys: Array<{ trialId, groundTruth }>`) or read from the bank at submission time — pick the simpler, consistent-with-existing pattern, and make sure it survives the existing session-doc flow.
- `submitAssessment`: accept optional `smileAnswers`; validate + score via `smile.ts`; when the candidate doc exists, merge `scoreResult.smile = { ...smileScoring, calibration: calibrateWLEIS(wleisRaw.OEA, smileScoring.accuracyPct) }` into the stored result. Existing ICAR/WLEIS behavior unchanged when `smileAnswers` is absent.

## 6. Frontend — `src/pages/TestPage.tsx` (THIRD TEST, THREE STAGES)

Integrate the smile test as a **third section after ICAR and WLEIS** in the existing candidate flow. Preserve all existing ICAR/WLEIS behavior, timers, anti-cheat listeners, and localStorage resume.

- **Stage A — Instructions (before the smile section starts):** a full-screen/card instructions view explaining: "You will watch 20 short video clips of people smiling. For each clip decide: is the smile GENUINE (real, reaches the eyes — a Duchenne smile) or FAKE (polite/social, mouth only)? Trust your first impression." Include a Start button ("Start Smile Test"), plus the same GDPR/consent-style framing already used (no new legal text needed — reuse tone).
- **Stage B — 20 video trials:** one trial at a time:
  - Render a `<video>` element with `src="/assets/video/smile-4-presift.mp4"`, `preload="auto"`, `muted`, `playsInline`, controls disabled (or minimal), sized responsively (max ~420px wide, the source is 314×286).
  - On trial start: `video.currentTime = startSec`, `video.play()`; use `timeupdate` to pause when `currentTime >= endSec` (clamp at endSec; handle seeking edge cases robustly — if the browser fires `timeupdate` past the end, pause immediately).
  - Buttons: **"Genuine"** and **"Fake"** (large, distinct — e.g. green/red outline) + a **"Replay clip"** button (re-seeks to startSec and plays) + progress indicator "Clip X of 20".
  - On judgment → record `{ trialId, judgment }` → advance to next trial (stop current playback). If the user skips (no judgment), allow "Skip" that records `judgment: null` — the video pauses and next trial loads.
  - After trial 20 → proceed to Stage C.
  - Reuse existing styling patterns (dark slate test UI like the current active-test screen).
- **Stage C — Calibration summary (after the whole test is submitted):** after `submitAssessment` succeeds (extend the existing submit call to include `smileAnswers`), show a results screen (can be a new route state or a final card — keep it inside TestPage, no new route needed unless cleaner):
  - "Smile Perception Accuracy: **X%** (N/20 correct)".
  - WLEIS calibration block: "Your self-reported ability to read others' emotions (OEA): **Y/28** → Calibrated: **Z/28**" + bias indicator: "You tend to overestimate/underestimate your emotion-reading ability by **B** points" (use the calibration `level`: High alignment / Moderate / Low).
  - If calibration is N/A (no WLEIS result), show accuracy only with a note.
  - A "Finish" button → navigate home (`/`), mirroring the existing completion flow.
- Keep localStorage resume for the smile section consistent with the existing pattern (e.g. `assessment_${id}_smile` storing answers; restore in-progress smile state on reload; if the ICAR/WLEIS flow is already submitted, smile resumes standalone — do not over-engineer, but do not lose answers on reload mid-test).

## 7. Tests

- `functions/src/__tests__/smile.test.ts` (NEW): AAA style with comment zones, matching existing test style:
  - `validateSmileAnswers`: valid 20-answer payload passes; wrong count fails; duplicate trial fails; unknown trial fails; forbidden keys (`groundTruth`/`correct`) rejected; bad judgment value fails; null judgment allowed.
  - `scoreSmile`: all-correct → 100%; all-wrong → 0%; null judgments counted incorrect; per-trial correctness mapping.
  - `calibrateWLEIS`: missing OEA → N/A; overestimation case (high OEA, low accuracy) → positive bias + lower calibrated score + appropriate level; underestimation case; boundary levels.
- Extend `functions/src/__tests__/submitAssessment.test.ts` (or submission-integration): a happy-path test where a candidate submits ICAR + WLEIS + smileAnswers and the stored result includes `scoreResult.smile` with calibration; and a test where smileAnswers is absent → no smile block (backward compat).
- `src/__tests__/TestPage.test.tsx`: extend minimally — assert the Stage A instructions render for the smile section (or the section appears in the flow) if the harness allows; do NOT add heavy video mocking. If the existing harness can't render video easily, state that explicitly in the report instead of forcing it.
- `e2e/`: allowed to sync specs ONLY where this change breaks existing selectors; list any sync explicitly. No new e2e flows.

## Explicitly out of scope

- Recruiter/Admin dashboard UI (showing smile results there is a future task — do NOT touch DashboardPage/AdminPage).
- `firestore.rules`, auth, pricing, scoring changes to ICAR/WLEIS formulas, anything not listed above.
- Do NOT change the trial time windows, the trials array structure, or the groundTruth values — they are authoritative (source video boundaries + P.'s official answer key).

## Constraints

- Explicit error handling only — no naked try/catch. Meaningful error classes (`SmileError` / `HttpsError`).
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output (oxlint + tsc + vitest; ALL existing tests must still pass)
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate)
- [ ] `npm --prefix functions run build` (or the project's functions build script) — paste VERBATIM output
- [ ] `npm test` in `functions/` — paste VERBATIM output (new smile tests must pass)
- [ ] `ls -la public/assets/video/` — confirm asset present
- [ ] Every changed file: path + the diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
