# Antigravity Task: PreSift — Recruiter name identifier + candidate names on benchmark diagram

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch only the files listed below — anything else is out of scope unless explicitly approved.

**Context:** P. reviewed the Recruiter Dashboard (screenshot: `~/.openclaw/workspace/presift-dashboard-live.png` and live app) and wants two visibility fixes:

1. The **Recruiter Dashboard** must show a **recruiter name identifier** (which recruiter owns this board), not just the generic "Recruiter Dashboard" title.
2. The **Candidate Benchmarking** scatter diagram must show the **candidate's name on every dot** — currently dots are anonymous blue circles (name only appears in the hover tooltip). Every dot must display its candidate's name directly on the chart, in addition to the score data.

**Current state (verified, Aug 14):**

- `src/pages/DashboardPage.tsx`:
  - Header at ~line 234: `<h1>Recruiter Dashboard</h1>` + subtitle "Manage assessments and review candidates." — no recruiter identity shown.
  - `fetchData` (~line 95) already reads `users/demo_recruiter` (`getDoc(doc(db, 'users', RECRUITER_ID))`) and stores only `credits` into `balance` state. The user doc has NO `name` field today — fields: `email` (`demo_recruiter@presift.app`), `credits`, `companyName` (`Acme Corp (Demo)`), `vatId`, `totalSpent`, `totalPurchased`, `role`.
  - `chartData` (~line 114): `filteredCandidates.map(c => ({ name: c.name, icar: c.scoreResult?.icar?.percentile || 0, wleis: c.scoreResult?.wleis?.rawScores?.Total || 0 }))` — `name` already present in data.
  - Benchmark card (~line 370): Recharts `<ScatterChart>` with `<Scatter name="Candidates" data={chartData} fill="#3b82f6" />`, custom `<Tooltip>` that shows `data.name` + ICAR + WLEIS. No per-dot labels.
- `src/__tests__/DashboardPage.test.tsx` exists (asserts `Recruiter Dashboard` button role).

**Changes:**

1. `src/pages/DashboardPage.tsx` — recruiter identifier in the header:
   - Extend `fetchData`: also capture the recruiter user doc data (name, companyName, email) into new state `recruiterName` (or a small `recruiter` object). Do not break the existing balance logic.
   - Derive the display identifier with an explicit fallback chain: `userDoc.data().name` (trimmed, if non-empty) → `companyName` (trimmed, if non-empty) → email prefix (part before `@`). If none exist, render nothing.
   - Render a subtle line under the page title, e.g. `<p className="text-slate-500">Recruiter: {identifier}</p>` (reuse existing typography; keep it subtle like the existing subtitle). Loading state: show nothing or a placeholder — no "undefined" text ever.
2. `src/pages/DashboardPage.tsx` — candidate names on every benchmark dot:
   - Add a `LabelList` (or equivalent per-dot label) to the `<Scatter>` so **every dot shows its candidate's name** directly on the chart — e.g. `<LabelList dataKey="name" position="top" className="..." />` with small, readable styling that works in both light and dark mode (check the existing `dark:` class pattern used in the file).
   - Keep the existing Tooltip (name + ICAR + WLEIS) intact.
   - Handle overlap pragmatically: labels may be small; if two names collide exactly (identical scores), it is acceptable to offset slightly or keep as-is — do not over-engineer; the requirement is that every dot is name-identifiable on the chart.
3. `src/__tests__/DashboardPage.test.tsx` — update/extend:
   - Keep the existing passing assertions.
   - Add (if the test setup renders the benchmark card): an assertion that candidate names appear on the chart (e.g., query for at least one candidate name rendered inside the benchmark section). If the existing test harness does not render the chart (e.g., recharts needs mocked canvas), add a lightweight check on the rendered `chartData` mapping instead — do NOT add heavy mocking infrastructure.
4. `e2e/` — allowed to sync specs ONLY where this change breaks existing selectors; list any sync explicitly. Do not add new e2e flows.

**Explicitly out of scope:** `functions/**` (no backend changes), `firestore.rules`, AdminPage, ProfilePage/sidebar, auth, pricing, anything not listed above. The `users/demo_recruiter` doc gets NO schema change — the fallback chain handles the missing name field.

**Constraints:**
- Explicit error handling only — no naked try/catch. Existing code style in this file uses `try/catch` with `console.error` — keep that pattern, do not introduce silent failures.
- Never edit a file you were not asked to edit.
- Never claim a command ran unless you actually ran it and have the output.
- Never reuse old screenshots or artifacts as evidence for new work.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.

## Evidence Checklist (mandatory — every item must be answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate; root tsconfig is solution-style `"files": []`)
- [ ] `npm test` (web root, vitest) — paste VERBATIM output (DashboardPage tests must pass)
- [ ] Every changed file: path + the diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
