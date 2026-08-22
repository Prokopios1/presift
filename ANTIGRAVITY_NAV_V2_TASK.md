# Antigravity Task: PreSift Navigation v2 — Hamburger on Every Page + Recruiter Layout Rework

Act as Principal Frontend Engineer. This is a UI/navigation iteration on the PreSift app (product owner's handwritten spec, transcribed by controller A1). The app is live at https://presift.web.app; this task is frontend-only (`src/**`), no backend changes, no e2e changes.

## Product owner's spec (verbatim intent)

1. **Hamburger menu on EVERY page** — always visible, vertical, on the LEFT side. Specifically the owner dashboard and the payment page currently do NOT have one and MUST get one (the recruiter dashboard already has one — see below).
2. **Recruiter dashboard layout rework:**
   - A horizontal toolbar at the top: **search field (🔍/Q)** + **"Create New Link" button** side by side.
   - **Underneath: the candidates list** (recent candidates table).
   - (The current "Assessment Links" card with inline form + the "Recent Candidates" card side-by-side grid is replaced by this layout — see current code below.)

## Current state (verified, Aug 11)

### Recruiter dashboard — `src/pages/DashboardPage.tsx`
- ALREADY has a hamburger: `Button variant="ghost" size="icon"` with lucide `Menu` icon (line ~99) opening a `Drawer` (`menuOpen` state) with 4 nav rows: Recruiter Dashboard → `/dashboard`, Owner / Admin → `/admin`, Pricing / Buy Credits → `/pricing`, Home / Landing → `/` (each `window.location.href`, close drawer on click). **Keep this exact menu pattern; reuse it everywhere.**
- Layout today: header (hamburger + title + balance card with Top Up + ThemeToggle), then a `grid md:grid-cols-3`:
  - Col 1 `md:col-span-1`: "Assessment Links" card — inputs Candidate Name (`candidateNameInput`), Candidate Email (`candidateEmailInput`), Role Title (`roleTitleInput`), button "Generate Assessment Link" (disabled when `balance <= 0`; calls `createAssessmentLink` callable; copies `data.url` to clipboard; decrements balance; alerts "Link created and copied to clipboard!").
  - Col 2 `md:col-span-2`: "Recent Candidates" card — `Table` with columns Name | Role | Status | Date | Fit Score | Integrity | Actions.

### Owner dashboard — `src/pages/AdminPage.tsx`
- NO hamburger. Header: "Owner Dashboard" + Admin badge, buttons "← Recruiter View" (→ `/dashboard`) and "Add Client". Add the same hamburger as the recruiter page (same Drawer, same 4 destinations).

### Payment page — `src/pages/PaymentPage.tsx`
- NO hamburger. Has a sticky top `nav` with PreSift logo + ghost buttons Dashboard/Admin + "Back to Home" link. Add the same hamburger to this nav (left side, before the logo or in the nav bar — pick the cleanest slot; the nav has `flex justify-between`).

## Required changes

### A. Shared hamburger menu (all 3 pages)
- On **AdminPage** and **PaymentPage**, add the exact same hamburger + Drawer pattern used in DashboardPage (lucide `Menu` icon button; `Drawer open={menuOpen}`; 4 destinations: Recruiter Dashboard `/dashboard`, Owner / Admin `/admin`, Pricing / Buy Credits `/pricing`, Home / Landing `/`; close drawer on click; `DrawerClose` "Close Menu" footer). Same styling (ghost icon button, w-6 h-6 icon).
- The hamburger button must be **always visible** on all three pages (no `isPublicRoute`-style hiding, no dev-only guards — this is production UI).
- If it makes the code cleaner, extract a shared component (e.g. `src/components/AppNavMenu.tsx`) used by all three pages — recommended, but keep the visual/behavior identical to the current DashboardPage drawer.

### B. Recruiter dashboard layout rework (`src/pages/DashboardPage.tsx`)
Replace the current 2-card grid with:

1. **Horizontal toolbar row** (below the header, above the list):
   - **Search input** (placeholder e.g. "Search candidates…", lucide `Search` icon inside or left of it) — filters the candidates list client-side by name/role/status (case-insensitive substring). No backend change.
   - **"Create New Link" button** (primary style) — opens a dialog with the SAME fields/flow as the current "Assessment Links" card: Candidate Name, Candidate Email (optional), Role Title, submit button that calls `createAssessmentLink` (disabled when `balance <= 0`; on success copy `data.url` to clipboard, decrement balance, alert "Link created and copied to clipboard!"). Use the existing Dialog components (`@/components/ui/dialog` — check it exists; if not, use the same drawer pattern as the candidate drawer). Keep `candidateNameInput`/`candidateEmailInput`/`roleTitleInput` ids if tests reference them (check `src/__tests__/DashboardPage.test.tsx` and keep its tests passing — update tests only if the rework requires it, and keep AAA wrappers).
   - Layout: `flex flex-col sm:flex-row gap-3` — search grows (`flex-1`), button fixed width.
2. **Candidates list underneath**: the existing "Recent Candidates" card/table, full width (no md:col-span grid wrapper). The table itself stays as-is.
3. Remove the old "Assessment Links" card (its functionality moves into the dialog). The "Recent Candidates" card becomes the full-width section below the toolbar.

### C. Constraints
- Do NOT touch: `functions/**`, `firestore.rules`, `firebase.json`, `e2e/**`, `playwright.config.ts`, `src/lib/firebase.ts`.
- Do NOT change routing in `src/App.tsx` (no new routes needed).
- Do NOT change the balance card / Top Up Credits / ThemeToggle in the dashboard header.
- Explicit error handling; no naked try/catch (mirror existing `catch (e) { console.error(e); alert(...) }` style).
- Keep all existing unit tests green (`npm run verify`). If the layout rework breaks a test that asserts the old grid, update that test to the new layout (AAA comments, same describe/test names where sensible).

## Proof (mandatory, verbatim)

- `npm run verify` → full output, must be green (currently 76/76).
- `npm run build` → exit 0.
- Quick manual/Playwright smoke (dev server or `PLAYWRIGHT_BASE_URL` if you run against live — but DO NOT deploy): hamburger visible on all 3 pages, opens vertical drawer with 4 destinations; recruiter toolbar renders search + Create New Link; search filters the table. Paste the smoke output or a short structured description of what you verified.
- `git diff --stat` + list of changed files.

## Stop condition
All three pages have the working hamburger; recruiter page has toolbar + full-width candidates list; `npm run verify` green; `npm run build` green; diff limited to `src/**` (+ tests if needed). Do NOT deploy — deployment is handled separately.
