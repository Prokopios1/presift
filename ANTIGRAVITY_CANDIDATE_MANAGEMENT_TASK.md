# Antigravity Task: PreSift — Total candidate management (recruiter + admin views)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** P. wants full candidate-management capabilities in the Recruiter Dashboard (`src/pages/DashboardPage.tsx`) AND in the Administrator's per-account candidate view (`src/pages/AdminPage.tsx`). Required actions: **select all / select some, delete (single + bulk), edit (name/email/appliedRole), copy (candidate assessment link to clipboard)**. Today's earlier work already added server-side `deleteCandidate` and `updateCandidateStatus` callables and a per-row Clear (delete) action; this task extends that into complete management. Note: Firestore rules are now locked (candidates create/update/delete = false for clients) — ALL mutations must go through callables.

**Changes:**

1. `functions/src/index.ts` — add callables (explicit validation, no naked try/catch; follow existing patterns in the file):
   - `updateCandidate({candidateId, name?, email?, appliedRole?})` — reads the existing doc, applies only provided fields, trims strings, rejects empty strings for provided fields, throws `HttpsError("invalid-argument")` on invalid input and `not-found` when the doc is missing. Preserves all other fields (scoreResult, fitBadge, status, etc.).
   - `bulkDeleteCandidates({candidateIds})` — validates the array (1..100, non-empty strings, no dupes), deletes each via a batched admin write, returns `{deleted: n, missing: [...]}` for ids that did not exist (do not fail the whole batch for missing ids). Does NOT touch other collections.
2. `src/pages/DashboardPage.tsx` — candidate management UI on the existing candidates table:
   - Header checkbox + per-row checkboxes (selection state as a `Set<string>`); header checkbox = select all currently-filtered rows (with indeterminate state via ref when partial); a bulk action bar appears when ≥1 row is selected, showing count + **Delete selected** (confirm dialog, calls `bulkDeleteCandidates`, removes rows from local state).
   - Per-row actions (icons or small buttons): **Copy** (copies `${location.origin}/assessment/<candidateId>` to clipboard via `navigator.clipboard`, brief "Copied" feedback), **Edit** (opens a dialog with Name / Email / Applied Role inputs prefilled → `updateCandidate`, updates local row), and keep the existing single **Clear** (delete) + status actions (Shortlist/Interview/Reject) in the drawer.
   - Preserve existing layout, search filter, chart, drawer, and the `pl-0 md:pl-60` main wrapper.
3. `src/pages/AdminPage.tsx` — mirror the same selection/actions in the deep-dive candidate table (`recruiterCandidates` view under a selected account): select all/some, bulk delete (via `bulkDeleteCandidates`), edit (via `updateCandidate`), copy link. Same UI patterns/components as the dashboard.
4. Tests:
   - `functions/src/__tests__/` — new tests for `updateCandidate` (valid update, empty-string rejection, missing doc) and `bulkDeleteCandidates` (mixed existing/missing, empty array rejection, dupe rejection). Follow the AAA + comment-zone style used in the existing tests in that folder.
   - `src/__tests__/` — add/adjust tests for the selection logic if a testable pure helper emerges (e.g., toggle-all semantics); do not over-engineer.
   - `e2e/` — allowed to sync specs ONLY where the new UI changes selectors/behavior that existing specs assert (e.g., new row buttons); do not add a whole new spec unless trivial.

**Explicitly out of scope:** `firestore.rules`, `seeder.ts`, `AppSidebar.tsx`, `PaymentPage.tsx`, auth, landing page, anything not listed above.

**Constraints:**
- Explicit error handling only — no naked try/catch. `HttpsError` codes must be meaningful.
- Never edit a file you were not asked to edit (e2e sync exceptions must be listed explicitly in the report).
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` in `functions/` — paste VERBATIM output (new callable tests must pass)
- [ ] Every changed file: path + the diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] Live smoke of the new actions: state which you verified manually and how (or state that Hermes will verify visually after deploy)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
