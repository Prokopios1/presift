# Product Manager — preSift review

Persona: Product Manager (Alex)  
Specialization: Holistic B2B SaaS product lifecycle, positioning, unit economics, and funnel optimization

---

## What I inspected

- `README.md`, `BLUEPRINT.md`, `docs/PRODUCT_SHEET.md`
- `src/App.tsx`, `src/pages/LandingPage.tsx`, `src/pages/RegisterPage.tsx`, `src/pages/LoginPage.tsx`
- `src/pages/DashboardPage.tsx`, `src/pages/CandidateDetailPage.tsx`, `src/pages/RecruiterGuidePage.tsx`
- `src/pages/PaymentPage.tsx`, `src/pages/TestPage.tsx`, `src/pages/ThankYouPage.tsx`, `src/pages/AdminPage.tsx`, `src/pages/AdminClientPage.tsx`
- `src/components/AppSidebar.tsx`, `src/components/LanguageSwitcher.tsx`
- `functions/src/index.ts` (`createAssessmentLink`, `registerRecruiter`, `checkAbandonedSessions`, `submitAssessment`)
- `functions/src/stripe.ts` (`createCheckoutSession`)
- `functions/src/psychometrics.ts` (scoring models and thresholds)
- `src/locales/en.json` and `src/locales/gr.json`

---

## Findings

### 1. Landing Page is a High-Bounce Minimalist Shell (`src/pages/LandingPage.tsx`)
The current landing page is barely 54 lines of code. It contains a single headline ("Beyond the resume: Precise metrics for cognitive power and human chemistry"), one subtitle, and a "Get Started" CTA button. 
- There is **no explanation of what preSift actually does**, no product screenshots or interactive sample reports, no explanation of the dual cognitive (ICAR) + emotional (WLEIS) testing model, and **no link or mention of pricing**.
- For SMB business owners (5–50 staff) who don't have dedicated HR, this copy is too abstract. They need to understand: "How much time will this save me in screening 50 applicants for my sales/ops role?"
- For independent recruiters, there are no trust markers, psychometric validity references, or mentions of ATS export.

### 2. Zero-Credit "Cold Start" Wall Kills User Activation (`functions/src/index.ts` L205–215, `src/pages/DashboardPage.tsx`)
When a recruiter registers via `registerRecruiter`, they receive `credits: 0`.
- The moment they arrive at `/dashboard`, they are immediately blocked from creating their first assessment link (`createAssessmentLink` throws `failed-precondition: Insufficient credits`).
- To see the product deliver value, a user must immediately navigate to `/pricing` and enter payment details (even for the €1 promo credit).
- In B2B self-serve SaaS, the "time to first value" (TTFV) is critical. Without 1–2 complimentary trial credits or a pre-populated sandbox candidate (e.g. "Demo Candidate: Alex Morgan") that allows them to explore the rich candidate drawer, fit badges, and dynamic interview prompts, 80%+ of newly registered users will bounce.

### 3. Upfront Credit Burn Model Creates Recruiter Risk (`functions/src/index.ts` L395–403, L868–898)
In `createAssessmentLink`, 1 credit is deducted immediately upon generating the link URL.
- If an applicant never clicks the link or drops out at the GDPR consent screen, the recruiter loses their credit.
- The scheduled sweeper `checkAbandonedSessions` claims to refund unused credits, but it has two severe bugs:
  1. It only queries candidates with `status == "In Progress"`. Unopened links remain `status == "Invited"` and are never swept or refunded.
  2. It checks `sessionId = docSnapshot.id.startsWith("cand_") ? ... : null`. Candidate documents created by `createAssessmentLink` use standard Firestore auto-IDs without the `cand_` prefix, meaning `sessionId` is always `null` and answers length is evaluated against nonexistent session documents.
- Recruiter trust is fragile. Charging upfront for candidate actions without reliable automated refunding leads to chargeback friction and reluctance to send bulk assessment links.

### 4. Pricing and Packaging Lack Tiering & Expansion Hooks (`src/pages/PaymentPage.tsx`, `functions/src/stripe.ts`)
The pricing model is strictly linear: €5.00 per credit (with a €1.00 single-credit promo).
- The credit selector is a basic numerical stepper (1 to 200). There are no package bundles (e.g. "Starter Pack: 5 credits for €25", "Hiring Surge: 25 credits for €99", "Agency Pack: 100 credits for €350").
- High-intent recruiters or agencies hiring 5 roles a month have no incentive to pre-purchase in bulk. Average Order Value (AOV) remains depressed at €5–€25.
- There is no team seats or subscription tier (e.g. monthly allotment + rolled-over credits) for recurring recruitment desks.

### 5. Critical Flaw in Interview Prompt Logic Misleads Recruiters (`src/pages/CandidateDetailPage.tsx` L146–157)
In `CandidateDetailPage.tsx`, dynamic behavioral interview questions are generated using the following checks:
```typescript
if (SEA < 20) prompts.push(t('candidate_detail.prompt.sea', ...));
if (OEA < 20) prompts.push(t('candidate_detail.prompt.oea', ...));
if (UOE < 20) prompts.push(t('candidate_detail.prompt.uoe', ...));
if (ROE < 20) prompts.push(t('candidate_detail.prompt.roe', ...));
```
Because WLEIS has 4 items per subscale scored 1–5, the **theoretical maximum subscale score is 20**.
- A candidate scoring 19/20 (top 5% emotional intelligence) still triggers `< 20`, causing the UI to flag them as deficient and generate remediation interview questions!
- As a result, almost every candidate triggers low-score probes, negating the value of "custom interview prompts" and misleading the hiring manager.

### 6. Psychometric Spec Drift Between Code and Documentation (`functions/src/psychometrics.ts` vs `docs/PRODUCT_SHEET.md`)
- `docs/PRODUCT_SHEET.md` and `README.md` state WLEIS-16 uses a 7-point Likert scale (1–7) with reverse formula `8 - original`.
- `functions/src/psychometrics.ts` and `src/pages/TestPage.tsx` implement a 5-point Likert scale (1–5) with reverse formula `6 - value`.
- `src/pages/RecruiterGuidePage.tsx` claims "Logic & Reasoning — 11 short tasks", whereas `functions/src/data/presift-bank.json` and the README specify 16 items.
- For HR buyers who evaluate assessment validity and adverse impact, inconsistencies in normative baselines and test length undermine enterprise credibility.

### 7. Invisible ATS Integration & Export Value (`src/pages/DashboardPage.tsx`)
The candidate table allows exporting a single candidate via browser print (`window.print()` in `CandidateDetailPage.tsx`).
- There is no CSV bulk export of scores from `DashboardPage.tsx` for importing into an ATS (Workable, Lever, Greenhouse, or even Google Sheets).
- Small businesses and agencies manage candidate pipelines in tables; forcing them to click into each profile individually creates workflow friction.

---

## Prioritized recommendations

### High Priority

1. **Implement 2 Free Trial Credits & Onboarding Sandbox**
   - **Why:** Immediate time-to-value. Give newly registered recruiters 2 free credits upon email verification so they can run a real assessment immediately without credit card hesitation. Include 1 pre-populated demo candidate on their dashboard so they see the full report structure on day 1.
   - **Rough Effort:** Small (1–2 days). Update `registerRecruiter` to initialize `credits: 2` and seed an interactive sample candidate doc.

2. **Overhaul the Public Landing Page (`LandingPage.tsx`)**
   - **Why:** High-converting B2B SaaS needs clear value framing. Add:
     - Hero with clear value statement ("Screen cognitive ability and emotional intelligence in 12 minutes").
     - Visual mockup/interactive preview of the Candidate Intelligence Card & Interview Prompts.
     - Transparent pricing teaser (€5/candidate, no subscriptions).
     - Direct nav links: "Features", "Science", "Pricing", "Recruiter Guide", "Log In", "Get Started (2 Free Credits)".
     - Greek & English market-tailored messaging for SMBs.
   - **Rough Effort:** Medium (2–3 days).

3. **Fix Interview Prompt Generation Thresholds (`CandidateDetailPage.tsx`)**
   - **Why:** Major product bug that produces incorrect interview guidance for top candidates. Subscales on a 4–20 range should trigger low-score probes only when `<= 12` (below median) or `<= 10` (low), not `< 20`.
   - **Rough Effort:** Very Small (1 hour).

4. **Fix Credit Deduction & Abandonment Refund Architecture**
   - **Why:** Recruiter trust. Either (a) deduct credits upon assessment completion rather than link generation, or (b) fix `checkAbandonedSessions` to refund links with status `"Invited"` after 7 days of inactivity, and resolve candidate session IDs properly.
   - **Rough Effort:** Medium (2 days).

### Medium Priority

5. **Introduce Tiered Credit Packs on Pricing Page (`PaymentPage.tsx`)**
   - **Why:** Increase Average Order Value (AOV). Replace the bare stepper with 3 clear tiers:
     - *Single Role* (5 credits) — €25
     - *Active Hiring* (20 credits) — €80 (€4/credit, 20% discount)
     - *Agency Volume* (60 credits) — €199 (€3.30/credit, 34% discount)
     - Custom slider for 60+ credits.
   - **Rough Effort:** Small (1 day).

6. **Add One-Click CSV Export on Dashboard (`DashboardPage.tsx`)**
   - **Why:** Essential for recruiters managing multiple applicants per vacancy. Exporting candidate name, role, ICAR percentile, WLEIS total, SEA/OEA/UOE/ROE, fit badge, and integrity status directly to CSV.
   - **Rough Effort:** Small (1 day).

7. **Synchronize Psychometric Documentation & Recruiter Guide**
   - **Why:** Alignment across `PRODUCT_SHEET.md`, `RecruiterGuidePage.tsx`, and `functions/src/psychometrics.ts`. Clarify 5-point vs 7-point Likert and exact 16-item ICAR structure.
   - **Rough Effort:** Small (0.5 day).

### Low Priority

8. **Recruiter Notification Hooks (Email / Webhook on Completion)**
   - **Why:** Recruiters currently have to poll the dashboard. Sending an automated email notification via SendGrid/Nodemailer ("Candidate [Name] just completed their assessment for [Role] — view report") drives instant re-engagement.
   - **Rough Effort:** Medium (2 days).

9. **Customizable Benchmark Profiles by Job Category**
   - **Why:** Different roles demand different profiles (e.g. Customer Support demands high OEA/ROE; Quantitative Analyst demands top-decile ICAR). Allowing recruiters to select a role archetype would make the "Fit Badge" significantly more accurate.
   - **Rough Effort:** Large (1–2 sprints).

---

## What I would NOT change

1. **The Core Psychometric Pairing (ICAR-16 + WLEIS-16)**  
   Pairing cognitive problem-solving (fluid intelligence) with emotional intelligence appraisal is an exceptional, highly defensible differentiator. Most screening tools do one or the other. Combining both into a fast assessment provides genuine signal without applicant fatigue.

2. **Server-Side Parameterization & Anti-Cheat Architecture**  
   The decision to keep item templates, random seeds, and scoring keys strictly on Firebase Cloud Functions, returning only pre-rendered item instances to the client, is textbook security for an unproctored online assessment. Do not compromise this by pushing scoring logic to the frontend.

3. **Pay-As-You-Go Credit Model for SMBs**  
   Resist the urge to force SMB owners into €250/month recurring annual contracts. The pay-per-candidate credit model is preSift's biggest competitive wedge against enterprise monoliths (SHL, Wonderlic, TestGorilla). Keep pay-as-you-go as the entry door.

4. **Clean, Minimalist Dashboard and Candidate Drawer UX**  
   The candidate results view (percentiles, fit badges, domain breakdown cards, tab-blur integrity indicators) is clean, readable, and free of unnecessary clutter. It gives a non-technical hiring manager the exact 3 metrics they need in under 10 seconds.
