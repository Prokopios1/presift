# Antigravity Task: Admin — Add Client with Free Credits (Promo/Testing)

## Context

Project: `/home/fupazuzi/projects/b2b-assessment-engine` (presift-web). Owner/Admin page = `src/pages/AdminPage.tsx` (route `/admin`).

What already exists (do NOT redo): customer accounts table listing `users/` docs, per-row **Adjust** dialog (grant/deduct credits + required reason, writes `credits` + `creditAuditLog` subcollection), candidate deep-dive drawer. Dev/demo firestore rules allow anonymous writes — **no rules change needed**.

What's missing (this task): an **Add Client** flow — create a new customer account and grant initial free credits for promo/testing.

## Changes (all in `src/pages/AdminPage.tsx` unless noted)

1. **"Add Client" button** in the page header (next to "← Recruiter View"), opening a new Dialog.
2. **Add Client dialog** with fields:
   - Company Name (required)
   - Email (required, type email)
   - VAT / Tax ID (optional)
   - Initial Free Credits (number, min 0, default 5, label: "Free credits for promo/testing")
   - Reason (optional text, placeholder "e.g., Promo / Testing — free units"; default to "Promo / testing" when empty)
3. **On submit** (mirror the existing `handleCreditAdjust` pattern exactly):
   - `addDoc(collection(db, 'users'), { companyName, email, vatId, credits: initialCredits, totalSpent: 0, role: 'recruiter', createdAt: serverTimestamp() })`
   - Then `addDoc(collection(db, 'users', newId, 'creditAuditLog'), { amount: initialCredits, reason, adjustedBy: 'admin', previousBalance: 0, newBalance: initialCredits, createdAt: serverTimestamp() })`
   - Refresh the recruiters list (re-fetch or append), close dialog, reset fields.
4. Validation: disable submit until Company Name + Email valid and credits >= 0. Explicit error handling — no naked try/catch; alert + console.error on failure (match existing style).
5. Use existing UI components only (Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter, Input, Label, Button). Keep the existing adjust/audit behavior untouched.

## Tests

Add `src/__tests__/AdminPage.test.tsx` (best effort, keep all suites green):
- Mock `firebase/firestore` (`vi.mock`) for getDocs/addDoc/updateDoc; render with MemoryRouter.
- Test 1: renders the customers table + "Add Client" button.
- Test 2: opening Add Client, submitting without company/email stays disabled.
- Test 3: valid submit calls addDoc with companyName/email/credits and refreshes the list.
- Keep AAA comment wrappers. If mocking proves flaky, at minimum assert the dialog opens and validates — do not weaken other suites.

## Evidence Checklist (mandatory)

- [ ] `npm run verify` verbatim output — NOTE: not a real typecheck (solution-style tsconfig)
- [ ] `npm run build` verbatim output — build success is the real gate
- [ ] Changed files + diff, confirmed on disk with `stat`
- [ ] Do NOT take screenshots yourself — Hermes captures visual evidence (Playwright)
- [ ] List modified files with timestamps; if anything failed, say so

**Out of scope:** functions/, firestore.rules, e2e/, other pages, PaymentPage, LandingPage. Touch nothing else.
