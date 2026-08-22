# Task: Make the Firebase Firestore emulator runnable locally (preSift)

Repo: `/home/fupazuzi/projects/b2b-assessment-engine`

## Goal
Make the Firebase Firestore emulator runnable so the recruiter dashboard loads real candidate data (needed to live-verify the candidate drill-down drawer).

## Why port 8081
Port **8080** is occupied by the running `open-webui` container (127.0.0.1:8080), which must keep running. The Firestore emulator defaults to 8080 → conflict. Pin Firestore to **8081** instead. Functions stays on 5001.

## Edit 1 — `src/lib/firebase.ts` (code)
Line 22 currently:
```ts
connectFirestoreEmulator(db, "127.0.0.1", 8080);
```
Change the port to `8081`:
```ts
connectFirestoreEmulator(db, "127.0.0.1", 8081);
```
Leave `connectFunctionsEmulator(..., 5001)` (line 21) unchanged.

## Edit 2 — `firebase.json` (add `emulators` block)
Keep ALL existing keys (`firestore` rules/indexes, `functions`, `hosting`) intact. Add a new top-level `emulators` key:
```json
"emulators": {
  "firestore": { "port": 8081 },
  "functions": { "port": 5001 },
  "ui": { "enabled": true },
  "singleProjectMode": true
}
```

## Constraints
- Do NOT modify `/pricing` (Stripe) or the collective-score logic on `/dashboard`.
- Do NOT touch the Open WebUI container or its 8080 binding.
- Do NOT commit — A1/A2 (Hermes) handle inspect + commit afterward.
- Both edits must use the same port (8081) or the app and emulator will not connect.

## Verify
After editing, start `firebase emulators:start` and confirm Firestore binds **8081** (not 8080). With the Vite dev server already on 5174, confirm `/dashboard` fetches from `127.0.0.1:8081` with no CORS/wildcard-on-8080 error.
