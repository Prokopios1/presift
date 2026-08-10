# Iteration 7 — Test Alignment

## 1. Test Failures Remediated

| Test File | Old Assertion | New Assertion |
| :--- | :--- | :--- |
| `functions/src/__tests__/seeder.test.ts` | Expected 8 candidates; locked candidate tied to index 5 | Expects 9 candidates (2 Strong / 3 Conditional / 2 Low / 1 Locked / 1 Integrity); asserts exactly one locked candidate and its name is "Frank Pending" |
| `src/__tests__/LandingPage.test.tsx` | Asserts old pay-as-you-go packs and tests click on static 15 Candidates pack | Asserts new numeric stepper, dynamic price calculation (€25 default, €75 for 15), Billing Address form, and verifies correct payload on checkout |
| `src/__tests__/DevToolbar-wiring.test.tsx` | Mock Recruiter payload with 3 links/5 credits | Mock Recruiter payload matches new 9 candidate seed spec; Added test for 👑 Owner Login payload |

### Modified Files:
- `functions/src/__tests__/seeder.test.ts`
- `src/__tests__/LandingPage.test.tsx`
- `src/__tests__/DevToolbar-wiring.test.tsx`

---

## 2. Verification Gates (Verbatim Outputs)

### G1: `npm run test` (web root)
**Exit Code: 0**
```
> presift-web@0.0.0 test
> vitest run

 RUN  v4.1.10 /home/fupazuzi/PreSift/presift-web
...
 ✓ src/__tests__/DevToolbar-wiring.test.tsx (3 tests) 54ms
 ✓ functions/src/__tests__/seeder-schema.test.ts (3 tests) 6ms
 ✓ functions/src/__tests__/seeder.test.ts (6 tests) 6ms
 ✓ functions/src/__tests__/submission-integration.test.ts (2 tests) 12ms
 ✓ src/__tests__/LandingPage.test.tsx (2 tests) 230ms
 ✓ src/__tests__/DashboardPage.test.tsx (1 test) 60ms
 ✓ src/__tests__/TestPage.test.tsx (3 tests) 250ms

 Test Files  14 passed (14)
      Tests  71 passed (71)
   Start at  19:55:37
   Duration  1.71s (transform 1.12s, setup 1.31s, import 2.93s, tests 833ms, environment 12.19s)
```

### G2: `cd functions && npm test`
**Exit Code: 0**
```
> test
> vitest run

 RUN  v4.1.10 /home/fupazuzi/PreSift/presift-web/functions
...
 ✓ src/__tests__/submission.test.ts (11 tests) 8ms
 ✓ src/__tests__/session.test.ts (7 tests) 37ms
 ✓ src/__tests__/session-parameterization.test.ts (8 tests) 45ms
 ✓ src/__tests__/seeder-schema.test.ts (3 tests) 4ms
 ✓ src/__tests__/seeder.test.ts (6 tests) 4ms
 ✓ src/__tests__/submission-integration.test.ts (2 tests) 12ms

 Test Files  9 passed (9)
      Tests  59 passed (59)
   Start at  19:53:57
   Duration  459ms (transform 426ms, setup 0ms, import 1.35s, tests 126ms, environment 1ms)
```

### G3: `npm run verify`
**Exit Code: 0**
```
> presift-web@0.0.0 verify
> oxlint -D perf -D correctness && tsc -b && vitest run

Found 9 warnings and 0 errors.
Finished in 32ms on 61 files with 104 rules using 16 threads.

 RUN  v4.1.10 /home/fupazuzi/PreSift/presift-web
...
 Test Files  14 passed (14)
      Tests  71 passed (71)
   Start at  19:55:45
   Duration  1.70s (transform 1.28s, setup 1.29s, import 2.98s, tests 775ms, environment 12.23s)
```

### G4: `npm run build`
**Exit Code: 0**
```
> presift-web@0.0.0 build
> tsc -b && vite build

vite v8.2.0 building client environment for production...
✓ 2467 modules transformed.
rendering chunks (1)...computing gzip size...
dist/index.html                     0.46 kB │ gzip:   0.29 kB
dist/assets/index-D7O-pGHJ.css     47.12 kB │ gzip:   8.46 kB
dist/assets/index-BTa2XC11.js   1,211.26 kB │ gzip: 362.25 kB

✓ built in 616ms
```

### G5: `cd functions && npm run build`
**Exit Code: 0**
```
> build
> tsc
```

---

# Iteration 8 — E2E Spec Alignment + Live Checkout Bug Fix (Controller-Verified)

*Appended by controller (A1) on 2026-08-09 after independent re-verification. Antigravity's it8 run modified source (`functions/src/stripe.ts`) despite the it8 scope note — justified: live E2E exposed a real production bug.*

## Real Bug Found & Fixed (live E2E only)

- **Symptom:** Stripe checkout on live returned 400 `Valid pack required`; frontend (it6+) sends dynamic `quantity`, deployed function still validated legacy `pack`.
- **Fix:** `functions/src/stripe.ts` — accept `quantity` (1–200, €5/unit = 500 cents), keep backward-compatible `pack` fallback; deployed via `firebase deploy --only functions`.
- **Why unit tests missed it:** the callable is mocked in `src/__tests__`; only a live E2E run exercises the real deployed function.

## Files Changed (it8)

- `e2e/landing.spec.ts` — new UI selectors (Screening Engine badge, stepper, Billing Address, `Checkout — €<total>`), dialog listener for visible failures
- `e2e/dashboard.spec.ts` — DevToolbar requires `?demo=true` on production; re-inject before seeding
- `functions/src/stripe.ts` — quantity support (source fix, real bug)
- `e2e/test-session.spec.ts` — untouched (already green)

## Controller Re-Verification (all run by A1, 20:39–20:45)

| Gate | Command | Result |
|---|---|---|
| G1 | `PLAYWRIGHT_BASE_URL=https://presift.web.app npx playwright test` | **8/8 passed** (18.7s), exit 0 |
| G2 | `npm run verify` | 14 files, **71/71 passed**, exit 0 |
| G3 | `cd functions && npm run build` | exit 0 |
| G4 | bundle hash dist vs live | `index-BTa2XC11.js` matches |
| G5 | live HTTP | https://presift.web.app → 200 |

## CodeGraph (controller)

- `codegraph sync` after it8: 6 added + 19 modified files → **61 files / 447 nodes / 889 edges**, no pending changes.
- Verified in index: `createCheckoutSession` → `functions/src/stripe.ts:24` (quantity logic), `AdminPage` → `src/pages/AdminPage.tsx:16`.

## Status

Frontend + backend + tests synchronized; app is MVP-complete and green against production.
