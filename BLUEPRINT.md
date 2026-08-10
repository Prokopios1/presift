# PreSift Architecture Blueprint

## System Layout

PreSift is a B2B psychometric pre-screening platform built on a serverless architecture using Firebase.

### Frontend
- **Framework:** React + Vite, TypeScript
- **Styling:** Tailwind CSS, Shadcn/ui (Radix UI)
- **Routing:** React Router (Dashboard `/`, Test Session `/test/:assessmentId`)
- **State Management:** React local state, `localStorage` for mid-test resilience

### Backend (Cloud Functions)
- **Framework:** Firebase Functions (Node.js/TypeScript)
- **Database:** Firestore
- **Core Modules:**
  - `session.ts`: Manages assessment instantiation, key generation, and template parameterization.
  - `psychometrics.ts`: Executes scoring using ICAR-16 (IRT/theta) and WLEIS-16 algorithms.
  - `submission.ts`: Validates data payloads, normalizes input, and guards against parameter tampering.
  - `seeder.ts`: Provides a dev-mode stub environment with mock recruiters, candidates, and items.

## Data Model (Firestore)

- **`users/{userId}`**: Recruiter account
  - `credits` (number): Remaining candidate invitations
  - `email` (string), `name` (string)
- **`candidates/{candidateId}`**:
  - `name` (string), `email` (string), `appliedRole` (string)
  - `recruiterId` (string)
  - `status` (string) e.g., "Pending", "Shortlisted", "Interviewing", "Rejected"
  - `scoreResult`: ICAR and WLEIS subscale metrics
  - `integrityEvents`: Array of `{ type: string, at: number }`
  - `isLocked` (boolean)
- **`sessions/{sessionId}`**:
  - `assessmentId` (string)
  - `keys` (SessionKey[]): The server-side keys for cognitive answers.
  - `sessionToken` (string): For authorization checks.

## Subsystems & Edge-Case Failure Boundaries

### 1. Test Parameterization & Engine
- **Failure Boundary A:** Missing or un-parseable templates (e.g., `enum` resolution fails). *Fallback: Defaults to `resolvedExample.prompt`.*
- **Failure Boundary B:** Non-integer item responses submitted by a candidate. *Validation: Hard rejection in `validateSubmission` (throws `SubmissionError`).*
- **Failure Boundary C:** Tampered `correctAnswerKey` included in submission. *Validation: Hard rejection of forbidden keys before scoring begins.*

### 2. Session Integrity & Auto-Save
- **Failure Boundary A:** Browser crash mid-test. *Fallback: `localStorage` recovers current question and responses on reload.*
- **Failure Boundary B:** Auto-save spamming rate limits or fails due to network. *Fallback: Client catches Firebase error, ignores to prevent UI block, relies on final submission.*
- **Failure Boundary C:** Unauthorized user attempts to write to a session doc. *Validation: Firestore rules require a matching `sessionToken` inside the request body.*

### 3. Recruiter Dashboard & Billing
- **Failure Boundary A:** `topUpCredits` function invoked without auth. *Validation: Cloud Function immediately throws `unauthenticated` HTTPS error.*
- **Failure Boundary B:** Export PDF triggered on unsupported browser/mobile. *Fallback: Defaults to `window.print()` which is universally supported but gracefully downgrades if missing.*
- **Failure Boundary C:** Candidate doc updated with wrong status. *Validation: Statuses must strictly match "Shortlisted", "Interviewing", or "Rejected".*
