# LinkedIn Content Creator — preSift review

Persona: LinkedIn Content Creator  
Specialization: B2B HR/Recruiter channel strategy, founder thought leadership, LinkedIn algorithm mechanics, contrarian hiring narratives, carousel copywriting

---

## What I inspected

- `src/pages/LandingPage.tsx` and `src/locales/en.json` / `gr.json` (value proposition framing)
- `src/pages/RecruiterGuidePage.tsx` (psychometric methodology, rules of use, interview philosophy)
- `src/pages/CandidateDetailPage.tsx` (dynamic behavioral interview prompts, ICAR/WLEIS scores)
- `docs/PRODUCT_SHEET.md`, `README.md`, `BLUEPRINT.md`
- Target market dynamics: Greek SME business owners, boutique European recruiters, US talent acquisition

---

## Findings

### 1. Massive Unmined Narrative: "ChatGPT Broke the Resume — Why Behavioral Signals Are All That's Left"
On LinkedIn right now, every recruiter and founder is inundated with AI-polished, buzzword-stuffed CVs.
- `src/pages/LandingPage.tsx` uses the bland headline: *"Beyond the resume: Precise metrics for cognitive power and human chemistry."*
- On LinkedIn, this fails to stop the scroll because it sounds like generic HR software brochure copy.
- The high-engagement LinkedIn angle is specific and confrontational: Candidates can generate a 10/10 CV with Claude or ChatGPT in 15 seconds. The resume is dead as a signal of competence. PreSift's true value is providing an un-gameable, 15-minute empirical test of how someone actually reasons and regulates emotion under time constraints.

### 2. High-Converting Content Asset Locked Inside Code (`CandidateDetailPage.tsx` L146–157)
In `CandidateDetailPage.tsx`, preSift generates dynamic behavioral interview questions based on WLEIS/ICAR scores:
- *"Tell me about a situation where you had to read the room and adjust your approach."* (OEA probe)
- *"Describe a time when you motivated yourself to complete a tedious task."* (UOE probe)
- *"Can you walk me through your step-by-step process for solving a completely new problem?"* (ICAR probe)
- This is LinkedIn gold! Recruiters love structured interview questions. Sharing real breakdowns of: *"Here are 4 questions you should ask in your next interview, and the exact psychometric subscales they test"* will drive 10x higher organic reach and saves than product announcements.

### 3. The "Anti-AI" Ethical Differentiator Is Missing from Public B2B Discussion
Under the incoming EU AI Act and growing recruiter fatigue, hiring managers are terrified of "AI video interviewers" and opaque screening algorithms that risk discrimination suits.
- preSift's strict architectural design is **deterministic Item Response Theory (IRT 3PL)** with verified psychometric norms, zero facial recognition, zero generative AI in the scoring loop, and zero automated rejection ("The human decides" — `RecruiterGuidePage.tsx` L80).
- This is an immense thought leadership wedge for Greek and EU LinkedIn. A post titled: *"Why we built an assessment platform without a single line of AI in the scoring engine"* positions preSift as the principled, compliance-proof alternative to reckless HR tech startups.

### 4. Absence of LinkedIn-Optimized Educational Carousels & Visual Hook Material
Text-only announcements have low dwell time compared to document posts (PDF carousels).
- The concepts in `RecruiterGuidePage.tsx` (the 4 branches of emotional intelligence: Self-Emotion Appraisal, Others' Emotion Appraisal, Use of Emotion, Regulation of Emotion) are perfect 7-slide educational carousels for talent leaders.
- PreSift currently produces zero social-native visual assets or bite-sized frameworks for founders hiring without an HR department.

### 5. Pricing Arbitrage Angle Is Not Being Exploited (€5 vs €200 Legacy Monopolies)
Independent recruiters and boutique agencies in Greece and Southern Europe cannot afford legacy enterprise contracts (e.g. SHL, Hogan, Thomas International requiring €3,000–€10,000 annual commitments).
- preSift's €5 pay-as-you-go credit pack is a disruptive price wedge.
- A LinkedIn story contrasting: *"Enterprise assessment tools charge €150/candidate and lock you into annual contracts. We made psychometric candidate pre-screening €5/test with no subscription"* directly addresses the solo recruiter's primary budget pain point.

---

## Prioritized recommendations

### High Priority

1. **Launch a Founder-Led "Anti-AI Pre-Screening" LinkedIn Thought Leadership Campaign**
   - **Why**: Captures high-authority B2B reach by challenging AI hype while establishing preSift's scientific credibility.
   - **Hook Variants**:
     - *Hook 1 (Bold Claim)*: *"Every candidate you interview this week applied with an AI-generated resume. Here is why the CV is officially dead."*
     - *Hook 2 (Contrarian Tech)*: *"We built an HR pre-screening engine in 2026. And we refused to put AI in the scoring loop."*
     - *Hook 3 (Specific Story)*: *"A founder told me yesterday: 'The candidate gave world-class answers on Zoom, but can't prioritize basic tasks on day three.' Here is what went wrong."*
   - **Core Message**: Rehearsed answers vs empirical problem-solving; why deterministic psychometrics (ICAR/WLEIS) give hiring managers objective signals before the interview.
   - **Effort**: Low (2 hours).

2. **Publish the "Structured Interview Prompt" Carousel Series**
   - **Why**: LinkedIn document posts (PDF carousels) generate 3x higher dwell time and bookmarking from HR professionals.
   - **Action**: Create a recurring 6-slide carousel format:
     - Slide 1: *"Stop asking 'What is your greatest weakness?': 5 high-signal interview questions based on emotional intelligence research."*
     - Slides 2–5: Deep dive into SEA, OEA, UOE, ROE with the exact prompts from `CandidateDetailPage.tsx` and what answers indicate high vs low composure.
     - Slide 6: *"Want these generated automatically for every candidate you interview? Check the link in the comments."*
   - **Effort**: Medium (2–3 hours).

3. **Targeted Greek B2B Founder & Recruiter Content Pillar (Greek Language)**
   - **Why**: PreSift is launched Greece-first. Greek business founders and HR recruiters on LinkedIn are highly active and underserved by local HR tech content.
   - **Action**: Publish 2 Greek posts per week targeting Greek SMB owners (5–50 staff):
     - Focus: *«Πώς μια ελληνική μικρομεσαία επιχείρηση μπορεί να προσλάβει με τη μεθοδολογία πολυεθνικών χωρίς να πληρώσει χιλιάδες ευρώ.»* (How a Greek SME can hire with multinational rigor without enterprise software costs).
   - **Effort**: Low (1.5 hours/week).

### Medium Priority

4. **Develop the "€5 Candidate Screen" Disruption Case Study**
   - **Why**: Converts price-sensitive independent recruiters and agency owners into self-serve credit buyers.
   - **Action**: Write a breakdown post comparing the total cost of a bad hire (€15,000+ in severance and lost productivity) vs €5 pre-screening before the first interview round.
   - **Effort**: Low (1 hour).

5. **Create "Recruiter Guide" Teaser Snippets Linking to Public `/guide`**
   - **Why**: Drives high-intent inbound traffic from senior HR professionals seeking ethical hiring guidelines.
   - **Action**: Pull short rules from `RecruiterGuidePage.tsx` (e.g. *"Rule 1: preSift is never the sole criterion for hiring. The human always decides."*) into standalone thought leadership posts.
   - **Effort**: Low (1 hour).

### Low Priority

6. **Establish an Employee / Candidate Advocacy Angle**
   - **Why**: Expands brand reach among job seekers who appreciate fair, objective assessments over subjective recruiter bias.
   - **Action**: Share posts addressing candidate test anxiety: *"Why standard cognitive and emotional assessments are actually fairer to candidates than a 15-minute vibe check."*
   - **Effort**: Low (1 hour).

---

## What I would NOT change

1. **Do NOT Post Generic "HR Inspiration" or Motivational Quotes**
   - Avoid generic platitudes like *"Employees are a company's greatest asset"* or *"Hiring the right person is a journey"*. LinkedIn feeds are flooded with fluff. Keep PreSift's voice technical, analytical, data-driven, and focused on verifiable psychometric methodology.

2. **Do NOT Put External Links in the Post Body**
   - Always adhere to LinkedIn algorithm best practices: place the application link (`https://presift.web.app`) in the first comment or profile featured section to avoid feed reach suppression.
