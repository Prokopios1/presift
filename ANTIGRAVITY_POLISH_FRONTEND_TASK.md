# Antigravity Task: Polish — Frontend (admin pages refactor + candidate archive UI + tooltips everywhere)

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Touch ONLY the files listed below — anything else is out of scope unless explicitly approved.

## Context

P. wants the admin experience rebuilt from popups to PAGES, plus candidate archiving in the recruiter dashboard, plus a tooltip ("balloon") on every button app-wide. Firebase Auth is deliberately OUT of scope — keep current mock-session behavior.

Design principle (P.'s rule): **no popups/overlays for content in the admin lists — content lives on dedicated pages. Form dialogs (Add Client, Edit, Adjust credits, Manage candidates) are fine.** The existing deep-dive drawer in AdminPage is replaced by a client detail page.

Backend (already specced separately, deploy order: backend first): `archiveCandidate({candidateId, archived})` callable + `startSession` gate that rejects archived candidates. This task consumes `archiveCandidate` from the frontend; the startSession gate is server-side (no frontend call needed for the block).

## Changes

### 1. `package.json` — add tooltip dependency
- Run `npm install @radix-ui/react-tooltip` (this is the shadcn tooltip primitive; the repo uses the same family for dialog/switch/checkbox).

### 2. NEW `src/components/ui/tooltip.tsx`
- shadcn-ui standard tooltip component (Tooltip, TooltipTrigger, TooltipContent, TooltipProvider) — copy the canonical shadcn implementation, styled to match the existing ui components (dark-mode aware).

### 3. Tooltips everywhere (the "balloons")
- Wrap the app in `<TooltipProvider>` once (in `src/App.tsx` around the Router, or `src/main.tsx` — pick what fits).
- Systematic pass over EVERY button/icon-button on: `LandingPage`, `PaymentPage`, `TestPage` (navigation/submit/back buttons), `DashboardPage` (all toolbar, table row actions, drawer actions, dialogs), `AdminPage`, the new `AdminClientPage`, and `AppSidebar` links/buttons.
- Rule: every ICON-ONLY button MUST have a tooltip; text-labeled buttons get one too where the action isn't 100% self-evident (e.g. "Copy", "Clear", "Archive"). Short, human text ("Copy assessment link", "Archive this client — hides it from the list", "Export candidates as CSV").
- Use the shadcn Tooltip pattern (trigger wraps the button; content with `side`/`sideOffset` defaults). Do NOT introduce a custom tooltip library. Do NOT tooltip the DevToolbar (dev-only, compiled out of prod) or chart internals.

### 4. NEW `src/pages/AdminClientPage.tsx` — the client detail page (route `/admin/clients/:clientId`)
- Loads `users/<clientId>` + its `creditAuditLog` + candidates via `where('clientIds','array-contains',clientId)`. Loading/error states.
- **Header:** back link ("← Clients" → `/admin`), company name, email, VAT, credits, "Archived" badge when archived.
- **Client info card:** companyName / email / vatId + **Edit** dialog (prefilled; submit disabled until company+email valid; calls `updateClient`; omit vatId from payload when blank — it is optional; preserve prior vatId in local state).
- **Archive/Unarchive button** (calls `archiveCandidate`'s sibling `archiveClient` — actually calls `archiveClient({clientId, archived})`): flips flag, updates local state, shows badge.
- **Credits card:** balance, totalSpent, **Adjust** button (reuse the existing adjust dialog logic from AdminPage: amount + required reason → credits + `creditAuditLog` entry), and the audit log table (amount, reason, adjustedBy, timestamp).
- **Candidates section:** search filter, "Show archived" toggle (default hidden), select-all/select-some + bulk delete, per-row actions: Copy link, Edit (name/email/appliedRole via `updateCandidate`), **Archive/Unarchive** (via `archiveCandidate`), status actions (Shortlist/Interview/Reject via `updateCandidateStatus`), Clear (hard delete via `deleteCandidate`), and the **Manage candidates** dialog (link/unlink other clients via `updateCandidateClients` — reuse the AdminPage logic you are moving), plus **Export CSV** (`buildCandidatesCsv` — reuse the exported helper; keep it exported from AdminPage or move it to a shared module and update the import).
- Archived candidate rows: dimmed + badge; Copy button disabled for archived candidates (they cannot start new sessions).

### 5. `src/pages/AdminPage.tsx` — slim down to the list
- KEEP: clients table (name, email, credits, spent, candidate count column, archived badge/dim), **Add Client** modal, "Show archived" switch, totals.
- REMOVE (moved to AdminClientPage): deep-dive drawer, per-row Adjust/Edit/Archive dialogs, all candidate-management state/handlers (selection, bulk delete, edit candidate, copy, status), `recruiterCandidates` loading, CSV export.
- Row click (or an explicit "Open" affordance) → `useNavigate()` to `/admin/clients/<id>`.
- Keep `buildCandidatesCsv` exported here OR relocate to a shared module — pick one, keep imports consistent.

### 6. `src/App.tsx` — add route
- `<Route path="/admin/clients/:clientId" element={<AdminClientPage />} />` next to `/admin`.

### 7. `src/pages/DashboardPage.tsx` — recruiter candidate archive
- Add **Archive/Unarchive** per-row action (icon + tooltip) alongside existing Copy/Edit/Clear/status actions; calls `archiveCandidate`.
- Add "Show archived" toggle above the candidates table (default hidden); archived rows dimmed + badge; **Copy disabled for archived candidates**.
- Keep all existing management UI working (selection, bulk delete, edit, copy, status, drawer).

### 8. Tests (all suites stay green; AAA comment zones; existing mock patterns)
- `src/__tests__/AdminPage.test.tsx` — update to the slim list: renders table + Add Client; no drawer/candidate-management assertions remain; row click navigates (MemoryRouter + assert navigate call or rendered route).
- NEW `src/__tests__/AdminClientPage.test.tsx` — loads client + candidates + audit log; edit client dialog (prefill, invalid disabled, valid calls updateClient, vatId omitted when blank); archive toggle calls archiveClient; adjust credits writes audit entry; candidate archive calls archiveCandidate; show-archived toggle filters; export CSV works; copy disabled for archived.
- `src/__tests__/DashboardPage.test.tsx` (or wherever dashboard tests live) — archive action calls archiveCandidate; show-archived toggle; copy disabled when archived.
- Add a handful of tooltip presence assertions (e.g. an icon-only button in the dashboard row renders tooltip content on hover, AdminPage Add Client button has a tooltip) — do not over-engineer.
- e2e: sync existing specs ONLY where selectors/behavior they assert changed; list every change explicitly. No new spec unless trivial.

## Constraints

- Explicit error handling only — no naked try/catch (alert + console.error pattern is the house style, as in existing handlers).
- Never edit a file you were not asked to edit. No changes to functions/, firestore.rules, seeder, auth, PaymentPage/LandingPage content (tooltips only).
- Never claim a command ran unless you actually ran it and have the output.
- Do NOT commit and do NOT deploy — Hermes handles commit + deploy after A1 verification.
- Do NOT take screenshots yourself — Hermes captures visual evidence.

## Evidence Checklist (mandatory — every item answered)

- [ ] `npm run verify` — paste VERBATIM output
- [ ] `npm run build` — paste VERBATIM output (build success is the real gate)
- [ ] `npm test` — paste VERBATIM output (new/updated tests pass, all others green)
- [ ] Every changed file: path + diff/lines changed, confirmed on disk (`ls -la` / `stat`)
- [ ] List of every button that received a tooltip (page-by-page) — complete, not sample
- [ ] State exactly which files you modified, with timestamps

**Report format:** per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
