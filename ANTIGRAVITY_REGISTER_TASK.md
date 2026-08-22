# PreSift — Recruiter Registration page + auto-wire registration data into Stripe on credit purchase

Act as Principal Full-Stack Engineer + QA Lead. Controller (A1) verified the repo baseline: web `tsc --noEmit` clean (exit 0), `vitest run` 164/164 green; functions baseline green (per prior handoffs). Implement two things in **one coherent iteration**:

1. A public **Recruiter Registration page** at `/register`.
2. Registration data flows **automatically** to the Stripe checkout when that recruiter buys credits — the buyer's registered identity is carried into the Stripe session, not re-entered by hand.

## Current state (facts — code against these)

### No auth; identity = localStorage
- `presift_uid` is the source of truth for "who is signed in"; `presift_demo_session` carries demo identity. `allowAnonDemo()` returns true in demo mode (`FUNCTIONS_EMULATOR === "true"` or `demo.allow_anon === "true"` config).
- `RECRUITER_ID = 'demo_recruiter'` is hardcoded in `DashboardPage`. Do NOT introduce real Firebase Auth in this iteration (consistent with prior iterations).

### Users collection + Firestore rules
- `firestore.rules`: `match /users/{userId}` → `allow read: if true;` but `allow write: if false;` — **only Cloud Functions may write users**. Therefore the registration must create the `users/<uid>` doc via a NEW callable, never a client `addDoc`.
- Existing `users` docs carry `{ email, credits, companyName, vatId, totalSpent, totalPurchased, role, [name] }` (it11 added optional `name`). Presence fields vary; handle missing gracefully.

### Stripe checkout
- `functions/src/stripe.ts` `createCheckoutSession` (callable) currently accepts `{ uid, quantity, email, companyName, vatId, billingAddress, origin }`. It sets `customer_email` from `data.email` but **drops companyName/vatId/billingAddress** — they are not put on the Stripe session/customer. `metadata` only carries `{ uid, credits, quantity }`. On `checkout.session.completed`, the webhook credits `users/<uid>.credits` by `metadata.credits` (merge).
- `PaymentPage.tsx` collects `email`, `companyName`, `vat`, `billingAddress` via form fields and passes them to `createCheckoutSession`. After registration, these should be **pre-filled from the registered recruiter profile** and the buyer should not need to retype them.

## Part A — Recruiter Registration page (`/register`)

- New route `src/pages/RegisterPage.tsx`, mounted in `src/App.tsx` at `/register`. Add a nav/entry point from the LandingPage nav (e.g. a "Register" link near Pricing/Dashboard/Admin) and/or the pricing page intro so recruiters can discover it. Keep it consistent with the current nav layout.
- Form fields (all validated, required where marked): **Full name** (required), **Business email** (required, valid email), **Company name** (required), **VAT ID** (optional), and optionally **Password** only if you also persist it in the demo user doc (do NOT invent real auth — store as plaintext demo field on `users/<uid>` only if you keep `password` out of any client-visible read path; otherwise omit password and generate a `uid` client-side). Prefer: client generates a `uid` (e.g. `crypto.randomUUID()`), stores `presift_uid` in localStorage, and calls the new callable.
- On submit: validate → call new callable `registerRecruiter` (see Part B) → persist `presift_uid` + `presift_demo_session` to localStorage → navigate to `/dashboard` (or `/pricing` with a success banner). Show inline field errors (no naked try/catch; explicit error handling).
- Registration must be **idempotent**: if the `users/<uid>` doc already exists (e.g. re-register / existing demo_recruiter), update provided fields without resetting credits, or return the existing doc — state your chosen semantics and test it.

## Part B — `registerRecruiter` callable (backend)

Add `export const registerRecruiter = functions.https.onCall(...)` in `functions/src/index.ts` (or a new functions file, consistent with repo layout):

- Input: `{ uid?, name, email, companyName, vatId?, billingAddress?, role?: 'recruiter' }`.
- Auth/demo gate: same pattern as other callables (`if (!_context.auth && !allowAnonDemo()) throw unauthenticated`).
- Behavior (explicit):
  - Resolve `uid` (caller-provided or `_context.auth?.uid` or generated).
  - If `users/<uid>` exists → **merge** provided fields, do NOT touch `credits`/`totalSpent`/`totalPurchased`/`role` (or normalize role to `recruiter`). Return `{ uid, created: false, profile }`.
  - If missing → create with provided fields + `role: 'recruiter'`, `credits: 0`, `totalSpent: 0`, `totalPurchased: 0`, `createdAt: serverTimestamp()`, and a `creditAuditLog` entry only if granting credits (do NOT grant). Return `{ uid, created: true, profile }`.
  - Validate required fields; throw `invalid-argument` with clear messages. No naked try/catch.
- Add/extend unit tests in `functions/src/__tests__/` covering: new user created, existing user merged without credit reset, missing email/name rejected, invalid uid rejected.

## Part C — Auto-wire registration data into Stripe

- **`createCheckoutSession`**: when `data.uid` resolves to a registered recruiter and the caller does NOT provide explicit `email`/`companyName`/`vatId`/`billingAddress`, look up `users/<uid>` and pull those fields from the registered profile. Always populate `email` for `customer_email` (prefer passed email, else registered email).
- Put identity onto the Stripe session so it is not lost at payment: add `metadata` keys for `companyName` and `vatId` (and optionally `email`) alongside the existing `uid/credits/quantity`. Keep `client_reference_id` = uid.
- **`PaymentPage.tsx`**: on mount, read `presift_uid`; fetch `users/<uid>` (existing pattern) and **pre-fill** `email`, `companyName`, `vat`, `billingAddress` from the registered profile so the buyer sees their info already populated (editable). Add a small badge/label like "Signed in as <Name> (<email>)" when a registered profile is present, so it's clear registration data will be used. Keep manual override possible.
- On `checkout.session.completed`, do NOT regress the existing credit-increment behavior. (Company/VAT from metadata may optionally be written back to `users/<uid>` on purchase completion if you make that explicit in the report — keep it simple and documented.)

## Scope (hard rule)

MAY edit:
- `src/App.tsx` (add route), `src/pages/RegisterPage.tsx` (new), `src/pages/PaymentPage.tsx` (prefill + signed-in badge), `src/pages/LandingPage.tsx` (add Register entry link only — do NOT restructure hero/body).
- `functions/src/index.ts` (and/or a new functions file), `functions/src/stripe.ts` (metadata + profile lookup), `functions/src/__tests__/**` (new tests).
- Src unit tests for RegisterPage/PaymentPage prefill in `src/__tests__/**`.

Do NOT touch: TestPage, DemoPage body, seeder demo data (unless adding a registered-demo-recruiter doc is needed for the demo path — if so state it), Firestore rules (keep `users` write disabled — registration goes through the callable), core theme work, E2E specs. No naked try/catch. No real Firebase Auth in this iteration. No changes that break the local dev server.

## Edge cases (must handle explicitly)

1. `users/<uid>` exists but has no `name`/`companyName` → fall back to email / neutral label; never render `undefined`.
2. Fresh visit (no `presift_uid`) to `/pricing` → show empty form (no crash); after registration → prefilled.
3. Existing user re-registers → merge, credits untouched, `created:false`.
4. Invalid email / missing company name / missing name → inline validation blocks submit, explicit `invalid-argument` from backend.
5. Long names → truncate gracefully; no layout break.
6. Callable error (unauthenticated in prod, etc.) → surface a clear message; never a silent blank.
7. `createCheckoutSession` with a uid that has no profile → behave exactly as today (no lookup crash).

## Proof (mandatory, verbatim, run from `/home/fupazuzi/projects/b2b-assessment-engine`)

- Web: `npx tsc --noEmit` exit 0; `npx vitest run` all green (≥ 164 + new); `npx vite build` exit 0.
- Functions: `cd functions && npx tsc --noEmit` exit 0; `cd functions && npx vitest run` all green (new registerRecruiter tests included).
- One local sanity check: run `npm run dev`, visit `/register`, register a new recruiter, see it redirect + appear on `/dashboard`, then confirm the `/pricing` form is pre-filled from registration. Screenshot/paste the register page and the pre-filled pricing form. If the callable needs the emulator for the full loop, run the Functions emulator for that check and note it.

## Stop condition

`/register` page works end-to-end (register → persisted to users via callable → identity stored → pricing pre-filled → Stripe session carries the registered identity/metadata). All proofs green, tests cover the merge/validation paths, nothing outside scope touched. Report exactly what changed per file + verbatim proof output.
