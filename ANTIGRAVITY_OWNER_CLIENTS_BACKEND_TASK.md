# Antigravity Task: Owner Clients — Backend & Data Model (many-to-many candidate↔client)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch ONLY the files listed below — anything else is out of scope unless explicitly approved.

## Context

P. (owner) manages clients (companies, stored as `users/` docs with `companyName`, `email`, `vatId`, `credits`, `creditAuditLog`) and each client's candidates. "Add Client" (free credits) already ships in `AdminPage.tsx`; candidate management (select/delete/edit/copy/status) already ships for recruiter + admin views.

**What's missing (this task = backend half):** candidates currently belong to exactly ONE client via `candidates.recruiterId: string`. The owner wants candidates **shared across multiple clients** (many-to-many). This task adds the canonical `clientIds: string[]` field, three owner callables (`updateCandidateClients`, `updateClient`, `archiveClient`), a backfill script, and seeder updates. The frontend task (`ANTIGRAVITY_OWNER_CLIENTS_FRONTEND_TASK.md`) consumes these.

**Auth note:** Firebase Auth has NOT landed yet (repo still uses localStorage mock sessions; `firestore.rules` reads are open, writes functions-only). Follow the EXISTING guard pattern in `index.ts` for these callables: `if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in")` — do NOT introduce new auth requirements. Rules stay untouched.

## Changes

### 1. `functions/src/index.ts` — three new callables (follow existing patterns: explicit validation, meaningful `HttpsError` codes, NO naked try/catch)

- **`updateCandidateClients({candidateId, clientIds})`** — owner sets a candidate's full client membership.
  - Validate: `candidateId` non-empty string; `clientIds` is an array of 1..50 non-empty strings, no duplicates (reject with `invalid-argument` otherwise).
  - Read the candidate doc → `not-found` if missing.
  - Verify EVERY clientId exists: batched/parallel reads of `users/<id>`; any missing → `invalid-argument` with the list of unknown ids in the message.
  - `update(candidateRef, { clientIds, updatedAt: FieldValue.serverTimestamp() })`. Do NOT touch `recruiterId` (back-compat: recruiter dashboard still filters on it; the creating client stays its owner).
  - Return `{ candidateId, clientIds }`.
- **`updateClient({clientId, companyName?, email?, vatId?})`** — owner edits a client account.
  - Validate: `clientId` non-empty string; at least one of the three fields provided; each provided string trimmed and non-empty; `email` must match a minimal pattern (`/^\S+@\S+\.\S+$/`) when provided. Reject with `invalid-argument`.
  - Read `users/<clientId>` → `not-found` if missing. Do NOT allow editing `credits`, `totalSpent`, `role`, `createdAt`, `archived`.
  - `update` with only the provided fields (+ `updatedAt`). Return the updated doc's public fields.
- **`archiveClient({clientId, archived})`** — soft-archive/unarchive a client.
  - Validate: `clientId` non-empty string; `archived` is boolean. Reject with `invalid-argument`.
  - Read `users/<clientId>` → `not-found` if missing.
  - `update` with `{ archived, archivedAt: archived ? FieldValue.serverTimestamp() : FieldValue.delete() }`. Candidates/assessments/audit logs are NOT touched. Return `{ clientId, archived }`.

### 2. `functions/src/seeder.ts` — seed the new field

- Every seeded candidate (the `demo_cand_*` loop) gets `clientIds: [recruiterId]` alongside the existing `recruiterId` spread.
- Keep everything else in the seeder unchanged.

### 3. NEW `scripts/backfill-client-ids.mjs` — one-time migration (Hermes executes, you only write it)

- Follow the existing `scripts/backfill-recruiter-id.mjs` style (firebase-admin, explicit `projectId: 'presift'`, Application Default Credentials, batch writes, console progress logs).
- For every candidate doc where `clientIds` is missing OR not an array: set `clientIds = (recruiterId && typeof recruiterId === 'string') ? [recruiterId] : []`.
- Print per-doc lines + a final `Migrated: n / Skipped: m` summary. Idempotent (safe to re-run).

### 4. Tests — `functions/src/__tests__/` (AAA layout, comment zones, existing style)

- `updateCandidateClients`: happy path (valid candidate + 2 existing clients), missing candidate → `not-found`, unknown clientId → `invalid-argument`, empty array / >50 / dupes / non-string → `invalid-argument`, recruiterId untouched after update.
- `updateClient`: happy path (all three fields), empty companyName rejected, malformed email rejected, only `vatId` provided works, missing doc → `not-found`, credits/role not writable via this callable (attempt → `invalid-argument` or assert untouched).
- `archiveClient`: `archived: true` sets flag + `archivedAt`, `archived: false` clears flag, non-boolean rejected, missing doc → `not-found`.

## Constraints

- Explicit error handling only — no naked try/catch. `HttpsError` codes must be meaningful.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots/artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.
- Do NOT execute the backfill against prod — the script is WRITTEN here, EXECUTED by Hermes in the handoff step.

## Evidence Checklist (mandatory — every item answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` in `functions/` — paste VERBATIM output (new callable tests must pass, all existing still green)
- [ ] Every changed file: path + diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] Backfill script: show `node --check scripts/backfill-client-ids.mjs` passes (syntax gate; do NOT run against prod data)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.

## Handoff (Hermes, after A1 verification)

1. Run `node scripts/backfill-client-ids.mjs` against prod (ADC, project `presift`) → paste summary output.
2. `firebase deploy --only functions --project presift` (rules/hosting unchanged this round).
3. Live smoke: call `updateClient` (edit vatId), `archiveClient` (archive then unarchive), `updateCandidateClients` (add a second client to a demo candidate) via a scratch script or the app; confirm `clientIds` persisted and `recruiterId` untouched.
4. Report everything to `/tmp/presift_owner_clients_backend.md`.

**Out of scope:** `firestore.rules`, `src/` (frontend — next task), `DashboardPage.tsx`, `PaymentPage.tsx`, `LandingPage.tsx`, auth, e2e.
