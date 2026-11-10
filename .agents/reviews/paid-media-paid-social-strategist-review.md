# Paid Social Strategist — preSift review

Persona: Paid Social Strategist  
Specialization: Full-funnel paid social advertising (LinkedIn Campaign Manager, Meta Ads Manager), audience architecture, B2B conversion tracking, creative strategy & paid landing funnels

---

## What I inspected

- `index.html` and `src/App.tsx` (tracking pixel presence, tag manager hooks)
- `src/pages/LandingPage.tsx` (paid traffic destination suitability, conversion paths)
- `src/pages/RegisterPage.tsx` and `src/pages/PaymentPage.tsx` (signup and checkout conversion friction)
- `functions/src/stripe.ts` (`createCheckoutSession`, checkout redirect, webhook attribution)
- `src/pages/ThankYouPage.tsx` and `src/pages/DashboardPage.tsx` (post-conversion destinations)
- Target market dynamics: Greece (low CPM, founder-led SMBs) + US/EU (high intent recruiters)

---

## Findings

### 1. Zero Tracking & Measurement Infrastructure (`index.html`, `src/App.tsx`, `stripe.ts`)
A complete codebase audit reveals **zero tracking pixels or conversion analytics tags**:
- **No Meta Pixel (`fbq`)** or Meta Conversions API (CAPI).
- **No LinkedIn Insight Tag (`lintrk`)**.
- **No Google Tag Manager (GTM) or GA4 tag (`gtag`)**.
- **No conversion event dispatching**: When a user registers in `RegisterPage.tsx` or finishes a purchase via Stripe (`/dashboard?payment=success`), no custom events (`CompleteRegistration`, `InitiateCheckout`, `Purchase`) are triggered.
- **Verdict**: Launching paid ads today would burn 100% of the ad budget blind. Ad algorithms cannot optimize delivery, and ROAS / CPA attribution is impossible.

### 2. High-Bounce Landing Page Unsuitable for Cold Paid Social Traffic (`LandingPage.tsx`)
Paid social is an *interruption* channel: prospects are scrolling their feeds and click with high curiosity but a 5-second attention span.
- When an ad click lands on `https://presift.web.app`, the visitor sees 35 words of text, no screenshots of the dashboard or scored candidate profile, no client testimonials, no pricing details, and no proof of methodology.
- Paid traffic bounce rate on the current landing page will easily exceed **85–90%**.
- Cold social visitors need immediate visual proof: what the recruiter dashboard looks like, what dynamic interview questions look like, and how the €5 credit model works.

### 3. Six-Step Conversion Gauntlet Kills Paid ROAS
The current funnel from ad click to first paid conversion requires 6 distinct hurdles:
1. Paid ad click → Landing page (`/`)
2. Click "Get Started" → Register page (`/register`)
3. Fill 5 manual input fields (Name, Email, Password, Company, Job Title)
4. Land on `/dashboard` (with 0 credits)
5. Navigate to `/pricing`
6. Stepper selection → Redirect to Stripe checkout
In paid B2B marketing, each step between ad click and transaction cuts conversion by ~40%. An ad promoting "Screen your candidate for €1" or "€5 candidate pre-screening" must land either on a high-converting dedicated lander or utilize native on-platform Lead Gen Forms.

### 4. Meta "Special Ad Category (Employment)" Constraints
Because preSift is an employment/recruitment tool, running ads on Meta (Facebook/Instagram) in the US and parts of the EU requires declaring the **Special Ad Category: Employment**.
- This disables age, gender, and narrow postal code targeting.
- Meta campaigns must therefore rely on B2B interest layering (e.g. "Small business owner", "Recruitment", "HR Management") or broad Advantage+ targeting combined with highly specific ad creative copy that filters out job seekers and calls out hiring managers.

### 5. High-Impact Paid Creative Hooks Are Ready to Be Built
The core preSift value props translate seamlessly into high-performing B2B social ad creatives:
- **Pain Angle (Bad Hire)**: *"The CV looked perfect on paper. The interview seemed great. Two weeks in, they can't solve basic operational problems. Stop guessing — test reasoning in 15 minutes."*
- **Price Disruption Angle**: *"Why pay €150/candidate on annual enterprise assessment subscriptions? PreSift gives you scientific psychometric pre-screening for €5/candidate. Pay as you go."*
- **The Anti-AI Differentiator**: *"AI-written resumes have made CV screening useless. Screen actual cognitive reasoning with deterministic, GDPR-compliant psychometrics."*
- **Visual Asset**: Side-by-side screenshot showing a candidate's WLEIS score and the resulting structured interview prompt.

---

## Prioritized recommendations

### High Priority

1. **Install Tracking Infrastructure (LinkedIn Insight Tag & Meta Pixel via GTM)**
   - **Why**: Prerequisite for paid advertising. Allows ad algorithms to optimize for conversions and unlocks retargeting.
   - **Action**: Add Google Tag Manager (or native scripts) to `index.html`. Fire:
     - `PageView` on all route transitions
     - `CompleteRegistration` on `RegisterPage.tsx` submit success
     - `Purchase` with `{ value: totalPrice, currency: 'EUR' }` when `DashboardPage.tsx` detects `?payment=success`
   - **Effort**: Low (1.5 hours).

2. **Build a High-Converting Paid Landing Page (`/lp/prescreening`)**
   - **Why**: Directly addresses cold traffic skepticism and maximizes conversion rate per ad spend.
   - **Action**: Create a focused, distraction-free landing page with:
     - Sticky CTA: *"Get Started — 1st Candidate for €1"*
     - Visual mockup of the candidate scorecard and dynamic interview questions
     - 3-step timeline: Send link (1 min) → Candidate takes 15-min test → Recruiter gets scored intelligence profile
     - Trust badges: GDPR Compliant, Deterministic Science (No AI black boxes), €5 Pay-As-You-Go
   - **Effort**: Medium (3–4 hours).

3. **Deploy Greece-First Paid Pilot Campaign on LinkedIn & Meta**
   - **Why**: Greece has significantly lower CPMs than the US/UK, allowing rapid creative testing and feedback loops.
   - **Campaign Architecture**:
     - **LinkedIn Ads**: Sponsored Content + Document Carousel Ads targeting Greece: Job Titles: *"Founder"*, *"Owner"*, *"HR Manager"*, *"Recruiter"*. Budget: €25/day. Focus on B2B trust and structured interview prompts.
     - **Meta Ads (Facebook/Instagram)**: Advantage+ Lead Gen or Traffic campaigns targeting business page admins & SMB interests in Greece. CPMs in Greece average €4–€8 (vs $35+ in US). Budget: €15/day. Focus on the €1 trial / €5 pay-as-you-go hook.
   - **Effort**: Low (2 hours setup).

### Medium Priority

4. **Implement Native Lead Gen Forms for Frictionless On-Platform Capture**
   - **Why**: Avoids website bounce rates by allowing LinkedIn/Meta users to register in 2 taps using pre-filled profile data.
   - **Action**: Set up LinkedIn Lead Gen Forms offering a "Free Candidate Assessment Voucher" or "The 2026 Structured Interview Guide", automatically provisioning recruiter accounts via webhook.
   - **Effort**: Medium (3 hours).

5. **Establish 2-Tier Retargeting Funnel**
   - **Why**: Converts high-intent visitors who bounced before purchasing credits.
   - **Action**:
     - *Audience 1 (Site Visitors 30d)*: Ad showing candidate score drawer screenshot + headline: *"Screen your next hire for €1"*.
     - *Audience 2 (Registered Users with 0 Credits)*: Ad reminding them to send their first assessment link with dynamic interview prompts.
   - **Effort**: Low (1 hour).

### Low Priority

6. **Implement Server-Side Conversions API (Meta CAPI & LinkedIn CAPI)**
   - **Why**: Circumvents client-side ad blockers and Safari ITP tracking loss.
   - **Action**: Trigger conversion events directly from the Firebase Cloud Function Stripe webhook upon `checkout.session.completed`.
   - **Effort**: Medium (3–4 hours).

---

## What I would NOT change

1. **Do NOT Spend on Broad Awareness Campaigns (CPM/Reach Optimization)**
   - At this stage, preSift does not have brand budget to waste on general awareness or vanity video views. Every paid euro must be focused on performance marketing: Lead Gen Forms, website conversions, and direct signups.

2. **Do NOT Target Candidates or Job Seekers with Paid Social**
   - Candidates are the test-takers, not the buyers. Ad targeting must ruthlessly exclude job seekers by avoiding terms like "Take a psychometric test" or "Practice IQ test" which attract students and applicants instead of hiring managers.
