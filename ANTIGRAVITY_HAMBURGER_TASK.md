# Antigravity Task: Recruiter Interface — Hamburger Navigation Menu

## Context

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Recruiter interface = `src/pages/DashboardPage.tsx` (route `/dashboard`). It currently has NO navigation links — only the header (title, balance, Top Up Credits button, ThemeToggle). The app has these routes: `/` (landing), `/dashboard` (recruiter), `/admin` (owner), `/pricing` (payment page).

## Changes

Add a **hamburger navigation menu** to the recruiter interface:

1. **Trigger:** a hamburger icon button (lucide-react `Menu` icon — lucide-react is already a dependency) in the DashboardPage header, left of the title (or right of it — pick what fits cleanly), styled as a ghost/outline icon button, dark-mode aware.
2. **Menu:** a slide-over Drawer (reuse `@/components/ui/drawer`, already used by this page's candidate drawer) listing ALL navigation options:
   - Recruiter Dashboard (`/dashboard`)
   - Owner / Admin (`/admin`)
   - Pricing / Buy Credits (`/pricing`)
   - Home / Landing (`/`)
   Each as a full-width clickable row (Button variant ghost w/ justify-start), navigating via `window.location.href` (matches existing app patterns) or react-router `Link` if already imported. Close the drawer on selection.
3. **Consistency:** same visual language as the rest of the app (slate/blue gradients, dark mode). Keep the balance card + Top Up Credits + ThemeToggle in the header untouched. Do NOT restructure the page layout otherwise.

## Tests

`src/__tests__/DashboardPage.test.tsx` (exists — extend it, keep AAA wrappers):
- Add test: hamburger button renders and opens the menu; menu shows the four destinations; clicking a destination navigates (assert `window.location.href` was set — mock it like other tests do).
- Keep existing tests green.

## Evidence Checklist (mandatory)

- [ ] `npm run verify` verbatim output (NOT a real typecheck — solution-style tsconfig)
- [ ] `npm run build` verbatim output — build success is the real gate
- [ ] Changed files + diff, confirmed on disk with `stat`
- [ ] Do NOT take screenshots yourself — Hermes captures visual evidence
- [ ] List modified files with timestamps; report failures honestly

**Out of scope:** functions/, firestore.rules, e2e/, AdminPage, LandingPage, PaymentPage, App.tsx routing. Touch nothing else.
