# Phase 4 Handoff: Benchmarking Integration

> **Status:** Waiting for Phase 2 + 3 | **Created:** Feb 24, 2026
> **Executor:** Cursor | **Reviewer:** Claude Code
> **Prerequisite:** Phase 2 (pipeline writes `benchmarkComparison`) + Phase 3 (admin tabs exist)

---

## Goal

Build the benchmark admin CRUD, scoring pipeline, Score Agent enrichment, Creative Agent rationale display, and results page "why" explanations. Transform the output from "here are 3 designs" to "here are 3 designs backed by competitive data."

---

## Reference Documents

- `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` — **Primary spec.** Contains exact schema (already migrated in Phase 1), API routes, admin pages, comparison query, frontend component, and testing checklist. Follow this document closely.
- `PLANNING-PEER-BENCHMARKING-ADDITIONS.md` — Supplements Enhancement E with pipeline integration: benchmark data as Score Agent input, graceful degradation, rationale in creative output.

---

## 1. Benchmark Admin CRUD

**Follow `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` Sections 2–4 exactly.**

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `POST /api/admin/benchmarks` | POST | Add URL + industry |
| `GET /api/admin/benchmarks` | GET | Paginated list (filter by industry) |
| `GET /api/admin/benchmark/[id]` | GET | Full detail with notes |
| `DELETE /api/admin/benchmark/[id]` | DELETE | Remove (cascade notes) |
| `POST /api/admin/benchmark/[id]/score` | POST | Score single benchmark |
| `POST /api/admin/benchmark/[id]/notes` | POST | Add note |
| `PUT /api/admin/benchmark/[id]/notes/[noteId]` | PUT | Edit note |
| `DELETE /api/admin/benchmark/[id]/notes/[noteId]` | DELETE | Remove note |
| `POST /api/admin/benchmarks/score-all` | POST | Batch score unscored (sequential) |

### Scoring Pipeline (admin-triggered, NOT user-facing)

When admin triggers scoring for a benchmark URL:

1. `fetchHtml(benchmark.url)`
2. `detectTechStack(html)`
3. Extract CSS: `extractInlineCss(html)` + `fetchExternalCss(html, url, 3)`
4. `extractAssets(html, css, url)` — for copy extraction
5. `runSeoAudit(html)`
6. `analyzeHtmlStructure(html, techStack)` — brand analysis (no screenshot for benchmarks)
7. `scoreWebsite(...)` — using benchmark's stored `industry`
8. Update Benchmark with all scores, `scored: true`, `scoredAt: new Date()`

**Important:** Use the benchmark's stored `industry` — do NOT run `detectIndustry()`. Admin chose the industry when adding the URL.

**Batch scoring:** Process sequentially to avoid API rate limits. Return `{ scored: number, failed: number, errors: string[] }`.

### Admin Pages

**`/admin/benchmarks`** — Benchmark list
- "Add Benchmark" form: URL input + industry dropdown (21 industries)
- "Score All Unscored" button
- Table: URL, Industry, Overall Score, Scored badge, Notes count, Created
- Use `<AdminPagination>` from Phase 3 (50/100 page size)
- Lives under the "Benchmarks" tab (Phase 3 tab nav)

**`/admin/benchmark/[id]`** — Benchmark detail
- Score card with 8 dimensions + overall
- Score / Re-score button
- Notes section (same pattern as `AdminNotesSection` from analysis detail)
- Delete button with confirmation

### Validation Schemas

Add to `lib/validations.ts`:
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

## 2. Score Agent Benchmark Enrichment

Phase 2 already wires benchmark data into the Score Agent. Phase 4 ensures:

### Benchmark Query Timing
The benchmark DB read runs during Step 1 (parallel with agents) — ~5-20ms, ready before Score Agent executes in Step 2. **No added latency.**

### Score Agent Input Format
When calling the Score Agent, include benchmark context in the user message:

```
Benchmark context for {industry}:
- Sample size: {count} scored benchmarks
- Industry averages: clarity={avg}, visual={avg}, ...
- Top 10% thresholds: clarity={top10}, visual={top10}, ...

[If < 3 benchmarks:]
Limited benchmark data available ({count} sites). Use for directional guidance only. Rely primarily on absolute scoring and general industry knowledge.

[If 0 benchmarks:]
No benchmark data available for this industry. Score on absolute merit using general industry best practices.
```

### Graceful Degradation
| Benchmark Count | Score Agent Behavior |
|---|---|
| 3+ | Full gap analysis with percentiles |
| 1-2 | Partial: "Limited data — directional guidance" |
| 0 | Absolute scoring + general industry knowledge |

The Score Agent system prompt (seeded in Phase 1) already includes these three cases. Verify the prompt handles all three correctly.

---

## 3. benchmarkComparison on Refresh

Phase 1 added the `benchmarkComparison Json?` field. Phase 2 populates it. Phase 4 ensures the calculation follows Enhancement E Section 5 exactly:

```typescript
if (benchmarks.length >= 3) {
  const beatCount = benchmarks.filter(b => b.overallScore < scores.overall).length;
  const percentile = Math.round((beatCount / benchmarks.length) * 100);

  const avg = (key: string) => Math.round(
    benchmarks.reduce((sum, b) => sum + (b as any)[key], 0) / benchmarks.length
  );
  const top10 = (key: string) => {
    const sorted = benchmarks.map(b => (b as any)[key]).sort((a: number, b: number) => b - a);
    return sorted[Math.max(0, Math.floor(sorted.length * 0.1))] ?? 0;
  };

  benchmarkComparison = {
    percentile,
    sampleSize: benchmarks.length,
    industry,
    industryAvg: avg("overallScore"),
    top10Overall: top10("overallScore"),
    dimensions: ["clarity", "visual", "hierarchy", "trust", "conversion", "content", "mobile", "performance"].map(dim => ({
      dimension: dim,
      industryAvg: avg(`${dim}Score`),
      top10: top10(`${dim}Score`),
    })),
  };
}
```

Only calculated when 3+ scored benchmarks exist. Otherwise `null`.

---

## 4. Creative Agent Rationale Display

Phase 2 saves `layout1Rationale` / `layout2Rationale` / `layout3Rationale`. Phase 4 enriches these with benchmark-grounded language and displays them.

### Enrichment
The Score Agent's creative brief already contains benchmark gap data (priorities with `industryAvg`, `gap`, `guidance`). Creative Agents reference these in their `rationale` field. Example output:

> "This layout prominently features your credentials and client testimonials because top-performing law firm websites score 85+ on Trust — your current site scores 45. We prioritized closing that 40-point gap."

No additional AI call needed — the rationale comes from the Creative Agent's existing output.

### Results Page Display

**Modify:** `app/results/[id]/page.tsx`

For each layout card, if `layoutNRationale` is non-empty, render it below the layout preview:

```tsx
{rationale && (
  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
    <p className="text-sm text-muted-foreground font-medium mb-1">Design rationale</p>
    <p className="text-sm text-foreground">{rationale}</p>
  </div>
)}
```

### Fetch rationale in `getRefresh`

Add to the `select` in `app/results/[id]/page.tsx`:
```typescript
layout1Rationale: true,
layout2Rationale: true,
layout3Rationale: true,
benchmarkComparison: true,
```

---

## 5. Benchmark Comparison on Results Page

**Follow `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` Section 6 exactly.**

### New Component: `components/BenchmarkComparison.tsx`

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
  userScores: Record<string, number>;
  className?: string;
}
```

**Display:**
- Collapsible section (same pattern as SEO Audit)
- Percentile headline: "Your site ranks in the **bottom 30%** for {industry}"
- Sample size note: "Based on {sampleSize} {industry} websites"
- Per-dimension: user score vs industry average vs top 10%
- Callouts for dimensions >20 points below average

**Only render when `comparison` is not null.** Return `null` otherwise.

### Placement

Render between Score Breakdown and SEO Audit sections in results page.

### Add to PublicRefresh

If `lib/utils.ts` has a `PublicRefresh` type or `serializeRefreshForPublic()`, add `benchmarkComparison` and rationale fields.

---

## 6. Seed Benchmarks (Optional)

`scripts/seed-benchmarks.ts` — Insert 5-10 curated URLs per industry as unscored starting points.

```typescript
const BENCHMARK_URLS: Record<string, string[]> = {
  "Lawyers": [
    "https://www.morganandmorgan.com",
    "https://www.bakerlaw.com",
  ],
  "Restaurants": [
    "https://www.sweetgreen.com",
    "https://www.chipotle.com",
  ],
  // ... all 21 industries
};
```

Admin can then score them via the dashboard, add more, or remove.

---

## Files to Create

| File | Purpose |
|---|---|
| `app/api/admin/benchmarks/route.ts` | List + create benchmarks |
| `app/api/admin/benchmark/[id]/route.ts` | Get + delete benchmark |
| `app/api/admin/benchmark/[id]/score/route.ts` | Trigger scoring |
| `app/api/admin/benchmark/[id]/notes/route.ts` | Add note |
| `app/api/admin/benchmark/[id]/notes/[noteId]/route.ts` | Edit + delete note |
| `app/api/admin/benchmarks/score-all/route.ts` | Batch score |
| `app/admin/benchmarks/page.tsx` | Benchmark list page |
| `app/admin/benchmark/[id]/page.tsx` | Benchmark detail page |
| `components/BenchmarkComparison.tsx` | Results page comparison |
| `scripts/seed-benchmarks.ts` | Optional starter URLs |

## Files to Modify

| File | Change |
|---|---|
| `lib/validations.ts` | Add benchmark Zod schemas |
| `app/results/[id]/page.tsx` | Add BenchmarkComparison, rationale display, fetch new fields |
| `lib/utils.ts` | Add benchmarkComparison + rationale to PublicRefresh (if exists) |

---

## Testing Checklist

From Enhancement E + additions:

- [ ] Admin can navigate to `/admin/benchmarks` via tab
- [ ] Admin can add URL + industry → appears as unscored
- [ ] Admin can score a single benchmark → scores populate
- [ ] Admin can add/edit/delete notes on a benchmark
- [ ] Admin can delete a benchmark (cascades notes)
- [ ] "Score All Unscored" processes sequentially without crashing
- [ ] After 3+ scored benchmarks for an industry, new analyses include `benchmarkComparison`
- [ ] Results page shows percentile and dimension comparisons when data exists
- [ ] Results page hides benchmark section when no data exists
- [ ] Layout rationale renders below each layout card when non-empty
- [ ] Old analyses without benchmarkComparison still render normally
- [ ] Benchmark scoring does NOT affect user-facing pipeline performance
- [ ] Score Agent receives benchmark context and produces benchmark-enriched creative brief
- [ ] With 0 benchmarks: Score Agent works on absolute scores (no crash)
- [ ] With 1-2 benchmarks: Score Agent notes limited data
- [ ] `npm run build` passes
