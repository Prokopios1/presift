# Growth Hacker — preSift review

Persona: Growth Hacker  
Specialization: Product-Led Growth (PLG), viral loops, conversion funnels, onboarding activation, customer acquisition economics (CAC:LTV), acquisition experimentation

---

## What I inspected

- `src/pages/LandingPage.tsx` (top-of-funnel acquisition, primary CTA)
- `src/pages/RegisterPage.tsx` (signup friction, form fields, post-registration routing)
- `src/pages/PaymentPage.tsx` & `functions/src/stripe.ts` (monetization friction, credit unit economics, promo mechanics)
- `src/pages/DemoPage.tsx` & `src/App.tsx` (demo accessibility, sandbox evaluation)
- `src/pages/ThankYouPage.tsx` (candidate completion touchpoint, missing referral hooks)
- `src/pages/CandidateDetailPage.tsx` (shareability, recruiter-to-client collaboration loops)
- `functions/src/index.ts` (`registerRecruiter`, `createAssessmentLink`)
- `docs/PRODUCT_SHEET.md`, `README.md`, `BLUEPRINT.md`

---

## Findings

### 1. Zero-Credit "Cold Start" Wall Kills Funnel Activation (`functions/src/index.ts` L205–215, `src/pages/DashboardPage.tsx`)
When a recruiter completes registration in `RegisterPage.tsx`, the backend assigns `credits: 0`.
- The user is redirected to `/dashboard`. When they click "Create Assessment Link" to try out the system, the platform immediately throws an error: `"Insufficient credits — top up this recruiter to create a link."`
- The user cannot experience the product's "Aha!" moment (generating a link, completing a test, seeing the scored profile and dynamic interview prompts) without pulling out a credit card on day one.
- In B2B SaaS, forcing upfront payment before first value results in a 70–85% drop-off between registration and first active usage.

### 2. Missing Public Interactive Demo / Production Demo Disabled (`src/App.tsx` L69, `DemoPage.tsx`)
In `src/App.tsx`:
```tsx
{import.meta.env.MODE !== 'production' && <Route path="/demo" element={<DemoPage />} />}
```
- The `/demo` route is completely disabled in production. Even in development, `DemoPage.tsx` is an internal test kit for mocking Firebase auth, not a prospective customer demo.
- Prospective buyers who land on `https://presift.web.app` have no interactive playground: they cannot test a 2-minute sample cognitive/emotional item, view a sample candidate intelligence profile, or see how structured interview prompts work in action.
- Requiring full account registration simply to see what preSift outputs chokes top-of-funnel conversion.

### 3. Missing Candidate-to-Employer Viral Loop on Completion (`src/pages/ThankYouPage.tsx` L50–65)
Every candidate who completes an assessment is an employed or actively job-seeking professional, many of whom are hiring managers, team leads, or executives at other companies.
- Currently, when a candidate finishes, `ThankYouPage.tsx` renders a barren screen:
  `"Your responses have been submitted successfully and will be reviewed by the recruiter. You may now close this window."`
  accompanied only by raw JSON download and delete buttons.
- There is **zero preSift branding**, no referral prompt, and no B2B acquisition hook. Compare this to classic PLG viral loops (Typeform's *"Create your own Typeform"*, Calendly's *"Easy scheduling with Calendly"*): every completed session is a free distribution impression completely wasted.

### 4. Buried €1 Promo Credit & Lack of Tiered Volume Bundles (`PaymentPage.tsx` L74–75, `stripe.ts` L31–33)
In `PaymentPage.tsx`:
```tsx
const isPromo = credits === 1;
const totalPrice = isPromo ? 1 : credits * UNIT_PRICE; // €1 for 1st credit, else €5/credit
```
- The backend and frontend technically support a €1.00 promotional single credit. However, this is **completely hidden from the user**.
- The payment page defaults to 5 credits (€25.00) on a basic numeric stepper. Neither the landing page nor the onboarding flow highlights: *"Try your first candidate assessment for just €1"*.
- Furthermore, the credit model is strictly linear (€5/credit). There are no pre-packaged volume tiers (e.g. 10 credits for €40 [save 20%], 50 credits for €175 [save 30%]). This suppresses Average Order Value (AOV) and provides zero incentive for high-volume recruiters to commit upfront capital.

### 5. No Recruiter-to-Client Share Loop for External Stakeholders (`CandidateDetailPage.tsx`)
Independent recruiters and staffing agencies pre-screen candidates specifically to present them to hiring clients.
- Currently, recruiters can only view results in their private dashboard or download a PDF.
- There is no **shareable, tokenized read-only link** (e.g. `presift.web.app/share/cand_abc123`) that a recruiter can send to a hiring manager to review the candidate's psychometric profile and interview prompts.
- A shareable candidate card would turn every candidate shortlist sent to a client into an inbound B2B lead generation touchpoint for preSift.

### 6. Five-Field Signup Form Causes Unnecessary Top-of-Funnel Drop (`RegisterPage.tsx` L17–23)
Registration demands 5 separate text fields upfront: Name, Email, Password, Company Name, and Job Title.
- There is no Google One-Tap or Google OAuth integration.
- For small business owners testing SaaS on mobile or between meetings, high form friction reduces landing-to-registration conversion.

---

## Prioritized recommendations

### High Priority

1. **Implement "1 Free Onboarding Credit" or "Test Yourself Sandbox"**
   - **Why**: Reaches the "Aha!" moment in under 3 minutes, unlocking the primary PLG activation loop.
   - **Action**: In `functions/src/index.ts` (`registerRecruiter`), grant `credits: 1` upon initial registration with an onboarding prompt: *"Send your first candidate assessment for free, or test yourself to see your own intelligence profile."*
   - **Effort**: Low (1–2 hours).

2. **Add "Powered by PreSift" Growth Loop on Candidate Thank-You Page (`ThankYouPage.tsx`)**
   - **Why**: Turns every screened candidate into an organic B2B acquisition channel with zero ad spend.
   - **Action**: Add an elegant footer banner below the completion card:
     *"Assessed with PreSift — Scientific, bias-free candidate pre-screening. Are you hiring for your team? Screen your first candidate for free."* with a direct tracking link (`?utm_source=candidate_thankyou`).
   - **Effort**: Low (1 hour).

3. **Promote the €1 Promo Hook as a Low-Barrier Acquisition Magnet**
   - **Why**: A €1 offer eliminates purchasing hesitation for price-sensitive SMB owners while validating payment credentials.
   - **Action**: Feature a badge on the landing page and registration confirmation: *"Get Started for €1: Test your next candidate with full cognitive & emotional profiling for €1.00 (regular €5.00)."*
   - **Effort**: Low (1 hour).

4. **Add an Interactive Sample Candidate Report on the Public Landing Page**
   - **Why**: Allows prospects to explore candidate scoring, fit badges, and dynamic interview questions without creating an account.
   - **Action**: Embed an interactive preview drawer featuring a fictitious profile ("Sample Candidate: Senior Account Manager") showcasing ICAR reasoning scores, WLEIS breakdown, and auto-generated interview questions.
   - **Effort**: Medium (3–4 hours).

### Medium Priority

5. **Package Pricing into Tiered Discount Bundles (`src/pages/PaymentPage.tsx`)**
   - **Why**: Increases Average Order Value (AOV) and accelerates cash collection.
   - **Action**: Replace the raw 1–200 stepper with 3 clickable package cards:
     - **Starter**: 5 Candidates — €25 (€5/cand)
     - **Growth**: 20 Candidates — €80 (€4/cand — Save 20%) *[Most Popular]*
     - **Agency / Scale**: 50 Candidates — €175 (€3.50/cand — Save 30%)
     - Custom input below for bespoke amounts.
   - **Effort**: Medium (2–3 hours).

6. **Create a Shareable "Client Review Link" for Independent Recruiters**
   - **Why**: Injects PreSift directly into client meetings between external recruiters and SMB business owners.
   - **Action**: In `CandidateDetailPage.tsx`, add a "Share Client Link" button generating a read-only public URL with preSift branding and a CTA: *"Powered by PreSift. Start pre-screening your applicants."*
   - **Effort**: Medium (3–4 hours).

7. **Implement Google OAuth / One-Click Signup (`RegisterPage.tsx`)**
   - **Why**: Reduces registration friction by 40% for business users utilizing Google Workspace.
   - **Action**: Add "Sign up with Google" button using Firebase `GoogleAuthProvider`.
   - **Effort**: Low (2 hours).

### Low Priority

8. **Automate Drip Email Triggers for Inactive Signups**
   - **Why**: Recovers registered recruiters who drop out before sending their first assessment link.
   - **Action**: Send an automated email 24h post-registration if `credits` remain unused, sharing a 3-minute video guide on how to interpret candidate fit scores.
   - **Effort**: Medium (4–6 hours).

---

## What I would NOT change

1. **Do NOT Shift from Pay-As-You-Go Credits to a Mandatory Monthly Subscription**
   - Traditional assessment platforms force €200–€500/month recurring contracts. For small businesses that hire only 2–4 times per year, monthly subscriptions cause immediate churn. The pay-as-you-go credit pack model is PreSift's most potent competitive advantage against incumbent HR platforms.

2. **Do NOT Gate Candidate Assessment Behind Account Creation**
   - The current zero-friction candidate experience (candidate clicks unique link -> accepts GDPR -> begins test immediately without registering an account) is essential. Introducing candidate login credentials would destroy test completion rates.
