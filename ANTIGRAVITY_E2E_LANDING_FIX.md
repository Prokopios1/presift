# Antigravity Task: PreSift — Fix stale landing E2E selector after sidebar (iteration 11, pinpointed)

Act as QA Engineer. The permanent left sidebar (commit `dd8d7fa`, deployed) added a nav row literally containing "Recruiter Dashboard" / "Owner / Admin" on every page. The live E2E suite is now **7 passed / 1 failed** — the single failure is a STALE SELECTOR, zero app bugs (verified by controller A1 via live DOM probe).

## The failure (verbatim)

`e2e/landing.spec.ts` → test "renders core marketing content and navigation":
```
Error: strict mode violation: getByRole('button', { name: /Dashboard/i }) resolved to 2 elements:
  1) <button ...>Recruiter Dashboard</button>   (sidebar row, new)
  2) <button ...>Dashboard</button>             (header button, exact)
```
Same latent issue exists for the `Admin` selector (`/Admin/i` also matches sidebar's "Owner / Admin") and possibly the `Pricing` link selector.

## Fix (scope: `e2e/landing.spec.ts` ONLY — the ONLY file you may touch)

Make the header-navigation selectors unique and exact so they target the OLD header nav (not the sidebar rows):

- `dashboardLink` → `page.getByRole('button', { name: 'Dashboard', exact: true })`
- `adminLink` → `page.getByRole('button', { name: 'Admin', exact: true })`
- `pricingLink` → keep as `getByRole('link', { name: 'Pricing', exact: true })` ONLY if the sidebar renders "Pricing / Buy Credits" as a button (it does) — verify no strict-mode collision; if it still matches 2, scope it to the header nav (`page.locator('header nav, nav').getByRole('link', { name: 'Pricing', exact: true })` or the equivalent unique container).
- Keep ALL other assertions unchanged (headline, subtext, Get Started, footer).

Do NOT touch any other file (`src/**`, other e2e specs, configs). No source-code changes.

## Proof (mandatory, verbatim)

- `cd /home/fupazuzi/projects/b2b-assessment-engine && PLAYWRIGHT_BASE_URL=https://presift.web.app npx playwright test e2e/landing.spec.ts --reporter=list` → **2 passed (exit 0)** — note: the second landing test hits real Stripe hosted checkout; if Stripe test-mode is flaky/unreachable from your network, report that explicitly with the error, but the FIRST test (the one that failed) must pass.
- Then full suite: `PLAYWRIGHT_BASE_URL=https://presift.web.app npx playwright test --reporter=list` → **8 passed (exit 0)**.
- `git diff --stat` (must show `e2e/landing.spec.ts` only).

## Stop condition

Full live suite 8/8 green, diff limited to `e2e/landing.spec.ts`. Do NOT commit (Hermes handles commit+deploy... actually commit is fine ONLY if you also run the full suite green; otherwise leave uncommitted). Do NOT deploy.
