# UX Researcher — preSift review

Persona: UX Researcher  
Specialization: User behavior analysis, cognitive load, dual-sided workflow ergonomics, accessibility, and assessment anxiety

---

## What I inspected

- `src/pages/TestPage.tsx` (Candidate end-to-end testing flow, instructions, timers, autosave, anti-cheat)
- `src/pages/ThankYouPage.tsx` (Candidate completion state, GDPR download and erasure)
- `src/pages/DashboardPage.tsx` (Recruiter table, candidate filtering, scatter plot, bulk management)
- `src/pages/CandidateDetailPage.tsx` (Recruiter inspection drawer, score visualizers, anti-cheat indicators, dynamic prompts)
- `src/pages/RecruiterGuidePage.tsx` (Recruiter onboarding and educational mental models)
- `src/pages/PaymentPage.tsx` (Recruiter credit purchase flow)
- `src/components/AppSidebar.tsx` (Recruiter primary navigation)
- `src/components/LanguageSwitcher.tsx` (Bilingual Greek/English switching)
- `src/locales/en.json` and `src/locales/gr.json`

---

## Findings

### 1. High-Stakes Accidental Submission Risk on Candidate Test (`src/pages/TestPage.tsx` L725–752)
In `TestPage.tsx`, both ICAR cognitive items and WLEIS emotional intelligence items use instant-click buttons:
```tsx
<Button onClick={() => handleNextQuestion(i)}>{opt}</Button>
```
- **Zero confirmation / Zero review**: As soon as a candidate taps or clicks any option, the answer is immediately committed, synced to Firestore, and the next question loads. There is no "Select → Confirm" step and no ability to review or change an answer.
- **Mobile vulnerability**: On a smartphone or tablet screen, a finger brush or accidental touch while scrolling locks in an answer irreversibly.
- **Cognitive anxiety**: In psychological assessment, forcing irrevocable single-tap decisions without an active selection state significantly spikes candidate stress, leading to miskeyed data rather than true ability measurements.

### 2. Inappropriate Countdown Timer Stress on Emotional Self-Appraisal (`src/pages/TestPage.tsx` L226–240, L713–716)
The assessment applies the identical 45-second per-question countdown timer (with a red pulsating `00:10` warning) to **both Stage 1 (ICAR)** and **Stage 2 (WLEIS)**.
- While speeded cognitive items in ICAR test fluid processing under pressure, WLEIS is a reflective, introspective Likert self-report inventory ("I am sensitive to the feelings and emotions of others").
- Forcing a candidate to rush through personal self-reflections under a 45-second ticking gun triggers panicked satisficing (choosing the first plausible middle option) rather than honest self-reflection.
- Self-report modules in standard psychometric testing are untimed or broadly bounded (e.g. 10 minutes total for the whole section), never sub-divided into ticking 45-second intervals.

### 3. Redundant Double GDPR Consent Gates (`src/pages/TestPage.tsx` L413–421, L467–475)
A candidate is forced to accept mandatory GDPR consent **twice** before answering a single question:
1. On the initial landing screen (`stage === 'landing'`), they must check `terms` ("Mandatory GDPR Consent").
2. Then on the Stage 1 introduction screen (`stage === 'icar_intro'`), they must check `ack-icar` ("I have read and understand these instructions") **and check `icar-consent` ("Mandatory GDPR Consent") a second time!**
- This creates unnecessary administrative friction and signals a clumsy, repetitive legal compliance experience.

### 4. Tab-Switch "Integrity Flag" False-Positive Traps (`src/pages/TestPage.tsx` L203–212, `CandidateDetailPage.tsx` L189–191)
The anti-cheat mechanism listens to `window.addEventListener('blur', handleBlur)` and immediately logs an integrity violation:
- Any OS-level event — such as a calendar alert, an incoming Slack or Teams notification, a browser password autofill prompt, or clicking an assistive screen magnifier — triggers a blur event.
- In `CandidateDetailPage.tsx`, any count > 0 is displayed as a harsh red badge: `⚠️ 2 Integrity Flags` with the warning: *"Candidate left the test window 2 times — review results with caution."*
- Recruiters (especially non-technical SMB owners) immediately interpret this as evidence of cheating. Candidates are penalised for standard desktop OS notifications without ever having received an in-test warning modal ("Warning: Please remain focused on this browser window").

### 5. Raw JSON Payload on Candidate "Download My Data" (`src/pages/ThankYouPage.tsx` L33–44)
On the completion page, candidates have a GDPR button to download their data.
- The button downloads a raw `.json` file (`candidate_data_<id>.json`) containing unprocessed developer objects (`rawScores`, `domainScores`, `theta`).
- This violates standard candidate empathy. A candidate who took 20 minutes to complete a test and requests their data receives a confusing code blob instead of a readable summary card or formatted candidate summary PDF.

### 6. Destructive Hard-Reload Navigation in Recruiter Sidebar (`src/components/AppSidebar.tsx` L85)
In `AppSidebar.tsx`:
```tsx
onClick={() => { window.location.href = item.href; }}
```
- Clicking any navigation item (Dashboard, Recruiter Guide, Profile & Billing, Buy Credits) bypasses the React Router client-side SPA navigation and executes a full window reload (`window.location.href`).
- This causes white-screen flashes, resets React state, forces re-authentication against Firebase Auth, and makes the app feel sluggish and clunky on slower mobile connections.

### 7. Misleading Browser History Buttons in Test and Candidate Headers (`src/pages/TestPage.tsx` L706–708, `CandidateDetailPage.tsx` L173–175)
In `TestPage.tsx` and `CandidateDetailPage.tsx`, the top header bar contains literal browser history buttons:
`<Button onClick={() => navigate(-1)}>Back</Button>` and `<Button onClick={() => navigate(1)}>Forward</Button>`.
- Inside an active timed assessment (`TestPage.tsx`), having a "Back" button that triggers `navigate(-1)` is dangerous. Candidates assume clicking "Back" will let them revise the previous question. Instead, it takes them back to the previous browser URL or out of the test entirely.

### 8. Recruiter Scatter Plot Cognitive Load (`src/pages/DashboardPage.tsx` L510–535)
The recruiter dashboard displays a 2D scatter plot (ICAR Percentile vs WLEIS Score).
- For a small business owner hiring a receptionist or junior salesperson, an unannotated scatter plot is intimidating.
- The chart lacks quadrant labels (e.g. "High Cognition / High EI = Strategic Star", "High Cognition / Lower EI = Independent Specialist"). Without clear quadrant framing, hiring managers don't know how to interpret clustered points.

---

## Prioritized recommendations

### High Priority

1. **Implement Two-Step Option Selection or Review Step on Candidate Test (`TestPage.tsx`)**
   - **Why:** Prevent catastrophic accidental clicks on mobile and reduce test anxiety. Let candidate tap to highlight an option (active state `border-blue-600 bg-blue-50`), then tap a persistent "Next Question →" button to confirm and advance.
   - **Rough Effort:** Small (1 day).

2. **Remove Strict Per-Question Countdown from WLEIS Emotional Intelligence (`TestPage.tsx`)**
   - **Why:** Emotional intelligence self-appraisal is non-speeded. Remove the ticking 45-second timer from WLEIS statements, or replace it with a generous section-level time budget (e.g. 10 minutes total for all 16 items) to encourage honest reflection.
   - **Rough Effort:** Small (0.5 day).

3. **Add Grace Period & In-App Warning for Tab-Switching (`TestPage.tsx`)**
   - **Why:** Eliminate false-positive integrity flags. Instead of silently logging every microsecond blur, show an in-app modal on the first switch: *"Notice: Please keep your assessment window active. Continued switches will be recorded."* Only log blurs lasting longer than 5 seconds.
   - **Rough Effort:** Medium (1–2 days).

4. **Replace Sidebar `window.location.href` with React Router `navigate` (`AppSidebar.tsx`)**
   - **Why:** Provide smooth SPA transitions without full-page reloads and flashes.
   - **Rough Effort:** Very Small (30 minutes).

### Medium Priority

5. **Eliminate Duplicate GDPR Consent Checkbox (`TestPage.tsx`)**
   - **Why:** Simplify candidate onboarding. Keep the GDPR consent on the first landing screen; on the ICAR intro screen, require only a single acknowledgment: *"I have read the instructions and am ready to start."*
   - **Rough Effort:** Very Small (30 minutes).

6. **Add Quadrant Annotations to Dashboard Scatter Plot (`DashboardPage.tsx`)**
   - **Why:** Make psychometric data actionable for non-HR hiring managers. Divide the chart into 4 quadrants with subtle background shading and titles:
     - Top-Right: *All-Round Star*
     - Top-Left: *High EI / Collaborative*
     - Bottom-Right: *Analytical Specialist*
     - Bottom-Left: *Developing*
   - **Rough Effort:** Small (1 day).

7. **Remove History "Forward" and Misleading "Back" from Active Test Header (`TestPage.tsx`)**
   - **Why:** Prevent accidental navigation out of active timed sessions.
   - **Rough Effort:** Very Small (30 minutes).

### Low Priority

8. **Human-Readable Candidate Data Export on Thank You Page (`ThankYouPage.tsx`)**
   - **Why:** Respect GDPR right of access with dignity. Provide a formatted HTML/text summary receipt instead of raw developer JSON.
   - **Rough Effort:** Small (1 day).

9. **Accessible Screen Reader Announcements for Timers**
   - **Why:** Candidates using assistive technology cannot track the visual timer. Add an invisible `aria-live` announcement at 30s, 15s, and 5s marks.
   - **Rough Effort:** Small (1 day).

---

## What I would NOT change

1. **The Clean, Distraction-Free Test Environment**  
   The candidate test screen (`TestPage.tsx`) is commendably free of visual clutter. The high-contrast card, legible typography, and absence of external branding or navigation noise allow candidates to focus fully on the tasks.

2. **Bilingual Toggle Accessibility (`LanguageSwitcher.tsx`)**  
   The seamless toggle between Greek (EL) and English (EN) is fast, reliable, and properly localized across all core instructions and buttons. For the primary Greek market, this is critical.

3. **Candidate Detail Interpretation Sentences (`CandidateDetailPage.tsx`)**  
   Translating numeric scores into plain-language sentences (e.g. *"Performs better than 75% of the reference group on reasoning tasks"*, *"Reports strong emotional awareness and regulation relative to the norm group"*) is outstanding UX design. It bridges the gap between psychometric statistics and non-technical hiring decisions.

4. **Fit Badge Visual System**  
   The three-tier fit badge (`Strong`, `Conditional`, `Low`) with green/amber/red visual hierarchy provides an instantaneous, reliable summary before the recruiter dives into subscales.
