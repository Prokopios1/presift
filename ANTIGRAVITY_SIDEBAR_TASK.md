# Antigravity Task: PreSift — Replace Hamburger Drawer with Permanent Left Sidebar

Act as Principal Frontend Engineer. Product owner decision (verbatim, 2026-08-11): **"I want the menu panel always visible and always on the left."** The hamburger+drawer navigation built in the previous task (Nav v2, commit `4445be0`) does NOT match this — it opens a transient centered/bottom drawer. Replace it with a **permanent, fixed left sidebar** on every page. Frontend-only (`src/**`), no backend, no e2e changes, do not deploy.

## CodeGraph (mandatory)

- **Before coding:** refresh/read the CodeGraph index for this repo.
- **After EVERY file change:** update/sync CodeGraph so the index reflects each modified file (`src/components/AppNavMenu.tsx` or its replacement, `src/pages/DashboardPage.tsx`, `src/pages/AdminPage.tsx`, `src/pages/PaymentPage.tsx`, `src/pages/LandingPage.tsx`, any touched tests) — not just once at the end.
- Report the sync outcome per file (or one line listing all synced files) at the end.

## What exists now (verified by A1, Aug 11)

- `src/components/AppNavMenu.tsx` (new in 4445be0): a `Button` with lucide `Menu` icon + a `Drawer` (shadcn/Vaul, default bottom-sheet styling) listing 4 destinations: Recruiter Dashboard → `/dashboard`, Owner / Admin → `/admin`, Pricing / Buy Credits → `/pricing`, Home / Landing → `/`. Each row: `Button variant="ghost" className="w-full justify-start text-lg h-12"`, closes drawer, `window.location.href`.
- `<AppNavMenu />` is currently rendered in: `src/pages/DashboardPage.tsx` (header, before title), `src/pages/AdminPage.tsx` (header), `src/pages/PaymentPage.tsx` (sticky top nav), `src/pages/LandingPage.tsx` (nav).
- Pages are full-width containers: DashboardPage `p-8 max-w-7xl mx-auto min-h-screen`, AdminPage `p-6 md:p-8 max-w-7xl mx-auto`, PaymentPage has its own sticky top `nav` with logo + Dashboard/Admin buttons + "Back to Home" link, LandingPage has its own hero nav.

## Required changes

### A. Permanent left sidebar component (replace `AppNavMenu.tsx`)
Rewrite `src/components/AppNavMenu.tsx` (or rename to `AppSidebar.tsx` — pick the cleaner name and update imports) so it renders a **fixed, always-visible vertical sidebar on the LEFT edge of the viewport**:

- `fixed left-0 top-0 h-full` (or `h-dvh`) with a solid background (slate-50/white light mode, slate-900/950 dark mode — match the app's existing palette), a border-right, `z-40`.
- Width ~ `w-56`/`w-60` (responsive: on small screens it may shrink to icon-only or a narrower width — it must REMAIN VISIBLE, never hidden behind a hamburger).
- Contains: a small brand/logo header ("PreSift", matching existing gradient text style) at the top, then the SAME 4 nav destinations as vertical full-width rows (keep labels: Recruiter Dashboard, Owner / Admin, Pricing / Buy Credits, Home / Landing), each navigating via `window.location.href`. Highlight the current route (compare `window.location.pathname` — e.g. active row gets a colored background/border).
- No drawer, no overlay, no close button, no `Menu` icon needed (remove the hamburger entirely). The panel is permanently on screen.

### B. Apply the sidebar to ALL pages (layout shift)
Every page that currently renders `<AppNavMenu />` must instead render the sidebar AND offset its content so nothing sits underneath it:

- Wrap each page's root in a flex layout: `<div className="flex min-h-screen">` with the sidebar as the fixed-width left column and the existing page content in a `flex-1` column (content keeps its own `max-w-7xl mx-auto` padding; add `lg:pl-*` only if the fixed sidebar overlaps — prefer `flex` so content is naturally offset).
- Pages: `DashboardPage.tsx`, `AdminPage.tsx`, `PaymentPage.tsx`, `LandingPage.tsx`.
- PaymentPage: keep its sticky top nav (logo + buttons) but the nav should sit inside the content column (right of the sidebar); remove the old hamburger from it.
- LandingPage: keep the hero design; the sidebar replaces the hamburger; ensure the hero remains centered in the remaining viewport width.
- Keep everything else intact: balance card + Top Up Credits + ThemeToggle (DashboardPage header), Add Client + Recruiter View buttons (AdminPage header), pricing section (PaymentPage), hero + Get Started (LandingPage).

### C. Constraints
- Do NOT touch: `functions/**`, `firestore.rules`, `firebase.json`, `e2e/**`, `playwright.config.ts`, `src/lib/firebase.ts`, routing in `src/App.tsx`.
- Explicit error handling; no naked try/catch.
- Keep all unit tests green (`npm run verify`, currently 76/76). If a test asserts the hamburger/drawer (check `src/__tests__/DashboardPage.test.tsx` etc.), update it to assert the sidebar rows are visible instead (AAA wrappers, same describe/test names where sensible).
- No dark-mode regressions: sidebar must look correct in both themes.

## Proof (mandatory, verbatim)

- `npm run verify` full output → green.
- `npm run build` → exit 0.
- Smoke (local dev server, e.g. `npx vite --port 5199` + Playwright or manual): on ALL four pages the sidebar is visible on load (no click needed), positioned left, shows the 4 destinations, current route highlighted, content not overlapped. Paste a short structured description or test output.
- `git diff --stat` + changed files list.

## Stop condition

Sidebar permanently visible on the left on all four pages, hamburger/drawer code gone, `npm run verify` + `npm run build` green, diff limited to `src/**` (+ tests if needed). Do NOT deploy — handled separately.
