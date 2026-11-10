# Recruitment Specialist — preSift review

Persona: Recruitment Specialist  
Specialization: End-to-end talent acquisition operations, psychometric screening validity, structured behavioral interviewing (STAR), and hiring compliance

---

## What I inspected

- `src/pages/DashboardPage.tsx` (Candidate pipeline tracking, status transitions, search, bulk actions)
- `src/pages/CandidateDetailPage.tsx` (Candidate score profiles, domain breakdowns, interview prompt generator, GDPR deletion)
- `src/pages/RecruiterGuidePage.tsx` (Recruiter instructions, methodology guidelines, legal duty disclaimers)
- `src/pages/TestPage.tsx` (Candidate assessment interface, timing, instructions)
- `src/pages/AdminClientPage.tsx` (Client account oversight and credit assignment)
- `functions/src/index.ts` (`createAssessmentLink`, `submitAssessment` fit calculation, `updateCandidateStatus`)
- `functions/src/psychometrics.ts` (Scoring formulas, percentile calculations)
- `src/lib/fitBadge.ts` (Fit badge mapping)
- `docs/PRODUCT_SHEET.md` and `README.md`

---

## Findings

### 1. "Fit Badge" Calculation Discards Emotional Intelligence Entirely (`functions/src/index.ts` L806–808)
The product sheet and landing page promise a dual-pillar evaluation: cognitive power (ICAR) + emotional chemistry (WLEIS). However, in `submitAssessment`:
```typescript
let fitBadge = "🔴 Low Fit";
if (scoreResult.icar.percentile >= 80) fitBadge = "🟢 Strong Fit";
else if (scoreResult.icar.percentile >= 50) fitBadge = "🟡 Conditional Fit";
```
- **The WLEIS emotional intelligence score is 100% ignored** when calculating the candidate's headline fit badge!
- An applicant with off-the-charts emotional intelligence (top 1% empathy, regulation, and communication) who scores at the 48th percentile on abstract spatial rotation is stamped with a red **"🔴 Low Fit"** badge.
- For non-technical hiring managers recruiting for customer success, sales, operations, nursing, or hospitality, this produces catastrophic false negatives. High-EQ candidates are discarded before the recruiter ever reviews their subscales.

### 2. Interview Prompts Lack STAR Behavioral Anchors and Rating Rubrics (`CandidateDetailPage.tsx` L144–157)
preSift aims to empower hiring managers with "structured interview prompts".
- While generating targeted questions is helpful, the platform provides **zero evaluation rubrics, behavioral anchors, or scoring scales** for the interviewer.
- When an interviewer asks *"Tell me about a situation where you had to read the room and adjust your approach"*, what constitutes an Unsatisfactory (1), Competent (3), or Superior (5) response?
- Without behavioral anchors (the foundation of the STAR method), unstructured interviewer bias rushes back in, defeating the primary value proposition of objective psychometric pre-screening.

### 3. Missing Client/Hiring Manager Shareable Link (`CandidateDetailPage.tsx` L343–356)
A primary workflow for independent recruiters and recruitment agency desks is presenting a candidate shortlist to external hiring managers or clients.
- Currently, the only sharing mechanism in preSift is browser print (`window.print()`).
- There is no **secure, read-only candidate review link** (or client portal view) that an agency recruiter can send to a hiring manager.
- Recruiters are forced to manually export PDFs or take screenshots to communicate findings to their stakeholders.

### 4. No Automated Candidate Email Invitation (`functions/src/index.ts` L369–421, `DashboardPage.tsx` L538–570)
In the "Create Assessment Link" dialog, recruiters are prompted to enter the candidate's name and email.
- However, `createAssessmentLink` **never sends an invitation email**, even though `nodemailer` is configured in Cloud Functions. It merely saves the email string in Firestore and returns a raw URL.
- The recruiter must manually copy the link, open their email client or LinkedIn recruiter portal, draft an explanation, and paste the URL.
- This creates unnecessary administrative friction when processing batches of 10–20 applicants.

### 5. Absence of Bulk Status Transitions in Pipeline Management (`DashboardPage.tsx` L345–365)
The candidate table provides row checkboxes and a bulk selection header.
- However, the **only available bulk action is "Delete Selected"**!
- Recruiters cannot perform bulk status updates (e.g. selecting the top 5 candidates with `🟢 Strong Fit` and advancing them simultaneously to `Shortlisted` or `Interviewing`).
- Recruiters must click into each candidate individually or update them one by one, which is tedious during high-volume screening.

### 6. Adverse Impact & Legal Safeguards Missing in Score Interpretation (`CandidateDetailPage.tsx`, `RecruiterGuidePage.tsx`)
In both EU (under GDPR Article 22 on automated processing) and US markets (EEOC Uniform Guidelines on Employee Selection Procedures):
- Standalone cognitive cutoff scores carry documented disparate impact risks across diverse demographic cohorts.
- While `RecruiterGuidePage.tsx` correctly notes *"The human decides. preSift is never the sole criterion for hiring or rejection"*, this warning is absent on the actual candidate evaluation screen (`CandidateDetailPage.tsx`).
- Busy hiring managers glancing at the "🔴 Low Fit" badge will instinctively use it as an automated knockout filter.

---

## Prioritized recommendations

### High Priority

1. **Fix the Fit Badge to Integrate Both Cognitive (ICAR) and Emotional (WLEIS) Scores (`functions/src/index.ts`)**
   - **Why:** Align product reality with the core marketing promise and eliminate false rejections of high-EQ talent. Implement a balanced composite score (e.g. 50% ICAR percentile + 50% WLEIS percentile, or weighted by role type):
     - `Strong Fit`: Both Cognitive & EI ≥ 65th percentile, or Composite ≥ 75.
     - `Conditional Fit`: Composite between 45 and 74 (e.g. High EI with moderate cognitive, or vice versa).
     - `Low Fit`: Composite < 45.
   - **Rough Effort:** Small (1 day).

2. **Add Behavioral Scoring Rubrics (STAR Anchors) to Dynamic Interview Prompts (`CandidateDetailPage.tsx`)**
   - **Why:** Transform generic interview prompts into a true structured interview toolkit. Under each generated question, include 3 quick rating anchors:
     - *1 - Below Standard*: "Blames others; shows no awareness of own emotional triggers."
     - *3 - Competent*: "Recognizes friction after the fact; takes standard corrective steps."
     - *5 - Outstanding*: "Proactively identifies subtle non-verbal cues; de-escalates tension before conflict arises."
   - **Rough Effort:** Small (1–2 days).

3. **Add Automated Email Dispatch for Candidate Invitations (`functions/src/index.ts`)**
   - **Why:** Dramatically speed up recruiter workflow. When a recruiter supplies a candidate email in `createAssessmentLink`, give them a toggle: `[x] Send invitation email automatically`. Use the existing `transporter` to dispatch a branded, professional invitation email with the unique link and assessment instructions.
   - **Rough Effort:** Small (1 day).

### Medium Priority

4. **Implement Bulk Pipeline Status Actions on Dashboard (`DashboardPage.tsx`)**
   - **Why:** Allow recruiters to manage candidates as a true talent pipeline. When rows are selected, provide a dropdown: *"Move to Shortlisted"*, *"Move to Interviewing"*, *"Move to Rejected"*, alongside bulk delete.
   - **Rough Effort:** Small (1 day).

5. **Generate Secure Shareable Report Link for Hiring Managers (`CandidateDetailPage.tsx`)**
   - **Why:** Eliminate PDF printing friction for agency recruiters. Add a "Share Link" button that generates a temporary (e.g. 14-day tokenized) read-only public URL showing the candidate's scores, fit badge, and interview prompts without granting access to the recruiter's full dashboard.
   - **Rough Effort:** Medium (2 days).

6. **Add Role Archetypes to Customise Screening Weights**
   - **Why:** Different roles demand different competencies. Allow the recruiter to select a preset role profile when creating an assessment link:
     - *Analytical / Technical*: 70% Cognitive / 30% EI
     - *Client-Facing / Sales / Support*: 30% Cognitive / 70% EI
     - *General Management*: 50% Cognitive / 50% EI
   - **Rough Effort:** Medium (2–3 days).

### Low Priority

7. **Add Compliance Disclaimers on Candidate Results Screen (`CandidateDetailPage.tsx`)**
   - **Why:** Protect recruiters from EEOC and EU labor law liabilities. Add a subtle advisory footer: *"Psychometric scores reflect sample performance and should be weighted alongside CV, structured interview responses, and work samples. Do not use as a sole disqualifier."*
   - **Rough Effort:** Very Small (30 minutes).

8. **Candidate Re-engagement / Talent Pool Tagging**
   - **Why:** Support long-term recruitment operations. Allow recruiters to tag "Silver Medalist" candidates (e.g. high-fit candidates who were not hired for the current role) for future job openings.
   - **Rough Effort:** Medium (2 days).

---

## What I would NOT change

1. **The Dynamic Interview Prompts Concept**  
   Generating role-play and behavioral questions targeted specifically at a candidate's lowest subscales (e.g. probing Regulation of Emotion when ROE is low) is one of the highest-value features for non-professional interviewers. It directly solves the problem of hiring managers conducting superficial, unstructured chit-chat interviews.

2. **The "Invited → Completed → Shortlisted / Interviewing / Rejected" Pipeline Stages**  
   The candidate lifecycle states in `DashboardPage.tsx` map cleanly onto standard recruitment workflows. It gives recruiters an immediate overview of active requisitions without requiring an expensive enterprise ATS subscription.

3. **Plain-Language Executive Summary Sentences**  
   Recruiters and hiring managers don't want raw theta values or IRT mathematics; they need immediate operational clarity. The narrative sentences explaining what each score means in workplace terms are practical, defensible, and effective.
