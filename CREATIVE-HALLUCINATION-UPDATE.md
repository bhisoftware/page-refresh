# Creative Agent Hallucination: Investigation & Enhancement Roadmap

**Date:** 2026-03-02
**Trigger:** Analysis of revivediesel.com — all three creative agents invented fake business names ("DieselPro", "DieselShop Pro") and produced SaaS landing pages instead of a diesel repair shop site.

---

## Table of Contents

1. [Investigation Findings](#investigation-findings)
2. [Immediate Fix: Business Name + Data Quality](#immediate-fix)
3. [Data Extraction Issues](#data-extraction-issues)
4. [Pipeline Data Flow Issues](#pipeline-data-flow-issues)
5. [Score Agent Hallucination Risks](#score-agent-hallucination-risks)
6. [Creative Agent Output Validation](#creative-agent-output-validation)
7. [HTML/CSS Fetching Reliability](#htmlcss-fetching-reliability)
8. [Asset Download & Storage](#asset-download--storage)
9. [Deep Dive: SPA Rendering Solution](#deep-dive-spa-rendering-solution)
10. [Deep Dive: Score Agent Validation](#deep-dive-score-agent-validation)

---

## Investigation Findings

### What happened with revivediesel.com

The site is a React SPA (Vite + React). The HTML body is `<div id="root"></div>` plus scripts — all content renders client-side.

**What the pipeline extracted:**
- `extractedCopy.h1`: "Complete shop management system for diesel mechanics" (meta description fallback — not the real headline)
- `seoAudit.titleTag`: "Revive Diesel Mechanic" (correct, but never forwarded to creative agents)
- `brandAnalysis.qualityScore`: 2 (screenshot analysis basically failed)
- Logo: null, Hero image: null, Site images: 0, Nav links: 0

**What creative agents received:**
```json
{
  "industry": "Auto Repair",
  "brandAssets": {
    "logoUrl": null,
    "heroImageUrl": null,
    "siteImageUrls": [],
    "navLinks": [],
    "copy": { "h1": "Complete shop management system for diesel mechanics" }
  }
}
```

**What creative agents produced:**
- Modern: "DieselPro" (11 occurrences)
- Classy: "DieselShop Pro" / "DS"
- Unique: "DieselPro" (5 occurrences)
- All three built SaaS product pages, not a diesel repair shop site

**"DieselPro" exists nowhere in the codebase or input data** — it's a pure model hallucination. dieselpro.com is a real diesel parts shop, likely in Claude's training data.

---

## Immediate Fix

**Plan file:** `.claude/plans/linked-dazzling-truffle.md`

Four files, addressing 11 compounding issues:

1. **`lib/scraping/asset-extractor.ts`** — Add `businessName`/`titleTag` to `ExtractedCopy`; extract from `og:site_name` and `<title>` tag; remove meta-description-as-h1 fallback
2. **`lib/pipeline/agents/types.ts`** — Add `businessName` and `websiteUrl` to `CreativeAgentInput`
3. **`lib/pipeline/analyze.ts`** — Wire `resolveBusinessName()` cascade; add data quality assessment; append SPA warning to `contentDirection`
4. **`scripts/seed-agent-skills.ts`** — v8 → v9 prompts: add BUSINESS IDENTITY section, SPARSE DATA guidance, replace `[business name]` placeholder

---

## Data Extraction Issues

### DE-1: Meta description promoted to h1 (HIGH)
**File:** `lib/scraping/asset-extractor.ts` lines 475-476
**Problem:** When no h1/h2 exists, `<meta description>` becomes `copy.h1`. Meta descriptions are metadata, not headlines. For revivediesel.com, this turned "Complete shop management system for diesel mechanics" into the h1, causing the entire pipeline to misunderstand the business.
**Fix:** Remove the metaDesc and ogTitle fallbacks from the h1 chain. Leave `copy.h1` as undefined when no real heading exists.

### DE-2: No `businessName` field (HIGH)
**File:** `lib/scraping/asset-extractor.ts` line ~131
**Problem:** `ExtractedCopy` has h1, h2, heroText, navItems, ctaText, bodySamples — but no business name. Creative agents must guess it.
**Fix:** Add `businessName` and `titleTag` fields. Extract from `og:site_name` > cleaned `<title>` tag.

### DE-3: Title tag not extracted for copy (MEDIUM)
**Problem:** The `<title>` tag ("Revive Diesel Mechanic") is captured by the industry/SEO agent but never stored in `ExtractedCopy` or forwarded to creative agents.
**Fix:** Store `titleTag` in `ExtractedCopy`.

### DE-4: Logo fallback uses first image (LOW)
**File:** `lib/scraping/asset-extractor.ts` lines 558-560
**Problem:** If no element with "logo" in alt/src is found, the first extracted image becomes the logo. This could be a team photo or product image.
**Suggestion:** Better heuristics — check for image in `<header>`, check for small dimensions typical of logos, check for link to homepage.

### DE-5: Image dimension filtering only checks HTML attributes (LOW)
**File:** `lib/scraping/asset-extractor.ts` lines 451-453
**Problem:** Only filters on `width`/`height` HTML attributes, which are often missing. CSS-sized images pass through unfiltered. Tiny favicons without explicit dimensions get included.

### DE-6: Color extraction can return empty (LOW)
**File:** `lib/scraping/asset-extractor.ts` lines 258-272
**Problem:** After filtering grays/whites, minimal-design sites may return 0-2 colors. Creative agents need 3-5 for good output. Currently the pipeline has a single hardcoded fallback: `#2d5016` (line 479 of analyze.ts).

---

## Pipeline Data Flow Issues

### PD-1: Industry/SEO titleTag not forwarded to creative agents (HIGH)
**File:** `lib/pipeline/analyze.ts`
**Problem:** `industrySeo.seo.titleTag` ("Revive Diesel Mechanic") is stored in `seoAudit` but never included in `creativeInput`. The correct business name was available but silently dropped.
**Fix:** Include in business name resolution cascade.

### PD-2: Domain/URL not passed to creative agents (MEDIUM)
**Problem:** `CreativeAgentInput` has no `websiteUrl` field. Creative agents can't reference the domain for footer/contact sections.
**Fix:** Add `websiteUrl` to the interface.

### PD-3: No quality gate before creative agents (HIGH)
**File:** `lib/pipeline/analyze.ts` lines 429-463
**Problem:** Zero validation of `creativeInput` before sending to models. The pipeline sends null logo, 0 images, 0 nav links, near-empty copy — and lets agents hallucinate.
**Fix:** Add data quality assessment that logs warnings and appends context to `contentDirection` when data is sparse.

### PD-4: No SPA detection (MEDIUM)
**Problem:** When the HTML body is essentially `<div id="root"></div>`, there's no warning or adaptation. The pipeline treats it like a normal page.
**Fix:** Detect sparse HTML (no h1, no images, no nav, no body samples) and flag as likely SPA.

### PD-5: Score agent contentDirection based on bad data propagates downstream (MEDIUM)
**Problem:** The score agent received the misleading meta description as h1, so its `contentDirection` told creative agents to build a SaaS product page. Fixing DE-1 (meta desc fallback) prevents this.

### PD-6: Asset URL staleness — presigned URLs expire in 1 hour (MEDIUM)
**File:** `lib/storage/s3.ts` lines 104-111
**Problem:** Presigned S3 URLs have 1-hour expiration. If creative agent generation stalls/retries, image URLs become 403. The `/api/blob/[key]` route regenerates presigned URLs, but creative agents receive direct S3 URLs.
**Suggestion:** Pass `/api/blob/` URLs instead of raw S3 presigned URLs to creative agents, or extend expiration.

---

## Score Agent Hallucination Risks

### SA-1: No numeric score validation (HIGH)
**File:** `lib/pipeline/agents/score.ts` line ~94
**Problem:** Score agent output is `safeParseJSON(text)` then cast to `ScoreAgentOutput` with zero validation. Scores outside 0-100 (or NaN) flow into the database and frontend.
**Fix:** Add bounds validation: `if (score < 0 || score > 100) throw`.

### SA-2: contentDirection is unvalidated free text (HIGH)
**Problem:** The `contentDirection` string is generated by the score agent with no constraints and passed directly to creative agents. The score agent could hallucinate recommendations about features, content, or strategies that have no basis in the extracted data.
**Example from revivediesel:** "Focus on practical benefits for diesel shop owners: streamlined operations, time savings, customer management, and revenue growth" — treating it as a SaaS product.

### SA-3: guidance strings in priorities — hallucination vector (MEDIUM)
**File:** `scripts/seed-agent-skills.ts` lines 112-119
**Problem:** The prompt says "write concrete design instructions" but never says "only reference data you received." Guidance strings can contain fabricated claims about testimonials, trust badges, FAQ sections, etc. that don't exist in the source data.
**Suggestion:** Add to score agent prompt: "Only reference design elements and content that are supported by the extracted data."

### SA-4: Empty benchmarks produce ungrounded creativeBrief (MEDIUM)
**File:** `lib/pipeline/agents/score.ts` lines 54-59
**Problem:** When benchmarks are empty (0 comparison sites), the score agent uses "general industry knowledge" which is effectively hallucination. It may fabricate industry averages, requirements, and comparisons.
**Suggestion:** When benchmarks=0, constrain the creativeBrief to only reference what was actually extracted.

### SA-5: industryRequirements and technicalRequirements are unconstrained (MEDIUM)
**Problem:** These string arrays are free-form. The score agent could recommend "HIPAA compliance badges", "real-time appointment booking", "Kubernetes orchestration" for a simple local business. These flow to creative agents and influence layout decisions.
**Suggestion:** Keep these fields but add a prompt constraint: "Only list requirements that are standard for this industry type and achievable with a static landing page."

### SA-6: strengths array with no source validation (LOW)
**Problem:** Score agent can fabricate strengths like "Exceptional brand consistency across all touchpoints" for a site with almost no extractable content.

### SA-7: scoringDetails recommendations are displayed to users (MEDIUM)
**Problem:** Hallucinated recommendations in `scoringDetails[].recommendations[]` are stored in the DB and shown on the results page. Users see AI-generated advice that may not be grounded in their actual site.
**Note:** This is somewhat expected behavior for an AI analysis tool, but worth noting that recommendations can be speculative.

---

## Creative Agent Output Validation

### CO-1: No business name verification (HIGH)
**Problem:** After generation, there is zero check that the HTML uses the actual business name. The pipeline checks for score leakage but not semantic correctness.
**Suggestion:** Post-generation scan: extract text from `<title>`, `<nav>`, `<h1>` in the output and verify the business name appears. Log a warning if an unknown name is used.

### CO-2: No image URL verification (MEDIUM)
**Problem:** No check that `<img src>` attributes in the output match the provided URL list. The agent could invent image URLs that don't exist.
**Suggestion:** Extract all `src` attributes from output, check they're either from the provided list or are `#`/data URIs.

### CO-3: No placeholder/stock image detection (MEDIUM)
**Problem:** No scan for hallucinated stock image URLs (unsplash.com, pexels.com, pixabay.com, placeholder.com, via.placeholder.com).
**Suggestion:** Simple regex check on `<img src>` attributes for known stock domains.

### CO-4: Truncated HTML persisted silently (MEDIUM)
**File:** `lib/pipeline/agents/creative.ts` lines 101-106
**Problem:** When `stop_reason === "max_tokens"`, a warning is logged but the truncated HTML is persisted and displayed. Users see broken/incomplete layouts.
**Suggestion:** Either reject truncated output and retry, or add a visible warning on the results page.

### CO-5: Script injection relies on iframe sandbox (LOW for now)
**Problem:** Creative agent HTML is not sanitized. `<script>` tags execute inside the preview iframe because `allow-scripts` is needed for Tailwind CDN. Security relies entirely on iframe sandbox (no `allow-same-origin`).
**Note:** Acceptable for MVP since the iframe is sandboxed, but worth noting for future if layouts are ever served outside iframes.

### CO-6: No empty/minimal output detection (LOW)
**Problem:** An agent could return `<html><body></body></html>` (valid but empty) and it would pass all checks.

---

## HTML/CSS Fetching Reliability

### HF-1: SPAs return empty HTML shell (HIGH — root cause of revivediesel failure)
**File:** `lib/scraping/fetch-html.ts`
**Problem:** Standard HTTP fetch returns the unrendered HTML source. React/Vue/Angular SPAs return `<div id="root"></div>`. The Firecrawl fallback only triggers on 403/401 (bot blocked), not on "HTML is effectively empty."
**Suggestion:** Detect empty-body HTML (no `<h1>`, no `<p>` with >20 chars, no `<img>`) and trigger Firecrawl/headless rendering as fallback.

### HF-2: CSS import chains not followed (LOW)
**File:** `lib/scraping/fetch-external-css.ts`
**Problem:** Only inline `<style>` + 3 external stylesheets are fetched. If main CSS does `@import "theme.css"`, nested imports aren't followed. Brand colors in nested imports get missed.

### HF-3: Max 3 external stylesheets (LOW)
**Problem:** Hardcoded `maxSheets = 3`. Sites with Bootstrap + theme + vendor + custom CSS only get first 3.

### HF-4: No size limits on HTML/CSS fetch (LOW)
**Problem:** No max size on fetched HTML or CSS. A 50MB HTML page or large inline data URIs could cause memory issues.

### HF-5: Screenshot API silent failure (MEDIUM)
**File:** `lib/scraping/cloud-screenshot.ts` lines 34-47
**Problem:** Returns `null` on any error with minimal logging. Screenshot analysis still runs with HTML-only input, producing degraded results.

---

## Asset Download & Storage

### AD-1: No retry for transient failures (MEDIUM)
**File:** `lib/pipeline/asset-extraction.ts` lines 271-289
**Problem:** Single attempt per asset with 10s timeout. No exponential backoff for 5xx/timeout errors. A temporary CDN blip loses assets permanently.

### AD-2: Content-type mismatch on download (LOW)
**Problem:** If a server returns an HTML error page with 200 OK, it gets stored as an "image." No validation that downloaded bytes are actually image data.

### AD-3: Site images passed as raw URLs, not downloaded (MEDIUM)
**File:** `lib/pipeline/analyze.ts` lines 451-454
**Problem:** Only logo/hero/og_image/favicon get downloaded to S3. The `siteImageUrls` passed to creative agents are raw source URLs that may be CDN-cached with short TTLs, behind auth, or served with CORS restrictions.
**Impact:** Creative agent output contains URLs that may break when the layout is rendered.

### AD-4: No image deduplication (LOW)
**Problem:** srcset variants (1x, 2x, 3x of the same image) can end up as separate entries in `siteImageUrls`. Creative agents get 8 URL slots, some wasted on duplicates.

### AD-5: JUNK_URL_PATTERN too aggressive (LOW)
**File:** `lib/scraping/asset-extractor.ts` lines 410-411
**Problem:** Pattern filters out "badge" (excludes trust badges), "button" (excludes CTA images), "icon" (excludes service icons). These can be important content for certain industries (law firms, medical, finance).

---

## Priority Summary

### Must fix (causing user-visible hallucination now)
- **DE-1**: Meta description as h1 fallback
- **DE-2**: No businessName field
- **PD-1**: titleTag not forwarded
- **PD-3**: No quality gate before creative agents
- Immediate fix plan covers all of these

### Should fix soon (will cause issues at scale)
- **SA-1**: No score validation (0-100 bounds)
- **SA-2**: Unvalidated contentDirection
- **CO-1**: No business name verification in output
- **CO-2**: No image URL verification in output
- **CO-3**: No stock image detection
- **HF-1**: SPA detection + headless rendering fallback
- **PD-6**: Asset URL staleness

### Nice to have (quality improvements)
- **SA-3-7**: Score agent constraint improvements
- **CO-4**: Truncated HTML handling
- **AD-1-5**: Asset download reliability
- **HF-2-5**: Fetch robustness
- **DE-4-6**: Extraction edge cases

---

## Deep Dive: SPA Rendering Solution

### Current State

The HTML fetching pipeline has a two-tier strategy:
1. **Primary:** Plain `fetch()` with browser-like headers (15s timeout)
2. **Fallback:** Firecrawl, but only triggered on 403/401 (bot blocking)

For SPAs (React, Vue, Angular), the primary fetch returns the shell HTML (`<div id="root"></div>`) — all content renders client-side. The Firecrawl fallback never triggers because the server returns 200 OK.

Meanwhile, ScreenshotOne already renders the page fully (it's a headless browser service), so the screenshot is correct — but the HTML/copy/image extraction all operate on the empty shell.

### What already exists

- **Firecrawl SDK** (`@mendable/firecrawl-js` v4.15.0) — already a dependency with API key configured
- **Firecrawl supports JavaScript rendering** — `waitFor`, `actions` parameters can wait for React hydration
- **Tech detection** (`lib/scraping/tech-detector.ts`) — already detects React, Vue, Angular, Next.js, Nuxt, etc. from HTML patterns
- **SPA detection signals are available:** empty `<body>`, presence of `<div id="root">`, React/Vue framework markers

### Recommended: Enhanced Firecrawl Usage (Option 1)

**Why Firecrawl over Puppeteer/Playwright:**
- Already a dependency with configured API key
- No new infrastructure (Puppeteer adds ~250MB, serverless complications)
- Handles rendering, JavaScript execution, and waiting for hydration
- Costs ~$0.005/call — negligible at current volume

**Approach:**

```
fetchHtml(url)
  ├─ Plain fetch → got HTML
  │   ├─ Check: is HTML content-rich? (has <h1>, <p>, <img>)
  │   │   └─ Yes → return HTML
  │   └─ Check: is SPA detected? (React root, Vue app, etc.)
  │       └─ Yes → Firecrawl with JS rendering
  │           ├─ waitFor: 3000ms (hydration)
  │           └─ formats: ["rawHtml"]
  └─ 403/401 → Firecrawl (existing behavior)
```

**Implementation in `lib/scraping/fetch-html.ts`:**

After the primary fetch returns, check if the HTML looks like an SPA shell:
- No `<h1>`, no `<p>` elements with >20 chars, no `<img>` tags
- Framework markers present (React root div, Vue app mount, Angular `ng-version`)
- If so, re-fetch through Firecrawl with `waitFor: 3000` for JS hydration

The rendered HTML from Firecrawl replaces the shell HTML for all downstream processing — asset extraction, copy extraction, and agent input all benefit automatically.

**Key implementation details:**
- `lib/scraping/fetch-html.ts` — add SPA detection check after primary fetch, call Firecrawl with rendering options
- `lib/scraping/firecrawl-scrape.ts` — add new export `scrapeWithFirecrawlRendered()` that uses `waitFor` and `actions`
- `lib/scraping/tech-detector.ts` — already detects frameworks; add an `isSpaShell()` helper that checks for empty body + framework markers
- No changes needed downstream — all agents already accept full HTML

**Cost/performance impact:**
- Adds 3-5s per SPA site (Firecrawl wait + render time)
- ~$0.005 per SPA call
- At 100 SPA analyses/month: ~$0.50/month, ~5 min total added latency
- Non-SPA sites: zero impact (check is fast, no extra API call)

**What this fixes:**
- revivediesel.com would return full rendered HTML with real h1, nav items, images, copy
- All SPAs (React, Vue, Angular) would be properly analyzed
- Asset extraction, copy extraction, and creative agents all get real data

### Alternative considered: ScreenshotOne DOM export

ScreenshotOne already renders the page for screenshots. If their API supports DOM/HTML export alongside the PNG, we could get rendered HTML without an extra service call. Worth checking their docs, but Firecrawl is the safer bet since we know it works.

---

## Deep Dive: Score Agent Validation

### Current State

The score agent's output is parsed with `safeParseJSON()` and then cast directly to `ScoreAgentOutput` with **zero runtime validation**:

```typescript
const parsed = safeParseJSON(text);
if (!parsed.success || !parsed.data) throw new Error("Invalid JSON");
return parsed.data as ScoreAgentOutput; // ← no validation
```

This means: out-of-range scores, missing fields, empty guidance, hallucinated recommendations — all pass through silently.

### Existing strengths

The score agent **prompt** (v2 in `seed-agent-skills.ts`) already has good constraints:
- "DO NOT include scores, numbers, percentages in guidance text"
- "DO NOT reference 'userScore', 'industryAvg', 'gap'"
- "DO write concrete design instructions that a web designer would understand"
- Example/counter-example patterns provided

The issue is **enforcement** — the prompt constraints aren't validated after output parsing.

### Zod is already a project dependency

`zod` (v4.3.6) is already used in `lib/validations.ts` for API request schemas (`analyzeSchema`, `requestQuoteSchema`, etc.). Adding score output validation follows the existing pattern.

### Recommended: Three-tier validation

#### Tier 1: Zod schema validation (immediate)

Add to `lib/validations.ts`:

```typescript
export const scoreAgentOutputSchema = z.object({
  scores: z.object({
    overall: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100),
    visual: z.number().int().min(0).max(100),
    hierarchy: z.number().int().min(0).max(100),
    trust: z.number().int().min(0).max(100),
    conversion: z.number().int().min(0).max(100),
    content: z.number().int().min(0).max(100),
    mobile: z.number().int().min(0).max(100),
    performance: z.number().int().min(0).max(100),
  }),
  scoringDetails: z.array(z.object({
    dimension: z.string().min(1),
    score: z.number().int().min(0).max(100),
    issues: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  })),
  benchmark: z.object({
    hasData: z.boolean(),
    percentile: z.number().int().min(0).max(100).nullable(),
    dimensionComparisons: z.record(z.unknown()).nullable(),
  }).optional(),
  creativeBrief: z.object({
    priorities: z.array(z.object({
      dimension: z.string().min(1),
      userScore: z.number().int().min(0).max(100),
      industryAvg: z.number().int().min(0).max(100).nullable(),
      gap: z.number().nullable(),
      priority: z.number().int().min(1),
      guidance: z.string().min(5).max(500),
    })).min(1),
    strengths: z.array(z.string().min(3)).min(1),
    industryRequirements: z.array(z.string().min(3)).optional(),
    contentDirection: z.string().min(10).max(1000),
    technicalRequirements: z.array(z.string().min(3)).optional(),
  }),
});
```

**What this catches:** Missing fields, wrong types, out-of-range scores (0-100), empty guidance, overly long contentDirection.

**Implementation:** Update `score.ts` to use `scoreAgentOutputSchema.safeParse(parsed.data)` instead of the raw cast.

#### Tier 2: Semantic pattern validation (recommended)

Create `lib/pipeline/agents/score-validator.ts` with a function that checks the creative brief for prompt violations:

**Patterns to detect:**
- Score fractions in guidance text (`42/100`, `scored: 65`)
- Field name leakage (`userScore`, `industryAvg`, `gap`)
- Gap comparison language (`vs industry average`, `below benchmark`)
- Generic/empty guidance (`N/A`, very short strings)
- Overly specific claims not in input data (future)

**Behavior:** Log warnings but don't fail the pipeline. Use these logs to monitor prompt effectiveness across versions and identify when the score agent prompt needs tightening.

```typescript
function validateCreativeBriefSemantics(brief: CreativeBrief): string[] {
  const warnings: string[] = [];
  const prohibited = [
    /\b\d{1,3}\s*(?:\/|out of)\s*100\b/,
    /\b(?:scored|score)\s*[:=]?\s*\d/i,
    /(?:userScore|industryAvg|gap)\b/,
    /(?:vs|versus|compared to).*(?:industry|average|benchmark)/i,
  ];

  brief.priorities?.forEach((p) => {
    for (const pattern of prohibited) {
      if (pattern.test(p.guidance)) {
        warnings.push(`"${p.dimension}" guidance violates pattern: ${pattern}`);
      }
    }
  });
  return warnings;
}
```

#### Tier 3: Data grounding (future)

Check if guidance mentions features (testimonials, trust badges, video) that don't exist in the extracted data. This is harder to get right without false positives — defer until there's evidence it's a real problem.

### Implementation priority

1. **Tier 1 (Zod):** ~30 min, catches structural issues. Do alongside the immediate fix.
2. **Tier 2 (Semantic):** ~1 hour, catches guidance hallucinations. Do in the "should fix soon" phase.
3. **Tier 3 (Grounding):** Defer. Monitor Tier 2 warnings first to understand the real frequency of grounding issues.

### Files to modify

| File | Change |
|------|--------|
| `lib/validations.ts` | Add `scoreAgentOutputSchema` |
| `lib/pipeline/agents/score.ts` | Replace `as ScoreAgentOutput` cast with Zod validation |
| `lib/pipeline/agents/score-validator.ts` | New file — semantic validation function |

No changes needed to the score agent prompt — the constraints are already well-written. The issue is enforcement, not instruction.
