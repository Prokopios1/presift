# TASK: Remove VAT / Tax ID AND Billing Address from Recruiter Registration

## Context (fresh session — ignore prior session context)

Repo: b2b-assessment-engine (preSift). You (ANTG) commit ONLY AFTER A2 inspects.

## Background

The recruiter registration page (`src/pages/RegisterPage.tsx`) currently collects a
"VAT / Tax ID (Optional)" field and a "Billing Address" field, submitting `vatId` and
`billingAddress`. Per product decision, **VAT / Tax ID and Billing Address should ONLY
exist on the Buy Units page (`/pricing`, PaymentPage.tsx)** — both must be **removed
entirely from registration**.

Registration should keep only: Full Name, Business Email, Company Name.

Note: The backend callable `registerRecruiter` (in `functions/src/index.ts`) already
treats `vatId` and `billingAddress` as optional (validated via `!== undefined`) and
defaults to `""` when absent. So removing them from the client is safe; **do not touch
the backend** for this change.

## Change requested (small, surgical)

In `src/pages/RegisterPage.tsx`:

1. Remove the `vatId` state (`const [vatId, setVatId] = useState('')`).
2. Remove the `billingAddress` state (`const [billingAddress, setBillingAddress] = useState('')`).
3. Remove `vatId: vatId.trim() || undefined` and `billingAddress: billingAddress.trim() || undefined`
   (or equivalent) from the callable payload.
4. Remove `vatId: vatId.trim()` and `billingAddress: billingAddress.trim()` from the
   demo-session write, if present.
5. Remove the entire "VAT / Tax ID" form field block (the `<Label htmlFor="vatId">`, the
   `<Input id="vatId" ...>`, its `onChange`/`value`, and its container).
6. Remove the entire "Billing Address" form field block (the `<Label htmlFor="billingAddress">`,
   the `<Input id="billingAddress" ...>`, its `onChange`/`value`, and its container).
7. Clean up the grid layout after removal so the remaining fields (name, email, company)
   render cleanly with no empty / orphaned container divs.

Do NOT remove Name, Email, or Company fields — those stay on registration.

## Tests

`src/__tests__/RegisterPage.test.tsx` currently asserts VAT exists (lines ~42, ~93, ~111, ~122)
and likely Billing Address too. Update it so the suite stays green:

- Remove assertions that `VAT / Tax ID` and `Billing Address` are present.
- Remove `vatId` and `billingAddress` from expected submit payloads.
- Remove `fireEvent.change(...)` interactions targeting those fields.

Keep the test verifying the remaining registration fields (name, email, company) and the
submit payload shape WITHOUT `vatId` / `billingAddress`.

## Verification (report)

- `npx tsc --noEmit` passes.
- `npm test` passes (especially RegisterPage.test.tsx).
- `npm run build` passes.
- Confirm in the running app (`http://localhost:5174/register`) that VAT / Tax ID and
  Billing Address fields are gone, and registration works with name / email / company only.

## Do NOT

- Do NOT touch `functions/src/` (backend `registerRecruiter` keeps its optional handling).
- Do NOT touch `PaymentPage.tsx` — VAT and Billing Address stay there.
- Do NOT commit yet — A2 must inspect first. You commit only after A2 sign-off.
- Do NOT touch unrelated files or other in-flight working-tree changes.
