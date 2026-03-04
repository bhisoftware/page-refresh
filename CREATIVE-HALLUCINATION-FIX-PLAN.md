# Fix: Creative Agent Hallucination from Missing Business Identity + No Quality Gates

## Context

For revivediesel.com (a React SPA), all three creative agents invented fake business names ("DieselPro", "DieselShop Pro") and built entirely fictional SaaS landing pages instead of a diesel repair shop site. Investigation revealed 11 compounding issues across data extraction, pipeline data flow, quality checks, and agent prompts.

**The creative agents received this input:**
- `copy`: `{"h1": "Complete shop management system for diesel mechanics"}` (meta description fallback — not the real headline)
- `logoUrl`: null, `heroImageUrl`: null, `siteImageUrls`: [], `navLinks`: []
- No business name, no URL, no real content at all
- `contentDirection`: "Focus on practical benefits for diesel shop owners: streamlined operations, time savings..." (score agent treated it as SaaS)

## Changes (4 files)

### 1. `lib/scraping/asset-extractor.ts` — Add business name extraction, fix meta-desc fallback

**a) Add fields to `ExtractedCopy` interface (~line 131):**
```typescript
businessName?: string;  // best-effort business name from og:site_name or <title>
titleTag?: string;      // raw <title> tag for downstream reference
```

**b) Extract business name in `extractAssets()` (~after line 469):**
- Extract `<title>` tag text and `og:site_name` meta tag
- Store raw title in `copy.titleTag`
- Derive `businessName` with priority: `og:site_name` > cleaned `<title>` (strip " | Home", " - Welcome", etc.)

**c) Remove meta description as h1 fallback (lines 475-476):**
Currently when no h1/h2 exists, `metaDesc` gets promoted to `copy.h1`. This is wrong — meta descriptions aren't headlines. For revivediesel.com, this caused the pipeline to think the business was a "shop management system."

Remove the `metaDesc` and `ogTitle` fallbacks. If no real h1/h2 exists, `copy.h1` stays `undefined`. The creative agents will handle missing h1 via the new SPARSE DATA prompt guidance.

### 2. `lib/pipeline/agents/types.ts` — Add fields to `CreativeAgentInput` (~line 138)

Add two required top-level fields:
```typescript
businessName: string;   // resolved business name (always provided, never null)
websiteUrl: string;     // the original URL being analyzed
```

### 3. `lib/pipeline/analyze.ts` — Wire business name, quality assessment, new fields

**a) Add `resolveBusinessName()` function (~after line 276):**

Priority cascade to always resolve a business name:
1. `extractedCopy.businessName` (from og:site_name or cleaned title tag)
2. `industrySeo.seo.titleTag` (cleaned — the industry-seo agent reads the full HTML)
3. `industrySeo.copy.headline` (AI-extracted headline)
4. Domain name, humanized (e.g., "revivediesel.com" → "Revivediesel")

This ensures `businessName` is always a non-empty string.

**b) Add data quality assessment (~before creativeInput construction):**

Lightweight check that logs a warning when data is sparse:
- Check: hasLogo, hasHeroImage, hasH1, hasNavLinks, imageCount, isSpaLikely
- `isSpaLikely`: true when no h1, no heroText, no navItems, and 0 images
- Log warning: `[pipeline] LOW DATA QUALITY for ${url}: missing logo, h1, navLinks (likely SPA)`

**c) Build `creativeInput` with new fields (~lines 429-463):**

Add `businessName` and `websiteUrl` to the input object.

When `isSpaLikely` is true, append a note to `designDirection.contentDirection`:
> "NOTE: This site's content is JavaScript-rendered. HTML extraction returned minimal data. Use the provided business name and industry. Keep the design simple rather than inventing content."

### 4. `scripts/seed-agent-skills.ts` — Update creative agent prompts to v9

Apply these changes to all three creative agents (modern, classy, unique):

**a) Bump version 8 → 9**

**b) Add BUSINESS IDENTITY section** (after "You receive a designDirection and REAL brand assets..." paragraph):
```
BUSINESS IDENTITY:
The input JSON includes "businessName" and "websiteUrl" at the top level.
- Use businessName as the company/brand name throughout (nav, hero, footer, copyright, alt text).
- Do not invent or guess a different business name.
- You may reference the domain from websiteUrl in footer or contact sections.
```

**c) Update CONTENT RULES** — change opening line from:
```
You are building a real website for a real business.
```
to:
```
You are building a real website for the business named in the businessName field.
Use this exact name — never invent or guess a different name.
```

**d) Replace `[business name]` placeholder in logo alt text:**
```
# FROM:
alt="[business name] logo"
# TO:
alt text should use the businessName field value (e.g., "Acme Corp logo")
```

**e) Add SPARSE DATA section** (after CONTENT RULES):
```
WORKING WITH LIMITED DATA:
When the source website yields little extractable content (JavaScript-heavy sites, new sites):
- Use businessName and industry to write a simple, honest landing page.
- Prefer fewer sections done well over many sections filled with invented content.
- A clean hero with the business name, an industry-appropriate tagline, and a contact CTA is better than a full page of fabricated copy.
- If navLinks are empty, use sensible defaults for the industry (e.g., Home, Services, About, Contact).
- If no images are available, use brand-colored gradients and strong typography. Do not invent image URLs.
```

## Issue Coverage

| # | Issue | Fix |
|---|-------|-----|
| 1 | No `businessName` in ExtractedCopy | Change 1a |
| 2 | Meta description used as h1 fallback | Change 1c |
| 3 | Title tag / og:site_name not extracted | Change 1b |
| 4 | Domain/URL not passed to creative agents | Changes 2 + 3c |
| 5 | titleTag from industry-seo not forwarded | Change 3a (cascade) |
| 6 | contentDirection based on misleading meta desc | Change 1c (removal prevents it) |
| 7 | No validation before creative agents | Change 3b (quality assessment) |
| 8 | No minimum data thresholds | Change 3b (logging + SPA flag) |
| 9 | No SPA detection | Change 3b + 3c (isSpaLikely + contentDirection note) |
| 10 | `[business name]` placeholder with no data | Changes 2 + 4d |
| 11 | No guidance for minimal-data scenarios | Change 4e |

## Execution Order

1. Change 1 (`asset-extractor.ts`) — data model + extraction
2. Change 2 (`types.ts`) — type interface
3. Change 3 (`analyze.ts`) — pipeline wiring
4. Change 4 (`seed-agent-skills.ts`) — prompts v9
5. Run `npx tsx scripts/seed-agent-skills.ts` to deploy v9 prompts

## Verification

1. Seed updated prompts: `npx tsx scripts/seed-agent-skills.ts`
2. Re-run analysis for revivediesel.com
3. Verify: business name resolves to "Revive Diesel Mechanic" (from title tag)
4. Verify: `copy.h1` is undefined (no real h1 in SPA HTML — no longer falls back to meta desc)
5. Verify: SPA warning appears in logs
6. Verify: all three layouts use "Revive Diesel Mechanic", not "DieselPro"
7. Spot-check a non-SPA site to confirm existing behavior isn't broken
