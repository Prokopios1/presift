# Antigravity Task: Polish — Backend (archiveCandidate callable + assessment gate)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch ONLY the files listed below — anything else is out of scope unless explicitly approved.

## Context

P.'s archiving model: recruiters archive their candidates (soft, reversible); admin archives clients (already shipped). An archived candidate is hidden from lists AND blocked from receiving new assessment sessions. Hard delete stays (deleteCandidate / bulkDeleteCandidates unchanged). Firebase Auth is deliberately OUT of scope this round — keep the existing `allowAnonDemo()` guard style.

**Important mechanism note:** `createAssessmentLink` does NOT target existing candidates — it always creates a brand-new candidate doc. The real gate for an existing candidate taking an assessment is `startSession(assessmentId)`, which reads the candidate doc to capture identity. That is where the archived-block belongs. `createAssessmentLink` needs NO change.

## Changes

### 1. `functions/src/index.ts`

- **NEW callable `archiveCandidate({candidateId, archived})`** — follow the exact pattern of the existing `archiveClient`:
  - Guard: `if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");`
  - Validate `candidateId` non-empty string; `archived` strictly boolean → else `invalid-argument`.
  - Read `candidates/<candidateId>` → `not-found` if missing.
  - Update `{ archived, archivedAt: archived ? FieldValue.serverTimestamp() : FieldValue.delete() }`.
  - Do NOT touch `status`, `recruiterId`, `clientIds`, scores, sessions, or results. Return `{ candidateId, archived }`.
- **Gate in `startSession`** — inside the existing candidate-identity read block: after `candDoc.exists` is confirmed, if `c.archived === true` throw `new functions.https.HttpsError("failed-precondition", "This candidate is archived and cannot start a new assessment session.")`. Keep the surrounding best-effort semantics for read failures (if the read itself throws, the session still starts — that behavior is unchanged).

### 2. Tests — NEW `functions/src/__tests__/archive-candidates.test.ts` (AAA layout, comment zones, existing style)

- `archiveCandidate`: happy path archive (sets `archived: true` + `archivedAt`), unarchive (clears both), non-boolean `archived` → `invalid-argument`, missing candidate → `not-found`, unauthenticated in non-demo mode.
- `startSession` gate: archived candidate → `failed-precondition` (and NO session doc created); non-archived candidate → session starts normally (existing behavior, assert session doc created / no throw).
- All existing tests must stay green (`npm test` in functions/).

## Constraints

- Explicit error handling only — no naked try/catch; meaningful `HttpsError` codes.
- Never edit a file you were not asked to edit. No changes to `createAssessmentLink`, `deleteCandidate`, `bulkDeleteCandidates`, `updateCandidate`, `updateCandidateStatus`, seeder, rules, or frontend.
- Never claim a command ran unless you actually ran it and have the output.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item answered)

- [ ] `npm run build` in `functions/` — paste VERBATIM output
- [ ] `npm test` in `functions/` — paste VERBATIM output (new tests pass, all existing green)
- [ ] `npm run verify` at repo root — paste VERBATIM output
- [ ] Every changed file: path + diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
