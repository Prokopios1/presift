# Application Security Engineer — preSift review

Persona: Application Security Engineer  
Specialization: Secure SDLC, Threat Modeling, Cloud Functions & Firestore Security, OWASP Top 10, and API Defense

---

## What I inspected

- `firestore.rules` (production rules, document path security, authentication helpers)
- `functions/src/index.ts` (`startSession`, `submitAssessment`, `deleteCandidateSelf`, `getCandidateSelf`, `createAssessmentLink`, `generateB2BInvoice`, `integrity`, `allowAnonDemo`)
- `functions/src/session.ts` (`resolveSession`, PRNG usage, anti-cheat structures, session token lifecycle)
- `functions/src/submission.ts` (`validateSubmission`, `processSubmission`, scoring pipelines)
- `functions/src/stripe.ts` (`createCheckoutSession`, `stripeWebhook`, signature verification, idempotency)
- `functions/src/utils/auth.ts` (`resolveRecruiterId`, impersonation guards)
- `src/pages/TestPage.tsx` (client-side state persistence, integrity beacon dispatch, score leak handling)
- `src/pages/DashboardPage.tsx` and `src/contexts/AuthContext.tsx`
- `firebase.json` and `src/lib/firebase.ts` (API exposure, emulator wiring)
- `npm audit` reports for root and functions packages

---

## Findings

### 1. Critical BOLA / IDOR on Self-Service Candidate Endpoints (`functions/src/index.ts` L449–518)
- **Vulnerability:** Broken Object Level Authorization (CWE-285, OWASP A01:2021).
- **Mechanism:** In `deleteCandidateSelf` and `getCandidateSelf`, the authorization check is wrapped in `if (_context.auth) { ... }`:
  ```typescript
  if (_context.auth) {
    const isAdmin = _context.auth.token?.admin === true;
    const isRecordOwner = doc.data()?.recruiterId === _context.auth.uid;
    if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
      throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
    }
  }
  ```
- **Exploit:** When called without Firebase authentication (`_context.auth == null`), the entire conditional block is skipped! Any anonymous user can supply an arbitrary `candidateId` and execute `getCandidateSelf` to exfiltrate candidate PII (name, email, applied role) or invoke `deleteCandidateSelf` to permanently delete any candidate document and all subcollections in Firestore.

### 2. Missing Session Token Validation on Submission & Weak PRNG (`functions/src/index.ts` L660–765, `session.ts` L351)
- **Vulnerability:** Incomplete Token Validation (CWE-287) & Use of Cryptographically Weak Pseudo-Random Number Generator (CWE-338).
- **Mechanism:** 
  1. `startSession` generates a UUID `sessionToken = crypto.randomUUID()` (L660), stores it in `sessions/{sessionId}` (L714), and delivers it to the client (L728).
  2. However, in `submitAssessment` (L740–765), `sessionToken` is **never validated**. The function accepts only `sessionId` from `validateSubmission`.
  3. Furthermore, in `functions/src/session.ts` L351, `sessionId` is derived using:
     ```typescript
     const sessionId = `${assessmentId}_sess_${Math.random().toString(36).substring(2, 9)}`;
     ```
     `Math.random()` provides zero cryptographic entropy (V8 XorShift128+ state is reconstructible).
- **Exploit:** An attacker who knows an `assessmentId` can predict or brute-force the 7-character session ID and submit fabricated test answers to corrupt the evaluation without possessing the unguessable `sessionToken`.

### 3. Open Redirect & Origin Injection in Stripe Checkout (`functions/src/stripe.ts` L36–38, L85–86)
- **Vulnerability:** Unvalidated Redirects and Forwards (CWE-601).
- **Mechanism:** In `createCheckoutSession`, the `origin` parameter is taken directly from the caller payload:
  ```typescript
  const origin = typeof data?.origin === "string" && /^https?:\/\//.test(data.origin)
    ? data.origin.replace(/\/$/, "")
    : "http://localhost:5173";
  ```
  The regex `/^https?:\/\//` matches ANY valid HTTP(S) URL. Stripe is then configured with:
  ```typescript
  success_url: `${origin}/dashboard?payment=success`,
  cancel_url: `${origin}/?payment=cancelled`,
  ```
- **Exploit:** An attacker can trigger checkout generation with `origin: "https://evil-phishing-presift.com"`. When a recruiter completes legitimate credit purchase via Stripe, Stripe automatically redirects them to the attacker's phishing portal. Additionally, `createCheckoutSession` lacks any `_context.auth` check, permitting anonymous callers to generate sessions with arbitrary `uid` recipients.

### 4. Missing Idempotency in Stripe Webhook Handler (`functions/src/stripe.ts` L117–128)
- **Vulnerability:** Lack of Replay Attack / Retry Idempotency (CWE-799).
- **Mechanism:** In `stripeWebhook`, signature verification is present, but upon handling `checkout.session.completed`:
  ```typescript
  if (uid && credits > 0) {
    await admin.firestore().collection("users").doc(uid).set(
      { credits: FieldValue.increment(credits) },
      { merge: true }
    );
  }
  ```
- **Risk:** Stripe webhooks guarantee at-least-once delivery. If Stripe retries a webhook due to a transient timeout or network glitch, `FieldValue.increment(credits)` executes multiple times, awarding duplicate credits without corresponding payment.

### 5. Leakage of Scoring Intelligence & Fit Badges to Candidate (`functions/src/index.ts` L860, `TestPage.tsx` L276)
- **Vulnerability:** Excessive Data Exposure (OWASP API3:2023).
- **Mechanism:** 
  1. `submitAssessment` returns the full scoring structure to the client:
     ```typescript
     return { success: true, scoreResult: resultPayload.scoreResult };
     ```
  2. In `TestPage.tsx` L276, the frontend writes this to browser storage:
     ```typescript
     localStorage.setItem(`assessment_${assessmentId}_submittedResult`, JSON.stringify(resData?.scoreResult ?? null));
     ```
- **Impact:** The product spec and `ThankYouPage.tsx` intentionally withhold scores from candidates to protect hiring confidentiality and prevent test gaming. However, any candidate inspecting DevTools Network responses or `localStorage` immediately sees their computed IRT standard score, theta, percentiles, raw WLEIS subscale totals, and whether they were classified as "🔴 Low Fit".

### 6. Unauthenticated Integrity Event Injection & Session Pollution (`functions/src/index.ts` L1166–1195)
- **Vulnerability:** Unauthenticated State Mutation (CWE-306).
- **Mechanism:** The `/api/integrity` HTTP endpoint is an open webhook accepting `{ sessionId, type, at }`. It performs no authentication, does not verify `sessionToken`, has no rate limits, and accepts arbitrary event types.
- **Exploit:** An external actor can broadcast automated POST requests specifying arbitrary session IDs with `type: 'blur'`, injecting fake integrity violations into a candidate's session record and triggering false `⚠️ Integrity Flag` alerts on the recruiter dashboard.

### 7. Unverified B2B Invoice Forgery Vector (`functions/src/index.ts` L297–329)
- **Vulnerability:** Insufficient Business Logic Authorization.
- **Mechanism:** `generateB2BInvoice` renders a server-signed PDF invoice with PreSift branding using inputs entirely provided by the client (`transactionId`, `companyName`, `amount`, `email`). It does not verify that `transactionId` corresponds to a completed Stripe charge or an existing Firestore audit log entry.
- **Impact:** Any authenticated user can generate authentic-looking PreSift invoices for arbitrary amounts (€10,000+) to submit fraudulent corporate expense reports or fabricate tax records.

### 8. Hardcoded Secrets Pattern & High/Critical Dependency CVEs
- **Pattern:** `functions/src/index.ts` L16 contains fallback mock API credentials: `pass: process.env.SMTP_PASS || "SG.production_key_mock"`.
- **Dependencies:** 
  - `proxy-addr` (1.1.0 - 2.0.7) has a Critical vulnerability (GHSA-jqcg-44mw-7w3h: IP spoofing via IPv4-mapped IPv6 trust subnets).
  - `nodemailer` (<=10.0.5) has multiple High vulnerabilities (GHSA-8m3c-c648-2xjj, GHSA-6vj9-mwq6-2f5v).
  - `nanoid` (<3.3.18) has a High vulnerability (GHSA-2v37-7h3g-55p8: custom generator infinite loop DoS).

---

## Prioritized recommendations

### High Priority

1. **Fix Authorization Gates on `getCandidateSelf` & `deleteCandidateSelf` (`functions/src/index.ts`)**
   - **Why:** Immediate unauthenticated data exfiltration and database destruction hazard.
   - **Fix:** Reject calls where `!_context.auth && !token`. Bind self-service actions to a signed, time-limited capability token issued by `submitAssessment` (e.g., HMAC-SHA256 of `candidateId` + secret timestamp). Never allow anonymous calls with raw document IDs.
   - **Rough Effort:** Small (1 day).

2. **Enforce `sessionToken` Verification in `submitAssessment` & Use Crypto PRNG**
   - **Why:** Prevents session hijacking and score fabrication.
   - **Fix:** Require `sessionToken` in `submitAssessment` payload; verify `sessionDoc.data().sessionToken === payload.sessionToken`. In `functions/src/session.ts` L351, replace `Math.random()` with `crypto.randomBytes(16).toString('hex')`.
   - **Rough Effort:** Small (0.5 day).

3. **Sanitize `origin` in `createCheckoutSession` & Require Authentication**
   - **Why:** Mitigates open redirects to phishing domains and unauthenticated credit creation.
   - **Fix:** Restrict `origin` to an allow-list of approved domains (`presift.web.app`, `localhost:5173`). Require `_context.auth` so credits can only be billed to verified accounts.
   - **Rough Effort:** Small (0.5 day).

4. **Implement Webhook Idempotency in `stripeWebhook` (`functions/src/stripe.ts`)**
   - **Why:** Prevents duplicate credit awards on webhook retries.
   - **Fix:** Store `event.id` in a `processedEvents` Firestore collection using a transaction before incrementing user credits.
   - **Rough Effort:** Small (0.5 day).

5. **Stop Exposing `scoreResult` in `submitAssessment` Response**
   - **Why:** Prevents leakage of confidential candidate psychometrics to the candidate's browser.
   - **Fix:** Return strictly `{ success: true }`. Remove `scoreResult` from the return payload in `functions/src/index.ts` L860 and remove `assessment_${id}_submittedResult` from `TestPage.tsx`.
   - **Rough Effort:** Very Small (1 hour).

### Medium Priority

6. **Protect `/api/integrity` with Session Tokens & Rate Limiting**
   - **Why:** Stops session log tampering and false integrity alerts.
   - **Fix:** Require `sessionToken` in the integrity request header/body and verify against `sessions/{sessionId}`.
   - **Rough Effort:** Small (0.5 day).

7. **Validate Transactions in `generateB2BInvoice`**
   - **Why:** Closes the invoice forgery vector.
   - **Fix:** Lookup `transactionId` in `users/{uid}/creditAuditLog` or Stripe API before rendering the PDF.
   - **Rough Effort:** Small (1 day).

8. **Update Vulnerable Dependencies**
   - **Why:** Patch critical IP spoofing and DoS vulnerabilities in `proxy-addr`, `nodemailer`, and `nanoid`.
   - **Fix:** Run targeted dependency updates in `functions/package.json`.
   - **Rough Effort:** Small (0.5 day).

---

## What I would NOT change

1. **Server-Side Psychometric Scoring Architecture:**
   The boundary between client and Cloud Functions for scoring (`psychometrics.ts`, `session.ts`) is well-designed. The client never gets the item bank correct answers or difficulty weights, effectively preventing answer-key scraping.
2. **Strict Payload Normalization in `validateSubmission`:**
   `validateSubmission` in `functions/src/submission.ts` contains robust checks against prototype pollution and forbidden keys (`ERR_FORBIDDEN_KEY` for `correctAnswerKey`, `irt`, `difficulty`). Keep this defense-in-depth barrier intact.
3. **Emulator-Isolated Destructive Seeder:**
   `seedDemoData` is strictly locked to `process.env.FUNCTIONS_EMULATOR === 'true'`, preventing accidental execution against production databases.
