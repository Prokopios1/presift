# Task: Fix the wedged functions emulator — ROOT CAUSE RESOLVED + VERIFIED (A1 2026-08-22 23:1x)

Repo: `/home/fupazuzi/projects/b2b-assessment-engine`

## ⚠️ Root-cause correction (supersedes earlier hypothesis)
The earlier hypothesis ("empty/missing functions build output") was **WRONG — a red herring**.
- Build output target = `functions/lib/` (tsconfig `outDir: "lib"`, package `main: lib/index.js`). `lib/index.js` exists, 35KB non-empty, and was freshly rebuilt (`npm run build` → exit 0) from the uncommitted source. `functions/dist` does not exist nor matter.
- **Actual root cause: JDK 21 missing from the `java`/JAVA_HOME used by `firebase emulators:start`.** firebase-tools 15.17.0 (global `/usr/bin/firebase`) enforces `MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21` (controller.js L182) for any downloadable-Java emulator (firestore). The system default `java` was JDK **17** (class-file max 61.0), but the emulator jar `cloud-firestore-emulator-v1.21.0.jar` is compiled for class-file 65.0 (Java 21) → 1. `emulators:start` exits ("firebase-tools no longer supports Java version before 21"), and 2. the stale functions runtime was left orphaned/wedged on a dead 5001.
- A working **JDK 21 already exists**: `/home/fupazuzi/jdk21` (Temurin 21.0.12 LTS). It was just not the default `java` on PATH/JAVA_HOME. This is why the 22:20/22:37 stack ran under it before it drifted.

## Fix applied (coordinated, no new software installed)
1. Killed stale orphaned processes: functions `functionsEmulatorRuntime` (old PID 673239) + firestore java (old PID 632722); cleared ports 5001/8081.
2. Rebuilt functions fresh: `npm --prefix functions run build` → exit 0, `lib/index.js` rebuilt 23:08.
3. Started `firebase emulators:start --project presift` with `JAVA_HOME=/home/fupazuzi/jdk21` (+ `PATH=$JAVA_HOME/bin:$PATH`). Single coordinated run → both emulators up:
   - Firestore 127.0.0.1:**8081**
   - Functions 127.0.0.1:**5001** — ALL 19 functions initialized (registerRecruiter, generateB2BInvoice, topUpCredits, createAssessmentLink, deleteCandidate, updateCandidateStatus, updateCandidate, bulkDeleteCandidates, startSession, submitAssessment, updateCandidateClients, updateClient, archiveClient, archiveCandidate, integrity, seedDemoData, createCheckoutSession, stripeWebhook). `checkAbandonedSessions` ignored only because pubsub emulator not running (expected).

## RESULT — all acceptance checks GREEN
- `seedDemoData` POST → `{"result":{"success":true,"count":9}}` (HTTP 200), idempotent.
- Vite dev server 5174 (`/dashboard`, `/register`) → HTTP 200; client firebase `connectFirestoreEmulator(db,"127.0.0.1",8081)`.
- **Dashboard renders** (real headless Chrome, not just DOM): "Recruiter: Acme Corp (Demo)", "Balance 5 Credits", all **9 candidate rows** (Alice Strong ✓Strong, Bob ✓Strong, Charlie/ Dave/Eve Conditional, Grace/Ivan Low, Frank Pending 🔒Locked, Harry Flag ⚠️Integrity Flagged), full table (Name/Role/Status/Date/Fit/Integrity/Actions), per-row View/Copy/Edit/Archive.
- **Detail drawer opens on View (Alice Strong)**: 🟢 Strong Fit badge, **Shortlist/Interview/Reject** buttons, Cognitive (ICAR) 95th %ile card, Emotional Intelligence 102 Score card, ICAR 4-Domain Breakdown (N 4/V 3/Ab 3/S 4), WLEIS 4x4 (Self 26/Others 24/Use 25/Reg 27), Anti-Cheating Logs (30m 0s, 0 tab blurs), Custom Interview Prompts, Export PDF, Delete Data (GDPR), Close.
- Screenshots: `/tmp/presift-dashboard.png` (table) + `/tmp/presift-drawer.png` (open drawer).

## Constraints honored
- `/pricing`, collective-score logic, Open WebUI container: untouched.
- Firestore = 8081, functions = 5001 (NOT reverted to 8080).
- Nothing committed — DB changed (seeded) + build refreshed; **A2 (Hermes) inspects + commits**.

## Note for A2 / future runs
- `emulators:start` must run with `JAVA_HOME=/home/fupazuzi/jdk21`. Default `java` = JDK 17 → firebase refuses. (No new JDK install needed; jdk21 already present.)
