# TASK: Harden `?next=` redirect on RegisterPage (new session)

## Context (fresh session — ignore prior session context)

Repo: b2b-assessment-engine (preSift). You (ANTG) commit ONLY AFTER A2 inspects.

## Background

On the landing page, the Buy Units CTAs go to `/register?next=/pricing`. After a successful
registration, `src/pages/RegisterPage.tsx` reads `?next=` via `useSearchParams()` and
`navigate(next)` (default `/dashboard` when absent).

A2 found a minor (non-blocking) issue: `next` is NOT validated. A crafted URL like
`/register?next=/register` would drop a fresh user back onto the register form, and any
other `next=` value is honored blindly. It's a hall pass that currently allows "any room."

## Change requested (small, surgical)

In `src/pages/RegisterPage.tsx`, whitelist the redirect target. Only allow a known-safe
set of internal paths; anything else falls back to the default `/dashboard`.

Recommended implementation shape (match existing style, no hardcoding across the app,
no naked try/catch):

```
const ALLOWED_NEXT = new Set(['/pricing', '/dashboard']); // only internal paths the app legitimately uses
const rawNext = searchParams.get('next');
const next = rawNext && ALLOWED_NEXT.has(rawNext) ? rawNext : '/dashboard';
```

Then `navigate(next)` uses that validated value.

- Keep `/dashboard` as the default when `next` is missing OR not in the allow-list.
- Only add `/pricing` (the actual funnel target) plus `/dashboard` to the allow-list; do
  not add a broad allow-all.
- The landing page still passes `/register?next=/pricing` — that stays valid.
- The existing register flow (writes `presift_uid` + `presift_demo_session`, then
  navigates) must remain unchanged otherwise.

## Out of scope

- Do NOT touch LandingPage.tsx, App.tsx routes, firestore.rules, or any other page.
- Do NOT change the createClient / Add Client flow.

## Verification (report)

- `npx tsc --noEmit` passes.
- `npm test` passes (there is an existing RegisterPage.test.tsx — if it asserts the old
  unbounded nav behavior it may need a tiny assertion update; run it and adjust only if
  needed so the suite stays green).
- `npm run build` passes.
- State the final behavior: what `next` values are honored, what falls back.

## Do NOT

- Do NOT commit yet — A2 must inspect first. You commit only after A2 sign-off.
- Do NOT touch unrelated files or other in-flight working-tree changes.
