# ATS Validator Architect — preSift review

Persona: ATS Validator Architect  
Specialization: ATS Ingestion Pipelines, Candidate Data Contracts, Automated Pre-Screening Interoperability, and HRIS/ATS Ecosystem Architecture

---

## What I inspected

- `src/pages/DashboardPage.tsx` (candidate pipeline view, bulk actions, search/filter capabilities, export options)
- `src/pages/CandidateDetailPage.tsx` (candidate score visualization, interview prompt generation, PDF export action)
- `functions/src/index.ts` (`createAssessmentLink`, `submitAssessment`, `updateCandidateStatus`, `bulkDeleteCandidates`)
- `functions/src/submission.ts` and `functions/src/session.ts` (assessment data schema, candidate payload structures)
- `docs/PRODUCT_SHEET.md`, `BLUEPRINT.md`, `README.md` (integration roadmap, export specs, buyer architecture)
- Firestore candidate document schemas and client-side serialization models

---

## Assessment: The ATS-Validator Angle

An assessment engine does not live in a vacuum. In enterprise talent acquisition and SMB recruitment alike, the **Applicant Tracking System (ATS)**—whether enterprise platforms like Workday, Greenhouse, Lever, and Ashby, or mid-market/regional leaders like Workable (dominant in Greece/EU) and Recruitee—is the immutable **System of Record**.

If an assessment platform forces recruiters to manually copy-paste candidate names, generate single-use links one by one, switch browser tabs to check completion status, and manually transcribe scores into their ATS, **buyer adoption will stall**. The primary buyer value of pre-screening is reducing recruiter screening time from hours to minutes. Without a machine-readable data contract and automated integration path, PreSift introduces operational overhead that counteracts its core psychometric value.

---

## Findings

### 1. Zero Programmatic Integration Surface (The "Siloed Island" Flaw)
- **File/Location:** `functions/src/index.ts` (`createAssessmentLink` L369–421, `submitAssessment` L740–860)
- **Finding:** PreSift possesses zero inbound API endpoints or outbound webhooks for ATS connectivity:
  1. **No Inbound Link Trigger:** Creating an assessment link requires an authenticated session inside PreSift's React UI (`createAssessmentLink`). An external ATS cannot programmatically trigger an assessment invite when a candidate moves to the "Assessment" stage in a hiring pipeline.
  2. **No Outbound Webhook on Completion:** When a candidate finishes a test in `submitAssessment`, results are written exclusively to Firestore. PreSift fires no HTTP webhook notification to external systems. Recruiters must manually refresh `DashboardPage.tsx` to discover that a candidate has finished.
  3. **No Partner Ecosystem Hooks:** There is no integration bridge for Workable, Greenhouse Harvest API, Lever Postings/Opportunities, or Zapier/Make.

### 2. Missing External Foreign Keys & Requisition Identifiers in Data Contract
- **File/Location:** `functions/src/index.ts` L406–415, `src/pages/DashboardPage.tsx` L133
- **Finding:** The candidate data schema lacks essential foreign key bindings required by any standard ATS data contract:
  ```typescript
  // Current PreSift Candidate Schema:
  {
    appliedRole: string, // Freeform text string (e.g. "Senior Dev")
    name: string,
    email: string,
    status: "Invited",
    lang: "el" | "en",
    createdAt: FieldValue.serverTimestamp(),
    recruiterId: string,
    clientIds: [recruiterId]
  }
  ```
  - **No `externalCandidateId` / `applicantId`:** The ATS candidate record ID is never captured. When results are ready, there is no identifier to associate the test with the candidate's existing ATS profile.
  - **No `jobRequisitionId` / `postingId`:** The job role is stored as an unvalidated freeform text string (`appliedRole`). ATS pipelines require a stable requisition identifier to group candidates by opening and enforce role-specific normative benchmarks.
  - **No `sourceAts`:** Cannot distinguish candidates arriving from Workable vs. LinkedIn vs. direct agency submission.

### 3. Brittle Scoring Schema & Unserializable Interview Prompts
- **File/Location:** `functions/src/index.ts` L806–827, `src/pages/CandidateDetailPage.tsx` L146–157, L333–341
- **Finding:**
  1. **Unstructured Fit Badges:** In `functions/src/index.ts` L806–809, the fit category is stored as an emoji-prefixed string: `"🟢 Strong Fit"`, `"🟡 Conditional Fit"`, `"🔴 Low Fit"`. Downstream ATS integrations filtering or ranking candidates programmatically must parse emojis and localized strings rather than a typed enum (`STRONG_FIT`, `CONDITIONAL_FIT`, `LOW_FIT`).
  2. **Transient Interview Prompts:** One of PreSift's strongest B2B value propositions is its **dynamic behavioral interview prompts** (e.g. probing low OEA or low ROE). However, these prompts are **never stored in the database**! They are dynamically generated on-the-fly inside the React component (`getDynamicPrompts` in `CandidateDetailPage.tsx`). If an ATS ingests candidate results, it receives only raw numerical scores—the actionable interview questions never make it to the hiring manager's ATS interview scorecard.

### 4. Absence of Bulk CSV / Machine-Readable Pipeline Export
- **File/Location:** `src/pages/DashboardPage.tsx` L72–100, `src/pages/CandidateDetailPage.tsx` L346
- **Finding:**
  - In `DashboardPage.tsx`, recruiters can filter and multi-select candidates via checkboxes, but the only batch action is `bulkDeleteCandidates` (`Trash2`).
  - There is **no CSV or JSON export button**. A recruiter processing a cohort of 40 applicants cannot export a summary spreadsheet of scores (ICAR percentile, WLEIS total, subscales, fit badge, completion date) to upload into their ATS or share with an executive hiring committee.
  - On `CandidateDetailPage.tsx`, the "Export PDF" button literally invokes the browser's native `window.print()` dialog (`onClick={() => window.print()}`). It does not generate a standardized, branded, multi-page vector PDF artifact with a persistent public verification URL or ATS-parseable text stream.

### 5. Single-Candidate Link Creation Bottleneck
- **File/Location:** `src/pages/DashboardPage.tsx` L78–85, `functions/src/index.ts` L369–420
- **Finding:**
  - To invite candidates, the recruiter must open a modal, type one candidate name and email, click "Create Link", copy the URL, and paste it into an email or ATS messenger.
  - For an agency screening 50 applicants for a client or an SMB hiring across 3 departments, this manual 1-by-1 workflow creates severe recruiter fatigue.
  - There is no CSV bulk invite mechanism (uploading a CSV with `name, email, role` to generate 50 links in a single operation) and no "Reusable Public Job Link" where applicants can self-register their email and start testing directly from a job board posting.

---

## Integration Path & Data Contract Specification

To achieve seamless ATS fit, PreSift must implement a standardized **Assessment Partner Data Contract**:

```
[ ATS / Job Board ]                          [ PreSift Assessment Engine ]
        │                                                  │
        │── 1. POST /api/v1/assessments/invite ───────────>│ (Stores externalCandidateId,
        │      { externalCandidateId, jobRequisitionId,   │  requisitionId, callbackUrl)
        │        candidateEmail, candidateName }          │
        │<── Returns { assessmentUrl, expiresAt } ─────────│
        │                                                  │
        │                                                  │ [ Candidate Takes Test ]
        │                                                  │
        │<── 2. POST callbackUrl (Webhook) ────────────────│ (Fires upon submitAssessment)
        │      { event: "assessment.completed",            │
        │        externalCandidateId: "cand_9812",         │
        │        fitBadge: "STRONG_FIT",                   │
        │        scores: { icarPercentile: 88, ... },      │
        │        interviewPrompts: [...],                  │
        │        reportPdfUrl: "https://.../report.pdf" }  │
        ▼                                                  ▼
```

### Standardized Webhook Completion Payload:
```json
{
  "event": "assessment.completed",
  "assessmentId": "cand_a1b2c3d4",
  "externalCandidateId": "app_982314",
  "jobRequisitionId": "req_frontend_sr",
  "completionTimestamp": "2026-10-06T09:15:00Z",
  "summary": {
    "fitTier": "STRONG_FIT",
    "cognitivePercentile": 88,
    "cognitiveStandardScore": 118,
    "emotionalIntelligenceScore": 64,
    "integrityStatus": "PASSED"
  },
  "subscales": {
    "numerical": 3,
    "verbal": 3,
    "abstract": 4,
    "spatial": 3,
    "sea": 18,
    "oea": 16,
    "uoe": 15,
    "roe": 15
  },
  "interviewPrompts": [
    "Describe a high-pressure deadline where team members had conflicting priorities. How did you maintain momentum?",
    "Tell me about a situation where you had to adjust your communication style to read an unstated concern."
  ],
  "reportUrl": "https://presift.web.app/reports/cand_a1b2c3d4.pdf"
}
```

---

## Prioritized recommendations

### High Priority

1. **Add 1-Click CSV Pipeline Export on Dashboard (`src/pages/DashboardPage.tsx`)**
   - **Why:** Immediate buyer value. Allows recruiters and agencies to download their candidate table as a formatted `.csv` file with standard columns (`Name, Email, Role, Status, Fit Tier, ICAR Percentile, WLEIS Total, SEA, OEA, UOE, ROE, Completed Date`) for immediate import into Workable, Greenhouse, Lever, or Excel.
   - **Rough Effort:** Small (1 day). Implement client-side CSV builder from `filteredCandidates`.

2. **Normalize Data Contract & Persist Interview Prompts (`functions/src/index.ts`)**
   - **Why:** Essential for machine readability and external integration. 
     - Store a clean enum `fitTier: "STRONG_FIT" | "CONDITIONAL_FIT" | "LOW_FIT"` alongside the display label.
     - Accept optional `externalCandidateId` and `jobRequisitionId` in `createAssessmentLink`.
     - Generate and store `interviewPrompts: string[]` in the Firestore candidate document during `submitAssessment` so they become permanent, exportable records.
   - **Rough Effort:** Small (1–2 days).

3. **Build Outbound Webhook Dispatcher on Test Completion**
   - **Why:** Automates the feedback loop into ATS platforms without requiring recruiters to check the PreSift dashboard. When `submitAssessment` completes, if the recruiter or client has a configured webhook URL, dispatch a signed HMAC-SHA256 payload with scores and interview prompts.
   - **Rough Effort:** Medium (2 days).

### Medium Priority

4. **Implement Bulk CSV Candidate Invitations (`DashboardPage.tsx`)**
   - **Why:** Eliminates the manual single-link bottleneck for agencies and high-volume recruiters. Allow uploading a CSV list of applicants to generate links and send invitation emails (or output a batch of URLs) in one click.
   - **Rough Effort:** Medium (2 days).

5. **Provide Inbound REST Assessment API (`/api/v1/invites`)**
   - **Why:** Enables direct headless integration from modern ATS webhooks (e.g. Workable candidate stage action $\to$ PreSift API).
   - **Rough Effort:** Medium (2–3 days).

6. **Generate Server-Side PDF Reports with Stable URLs**
   - **Why:** Replace fragile browser `window.print()` with a cleanly rendered vector PDF report (using `pdfkit` or Headless Chrome via Cloud Functions/Cloud Storage) that can be linked directly into ATS candidate cards.
   - **Rough Effort:** Medium (3 days).

### Low Priority

7. **Direct Marketplace Connectors (Workable & Greenhouse Partners)**
   - **Why:** Official listing in the Workable Developer Partner directory (key for Greece/EU) and Greenhouse Harvest integration allows 1-click OAuth app installation.
   - **Rough Effort:** High (1–2 weeks + partner certification).

---

## What I would NOT change

1. **Short, Predictable Assessment Duration:**
   The 12-minute total assessment length (ICAR-16 timed + WLEIS-16 Likert + brief smile task) is the sweet spot for top-of-funnel pre-screening. Long 45-minute psychometric batteries suffer from 50%+ candidate drop-off in ATS pipelines. Keeping it brief guarantees high completion rates.
2. **Clear 3-Tier Fit Classification:**
   The tri-state fit tier (Strong, Conditional, Low) aligns directly with standard recruiter Kanban stages (Advance, Interview with probes, Reject). Do not replace this with confusing multi-dimensional spider charts on the main summary.
3. **Structured Behavioral Interview Prompts:**
   Generating targeted interview probes mapped to specific psychometric deficiencies (e.g. low OEA prompting a "read the room" question) is PreSift's biggest differentiator over generic cognitive tests. This feature bridges the gap between mechanical ATS filtering and human interviewing.
