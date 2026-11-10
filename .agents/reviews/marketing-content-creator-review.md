# Content Creator — preSift review

Persona: Content Creator  
Specialization: B2B SaaS messaging, value proposition framing, editorial narrative, localization voice & tone (EN/GR), candidate vs recruiter copy alignment

---

## What I inspected

- `src/pages/LandingPage.tsx` (hero, value prop, CTA messaging)
- `src/locales/en.json` and `src/locales/gr.json` (bilingual microcopy, hero variants, guide, candidate test instructions)
- `src/pages/RecruiterGuidePage.tsx` (in-app educational copy, FAQs, rules of use)
- `src/pages/RegisterPage.tsx` and `src/pages/PaymentPage.tsx` (conversion copy, onboarding text)
- `src/pages/ThankYouPage.tsx` (candidate completion messaging, GDPR actions)
- `docs/PRODUCT_SHEET.md`, `README.md`, `BLUEPRINT.md`

---

## Findings

### 1. Inconsistent Hero Fallbacks & Clunky Parentheticals in Greek (`src/pages/LandingPage.tsx`, `en.json`, `gr.json`)
- In `LandingPage.tsx` L22, the code fallback is `"Beyond the resume: "` while in `en.json` L47 it is `"Beyond speculations: "`. While both are defensible, having unsynchronized keys leads to copy drift.
- In `gr.json` L49, the Greek subtitle reads:
  `"Αξιολόγηση IQ & EQ σε 10 λεπτά. (IQ: Νοημοσύνη, EQ: Διαχείριση συναισθημάτων.)"`
  Inserting a literal dictionary definition inside parentheses inside the primary hero subhead completely degrades authority and punchiness. Greek business owners and hiring managers are familiar with IQ and EQ; treating them like beginners in the hero undermines B2B credibility.
- In English `en.json`, the subtitle claims `"10 minutes to measure IQ & EQ"`, yet `RecruiterGuidePage.tsx` L135 states `"How long does it take? About 15–20 minutes in total."` This duration mismatch causes immediate candidate friction and recruiter confusion.

### 2. Candidate vs Recruiter Copy Contradiction (`RecruiterGuidePage.tsx` vs `en.json`/`gr.json`)
In `RecruiterGuidePage.tsx` (L82 & L132):
- Rule 3: *"The candidate never sees scores. They see only a thank-you page; the interpretation is for you."*
- FAQ 1: *"Does the candidate see their score? No — only you do."*
Yet in `en.json` (L357–363) and `gr.json` (L357–363), the candidate test flow contains:
- `test_page.cal_summary`: *"Perceptual Calibration Summary"*
- `test_page.percent_correct`: *"{pct}% Correct"*
- `test_page.self_oea`: *"Self-Reported OEA Score:"*
- `test_page.calibrated_oea`: *"Calibrated OEA Score:"*
This is a severe content narrative contradiction. If recruiters are promised that candidate scores are strictly confidential, but candidate completion screens or test strings surface calibration scores, trust is broken.

### 3. Total Absence of Persona-Specific Problem/Solution Narratives
preSift has three core buyer personas, but addresses none of them on the public landing page:
1. **Small-business owner (5–50 staff, no dedicated HR)**: Overwhelmed by 40+ CVs for a store manager, operations, or sales hire. They fear hiring a candidate who interviews well but lacks practical reasoning or emotional composure under pressure. They need plain-spoken confidence: *"Cut screening time by 75%. Know how they solve problems and handle conflict before booking an interview."*
2. **Small-company HR / Talent Lead (1–3 staff)**: Needs objective, standardized screening data to present to busy founders without paying €5,000 enterprise annual contracts (SHL, Predictive Index).
3. **Independent recruiter / Agency recruiter**: Needs structured interview prompts and exportable client-ready candidate reports to justify their candidate placements.
Currently, the public copy talks only in abstractions: *"cognitive power and human chemistry"*.

### 4. Overly Clinical / Intimidating Candidate-Facing Language (`en.json` & `gr.json`)
The GDPR consent line in `en.json` L340 and `gr.json` L340 reads:
- EN: *"I agree to the processing of my responses for psychological and perceptual assessment."*
- GR: *"Συμφωνώ με την επεξεργασία των απαντήσεών μου για ψυχολογική και αντιληπτική αξιολόγηση."*
For job applicants, "psychological assessment" (*ψυχολογική αξιολόγηση*) sounds like a clinical psychiatric examination, raising test anxiety and drop-off rates. It should be framed as a workplace pre-screening evaluation (e.g., *"workplace reasoning and situational assessment"* / *"αξιολόγηση εργασιακών δεξιοτήτων και λογικής"*).

### 5. Untapped Positioning Differentiator: "Deterministic & Fair, Not AI Black-Box"
In the current recruitment market, candidates and employers are exhausted by unchecked, biased "AI resume screeners" and creepy video emotion scrapers.
- preSift's greatest commercial strength is that its scoring is **strictly deterministic, psychometrically normed (IRT 3PL + WLEIS), and privacy-first (no facial capture, no automated hiring rejection)**.
- Neither the landing page nor the marketing materials articulate this advantage. This represents a massive missed opportunity to frame preSift as the trustworthy, transparent alternative to AI hype.

---

## Prioritized recommendations

### High Priority

1. **Rewrite Hero & Subtitle Copy for Both English and Greek (`en.json`, `gr.json`)**
   - **Why**: Captures immediate buyer intent, removes amateurish parenthetical definitions, and synchronizes test duration facts.
   - **Action**:
     - **Greek Hero**:  
       Title: *"Προσλήψεις χωρίς εικασίες: Αξιολογήστε λογική σκέψη και εργασιακή χημεία."*  
       Subtitle: *"Επιστημονική προεπιλογή υποψηφίων σε 15 λεπτά. Αντικειμενικά δεδομένα και στοχευμένες ερωτήσεις συνέντευξης πριν την τελική επιλογή."*
     - **English Hero**:  
       Title: *"Beyond the resume: Objective pre-screening for reasoning and team chemistry."*  
       Subtitle: *"15-minute scientific candidate assessments. Actionable intelligence profiles and structured interview prompts before you hire."*
   - **Effort**: Low (1 hour).

2. **Add 3-Pillar "Why PreSift" Narrative to Landing Page (`src/pages/LandingPage.tsx`)**
   - **Why**: Educates SMB owners and recruiters on the tangible business benefits rather than scientific jargon.
   - **Action**: Introduce 3 content cards below the hero:
     1. **"See Through Polished CVs"**: Measure real problem-solving and emotional composure under pressure with validated tasks, not rehearsed answers.
     2. **"Walk Into Interviews Prepared"**: Get auto-generated, role-relevant interview questions tailored directly to where each candidate scored high or low.
     3. **"Pay Only For Who You Screen"**: Transparent €5 pay-as-you-go credits. No €5,000 annual software lock-ins.
   - **Effort**: Medium (2–3 hours).

3. **Reframe Candidate Consent Copy from "Psychological" to "Workplace Pre-Screening"**
   - **Why**: Lowers candidate drop-off and legal alarmism without reducing GDPR validity.
   - **Action**: Update `test_page.gdpr_consent_body` in both languages to:
     - EN: *"I consent to the processing of my responses for pre-employment workplace reasoning and situational assessment."*
     - GR: *"Συμφωνώ με την επεξεργασία των απαντήσεών μου για σκοπούς προεπιλογής και αξιολόγησης εργασιακών δεξιοτήτων."*
   - **Effort**: Low (0.5 hour).

4. **Craft the "Why We Don't Use AI" Trust Manifesto**
   - **Why**: Turns a technical constraint into an enterprise-grade ethical selling point.
   - **Action**: Add a dedicated copy section or trust badge: *"Science, Not AI: Scoring is 100% deterministic based on psychometric research (IRT 3PL). No black-box algorithms, no facial recognition, no automated rejection. The hiring decision stays in human hands."*
   - **Effort**: Low (1 hour).

### Medium Priority

5. **Create an Interactive / Visual "Sample Candidate Intelligence Report" Section**
   - **Why**: B2B buyers convert when they see what the deliverable looks like.
   - **Action**: Add an interactive accordion or visual mockup showcasing:
     - Candidate Fit Badge (e.g., "Strong Problem Solver / Moderate Emotion Regulation")
     - Cognitive Breakdown (Numerical, Verbal, Abstract)
     - Dynamic Interview Questions (e.g., *"Ask how they prioritize tasks when requirements shift abruptly"*).
   - **Effort**: Medium (3–4 hours).

6. **Harmonize Candidate Completion Screen Copy with Recruiter Guide Policy**
   - **Why**: Eliminates the contradiction where candidate screens show internal psychometric score labels.
   - **Action**: Ensure candidate thank-you screen displays only a supportive confirmation message (*"Thank you! Your responses have been sent to the hiring team"*), completely deprecating candidate-facing score readouts.
   - **Effort**: Low (1–2 hours).

### Low Priority

7. **Develop Downloadable "Modern Recruiter's Interview Playbook" Lead Magnet**
   - **Why**: Captures emails of Greek and EU HR managers searching for structured interview guides.
   - **Action**: Repurpose `RecruiterGuidePage.tsx` into a downloadable PDF guide: "The 15-Minute Screening Playbook: How to Structure High-Signal Interviews."
   - **Effort**: Medium (4–5 hours).

---

## What I would NOT change

1. **Do NOT Adopt Buzzword-Heavy "HR Tech" Jargon**
   - Avoid empty buzzwords like "paradigm shift in talent synergy", "AI-powered holistic talent discovery", or "next-gen neural hiring". Greek SMB owners are practical and cynical about corporate speak. Maintain a crisp, professional, evidence-based tone: "objective data", "real problem-solving", "structured interview questions".

2. **Do NOT Eliminate the Greek-First Localization Tone**
   - Keep Greek as the default first-class experience (`gr.json`). The Greek SME market has virtually zero localized psychometric pre-screening tools available at €5/credit. Treating Greek as a secondary translation would squander PreSift's strongest early market moat.
