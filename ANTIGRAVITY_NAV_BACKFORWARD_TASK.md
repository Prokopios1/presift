# ANTG Task — Global Back/Forward Navigation (item #4 completion)

Source of truth: `ANTIGRAVITY_RECRUITER_WORKFLOW_TASK.md` (full current-state brief).
Project: `/home/fupazuzi/projects/b2b-assessment-engine`. HEAD = `c0d3d70` (working tree dirty — Recruiter Workflow in progress, not committed).

## Context
Item #4 of the Recruiter Workflow dispatch prompt requires every workflow page to have functional **Back** and **Forward** controls wired via react-router. A2 (Hermes) verified:
- **DONE** (already have `navigate(-1)` / `navigate(1)` Buttons): `src/pages/PaymentPage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/CandidateDetailPage.tsx`.
- **MISSING — your job:** `src/pages/LandingPage.tsx` (`/`), `src/pages/RegisterPage.tsx` (`/register`), `src/pages/TestPage.tsx` (`/test/:assessmentId`).

## Changes to implement
For each of the 3 pages above, add a **header row with two Buttons** matching the existing pattern used in the done pages:
- `Back` → `onClick={() => navigate(-1)}` with `ArrowLeft` icon
- `Forward` → `onClick={() => navigate(1)}` with `ArrowRight` icon
- `Button variant="outline" size="sm"` (match existing styling in PaymentPage / DashboardPage / CandidateDetailPage).

Follow the existing component structure of each target page — do not restructure layout. Where the page already imports `useNavigate` (RegisterPage, TestPage), reuse it. For LandingPage, add `import { useNavigate } from 'react-router-dom'` plus the Arrow icon imports, and render the nav row in the page header. Keep style consistent with the app's existing design tokens.

## Hard constraints
- Explicit error handling only — no naked try/catch.
- Touch ONLY the 3 listed files. Anything else is out of scope unless you confirm first.
- Never claim a command ran unless you actually ran it and have the output.
- Minimal, modular changes. Record flow + changes to Codegraph.
- **Do NOT commit. Do NOT deploy.**

## Evidence checklist (mandatory)
1. `npm run verify` — paste VERBATIM output.
2. `npm run build` — paste VERBATIM output.
3. Each changed file: path + lines changed, confirmed on disk with timestamps.
4. Confirm Back/Forward rendering in all 6 workflow pages (grep for `navigate(-1)` / `navigate(1)` per page).

Report format: per-change summary + verbatim outputs + on-disk confirmation. If anything failed, say so — do not hide it.
