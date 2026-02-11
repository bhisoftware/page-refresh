# V2 Directive: Replace Puppeteer with fetch() + Cloud Screenshot API

## Problem
The analysis pipeline fails on Netlify Pro (30s function timeout). Puppeteer + @sparticuz/chromium takes 15-20s just to boot Chrome and navigate, leaving insufficient time for AI calls. The pipeline needs 60-90s but only gets 30s.

## Solution
Replace Puppeteer with two lighter approaches:
1. **`fetch()`** for HTML/CSS retrieval (~2s instead of 15-20s)
2. **Cloud screenshot API** for the screenshot image (2-3s, runs in parallel with other steps)

Claude Vision stays — it provides valuable visual quality analysis. We just get the screenshot faster via an API instead of a local Chrome instance.

## Reference Codebase
Port scraping logic from: `/Users/dovidthomas/Desktop/downloads to organize/site-analyzer-tool/route.ts`

Key patterns from that codebase to adopt:
- `fetch()` with 15s timeout via `AbortSignal.timeout(15000)`
- Chrome User-Agent header for bot evasion
- Regex-based extraction (colors, fonts, meta, tech stack)
- External CSS fetch with 5s timeout per stylesheet (max 5)
- Graceful degradation when external CSS fails

## Updated Pipeline Flow
```
1. fetch() HTML+CSS + cloud screenshot API       (parallel, ~3s)
2. Extract assets + SEO audit + detect tech      (~1s)
3. Create DB record
4. Vision (screenshot) + Industry (HTML)          (parallel, ~12s)
5. Score 8 dimensions                             (parallel, ~11s)
6. Select templates + inject assets               (~3s)
7. Refresh copy x3                                (parallel, ~8s)
8. Upload screenshot + Update DB record           (~1s)
Total: ~30s (fits Netlify Pro timeout)
```

## Changes Required

### 1. New file: `lib/scraping/fetch-html.ts`
Replace Puppeteer-based HTML fetching with `fetch()`:
```typescript
export async function fetchHtml(url: string): Promise<{ html: string; url: string }>
```
- Use `fetch()` with 15s AbortSignal timeout
- Set User-Agent to Chrome browser string: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
- Set Accept header to `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- Handle errors: timeout → clear message, 403/captcha → "This website blocks automated access", DNS → "Could not reach website"
- Preserve the existing `validateUrlForScreenshot()` call for SSRF protection

### 2. New file: `lib/scraping/cloud-screenshot.ts`
Cloud screenshot API wrapper:
```typescript
export async function captureScreenshotCloud(url: string): Promise<Buffer>
```
- Use ScreenshotOne API (https://screenshotone.com) — simple REST API, generous free tier (100/mo), fast (~2-3s)
- API call: `GET https://api.screenshotone.com/take?url={url}&viewport_width=1440&viewport_height=900&format=png&access_key={SCREENSHOTONE_API_KEY}`
- Env var: `SCREENSHOTONE_API_KEY` (add to .env.local and Netlify)
- 10s timeout on the API call
- If screenshot API fails, return `null` (non-fatal — pipeline continues without Vision)
- Alternative services if ScreenshotOne doesn't work: urlbox.io, browserless.io, or screenshotapi.net

### 3. New file: `lib/scraping/tech-detector.ts`
Port tech stack detection from site-analyzer-tool:
```typescript
export interface TechStack {
  frameworks: string[];
  cms: string[];
  cssFrameworks: string[];
  analytics: string[];
}
export function detectTechStack(html: string): TechStack
```

Detection signatures:
- React/Next.js: `__NEXT_DATA__`, `_reactRootContainer`, `/_next/`
- Vue: `data-v-` attributes
- Angular: `ng-version`
- WordPress: `wp-content`, `wp-includes`
- Shopify: `cdn.shopify.com`
- Squarespace/Wix/Webflow: specific identifiers
- Tailwind: utility class patterns (`flex`, `grid`, `px-`, `py-`)
- Bootstrap: `bootstrap`, `container`/`row` patterns
- jQuery, GSAP, Google Analytics, GTM, Hotjar

### 4. Modify: `lib/pipeline/analyze.ts`
This is the main change.

**Remove imports:**
- `captureScreenshotWithFallback` from `fallback-scrapers`
- `compressScreenshotToWebP` from `screenshot-compress`

**Add imports:**
- `fetchHtml` from new `lib/scraping/fetch-html.ts`
- `captureScreenshotCloud` from new `lib/scraping/cloud-screenshot.ts`
- `detectTechStack` from new `lib/scraping/tech-detector.ts`

**Step 1 — Parallel fetch + screenshot:**
```typescript
onProgress?.({ step: "screenshot", message: "Fetching website..." });

const [{ html }, screenshotBuffer] = await Promise.all([
  fetchHtml(normalizedUrl),
  captureScreenshotCloud(normalizedUrl).catch(() => null), // non-fatal
]);
```

**Step 2 — Extract (unchanged except add tech detection):**
```typescript
onProgress?.({ step: "extract", message: "Extracting assets..." });
const inlineCss = extractInlineCss(html);
const externalCss = await fetchExternalCss(html, normalizedUrl, 3);
const css = [inlineCss, externalCss].filter(Boolean).join("\n");
const assets = extractAssets(html, css, normalizedUrl);
const techStack = detectTechStack(html);
```

**Step 3 — Create DB record (unchanged)**

**Step 4 — Vision + Industry parallel (conditional Vision):**
```typescript
onProgress?.({ step: "vision", message: "Analyzing design..." });
onProgress?.({ step: "industry", message: "Detecting industry..." });

const visionPromise = screenshotBuffer
  ? analyzeScreenshot(screenshotBuffer.toString("base64"), { ...promptLog, step: "screenshot_analysis" })
  : analyzeHtmlStructure(html, techStack, { ...promptLog, step: "html_structure_analysis" });

const [visionResult, industryResult] = await Promise.all([
  visionPromise,
  detectIndustry(html, { ...promptLog, step: "industry_detection" }),
]);
```

If screenshot was captured → use Claude Vision (best quality).
If screenshot failed → fall back to HTML structure analysis via Claude Text (still good).

**Step 5-7 — Scoring, templates, copy (unchanged)**

**Step 8 — Screenshot upload (conditional):**
```typescript
let screenshotUrl: string | null = null;
if (screenshotBuffer) {
  const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
  const blobKey = screenshotKey(analysisId, normalizedUrl);
  screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
}
```

### 5. New function: `analyzeHtmlStructure` in `lib/ai/claude-text.ts`
Fallback when screenshot is unavailable:
```typescript
export async function analyzeHtmlStructure(
  html: string,
  techStack: TechStack,
  promptLog?: PromptLogContext
): Promise<{ analysis: string }>
```
- Send HTML structure summary (first 5000 chars, heading hierarchy, tag counts, form/CTA presence) to Claude
- Include tech stack info for context
- Ask Claude to assess: layout quality, content organization, visual hierarchy signals, trust elements, conversion elements
- Returns `{ analysis: string }` matching the shape of `analyzeScreenshot()` output

### 6. Modify: `app/results/[id]/page.tsx`
Handle `screenshotUrl: null` gracefully — if no screenshot exists, don't show a broken image. The current page doesn't prominently display screenshots, so this may need minimal changes.

### 7. Update dependencies (package.json)
**Remove:**
- `puppeteer-core`
- `@sparticuz/chromium`

**Keep:**
- `sharp` (still used for WebP compression when screenshot IS available)

Run `npm install` after removing.

### 8. Environment Variables
**Add to .env.local and Netlify:**
- `SCREENSHOTONE_API_KEY` — get from https://screenshotone.com (free tier: 100 screenshots/month)

**Alternative (no API key needed):** Use a free/open screenshot service, or skip screenshots entirely and always use `analyzeHtmlStructure` fallback. The pipeline works either way.

### 9. Clean up files (optional, can defer)
These files become unused:
- `lib/scraping/puppeteer.ts` — can delete
- `lib/scraping/fallback-scrapers.ts` — can delete (logic moves to fetch-html.ts)

Keep for reference or delete — no functional impact.

## Testing Checklist
1. `npm run build` succeeds without Puppeteer/chromium
2. Local `npm run dev` → analyze example.com → completes in <30s
3. Deploy to Netlify → analyze a real URL → completes successfully within timeout
4. With screenshot API key: Vision analysis runs, screenshot shows in admin
5. Without screenshot API key: Falls back to HTML structure analysis, pipeline still completes
6. Results page renders correctly whether screenshotUrl is present or null
7. Admin dashboard shows prompt logs for all pipeline steps
8. Tech stack detection returns meaningful data for WordPress/Shopify/React sites
9. All 8 scoring dimensions still produce valid scores
10. Template selection and copy refresh still work
11. Error messages are clear when a site blocks fetch() (403, captcha, timeout)

## Architecture Principles
- Claude = all analysis (Vision OR HTML structure, industry, scoring, template selection)
- OpenAI = copy writing only (copy refresh for Design+Copy toggle)
- Analysis cannot fail — if fetch() fails, surface a clear error immediately (no 60s wait)
- Screenshot is a nice-to-have, not a hard dependency — pipeline degrades gracefully without it

## Performance Target
Total pipeline: <30 seconds on Netlify Pro
- fetch() + screenshot API: ~3s (parallel)
- AI calls: ~20s (with parallelism)
- DB + template operations: ~5s

---

# V2 Enhancements (build AFTER the pipeline fix is deployed and working)

Complete these in order. Each section is independent — deploy and verify before moving to the next.

## Enhancement A: 6 Layout Options (3 + "Show 3 More")

Currently the pipeline generates 3 layouts. Add support for 6 total with a progressive reveal.

### Schema Changes
Add to `Analysis` model in `prisma/schema.prisma`:
```prisma
layout4Html          String  @default("")
layout4Css           String  @default("")
layout4Template      String  @default("")
layout4CopyRefreshed String  @default("")
layout5Html          String  @default("")
layout5Css           String  @default("")
layout5Template      String  @default("")
layout5CopyRefreshed String  @default("")
layout6Html          String  @default("")
layout6Css           String  @default("")
layout6Template      String  @default("")
layout6CopyRefreshed String  @default("")
```
Run `npx prisma migrate dev --name add_layouts_4_5_6`.

### Pipeline Changes (`lib/pipeline/analyze.ts`)
- Change `selectTemplates()` to return 6 template names instead of 3
- Update `lib/templates/selector.ts`: change `valid.slice(0, 3)` → `valid.slice(0, 6)` and all `slice(0, 3)` references to `slice(0, 6)`
- Generate layouts 4-6 with asset injection (same pattern as 1-3)
- Run copy refresh for all 6 in parallel: `Promise.all([refresh1, refresh2, refresh3, refresh4, refresh5, refresh6])`
- Save all 6 layouts in the DB update

### Frontend Changes (`app/results/[id]/page.tsx`)
- Initially show only layouts 1-3
- Add a "Show 3 More Layouts" button below the first 3
- On click, reveal layouts 4-6 (client-side state toggle — data is already loaded)
- Track which layouts users interact with (expand, toggle copy) for future conversion analysis

### Component Changes
- Make the results page a client component wrapper or use a client component for the layout section
- Add state: `showMore: boolean`
- Button styling: secondary/outline, centered below the first 3 cards

## Enhancement B: Platform Exports

Add downloadable code packages for self-installers. Each layout can be exported for a specific platform.

### New file: `lib/exports/platform-exporter.ts`
```typescript
export type Platform = "squarespace" | "wordpress" | "wix" | "html";

export interface ExportResult {
  filename: string;       // e.g., "pagerefresh-layout1-wordpress.zip"
  buffer: Buffer;         // ZIP file contents
  contentType: string;    // "application/zip"
}

export async function exportLayout(
  platform: Platform,
  layoutHtml: string,
  layoutCss: string,
  templateName: string,
  metadata: { url: string; industry: string; score: number }
): Promise<ExportResult>
```

### Platform-specific export formats:

**HTML/CSS (Custom):**
- ZIP containing: `index.html`, `styles.css`, `README.md`
- README includes: "Generated by pagerefresh.ai", setup instructions, font/image references
- Self-contained — all CSS inline or in the single stylesheet
- Use `archiver` npm package for ZIP creation

**WordPress:**
- ZIP containing: `style.css` (with WP theme header), `index.php` (wraps the HTML), `functions.php` (enqueues styles), `screenshot.png` (if available), `README.md`
- Theme header: Theme Name, Description, Author (pagerefresh.ai), Version
- `index.php` uses `get_header()` / `get_footer()` WordPress functions wrapping the layout HTML
- Instructions in README for uploading via Appearance → Themes → Add New → Upload

**Squarespace:**
- ZIP containing: `template.html`, `styles.css`, `README.md`
- README explains Developer Mode setup: Settings → Advanced → Developer Mode → enable
- Instructions to paste HTML into Code Block or Custom Code injection
- CSS goes into Design → Custom CSS

**Wix (Velo/Corvid):**
- ZIP containing: `page.js` (Velo page code), `styles.css`, `README.md`
- README explains: Editor → Dev Mode → Enable, paste code into page, add CSS via Wix custom code
- `page.js` wraps the HTML in `$w.onReady()` pattern

### New API route: `app/api/export/route.ts`
```typescript
// POST /api/export
// Body: { analysisId, layoutIndex (1-6), platform, token }
// Returns: ZIP file as binary download
```
- Validate viewToken (same auth as results page)
- Load the requested layout HTML/CSS from the Analysis record
- Call `exportLayout()` with the platform
- Return the ZIP with `Content-Disposition: attachment; filename=...`

### Frontend: Export button on each LayoutCard
- Add a dropdown/select for platform (HTML, WordPress, Squarespace, Wix)
- "Download" button that triggers the export API
- Show a brief loading state while ZIP is generated
- Use `fetch()` + `URL.createObjectURL()` for client-side download

### Dependencies
Add to package.json:
- `archiver` (ZIP file creation)

## Enhancement C: Category-Specific Dimension Weighting

Currently all 8 dimensions are weighted equally in the overall score. Add industry-specific weights.

### Schema Changes
The `Industry` model already has `scoringCriteria JSONB`. Update the seed data to include weights.

### Update `lib/seed-data/industries.ts`
Add `dimensionWeights` to each industry's scoring criteria:
```typescript
dimensionWeights: {
  clarity: 1.0,
  visual: 1.0,
  hierarchy: 1.0,
  trust: 1.0,
  conversion: 1.0,
  content: 1.0,
  mobile: 1.0,
  performance: 1.0,
}
```

Example overrides:
- **Law Firms**: trust: 2.0, hierarchy: 1.5, clarity: 1.2
- **Restaurants**: visual: 2.0, mobile: 1.5, conversion: 1.3
- **E-commerce**: conversion: 2.0, mobile: 1.5, performance: 1.5
- **Healthcare**: trust: 2.0, clarity: 1.5, content: 1.3
- **Real Estate**: visual: 1.5, mobile: 1.5, conversion: 1.3
- **General Business** (default): all 1.0 (equal weight)

### Update `lib/scoring/scorer.ts`
- After scoring all 8 dimensions, load industry weights from cache (`getCachedIndustryByName`)
- Calculate weighted overall score: `sum(score[i] * weight[i]) / sum(weight[i])`
- Store both the raw dimension scores (unchanged) and the weighted overall score
- Include weight information in `scoringDetails` so the frontend can show "Trust is weighted 2x for law firms"

### Frontend: Show weight context
- In `ScoreBreakdown` component, show a small badge or note next to dimensions that are weighted above 1.0
- Example: "Trust & Credibility: 72/100 (weighted 2x for your industry)"

### Re-seed database
Run `npx prisma db seed` after updating industries to pick up new weights.

## Enhancement D: Deep SEO/LLM Optimization

Expand the existing `lib/seo/auditor.ts` from basic checks to a comprehensive audit.

### Expand `lib/seo/auditor.ts`
Add these checks to the existing `runSeoAudit()` function:

**Technical SEO:**
- Schema.org/JSON-LD structured data detection and validation
- Canonical URL presence and correctness
- Robots meta tag analysis
- Sitemap.xml reference check (in HTML or robots.txt patterns)
- Hreflang tags for multilingual sites
- Open Graph and Twitter Card meta completeness
- Page load hints: preconnect, prefetch, preload link tags

**Content SEO:**
- H1 count (should be exactly 1)
- Heading hierarchy (H1 → H2 → H3, no skips)
- Image alt text coverage (% of images with alt attributes)
- Internal vs external link ratio
- Content length assessment (word count)
- Keyword density in title, h1, meta description

**LLM Discoverability:**
- Structured data completeness for AI search (FAQ schema, HowTo schema, Product schema)
- Clear entity identification (business name, address, phone in structured data)
- Content structure that LLMs can parse (clear sections, descriptive headings)

### New: SEO recommendations in results
- Add `seoRecommendations` field to the Analysis model (JSONB, nullable) or include in existing `seoAudit` JSONB
- Generate prioritized recommendations: "Add schema.org LocalBusiness markup", "Add alt text to 8 images", etc.
- Show on results page in a collapsible "SEO Audit" section below the score breakdown

### Frontend: SEO section on results page
- New component: `SeoAuditSection.tsx`
- Collapsible/expandable section
- Show pass/fail checklist for each SEO check
- Prioritized recommendations with severity (critical, warning, info)

## Enhancement E: Peer Benchmarking

This is the largest enhancement. Build a benchmark database and add comparative scoring.

### New model: `Benchmark` in Prisma schema
```prisma
model Benchmark {
  id              String   @id @default(cuid())
  url             String
  industry        String
  overallScore    Int
  clarityScore    Int
  visualScore     Int
  hierarchyScore  Int
  trustScore      Int
  conversionScore Int
  contentScore    Int
  mobileScore     Int
  performanceScore Int
  scrapedAt       DateTime @default(now())

  @@index([industry])
  @@index([industry, overallScore])
}
```

### Seed script: `scripts/seed-benchmarks.ts`
- Define 10 best-in-class URLs per industry (20 industries × 10 = 200 sites for MVP, expand to 200 per later)
- For each URL: fetch HTML via `fetchHtml()`, run the scoring pipeline (industry detection + 8 dimensions), save to Benchmark table
- Run as a one-time seed script, not on every deploy
- Can be re-run periodically to refresh benchmarks

### Comparative scoring in pipeline
After scoring the user's site:
- Load benchmarks for the detected industry from DB
- Calculate percentile rank: "Your site scores higher than 30% of {industry} sites"
- Calculate dimension comparisons: "Your CTA friction is 2x higher than top performers"
- Store comparison data in `scoringDetails` or a new `benchmarkComparison` JSONB field

### Frontend: Benchmark context on results page
- Show percentile: "Your site ranks in the bottom 30% for your industry"
- Per-dimension comparison bars: your score vs industry average vs industry top 10%
- Specific callouts: "Top law firms score 85+ on Trust — you're at 45"

### Important: This runs as a background/cron job, NOT during user analysis
- The 200-site scraping is a batch operation
- User analysis only reads from the pre-computed benchmark table
- No impact on analysis pipeline performance

---

## Implementation Order

**Priority 1 — BLOCKING (production is broken):**
1. Pipeline fix: fetch() + cloud screenshot API (sections 1-9 above)
2. Deploy and verify analysis works on Netlify

**Priority 2 — Quick wins:**
3. 6 Layout Options (Enhancement A) — schema + pipeline + frontend
4. Category-Specific Weighting (Enhancement C) — seed data + scorer update

**Priority 3 — Medium effort:**
5. Platform Exports (Enhancement B) — new export system + ZIP generation
6. Deep SEO (Enhancement D) — expand existing auditor

**Priority 4 — Large effort (can defer):**
7. Peer Benchmarking (Enhancement E) — new model, seed script, comparative scoring

Deploy and verify after each enhancement. Do not bundle multiple enhancements into one deploy.
