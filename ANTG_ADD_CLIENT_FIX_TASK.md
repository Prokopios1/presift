# TASK: Fix "Failed to add client" in Admin Dashboard

## Context (new session — do NOT carry over previous task context)

This is a fresh ANTG session. Focus ONLY on the task below. The repo is the
b2b-assessment-engine (preSift). You are the ONLY one who writes code (per
project role split: ANTG codes, Hermes/A2 verifies, A1 overviews). Do NOT
commit — leave the working tree dirty for A2 to review.

## Bug

In the Admin Dashboard, clicking **Save** on the "Add New Client" dialog
always ends with `alert('Failed to add client.')`. The new client is never
created.

## Root cause (verified by A1)

`src/pages/AdminPage.tsx`, function `handleAddClient` (~line 115), writes to
Firestore **directly from the browser**:

```ts
const userRef = await addDoc(collection(db, 'users'), userData);
await addDoc(collection(db, 'users', userRef.id, 'creditAuditLog'), { ... });
```

But `firestore.rules` **denies all client writes** to those paths:

```
match /users/{userId} {
  allow read: if true;
  allow write: if false;   // <- blocks the add
}
match /users/{userId}/creditAuditLog/{logId} {
  allow read: if true;
  allow write: if false;   // <- blocks the audit log add
}
```

Security rules reject the write → exception → the `catch` fires the alert.
That is the whole failure: **the page writes directly, but the rules only
permit Cloud Functions to write.**

## Fix required

Follow the app's OWN architecture, which is documented in the rules file:

> "Every WRITE/DELETE that mutates product data goes through Cloud Functions
> callables (admin SDK, bypasses these rules). Clients get no anonymous
> write/delete anywhere."

So implement **Option 1**: route the client creation through a Cloud Function
HTTPS callable.

1. **Add an HTTPS callable** in `functions/src/index.ts` (e.g.
   `createClient`) that:
   - Validates inputs (companyName non-empty, valid email format, credits is a
     non-negative number).
   - Creates the `users` doc with the same shape `AdminPage.tsx` uses today:
     `companyName`, `email`, `vatId`, `credits`, `totalSpent: 0`, `role:
     'recruiter'`, `createdAt` (Cloud Functions already runs with admin SDK,
     use `admin.firestore.FieldValue.serverTimestamp()`).
   - Creates the nested `creditAuditLog` doc with `amount`, `reason`,
     `adjustedBy: 'admin'`, `previousBalance: 0`, `newBalance: credits`,
     `createdAt` server timestamp.
   - Returns `{ id: <newUserDocId> }`.
   - Leaves `firestore.rules` UNCHANGED (still `allow write: if false`).

2. **Update `src/pages/AdminPage.tsx` `handleAddClient`** to call the callable
   via `httpsCallable(functions, 'createClient')` instead of `addDoc`
   directly. On success, push the returned client (with its `id`) into the
   `recruiters` list exactly as it does today, clear the form, and close the
   dialog. Keep the existing validation / loading / try-catch-alert structure.

3. Make sure there is no double serverTimestamp on the client side anymore —
   remove the now-unused `addDoc`/`serverTimestamp` import(s) from
   `AdminPage.tsx` if they become dead after the refactor.

4. Keep the `Saving...` UI state and the `Failed to add client.` alert on
   callable failure — just make it actually succeed end-to-end.

## Verification (do these, report results)

- `npm run build` (or the project's typecheck) passes in `functions/` and the
  root.
- `npx tsc --noEmit` passes (project may use its own lint — run whatever the
  repo uses; earlier runs used `lint`, `tsc`, and `npm test`).
- Add-client flow works end-to-end against the local emulators:
  - Firestore emulator on `127.0.0.1:8081`
  - Functions emulator on `127.0.0.1:5001`
  - Admin page dev server on `5174`
  - Add a client in the UI → it appears in the list, credits reflect, audit
    log entry exists in the emulator for that user id.
- If you cannot drive the UI directly, at minimum call the new callable
  against the emulator and confirm a `users` doc + `creditAuditLog` subdoc are
  created.

## Edge cases to handle explicitly (no naked try/catch, no hardcoding)

- `email` format invalid → surface a clear error, do NOT write.
- `credits` negative / non-number → reject.
- `companyName` blank → reject.
- Callable returns success but client-list update should use the returned id.
- Duplicate email handled predictably (either pre-check or let the DB decide —
  state your choice).

## Do NOT

- Do NOT loosen `firestore.rules` to allow client writes.
- Do NOT commit. Leave changes uncommitted.
- Do NOT touch unrelated files / other in-flight task changes.
