# Antigravity Task — Skeptical Recruiter Team Benchmark Proof of Concept Flow

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web).
Touch ONLY the files listed below — anything else is strictly out of scope unless explicitly approved.

**Files in scope:**
- `src/pages/LandingPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/CandidateDetailPage.tsx`
- `src/lib/psychometrics.ts` (if helper functions needed)
- `src/App.tsx` (routing additions if dedicated benchmark page/modal route added)
- `src/__tests__/DashboardPage.test.tsx` (or new test file `src/__tests__/TeamBenchmark.test.tsx`)

---

## Specific Milestones & Verifiable Deliverables

### Milestone 1: Landing Page CTA & Intent Wiring
- Add "Benchmark Your Team" CTA button on `LandingPage.tsx` (hero section).
- Subtext: "Skeptical? Test preSift on your top performers first — 100% risk-free".
- Clicking button routes to `/register?intent=benchmark` or `/dashboard?mode=benchmark`.
- **Verification Gate M1**: `npm run test -- src/__tests__/LandingPage.test.tsx` passes.

### Milestone 2: Team Benchmark Board & Purpose Tagging
- On `DashboardPage.tsx`, add a "Team Benchmark" workflow option/modal.
- Recruiter inputs 3–5 team members: Name, Email, and Manager Performance Rating (1–10).
- Generate assessment links tagged with `purpose: 'benchmark'` and `performanceRating: <1-10>`.
- Provide a "Copy Invite Links" action.
- **Verification Gate M2**: Candidate docs in Firestore receive `purpose: 'benchmark'` and `performanceRating` field.

### Milestone 3: Dual-Metric Correlation & Visualization
- Update Candidate Detail drawer/page (`CandidateDetailPage.tsx`) & Dashboard to render benchmark metrics:
  - Render side-by-side comparison (Manager Rating vs preSift Score).
  - Compute Pearson correlation coefficient ($r$) when candidate count $N \ge 3$.
  - Display alignment percentage callout (e.g. "87% Alignment with Evaluation").
- **Verification Gate M3**: `npm run verify` passes with 0 type errors, 0 lint errors, all Vitest suites passing.

---

## Constraints
- Do NOT touch `functions/`, `scripts/`, or unrelated pages.
- Minimal, surgical diffs only.
- Strict error handling — no empty try/catch blocks.