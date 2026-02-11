# Phase 5: Performance Optimization Checklist

**Goal**: Full analysis < 90 seconds. Parallelism intact, caching for seed data, DB pooling, optimized screenshots and blob serving.

Reference: `docs/CURSOR-AGENT.md`, `MVP-PLAN.md` § Phase 5

---

## 5.1 Promise.all Parallelism

**Files**: `lib/pipeline/analyze.ts`, `lib/scoring/scorer.ts`, `lib/scraping/fetch-external-css.ts`

- [x] **Vision + Industry** – `analyze.ts`: `Promise.all([analyzeScreenshot, detectIndustry])` so Vision and industry detection run in parallel.
- [x] **Copy refresh ×3** – `analyze.ts`: `Promise.all([refreshCopy layout1, layout2, layout3])` so all three copy refreshes run in parallel.
- [x] **Scoring 8 dimensions** – `scorer.ts`: `Promise.all(DIMENSIONS.map(...))` so all 8 dimension scores are requested in parallel.
- [x] **External CSS fetch** – `fetch-external-css.ts`: `Promise.allSettled(toFetch.map(...))` for parallel stylesheet fetches.

**Verification**: Do not replace these with sequential awaits; keep independent work in `Promise.all` / `Promise.allSettled`.

---

## 5.2 In-Memory Caching (Industries / Templates / Rubric)

**Files**: `lib/cache/seed-cache.ts`, `lib/templates/selector.ts`, `lib/pipeline/analyze.ts`

- [x] **Cache module** – `lib/cache/seed-cache.ts`: In-memory cache for templates and industries (per-process; serverless = per instance). Rubric remains static in `lib/seed-data/scoring-rubric.ts`.
- [x] **Selector** – Uses `getCachedTemplateNames()`, `getCachedIndustryByName()`, `getCachedTemplatesByIds()` instead of direct Prisma in hot path.
- [x] **Pipeline** – Uses `getCachedTemplatesByNames()`, `getCachedFirstTemplate()` instead of `prisma.template.findMany` / `findFirst` for layout data.

**Verification**: Run an analysis and confirm template/industry reads hit cache after first load (no extra DB round-trips for seed data per analysis).

---

## 5.3 Database: Connection Pooling & N+1

**Files**: `.env.example`, `lib/prisma.ts`, `lib/pipeline/analyze.ts`, `lib/templates/selector.ts`

- [x] **DATABASE_URL params** – `.env.example`: `?connection_limit=1&connect_timeout=10` for serverless; comment documents PgBouncer if used.
- [x] **Single Prisma client** – `lib/prisma.ts`: Reuses one client via `globalForPrisma` in dev to avoid connection churn.
- [x] **No N+1** – Pipeline: one `analysis.create`, one `analysis.update`; template/industry data from cache. Selector fallback: one industry lookup + one template-by-IDs lookup from cache (no per-template queries in a loop).

**Verification**: No loops that call `prisma.*` inside; batch or cache used for templates/industries.

---

## 5.4 Screenshot Optimization & Blob Serving

**Files**: `lib/scraping/screenshot-compress.ts`, `lib/scraping/puppeteer.ts`, `lib/storage/netlify-blobs.ts`, `lib/pipeline/analyze.ts`, `app/api/blob/[key]/route.ts`

- [x] **Compression** – Screenshots converted to WebP (quality 85) via `compressScreenshotToWebP` (sharp); max dimensions 1280×800 (fit inside, no upscale).
- [x] **Blob key/upload** – `screenshotKey()` returns `.webp`; `uploadBlob(..., contentType)` used so stored blob is served as `image/webp`.
- [x] **Blob route cache headers** – `GET /api/blob/[key]`: `Cache-Control: public, max-age=31536000, immutable`; `Content-Type` set from extension (`.webp` → `image/webp`, `.png` → `image/png`).

**Verification**: Run analysis; confirm screenshot URL is `/api/blob/.../....webp` and response has `Cache-Control` and correct `Content-Type`.

---

## Target: Full Analysis < 90 Seconds

- Parallelism (Vision+Industry, 8 dimensions, 3× copy refresh) reduces wall-clock time.
- Caching avoids repeated DB reads for industries/templates.
- Connection limit and no N+1 keep DB fast and predictable.
- Smaller WebP screenshots reduce upload time and results-page load.

**Verification**: Time a full run from URL submit to “done”; aim for < 90s on a typical URL.

---

## Quick Reference

| Area            | Implementation |
|-----------------|----------------|
| Parallelism     | `Promise.all` Vision+Industry; 8 dimensions; 3× refreshCopy; `Promise.allSettled` CSS |
| Cache           | `lib/cache/seed-cache.ts` for templates + industries; rubric static |
| DB              | `connection_limit=1&connect_timeout=10`; single Prisma client; no N+1 |
| Screenshots     | WebP, 1280×800 max, sharp; blob route Cache-Control + Content-Type |
