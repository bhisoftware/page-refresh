# Enhancement E: Peer Benchmarking (Admin-Managed)

## Problem
Users see their site's score (e.g. 38/100) but have no context for what "good" looks like in their industry. There's no way to answer "Is 38 bad for a law firm?" or "How do I compare to competitors?"

## Solution
Add a pre-scored reference table of quality websites per industry, managed by admins via the dashboard. When a user runs an analysis, the results page shows: "You're in the 30th percentile for Lawyers" and "Top law firms score 85+ on Trust — you're at 45."

## Key Design Principle
Benchmark URLs are **admin-managed** with full CRUD. Admins add/remove URLs, trigger scoring, and add notes/feedback through the admin dashboard. This is NOT a fire-and-forget batch script — it's a living, curated dataset.

**The benchmark scoring is a background admin operation — it does NOT run during user analysis.** User analysis only performs a read query against the pre-computed Benchmark table. Zero impact on pipeline performance.

---

## 1. Prisma Schema Changes

**File:** `prisma/schema.prisma`

### New model: Benchmark
```prisma
model Benchmark {
  id               String   @id @default(cuid())
  url              String
  industry         String
  overallScore     Int      @default(0)
  clarityScore     Int      @default(0)
  visualScore      Int      @default(0)
  hierarchyScore   Int      @default(0)
  trustScore       Int      @default(0)
  conversionScore  Int      @default(0)
  contentScore     Int      @default(0)
  mobileScore      Int      @default(0)
  performanceScore Int      @default(0)
  scoringDetails   Json     @default("[]")
  scored           Boolean  @default(false)
  scoredAt         DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  notes            BenchmarkNote[]

  @@index([industry])
  @@index([industry, overallScore])
}
```

### New model: BenchmarkNote
```prisma
model BenchmarkNote {
  id          String    @id @default(cuid())
  benchmarkId String
  benchmark   Benchmark @relation(fields: [benchmarkId], references: [id], onDelete: Cascade)
  authorName  String
  content     String    @db.Text
  category    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([benchmarkId])
}
```

### Add to existing Refresh model
```prisma
benchmarkComparison Json?  // { percentile, industryAvg, top10, dimensionComparisons[] }
```

Run: `npx prisma migrate dev --name add_benchmarks`

---

## 2. Admin API Routes

Follow existing patterns from `app/api/admin/analysis/*`. All routes use `isAdminAuthenticated()` from `lib/admin-auth.ts`. Do NOT create a new auth system.

### `app/api/admin/benchmarks/route.ts` — GET (list) + POST (create)

**GET** — Paginated benchmark list:
```
GET /api/admin/benchmarks?page=1&limit=50&industry=Lawyers
```
- `industry` param is optional filter
- Return: `{ items: Benchmark[], total, page, limit }`
- Include `_count: { notes: true }` for note count in list
- Order by `createdAt desc`

**POST** — Add a new benchmark URL:
```
POST /api/admin/benchmarks
Body: { url: string, industry: string }
```
- Validate with `benchmarkCreateSchema` (see section 4)
- Just saves the URL + industry — does NOT trigger scoring
- Return: created Benchmark object

### `app/api/admin/benchmark/[id]/route.ts` — GET + DELETE

**GET** — Full benchmark with notes:
```
GET /api/admin/benchmark/[id]
```
- Include: `{ notes: { orderBy: { createdAt: "asc" } } }`
- Return: full Benchmark object with notes array

**DELETE** — Remove benchmark:
```
DELETE /api/admin/benchmark/[id]
```
- Cascade deletes notes automatically (Prisma relation)
- Return: `{ ok: true }`

### `app/api/admin/benchmark/[id]/score/route.ts` — POST (trigger scoring)

```
POST /api/admin/benchmark/[id]/score
```

This runs the scoring pipeline for a single benchmark URL:

1. Load the benchmark record
2. Call `fetchHtml(benchmark.url)` — from `lib/scraping/fetch-html.ts`
3. Call `detectTechStack(html)` — from `lib/scraping/tech-detector.ts`
4. Build a brand analysis via `analyzeHtmlStructure(html, techStack)` — from `lib/ai/claude-text.ts`
5. Call `scoreWebsite({ industry, brandAnalysis, extractedCopy, seoAudit })` — from `lib/scoring/scorer.ts`
6. Update the Benchmark record with all scores + `scored: true` + `scoredAt: new Date()`
7. Return: updated Benchmark object

**Important:** The admin sets the industry when adding the URL. Do NOT run `detectIndustry()` — use the stored `benchmark.industry` for scoring context.

For `extractedCopy`, extract it from the HTML using `extractAssets()` from `lib/scraping/asset-extractor.ts`. For `seoAudit`, run `runSeoAudit(html)` from `lib/seo/auditor.ts`.

### `app/api/admin/benchmark/[id]/notes/route.ts` — POST (add note)

Same pattern as `app/api/admin/analysis/[id]/notes/route.ts`:
```
POST /api/admin/benchmark/[id]/notes
Body: { authorName: string, content: string, category?: string }
```
- Validate with `benchmarkNotesSchema`
- Create BenchmarkNote linked to benchmark
- Return: created BenchmarkNote

### `app/api/admin/benchmark/[id]/notes/[noteId]/route.ts` — PUT + DELETE

Same pattern as `app/api/admin/analysis/[id]/notes/[noteId]/route.ts`:

**PUT** — Update note content:
```
PUT /api/admin/benchmark/[id]/notes/[noteId]
Body: { authorName?, content?, category? }
```

**DELETE** — Remove note:
```
DELETE /api/admin/benchmark/[id]/notes/[noteId]
```

### `app/api/admin/benchmarks/score-all/route.ts` — POST (batch score)

```
POST /api/admin/benchmarks/score-all?force=false
```

- If `force=false` (default): score only benchmarks where `scored === false`
- If `force=true`: re-score all benchmarks
- Process **sequentially** (not parallel) to avoid API rate limits
- Return: `{ scored: number, failed: number, errors: string[] }`
- Each scoring follows the same pipeline as the single-score endpoint above

---

## 3. Admin Frontend Pages

### `app/admin/benchmarks/page.tsx` — Benchmark List

Follow the server component + direct Prisma query pattern from `app/admin/page.tsx`.

**Layout:**
- Page title: "Benchmarks"
- "Add Benchmark" form at top:
  - URL text input
  - Industry dropdown (use the 21 industries from `lib/seed-data/industries.ts` → `INDUSTRIES.map(i => i.name)`)
  - "Add" button
- "Score All Unscored" button (calls `/api/admin/benchmarks/score-all`)
- Table columns: URL, Industry, Overall Score, Scored (yes/no badge), Notes (count), Created
- Each row links to `/admin/benchmark/[id]`
- Pagination: PAGE_SIZE = 30

### `app/admin/benchmark/[id]/page.tsx` — Benchmark Detail

Follow the pattern from `app/admin/analysis/[id]/page.tsx`.

**Layout:**
- Back link to /admin/benchmarks
- URL + Industry display
- Score card: overall score with color coding (reuse `scoreColorClass` pattern)
- 8 dimension scores listed
- "Score" button (if unscored) or "Re-score" button (if already scored) — calls `/api/admin/benchmark/[id]/score`
- Last scored timestamp
- Notes section — adapt the `AdminNotesSection` component pattern for BenchmarkNote
  - Author name input, category dropdown, content textarea
  - Add/Edit/Delete notes
  - Same categories: review, sales, quality, follow-up
- "Delete Benchmark" button (with confirmation)

---

## 4. Validation Schemas

**File:** `lib/validations.ts`

Add these alongside the existing `adminNotesSchema`:

```typescript
export const benchmarkCreateSchema = z.object({
  url: z.string().url().min(1),
  industry: z.string().min(1).max(100),
});

export const benchmarkNotesSchema = z.object({
  authorName: z.string().min(1).max(100),
  content: z.string().min(1).max(10000),
  category: z.string().max(50).optional(),
});
```

---

## 5. Comparison Query in Pipeline

**File:** `lib/pipeline/analyze.ts`

After the scoring step completes and before the final DB update, add a **read-only** benchmark comparison:

```typescript
// Load benchmarks for comparison (read-only, does not slow pipeline significantly)
const benchmarks = await prisma.benchmark.findMany({
  where: { industry: industryDetected, scored: true },
  select: {
    overallScore: true,
    clarityScore: true,
    visualScore: true,
    hierarchyScore: true,
    trustScore: true,
    conversionScore: true,
    contentScore: true,
    mobileScore: true,
    performanceScore: true,
  },
});

let benchmarkComparison = null;
if (benchmarks.length >= 3) {
  // Calculate percentile: what % of benchmarks does this site beat?
  const beatCount = benchmarks.filter(b => b.overallScore < scoring.overallScore).length;
  const percentile = Math.round((beatCount / benchmarks.length) * 100);

  // Industry averages
  const avg = (key: string) => Math.round(
    benchmarks.reduce((sum, b) => sum + (b as any)[key], 0) / benchmarks.length
  );

  // Top 10% threshold
  const top10 = (key: string) => {
    const sorted = benchmarks.map(b => (b as any)[key]).sort((a: number, b: number) => b - a);
    return sorted[Math.max(0, Math.floor(sorted.length * 0.1))] ?? 0;
  };

  const dimensions = ['clarity', 'visual', 'hierarchy', 'trust', 'conversion', 'content', 'mobile', 'performance'] as const;

  benchmarkComparison = {
    percentile,
    sampleSize: benchmarks.length,
    industry: industryDetected,
    industryAvg: avg('overallScore'),
    top10Overall: top10('overallScore'),
    dimensions: dimensions.map(dim => ({
      dimension: dim,
      industryAvg: avg(`${dim}Score`),
      top10: top10(`${dim}Score`),
    })),
  };
}
```

Include `benchmarkComparison` in the final `prisma.refresh.update()` data.

**Only calculate when 3+ scored benchmarks exist** for the industry. Otherwise leave null (frontend handles gracefully).

---

## 6. Frontend: Benchmark Context on Results Page

### New component: `components/BenchmarkComparison.tsx`

**Props:**
```typescript
interface BenchmarkComparisonProps {
  comparison: {
    percentile: number;
    sampleSize: number;
    industry: string;
    industryAvg: number;
    top10Overall: number;
    dimensions: Array<{
      dimension: string;
      industryAvg: number;
      top10: number;
    }>;
  };
  userScores: Record<string, number>;  // { clarity: 25, visual: 72, ... }
  className?: string;
}
```

**Display:**
- Collapsible section header: "Industry Benchmark" (same pattern as SEO Audit section)
- Percentile headline: "Your site ranks in the **bottom 30%** for {industry}" or "top 20%"
- Sample size note: "Based on {sampleSize} {industry} websites"
- Per-dimension comparison: show user score vs industry average vs top 10% for each dimension
- Callouts for dimensions where user is significantly below average (e.g., >20 points below)

**Only render when `comparison` data exists.** Return `null` if no data.

### Modify: `app/results/[id]/page.tsx`

- Fetch `benchmarkComparison` from the refresh record
- Render `<BenchmarkComparison>` between the score breakdown and SEO audit sections
- Pass user's dimension scores alongside the comparison data

### Modify: `lib/utils.ts`

Add `benchmarkComparison` to `PublicRefresh` type and `serializeRefreshForPublic()`.

---

## 7. Seed Data (Optional Starting Point)

**File:** `scripts/seed-benchmarks.ts`

Insert 5-10 curated URLs per industry as unscored starting points. Admin can then score them via the dashboard and add/remove as needed.

Example structure:
```typescript
const BENCHMARK_URLS: Record<string, string[]> = {
  "Lawyers": [
    "https://www.morganandmorgan.com",
    "https://www.bakerlaw.com",
    // ... 3-8 more
  ],
  "Restaurants": [
    "https://www.sweetgreen.com",
    "https://www.chipotle.com",
    // ...
  ],
  // ... all 21 industries
};
```

Run as: `npx tsx scripts/seed-benchmarks.ts`

---

## Files to Create
- `app/api/admin/benchmarks/route.ts` — list + create
- `app/api/admin/benchmark/[id]/route.ts` — get + delete
- `app/api/admin/benchmark/[id]/score/route.ts` — trigger scoring
- `app/api/admin/benchmark/[id]/notes/route.ts` — add note
- `app/api/admin/benchmark/[id]/notes/[noteId]/route.ts` — update/delete note
- `app/api/admin/benchmarks/score-all/route.ts` — batch score
- `app/admin/benchmarks/page.tsx` — admin list page
- `app/admin/benchmark/[id]/page.tsx` — admin detail page
- `components/BenchmarkComparison.tsx` — results page comparison display
- `scripts/seed-benchmarks.ts` — optional starter URLs

## Files to Modify
- `prisma/schema.prisma` — add Benchmark, BenchmarkNote models + benchmarkComparison on Refresh
- `lib/validations.ts` — add benchmark Zod schemas
- `lib/pipeline/analyze.ts` — add benchmark comparison query after scoring
- `lib/utils.ts` — add benchmarkComparison to PublicRefresh
- `app/results/[id]/page.tsx` — render BenchmarkComparison component

## Files to Reuse (DO NOT recreate)
- `lib/admin-auth.ts` — `isAdminAuthenticated()` for all admin routes
- `lib/scraping/fetch-html.ts` — `fetchHtml()` for scoring benchmarks
- `lib/scraping/asset-extractor.ts` — `extractAssets()` for getting copy from HTML
- `lib/scraping/tech-detector.ts` — `detectTechStack()`
- `lib/seo/auditor.ts` — `runSeoAudit()` for benchmark scoring context
- `lib/ai/claude-text.ts` — `analyzeHtmlStructure()` for brand analysis (no screenshot needed for benchmarks)
- `lib/scoring/scorer.ts` — `scoreWebsite()` for benchmark scoring
- `lib/seed-data/industries.ts` — `INDUSTRIES` array for industry dropdown
- `app/admin/analysis/[id]/AdminNotesSection.tsx` — pattern reference for benchmark notes UI

---

## Testing Checklist
1. `npx prisma migrate dev --name add_benchmarks` runs clean
2. `npm run build` passes
3. Admin can navigate to `/admin/benchmarks`
4. Admin can add a URL + industry → appears in list as unscored
5. Admin can click into detail page → score the benchmark → scores populate
6. Admin can add/edit/delete notes on a benchmark
7. Admin can delete a benchmark (cascades notes)
8. "Score All Unscored" processes benchmarks sequentially without crashing
9. After 3+ scored benchmarks exist for an industry, new user analyses include `benchmarkComparison` data
10. Results page shows percentile and dimension comparisons when data exists
11. Results page hides benchmark section gracefully when no data exists
12. Old analyses without `benchmarkComparison` still render normally
13. Benchmark scoring does NOT affect user-facing pipeline performance (it's a separate admin action)
