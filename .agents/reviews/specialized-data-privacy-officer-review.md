# Data Privacy Officer — preSift review

Persona: Data Privacy Officer  
Specialization: Corporate Data Privacy, GDPR Compliance, EU AI Act Governance, and Data Subject Rights Architecture

---

## What I inspected

- `firestore.rules` (candidate read/write permissions and collection-level isolation)
- `functions/src/index.ts` (`createAssessmentLink`, `startSession`, `submitAssessment`, `getCandidateSelf`, `deleteCandidateSelf`, `integrity`)
- `functions/src/session.ts` and `functions/src/submission.ts` (candidate payload validation, PII handling, session persistence)
- `functions/src/smile.ts` and `functions/src/psychometrics.ts` (stimulus evaluation mechanics vs biometric processing)
- `src/pages/TestPage.tsx` (candidate consent UX, notices, and legal acknowledgments)
- `src/pages/ThankYouPage.tsx` (candidate data export and erasure fulfillment UI)
- `src/pages/LandingPage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/CandidateDetailPage.tsx`
- `src/locales/en.json` and `src/locales/gr.json` (localized legal claims and microcopy)
- `firebase.json` and `src/lib/firebase.ts` (infrastructure configuration, cloud hosting regions, and client SDK setups)
- `docs/PRODUCT_SHEET.md`, `BLUEPRINT.md`, `README.md`

---

## Regulatory Classification: EU AI Act

### Assessment: OUTSIDE the Scope of the EU AI Act
Under Article 3(1) of the EU AI Act (Regulation (EU) 2024/1689), an "AI system" is defined as a machine-based system designed to operate with varying levels of autonomy and that may, for explicit or implicit objectives, infer from the input it receives how to generate outputs such as predictions, content, recommendations, or decisions. Recital 12 explicitly clarifies that software based on classical statistical rules or deterministic algorithms that do not infer how to produce outputs from training data are **not** AI systems.

1. **Deterministic Psychometric Scoring:**
   - In `functions/src/psychometrics.ts`, the cognitive engine uses standard 3-Parameter Logistic (3PL) Item Response Theory (`estimateTheta`, `eapTheta`). Difficulty ($b$), discrimination ($a$), and guessing ($c$) parameters are static constants derived from established psychometric literature (ICAR-16), not learned dynamically at runtime.
   - The emotional intelligence engine (WLEIS-16) is a deterministic arithmetic sum of 16 Likert items across 4 subscales (SEA, OEA, UOE, ROE).
   - The fit badge logic (`functions/src/index.ts` L806–809) is a deterministic threshold over IRT percentile ($\ge 80 \to$ Strong Fit, $\ge 50 \to$ Conditional Fit, $< 50 \to$ Low Fit).
2. **Absence of Biometric Emotion Recognition of Candidates:**
   - The smile assessment task (`functions/src/smile.ts`) does **not** capture candidate video, webcam feeds, eye tracking, voice pitch, or facial micro-expressions.
   - The candidate simply watches a pre-recorded external stimulus video and clicks whether the person in the video smiled genuinely or politely (`perceived: 'genuine' | 'fake'`). This measures perceptual appraisal ability, identical to a standardized multiple-choice reading test.
   - Therefore, the prohibited/high-risk provisions regarding "emotion recognition systems in the workplace" (Article 5(1)(f) and Article 26 / Annex III) **do not apply** because no biometric data of the candidate is captured or processed.

### High-Risk Marketing Trap
While the underlying engine is legally outside the EU AI Act, any careless marketing or UI copy describing preSift as "AI-powered candidate screening," "AI cognitive testing," or "AI emotion analysis" will immediately trigger false-positive classification under **Annex III, Point 4(a)** ("AI systems intended to be used for the recruitment or selection of natural persons, notably to screen or filter applications"). 
- Once labeled as "AI" by enterprise buyers or EU works councils (Betriebsrat / trade unions), preSift would face onerous demands for EU AI Act conformity assessments, fundamental rights impact assessments (FRIA), and technical documentation that do not match its true architecture.
- **Rule:** Keep all product documentation, landing pages, and recruiter guides strictly grounded in established terminology: *"Validated Psychometric Testing"*, *"Item Response Theory (IRT-3PL)"*, and *"Standardized Cognitive & Trait Assessment"*.

---

## Findings

### 1. "Mandatory GDPR Consent" is Legally Ineffective in Recruitment (`src/pages/TestPage.tsx` L414–420, L468–474)
In `TestPage.tsx`, candidate progression is blocked unless they check a box labeled:
`"Mandatory GDPR Consent: I agree to the processing of my responses for psychological and perceptual assessment."`
- **The Consent Oxymoron:** Under GDPR Article 4(11) and Article 7, consent must be "freely given, specific, informed, and unambiguous." The European Data Protection Board (EDPB Guidelines 05/2020 on consent) and Article 29 Working Party (Opinion 2/2017 on data processing at work) explicitly state that **consent is generally invalid in employment and recruitment contexts** due to the structural power imbalance between candidate and employer. A candidate cannot freely consent if refusing means forfeiture of their job application.
- **Mandatory Consent is a Violation:** Calling consent "Mandatory" is an immediate red flag for any supervisory authority (such as the Hellenic Data Protection Authority — HDPA). If it is mandatory, it is by definition not freely given.
- **Controller Lawful Basis:** The hiring organization (Data Controller) does not rely on Consent (Art. 6(1)(a)). Their lawful basis is **Article 6(1)(b)** (processing necessary in order to take steps at the request of the data subject prior to entering into a contract) or **Article 6(1)(f)** (Legitimate Interests in evaluating candidate qualifications, backed by a Legitimate Interest Assessment).
- **The Correct Notice:** PreSift should present a transparent **Pre-Assessment Privacy Notice** (Articles 13 & 14) detailing the controller, processor, purposes, retention, and rights, accompanied by an "I acknowledge the test instructions" checkbox, rather than a legally defective "Mandatory Consent" checkbox.

### 2. Broken Authorization on Self-Service DSAR Endpoints (`functions/src/index.ts` L449–518)
PreSift implements candidate data export and deletion via `getCandidateSelf` and `deleteCandidateSelf`. However, the authorization gate contains a severe vulnerability:
```typescript
if (_context.auth) {
  const isAdmin = _context.auth.token?.admin === true;
  const isRecordOwner = doc.data()?.recruiterId === _context.auth.uid;
  if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
    throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
  }
}
```
- **The Bypass:** If `_context.auth` is null (an anonymous caller), the function skips the authorization block entirely!
- Because candidates take tests anonymously without a Firebase Auth UID, any unauthenticated attacker who knows or enumerates a `candidateId` string can invoke `getCandidateSelf({ candidateId })` to exfiltrate PII (candidate full name, email address, role applied for, completion timestamp) or invoke `deleteCandidateSelf({ candidateId })` to delete records and wipe subcollections.
- While the intent was to provide an Article 17 (Right to Erasure) and Article 15 (Right of Access) self-service mechanism on `ThankYouPage.tsx`, exposing unauthenticated mutation and read endpoints keyed on a single Firestore document ID violates Article 32 GDPR (Security of Processing).

### 3. Processor Exceeding Authority by Permitting Unilateral Erasure (`src/pages/ThankYouPage.tsx` L51–66)
On `ThankYouPage.tsx`, any candidate can immediately click "Delete my data" (`deleteCandidateSelf`), instantly purging their record from Firestore.
- **Controller/Processor Relationship:** Under GDPR Article 28, PreSift is a **Data Processor** acting on behalf of the Recruiter/Employer (**Data Controller**).
- A data processor cannot unilaterally destroy controller records without controller authorization. In many jurisdictions (e.g. Greece and Germany), employers have statutory requirements and legitimate interests to retain recruitment records for 3 to 6 months to defend against unlawful discrimination claims or recruitment disputes.
- Allowing an applicant to unilaterally vaporize their candidate submission directly after taking the test denies the controller their legal defense records and corrupts recruiter audit trails.
- Deletion requests by candidates should be logged as a formal Data Subject Request (DSR) or routed through the recruiter's controller policy.

### 4. Absence of Data Retention Schedule and Automated Purging (GDPR Art. 5(1)(e))
The platform currently stores candidate records indefinitely.
- Candidate PII (`name`, `email`, `appliedRole`), detailed psychological answers (`wleis`, `icar`, `smileAnswers`), and computed psychometric profiles (`scoreResult`, IRT thetas) remain in Firestore permanently unless manually deleted by the recruiter.
- Under GDPR Article 5(1)(e) (Storage Limitation), personal data must not be kept longer than necessary for the purposes for which it is processed. In Greece (Law 4624/2019) and broader EU recruitment practice, candidate screening data should have an explicit retention period (e.g., 6 months from submission), followed by automated pseudonymization, anonymization, or deletion.

### 5. Automated Decision-Making Exposure Under GDPR Article 22 (`functions/src/index.ts` L806–809)
In `functions/src/index.ts`, the backend assigns a categorical `fitBadge`:
```typescript
let fitBadge = "🔴 Low Fit";
if (scoreResult.icar.percentile >= 80) fitBadge = "🟢 Strong Fit";
else if (scoreResult.icar.percentile >= 50) fitBadge = "🟡 Conditional Fit";
```
- Under GDPR Article 22, data subjects have the right **not to be subject to a decision based solely on automated processing** which produces legal effects or similarly significantly affects them (such as automatic rejection from a job application).
- If recruiters use the "🔴 Low Fit" tag as an automatic filter to reject candidates without human review, the process constitutes unlawful automated profiling under Article 22.
- The platform lacks any disclaimers or operational safeguards reminding recruiters that PreSift results are advisory inputs to assist human evaluation and must not be used as sole rejection criteria.

### 6. Cloud Functions Default Region (`us-central1`) vs EU Primary Market
In `firebase.json` and `functions/src/index.ts`, Cloud Functions are declared without an explicit `.region()` qualifier.
- By default, Firebase Cloud Functions deploy to Google Cloud's `us-central1` (Iowa, USA).
- Candidate PII submitted via `startSession`, `submitAssessment`, and `createAssessmentLink` is transmitted to and processed within the United States.
- For a product launching primarily in Greece and the EU, transferring recruitment PII outside the European Economic Area (EEA) without explicit customer disclosure and documented Standard Contractual Clauses (SCCs) / EU-US Data Privacy Framework adherence creates compliance exposure under GDPR Chapter V.

---

## Prioritized recommendations

### High Priority

1. **Replace "Mandatory Consent" with an Art. 13/14 Privacy Notice (`TestPage.tsx`)**
   - **Why:** "Mandatory consent" in hiring is an invalid lawful basis and an immediate regulatory violation. Replace it with transparent candidate disclosure explaining that processing is carried out by the recruiter (Controller) via PreSift (Processor) under legitimate interests / pre-contractual steps. Require candidates to acknowledge test instructions, not "consent" under duress.
   - **Rough Effort:** Small (1 day). Update text in `src/pages/TestPage.tsx`, `en.json`, and `gr.json`.

2. **Secure or Redesign Candidate Self-Service DSR Endpoints (`index.ts` L449–518)**
   - **Why:** Critical data protection vulnerability. Anonymous callers can currently query and delete any candidate record by guessing or knowing the ID.
   - **Fix:** If self-service access/erasure on the Thank You page is retained, bind it to a short-lived cryptographic capability token generated during `submitAssessment` (e.g. signed HMAC token passed in URL hash, single-use, expires in 2 hours). Do not allow arbitrary anonymous access by raw `candidateId`.
   - **Rough Effort:** Medium (2 days).

3. **Provide Controller DSR Routing Instead of Unilateral Erasure (`ThankYouPage.tsx`)**
   - **Why:** As a data processor, PreSift cannot erase records without controller authorization. Change "Delete my data" to submit an erasure request that notifies the recruiter or marks the candidate record as `erasure_requested: true`, preserving controller audit compliance.
   - **Rough Effort:** Small (1 day).

4. **Sanitize Marketing and UI Copy to Prevent EU AI Act Misclassification**
   - **Why:** Avoid triggering high-risk AI regulatory inquiries under Annex III. Ensure all marketing materials, web copy, and candidate instructions describe the platform as "Deterministic psychometric evaluation based on validated psychological research", explicitly stating that no artificial intelligence, machine learning, or biometric emotion recognition is utilized.
   - **Rough Effort:** Small (0.5 day).

### Medium Priority

5. **Deploy Functions & Firestore to EU Region (`europe-west1` / `europe-west3`)**
   - **Why:** Eliminates unnecessary Chapter V cross-border data transfer hurdles for Greek and EU hiring organizations. Specify `functions.region('europe-west1')` in all Cloud Functions and configure Firestore in an EU multi-region (`eur3`) or regional (`europe-west1`) instance.
   - **Rough Effort:** Medium (1 day + migration check).

6. **Implement Article 22 Safeguards on Recruiter Dashboard**
   - **Why:** Protects customers and PreSift from Art. 22 automated decision-making liability. Display a clear banner/tooltip on the dashboard and candidate detail drawer: *"PreSift results provide objective psychometric indicators. In compliance with labor and privacy standards, hiring decisions must involve human review and never rely solely on automated badges."*
   - **Rough Effort:** Small (0.5 day).

7. **Implement Configurable Data Retention Schedules (Storage Limitation)**
   - **Why:** Comply with GDPR Art. 5(1)(e). Provide recruiters with an organization-level retention setting (e.g., 90 days, 180 days, or 1 year) and deploy a scheduled sweeper that purges candidate PII and raw answers after the retention period elapses.
   - **Rough Effort:** Medium (2–3 days).

### Low Priority

8. **Draft Standard Data Processing Agreement (DPA) Template**
   - **Why:** Essential for B2B enterprise sales in the EU. Recruiters will require a standard Art. 28 DPA outlining PreSift's technical and organizational measures (TOMs), sub-processors (Google Firebase, Stripe), and breach notification SLA (48 hours to controller).
   - **Rough Effort:** Documentation / legal template (2 days).

---

## What I would NOT change

1. **Keep Scoring Logic Server-Side:**
   The design in `functions/src/session.ts` and `submission.ts`—where answer keys, item difficulty parameters, and scoring functions reside strictly on the server and are never delivered to the candidate browser—is excellent for test integrity and data accuracy (GDPR Art. 5(1)(d)).
2. **Keep the Smile Task Biometric-Free:**
   Do **not** succumb to feature-creep by adding webcam recording, eye tracking, or video proctoring. The current stimulus-only method provides genuine emotional appraisal metrics while completely avoiding the biometric processing minefield of GDPR Article 9 and EU AI Act Article 5/26.
3. **No Direct Candidate Score Disclosure:**
   In `getCandidateSelf` (L515–517), score data is omitted from candidate self-download, directing candidates to the recruiter. This correctly aligns with employment assessment best practices, where normative evaluation is proprietary to the hiring workflow and avoids unnecessary candidate distress or algorithmic disputation.
