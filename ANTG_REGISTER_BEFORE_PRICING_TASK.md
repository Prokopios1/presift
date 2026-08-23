# TASK: Recruiters registration page before Buy Units (new session)

## Context (fresh — ignore prior session context)

Repo: b2b-assessment-engine (preSift), root = /home/fupazuzi/projects/b2b-assessment-engine.
You (ANTG) are the only one who writes code. Per role split: A1 controls/verifies, A2
inspects, and YOU commit AFTER A2 inspects. For THIS task: implement it, then A2 will
inspect, then you commit. Do NOT commit until A2 sign-off.

## Desired flow change

Today the flow from the Landing page is:

  Landing (/)  →  "Buy Units" (/pricing = PaymentPage)  directly

The user wants a RECRUITERS REGISTRATION page inserted between the landing page and
the Buy Units page:

  Landing (/)  →  Recruiters registration  →  Buy Units (/pricing)

So after a visitor lands, they first register as a recruiter, and then proceed to the
Buy Units / pricing page.

## Current code facts (verify before editing)

- Routes are in `src/App.tsx` (BrowserRouter):
  - `/` → LandingPage
  - `/register` → RegisterPage  (recruiter registration — ALREADY BUILT: name, business
    email, company name, VAT, billing address, submits via httpsCallable to local
    Firebase emulator)
  - `/pricing` → PaymentPage  (the "Buy Units"/payment page)
- LandingPage.tsx currently links to `/pricing` from its "Buy Units"/CTA buttons
  (two `<Link to="/pricing">` around lines 54 and 83, plus nav buttons).

## What to do

1. Decide the cleanest routing so the visitor MUST pass through registration before
   Buy Units. Two reasonable approaches — pick the one that best matches existing
   patterns:
   - **Option A (gate /pricing behind register):** On the landing page, retarget the
     "Buy Units" CTAs to `/register` instead of `/pricing`. After successful
     registration, RegisterPage navigates the user onward to `/pricing` (Buy Units).
     In App.tsx keep `/pricing` reachable but ensure the primary funnel forces the
     register step first.
   - **Option B (reorder page sequence):** Make `/pricing` render a page that first
     presents/redirects to registration if no recruiter is registered yet.
   - Recommend whichever is simplest + matches the app's existing navigation and any
     existing auth/guard patterns (there is an AdminGuard for /admin — mirror its
     style if building a guard).

2. Considerations to preserve (do NOT break):
   - RegisterPage is already complete — reuse it as-is unless a small change is truly
     needed. It already uses `useNavigate`.
   - Keep `/register` reachable.
   - Keep `/pricing` working for existing deep links where sensible, but the VISIBLE
     funnel from Landing must go Landing → Register → Buy Units.
   - Keep the existing nav bar (Back/Forward buttons, ThemeToggle) consistent on the
     pages involved.

3. Update the Landing page CTA(s) so "Buy Units / Get Started" now takes the visitor
   to registration first.

## Out of scope (do NOT touch)

- Do NOT change firestore.rules, the createClient callable, or the Add Client flow.
- Do NOT refactor unrelated pages (Dashboard, Admin, Test, CandidateDetail).

## Verification (report results)

- `npm run build` passes.
- `npx tsc --noEmit` passes.
- `npm test` (vitest) passes — if you added or changed tests, run them.
- Manual/route check: describe the final navigation path (Landing → ? → /pricing) so
  the user/A2 can confirm the funnel.

## Do NOT

- Do NOT commit until A2 inspects (A2 runs the review; you commit only after sign-off).
- Do NOT loosen firestore.rules. No naked try/catch, no hardcoding.
- Do NOT touch other in-flight working-tree changes. Only your files for THIS task.

## Edge cases (handle explicitly)

- Visitor lands, goes to register, registers, then is sent to Buy Units — make sure
  the redirect after registration lands correctly AND the user doesn't get stuck in a
  loop.
- What happens if someone directly visits /pricing (deep link) without registering —
  state your intended behavior.
- Keep the funnel typed/compiled clean (no TS errors from any new guard or navigation).
