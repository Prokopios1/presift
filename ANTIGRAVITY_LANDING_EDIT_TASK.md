# Antigravity Task: Strip Landing Page; Move Pricing/Payment to a New Payment Page

## Context

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (package name `presift-web`) — React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui. Landing page = `src/pages/LandingPage.tsx` (route `/` in `src/App.tsx`).

Goal: the landing page keeps only the hero + nav + footer. The pricing/payment UI (credits stepper, B2B invoicing, Stripe checkout) moves **as-is** to a new dedicated page. Unit suite: `npm run verify` (oxlint + `tsc --noEmit` + vitest).

Files in scope: `src/pages/LandingPage.tsx`, `src/pages/PaymentPage.tsx` (new), `src/App.tsx` (route only), `src/__tests__/LandingPage.test.tsx`, `src/__tests__/PaymentPage.test.tsx` (new). **Do not touch anything else** (other pages, `functions/`, `firestore.rules`, `e2e/`).

## Part A — Landing page (`src/pages/LandingPage.tsx`): remove

### 1. Remove the entire Pricing section
Delete the whole `<section id="pricing">…</section>` block, including:
- The Pay-As-You-Go Credits price card (unit-price badge, numeric stepper −5/−/+1/+5, dynamic Total, B2B invoicing fields: Company Name / Email / VAT / Billing Address, Checkout button, payment methods row 💳🏦🍏📱).
- The "What's Included" list ("Each credit includes: …" with the 8 ✓ items).

### 2. Remove the feature quadrant (2×2 grid on the right of the hero)
Delete the `{/* Feature Grid */}` block: the `grid grid-cols-2 gap-4` div with the 4 cards (🧠 ICAR-16 Cognitive, 💡 WLEIS-16 EQ, 🔒 Anti-Cheating, 📊 Instant Results).

### 3. Remove free-trial elements
- Hero button "Start Free Trial (5 Credits)" — replace with a "Get Started" CTA that links to the new payment page (`window.location.href = '/pricing'`), styled like the old primary button.
- Remove microcopy "No credit card required for trial. GDPR compliant."
- Nav: replace the "Get Started" scroll-to-`#pricing` button with one linking to `/pricing` (keep "Dashboard" and "Admin" ghost buttons).

### 4. Clean dead code after removal
Remove from LandingPage everything that moves out: `UNIT_PRICE`, states `purchaseLoading/credits/companyName/email/vat/billingAddress`, `totalPrice`, `handleCheckout`, `adjustCredits`, and unused imports (`httpsCallable`, `functions`, `Input`, `Label`, all `Card*`). Keep only what's used (`useState` only if still needed — likely removable, `Button`, `Badge`).

### 5. Hero layout fix
After the quadrant is gone the hero wrapper (`flex flex-col lg:flex-row items-center gap-16`) holds only text. Simplify to a single centered column (e.g., `max-w-3xl mx-auto text-center`, centered buttons) so it doesn't look broken.

## Part B — New Payment page (`src/pages/PaymentPage.tsx`)

Create a new page that receives the full pricing/payment UI **unchanged in behavior**:

- Same gradient page shell as the landing page (keep the PreSift brand look).
- A nav bar identical in style to the landing page's, with "Dashboard", "Admin", and a "Back to Home" / logo link back to `/`.
- The complete pricing section: "Simple, transparent pricing" heading + subtext, the Pay-As-You-Go Credits card (stepper, dynamic Total, B2B invoicing fields), Checkout button calling `createCheckoutSession` exactly as before (same `handleCheckout` logic, same `origin` param), payment methods row, and the "What's Included" list.
- Keep `UNIT_PRICE = 5`, `httpsCallable`/`functions` imports, and all state/logic moved from the landing page. Explicit error handling only — no naked try/catch.

## Part C — Routing (`src/App.tsx`)

Add exactly one route: `<Route path="/pricing" element={<PaymentPage />} />` (import the new page). Nothing else changes in App.tsx.

## Part D — Tests

- `src/__tests__/LandingPage.test.tsx`: drop the `firebase/functions` mock and `createSessionMock`. Assert what remains (hero headline, "B2B Psychometric Screening Engine" badge, "View Demo Dashboard →", nav Dashboard/Admin/Pricing, footer) and assert removed elements are gone (no "Pay-As-You-Go Credits", no "Start Free Trial", no "ICAR-16 Cognitive", no Checkout/stepper, no "Berlin, Germany" input).
- `src/__tests__/PaymentPage.test.tsx` (new): port the two existing checkout tests — render with stepper + €5 unit price + "Checkout — €25.00" default, and the Stripe redirect test (set quantity to 15 via +5 clicks, set billing address, click checkout, assert `createSessionMock` called with `{ quantity: 15, uid: 'demo_user', origin: … }` and `window.location.href` set to the Stripe URL). Keep AAA comment wrappers and the `MemoryRouter` render pattern.

## Constraints & Verification

1. Explicit error handling only — no naked try/catch.
2. Do not modify other pages, `functions/`, `firestore.rules`, `e2e/`, `playwright.config.ts`. No cloud function changes — checkout stays exactly as-is, just relocated client-side.
3. Run and show verbatim output of: `cd /home/fupazuzi/projects/b2b-assessment-engine && npm run verify` (must be green: lint + tsc + vitest).
4. Optionally confirm with `npm run build`.
5. **Visual verification (required):** start the dev server (`npm run dev`), open `http://localhost:5173/` and `http://localhost:5173/pricing`, and attach a screenshot of each. Confirm on `/`: hero is centered, nothing looks broken/empty, no pricing/free-trial/quadrant remnants, nav Pricing button works. Confirm on `/pricing`: full pricing card renders (stepper, B2B fields, Checkout), nav Back-to-Home works. Fix any visual regressions before reporting.
6. Report back: per-file change summary + verbatim `npm run verify` output + the two screenshots.
