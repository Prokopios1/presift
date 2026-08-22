# Antigravity Task: Owner Clients — Frontend (AdminPage client detail + link/unlink + export)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch ONLY the files listed below — anything else is out of scope unless explicitly approved.

## Context

Backend half (`ANTIGRAVITY_OWNER_CLIENTS_BACKEND_TASK.md`) adds `candidates.clientIds: string[]` (many-to-many candidate↔client) plus callables `updateCandidateClients({candidateId, clientIds})`, `updateClient({clientId, companyName?, email?, vatId?})`, `archiveClient({clientId, archived})`, and a backfill script. This task is the AdminPage UI that consumes them.

Current `src/pages/AdminPage.tsx` (454 lines) already has: clients table from `users/` (`recruiters` state), **Add Client** dialog (free credits + `creditAuditLog`), per-row **Adjust** credits dialog, deep-dive drawer that loads `recruiterCandidates` via `where('recruiterId','==', r.id)` (`handleDeepDive`), and full candidate management inside the drawer (select-all/some, bulk delete, edit, copy link, status). All that stays — this task extends it, it does not rebuild it.

**Auth note:** Firebase Auth has NOT landed (localStorage mock sessions; reads open). Do NOT add auth gates; keep the current demo-mode behavior.

## Changes — all in `src/pages/AdminPage.tsx` unless noted

### 1. Client detail: Edit + Archive/Unarchive

- **Edit button** in the deep-dive drawer header (next to the existing Adjust). Opens a Dialog prefilled from `selectedRecruiter`: Company Name, Email, VAT / Tax ID. Submit disabled until Company Name + Email valid. On save: call the `updateClient` callable (new export from `src/lib/firebase.ts`-style callable imports — check how existing callables like `bulkDeleteCandidates` are imported in this file and mirror it), show saving state, update the `recruiters` row in local state, close. Errors: `alert` + `console.error` (match existing `handleCreditAdjust` style). Explicit handling — no naked try/catch.
- **Archive / Unarchive toggle** in the drawer header. Calls `archiveClient`; updates local row with `archived` flag + `archivedAt`. Archived clients render with an "Archived" badge in the table and their rows visually dimmed (opacity or muted color — keep simple).
- **"Show archived" toggle** in the page header (default: hidden). When off, archived clients are filtered from the table but still count toward any totals shown.

### 2. Candidate loading per client → `clientIds`

- Change `handleDeepDive` (and any other place loading candidates for a selected client) from `where('recruiterId','==', r.id)` to `where('clientIds','array-contains', r.id)`. This makes shared candidates appear under every client they belong to. Single array-contains — no composite index needed. Do not change any other query.
- Candidate count per client in the table: add a small count (loaded per row on list fetch — e.g. `Promise.all` of `array-contains` count queries for non-archived clients; keep it bounded and failing soft: on error show `–`). Optional column, keep the table readable.

### 3. Manage candidates (link/unlink) dialog

- **"Manage candidates"** button in the deep-dive drawer header. Opens a Dialog that:
  - Loads ALL candidates (`getDocs(collection(db,'candidates'))` — reads are open).
  - Renders a searchable (simple client-side filter by name/email) checkbox list; a candidate is checked iff its `clientIds` includes the selected client id.
  - On save: for every candidate whose membership CHANGED, call `updateCandidateClients({candidateId, clientIds: newMembership})` (sequential or batched with a small concurrency limit — no tight Promise.all over 100+ calls). Show progress (e.g. "3 of 12 updated") and disable the button while running.
  - On completion: refresh `recruiterCandidates` via the same `array-contains` query, close. Errors: `alert` + `console.error`.
- Handle candidates with missing `clientIds` (pre-backfill) gracefully: treat as `[]`.

### 4. Export CSV

- **"Export CSV"** button in the deep-dive drawer header. Client-side only: build CSV from current `recruiterCandidates` (columns: name, email, appliedRole, status, created, cognitive percentile, EI percentile, fit badge, integrity flag — use the fields actually present on `CandidateRecord`; omit absent ones), `Blob` + anchor download named `clients-<companyName-slug>-candidates.csv`. No server call.

### 5. Tests — `src/__tests__/AdminPage.test.tsx` (extend existing; keep all suites green)

- Edit client: opens prefilled dialog; invalid submit stays disabled; valid submit calls the `updateClient` callable and refreshes the row.
- Archive toggle: calls `archiveClient`; archived client hidden when "Show archived" off, visible with badge when on.
- Manage candidates: save calls `updateCandidateClients` for changed candidates only (unchanged ones untouched); missing `clientIds` treated as empty.
- Export: clicking Export CSV produces a blob download (assert `createObjectURL`/anchor invocation via mock if practical; otherwise assert the CSV builder helper if one emerges — do not over-engineer).
- Keep AAA comment wrappers and the existing `vi.mock('firebase/firestore')` + callable-mock pattern.

### 6. e2e sync (allowed ONLY where selectors/behavior changed)

- If existing `e2e/` specs assert things this task changes (e.g., deep-dive candidate query, drawer header buttons), sync them minimally and LIST each change explicitly in the report. No new spec unless trivial.

## Constraints

- Explicit error handling only — no naked try/catch.
- Never edit a file you were not asked to edit (e2e sync exceptions listed explicitly).
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots/artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` — paste VERBATIM output (new/extended AdminPage tests pass, all others green)
- [ ] Every changed file: path + diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps
- [ ] Do NOT take screenshots yourself — Hermes captures visual evidence (Playwright) after deploy

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.

## Handoff (Hermes, after A1 verification)

1. Requires the backend task deployed first (callables + backfill run).
2. `firebase deploy --only hosting --project presift`.
3. Live smoke: sign in (mock owner session via DevToolbar), open a client → edit companyName/VAT persists; archive → badge + hidden by default; toggle shows archived; deep-dive lists candidates incl. shared ones (link a demo candidate to a 2nd client first via the backend smoke); Manage candidates unlink/relink round-trip; Export CSV downloads a valid file.
4. Report everything to `/tmp/presift_owner_clients_frontend.md`.

**Out of scope:** backend/functions (previous task), `firestore.rules`, `DashboardPage.tsx`, `PaymentPage.tsx`, `LandingPage.tsx`, `AppSidebar.tsx`, auth, seeder.
