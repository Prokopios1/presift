# SEO Specialist — preSift review

Persona: SEO Specialist  
Specialization: Technical SEO, crawlability, indexation architecture, internationalization (hreflang), search intent, structured data, Core Web Vitals

---

## What I inspected

- `index.html` (root HTML shell, document metadata, viewport, title tag)
- `public/` directory (robots.txt, sitemap.xml, static assets)
- `firebase.json` (hosting rewrites, headers, caching)
- `src/App.tsx` (routing architecture, route guards, title management)
- `src/pages/LandingPage.tsx`, `DemoPage.tsx`, `RegisterPage.tsx`, `PaymentPage.tsx`, `RecruiterGuidePage.tsx`, `ThankYouPage.tsx`
- `src/locales/en.json` and `src/locales/gr.json` (localized copy, landing metadata)
- `docs/PRODUCT_SHEET.md`, `README.md`, `BLUEPRINT.md`

---

## Findings

### 1. Hardcoded Non-Descriptive Root Metadata & Missing Meta Description (`index.html` L1–14)
The root `index.html` contains:
```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>presift-web</title>
  </head>
```
- `<title>presift-web</title>` is an internal repository artifact. It provides zero topical keyword signals to search engine algorithms and will display as an amateur snippet on Google SERPs.
- There is **no `<meta name="description">`**, no Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`), and no Twitter Card metadata.
- `<html lang="en">` is hardcoded to English despite Greek being the primary target market and the default UI locale in `I18nContext.tsx`.

### 2. Complete Absence of `robots.txt` and `sitemap.xml` (`public/`)
The `public/` directory contains only `favicon.svg` and `icons.svg`.
- **No `robots.txt` exists**: Crawlers (Googlebot, Bingbot) crawl without directives. Private application routes such as `/test/:id`, `/candidate/:id`, `/demo`, and `/thank-you` are not explicitly disallowed from search indexation.
- **No `sitemap.xml` exists**: Search engines rely purely on link discovery. Because preSift is a Single Page Application (SPA) with minimal internal public navigation, crawlers cannot discover public pages like `/pricing` or localized variants.

### 3. Missing Internationalized URL & hreflang Architecture (`src/contexts/I18nContext.tsx`, `src/pages/LandingPage.tsx`)
preSift switches languages purely through client-side state (`localStorage.getItem('language')` / React context).
- Both Greek and English versions share the identical URL path (`/`).
- Googlebot executes JavaScript without maintaining local storage or clicking language switchers; it crawls from US-based IPs with default headers. Consequently, Google will almost certainly only crawl and index the fallback version, completely ignoring the Greek landing page.
- There are no `<link rel="alternate" hreflang="el" ...>` or `<link rel="alternate" hreflang="en" ...>` tags, paralyzing organic search visibility in Greece (`google.gr`) for B2B queries like "αξιολόγηση υποψηφίων", "ψυχομετρικά τεστ προσλήψεων", and "προεπιλογή προσωπικού".

### 4. Extreme Thin Content on Landing Page (`src/pages/LandingPage.tsx` L18–44)
The public landing page is only 54 lines of code with roughly 35 words of text:
- One H1: "Beyond the resume: Precise metrics for cognitive power and human chemistry."
- One subtitle: "10 minutes to measure IQ & EQ. Zero guesswork."
- Zero H2 or H3 section headings, zero explanatory content describing the ICAR (cognitive reasoning) or WLEIS (emotional intelligence) methodology, zero feature overviews, zero pricing information, and zero FAQ items.
- Search engines cannot discern topical authority or search intent from 35 words. The page will be categorized as "thin content" or soft 404 territory for competitive B2B search terms.

### 5. High-Value Educational E-E-A-T Content Locked Behind Auth Guard (`src/App.tsx` L64)
In `src/App.tsx`:
```tsx
<Route path="/recruiter/guide" element={<RecruiterGuard><RecruiterGuidePage /></RecruiterGuard>} />
```
The Recruiter Guide (`RecruiterGuidePage.tsx`) contains the highest-quality, most authoritative content in the entire codebase:
- Explanations of ICAR cognitive reasoning tasks (numerical, verbal, abstract) and WLEIS emotional intelligence dimensions (SEA, OEA, UOE, ROE).
- Candidate communication templates and ethical compliance guidance (GDPR, non-diagnostic use, anti-bias principles).
- By gating this route behind `RecruiterGuard`, search engines cannot access or index it. This locks away hundreds of long-tail organic search opportunities for recruiters searching how to structure interview prompts and evaluate cognitive vs emotional intelligence.

### 6. Zero Structured Data (Schema.org / JSON-LD)
There is no JSON-LD structured data anywhere in the application.
- Lacks `SoftwareApplication` schema detailing preSift as a "BusinessApplication" / "HRApplication".
- Lacks `Organization` schema linking official brand entities, domain, and contact points.
- Lacks `FAQPage` schema which would allow rich snippets (collapsible Q&A) to dominate high-intent SERP real estate.

### 7. Static SPA Title Lack of Route-Level Updates
When a user or crawler navigates to `/pricing`, `/register`, or `/login`, the document title remains `presift-web` because there is no `<title>` mutation or `react-helmet-async` wrapper.
- All routes indexed by Google will compete under the identical generic title tag `presift-web`.

---

## Prioritized recommendations

### High Priority

1. **Fix Root Document Title, Meta Description & Social Graph in `index.html`**
   - **Why**: Essential baseline for search engines to understand the site's identity and prevent broken snippet rendering.
   - **Action**: Replace `presift-web` with `preSift | Psychometric Pre-Screening & Candidate Intelligence`. Add meta description: `"Streamline hiring with 10-minute scientific pre-screening. Evaluate cognitive reasoning and emotional intelligence before the first interview. Pay-as-you-go B2B testing."` Add Open Graph and Twitter meta tags.
   - **Effort**: Low (0.5 hour).

2. **Deploy `robots.txt` and `sitemap.xml` in `public/`**
   - **Why**: Prevents indexing of candidate test sessions (`/test/*`), candidate drawer links (`/candidate/*`), dev tools (`/demo`), and ensures clean crawl paths for public marketing pages (`/`, `/pricing`, `/register`, `/guide`).
   - **Action**: Create `public/robots.txt` allowing `/`, `/pricing`, `/register`, `/login`, `/guide` and disallowing `/test/`, `/candidate/`, `/demo`, `/thank-you`, `/admin`. Add `Sitemap: https://presift.web.app/sitemap.xml`. Create valid XML sitemap.
   - **Effort**: Low (1 hour).

3. **Expand Landing Page with Semantic Topical Content & FAQ (`src/pages/LandingPage.tsx`)**
   - **Why**: Cures the thin content penalty and provides keyword context for both Greek and English commercial queries.
   - **Action**: Add dedicated H2 sections:
     - "Scientific Assessment, Not Speculation" (explaining ICAR 3PL cognitive reasoning & WLEIS emotional intelligence).
     - "How preSift Works in 3 Steps" (Invite -> 10-min candidate assessment -> Scored profile & structured interview prompts).
     - "Transparent Pay-As-You-Go Pricing" (€5/candidate pack overview).
     - "Frequently Asked Questions" (GDPR compliance, test duration, candidate fairness, deterministic scoring without AI black-boxes).
   - **Effort**: Medium (3–4 hours).

4. **Make the Recruiter Guide Publicly Accessible at `/guide` (`src/App.tsx`)**
   - **Why**: Captures high-intent informational search volume from hiring managers researching interview questions and psychometric scoring.
   - **Action**: Move `RecruiterGuidePage` to a public route `/guide` (or keep `/recruiter/guide` public while showing an in-app wrapper for logged-in recruiters). Remove `RecruiterGuard` from the view route.
   - **Effort**: Low (1 hour).

### Medium Priority

5. **Implement Route-Level Dynamic Titles and Descriptions**
   - **Why**: Ensures distinct SERP entries for `/pricing` ("preSift Pricing — Simple €5 Credit Packs"), `/guide` ("Recruiter Guide — Candidate Psychometric Interpretation | preSift"), and `/register`.
   - **Action**: Use lightweight native title updater hook (e.g. `useEffect` setting `document.title` and `meta[name="description"]` based on current route and locale).
   - **Effort**: Low (1–2 hours).

6. **Add JSON-LD Structured Data to Landing & Guide Pages**
   - **Why**: Enables rich snippets in Google search results (pricing stars, software app badge, expandable FAQ questions).
   - **Action**: Inject `SoftwareApplication`, `Organization`, and `FAQPage` JSON-LD script blocks into the landing page.
   - **Effort**: Low (1.5 hours).

7. **Implement Language-Specific Canonical & hreflang URL Strategy**
   - **Why**: Google cannot differentiate Greek vs English content if both live under `https://presift.web.app/`.
   - **Action**: Support URL path prefixes or clean query parameters (e.g. `https://presift.web.app/?lang=el` and `https://presift.web.app/?lang=en`), with `<link rel="alternate" hreflang="el" href="https://presift.web.app/?lang=el" />` and `<link rel="alternate" hreflang="en" href="https://presift.web.app/?lang=en" />` tags.
   - **Effort**: Medium (2–3 hours).

### Low Priority

8. **Add Blog / Glossary Section for Psychometric Hiring Terms**
   - **Why**: Long-term topical authority building around terms like "ICAR cognitive test", "WLEIS emotional intelligence in hiring", "unstructured vs structured interview bias".
   - **Action**: Build lightweight markdown-driven educational repository under `/resources` or `/blog`.
   - **Effort**: High (8+ hours).

---

## What I would NOT change

1. **Do NOT Market or Tag as "AI"**
   - From an SEO perspective, trying to rank for generic hype keywords like "AI recruitment bot" or "AI candidate screening" would be a catastrophic positioning and compliance error. PreSift's scientific differentiator is **deterministic, psychometrically validated scoring (IRT 3PL + WLEIS)**. Target high-trust search clusters: "psychometric pre-screening software", "cognitive candidate testing", "structured interview prompt generator", "GDPR-compliant candidate assessment".

2. **Do NOT Introduce Server-Side Rendering (SSR) Migration Overhead Now**
   - While SSR (Next.js/Remix) is often recommended by SEO purists, modern Googlebot renders React SPAs effectively if prerendered HTML contains appropriate meta tags, clean crawlable `<a>` links, and text-rich DOM trees. Migrating away from Vite + Firebase Hosting would introduce massive architectural complexity with minimal early SEO gain compared to fixing copy, sitemaps, and metadata.

3. **Do NOT Disallow `/pricing` in robots.txt**
   - Many B2B SaaS sites mistakenly hide pricing behind login or noindex it. PreSift's €5/credit transparent model is a major search conversion hook for SMBs searching for affordable pre-screening tools. Keep `/pricing` publicly crawlable and indexable.
