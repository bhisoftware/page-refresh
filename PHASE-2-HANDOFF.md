# Phase 2 Handoff: Pipeline Refactor

> **Status:** Waiting for Phase 1 | **Created:** Feb 24, 2026
> **Executor:** Cursor | **Reviewer:** Claude Code
> **Prerequisite:** Phase 1 complete (all models, libraries, seed data in place)

---

## Goal

Replace the current 14-call sequential pipeline with a 3-step agent architecture. Retire template composition and OpenAI copy refresh. All AI calls use Claude Sonnet with system prompts read from the `AgentSkill` DB table. Creative Agents output renderable HTML with real brand assets from URL Profiles.

**This is the high-risk phase.** After this, the app runs a fundamentally different pipeline.

---

## Current Pipeline (being replaced)

File: `lib/pipeline/analyze.ts`

```
fetchHtml + captureScreenshot (parallel)
  → extractInlineCss + fetchExternalCss + extractAssets + detectTechStack + runSeoAudit
  → prisma.refresh.create (preliminary)
  → analyzeScreenshot + detectIndustry (parallel) [2 Claude calls]
  → scoreWebsite — 8 dimensions parallel [8 Claude calls]
  → selectCompositions [1 Claude call] → composePage → injectAssets
  → refreshCopy × 3 [3 GPT-4o calls] → applyRefreshedCopy
  → compressScreenshot → uploadBlob
  → prisma.refresh.update (final)
```

**Total: ~14 AI calls, ~64 seconds**

## New Pipeline

```
Step 0: findOrCreateUrlProfile (normalize URL, check cooldown)
  → fetchHtml + captureScreenshot (parallel)
  → prisma.refresh.create (with urlProfileId)

Step 1 (Promise.all — 3 parallel):
  ├── Screenshot Analysis Agent [1 Claude call]
  ├── Industry & SEO Agent [1 Claude call]
  └── extractAndPersistAssets (no AI — HTML parse + file download + Blob upload)

Step 2 (sequential):
    Score Agent [1 Claude call]
    (receives Step 1 outputs + benchmark data from DB)

Step 3 (Promise.all — 3 parallel):
  ├── Creative Agent Modern [1 Claude call]
  ├── Creative Agent Classy [1 Claude call]
  └── Creative Agent Unique [1 Claude call]

Step 4: Save results
  → prisma.refresh.update (scores, layouts, rationale)
  → prisma.urlProfile.update (analysisCount++, latestScore, lastAnalyzedAt)
```

**Total: 6 AI calls, ~75s target (3 sequential windows × ~25s)**

---

## Detailed Implementation

### Step 0: URL Profile + Setup

```typescript
// 1. Normalize URL, find or create UrlProfile
const urlProfile = await findOrCreateUrlProfile(rawUrl);

// 2. Cooldown check
if (urlProfile.lastAnalyzedAt) {
  const minutesSince = (Date.now() - urlProfile.lastAnalyzedAt.getTime()) / 60000;
  if (minutesSince < 5) {
    // Return most recent Refresh for this profile — no new run
    const existing = await prisma.refresh.findFirst({
      where: { urlProfileId: urlProfile.id },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      // Emit SSE done event with existing refreshId/viewToken
      return existing;
    }
  }
}

// 3. Fetch HTML + screenshot (parallel, same as current)
const [html, screenshotBuffer] = await Promise.all([
  fetchHtml(rawUrl),
  captureScreenshotCloud(rawUrl),
]);

// 4. Create preliminary Refresh (for PromptLog FK)
const refresh = await prisma.refresh.create({
  data: {
    url: rawUrl,
    targetWebsite: rawUrl,
    urlProfileId: urlProfile.id,
    htmlSnapshot: html,
    cssSnapshot: "",
    // ... all required fields with defaults
  },
});
```

**SSE event:** `{ step: "started" }`

### Step 1: Parallel Analysis + Asset Extraction

```typescript
// Emit progress
emitProgress({ step: "analyzing", message: "Analyzing your website..." });

// Extract CSS first (needed for asset extraction)
const inlineCss = extractInlineCss(html);
const externalCss = await fetchExternalCss(html, rawUrl, 3);
const css = inlineCss + "\n" + externalCss;

// Load all agent skills in one query
const skills = await getAllActiveSkills();
const skillVersions: Record<string, number> = {};
skills.forEach(s => { skillVersions[s.agentSlug] = s.version; });

// 3 parallel operations
const [screenshotAnalysis, industrySeo, assetResult] = await Promise.all([
  runScreenshotAnalysisAgent(skills, html, screenshotBuffer, refresh.id),
  runIndustrySeoAgent(skills, html, css, refresh.id),
  extractAndPersistAssets(urlProfile, html, css, rawUrl, screenshotBuffer),
]);
```

**Agent call pattern (same for all agents):**

```typescript
async function runScreenshotAnalysisAgent(
  skills: AgentSkill[],
  html: string,
  screenshot: Buffer | null,
  refreshId: string
): Promise<ScreenshotAnalysisOutput> {
  const skill = skills.find(s => s.agentSlug === "screenshot-analysis")!;
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";

  // Build messages — vision if screenshot available, text-only fallback
  const messages = screenshot
    ? [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: screenshot.toString("base64") } },
        { type: "text", text: `Analyze this website screenshot and HTML structure.\n\nHTML (first 15000 chars):\n${html.slice(0, 15000)}` }
      ]}]
    : [{ role: "user", content: `Analyze this website HTML structure.\n\n${html.slice(0, 15000)}` }];

  const startMs = Date.now();
  const response = await withRetry(() =>
    client.messages.create({
      model,
      max_tokens: skill.maxTokens ?? 4096,
      temperature: skill.temperature ?? 0.1,
      system: skill.systemPrompt,
      messages,
    })
  );

  // Log to PromptLog
  await createPromptLog({
    refreshId,
    step: "screenshot_analysis",
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n" + (typeof messages[0].content === "string" ? messages[0].content : "[vision+text]"),
    responseText: extractText(response),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    responseTimeMs: Date.now() - startMs,
  });

  return safeParseJSON(extractText(response)).data as ScreenshotAnalysisOutput;
}
```

### Step 2: Score Agent

```typescript
emitProgress({ step: "scoring", message: "Scoring against industry benchmarks..." });

// Fetch benchmark data (fast DB read, ~5-20ms)
const industry = industrySeo.industry.name;
const benchmarks = await prisma.benchmark.findMany({
  where: { industry, scored: true, active: true },
  select: { overallScore: true, clarityScore: true, visualScore: true, hierarchyScore: true, trustScore: true, conversionScore: true, contentScore: true, mobileScore: true, performanceScore: true },
});

const scoreResult = await runScoreAgent(skills, {
  screenshotAnalysis,
  industrySeo,
  benchmarks,
  benchmarkCount: benchmarks.length,
}, refresh.id);
```

**Score Agent receives a structured input combining Step 1 outputs + benchmark data.** The prompt includes:
- Screenshot Analysis JSON output
- Industry & SEO JSON output
- Benchmark summary: count, industry averages per dimension, top-10% thresholds (if 3+)
- If < 3 benchmarks: note that data is limited

### Step 3: Creative Agents

```typescript
emitProgress({ step: "generating", message: "Generating 3 design options..." });

// Build the shared input for all 3 Creative Agents
const creativeInput = {
  creativeBrief: scoreResult.creativeBrief,
  industry,
  brandAssets: {
    logoUrl: assetResult.storedAssets.find(a => a.assetType === "logo")?.storageUrl ?? null,
    heroImageUrl: assetResult.storedAssets.find(a => a.assetType === "hero_image")?.storageUrl ?? null,
    colors: assetResult.assets.colors.map(c => c.hex),
    fonts: assetResult.assets.fonts.map(f => f.family),
    navLinks: assetResult.assets.copy.navItems ?? [],
    copy: assetResult.assets.copy,
  },
};

// 3 parallel Creative Agents with individual error handling
const creativeResults = await Promise.allSettled([
  runCreativeAgent(skills, "creative-modern", creativeInput, refresh.id),
  runCreativeAgent(skills, "creative-classy", creativeInput, refresh.id),
  runCreativeAgent(skills, "creative-unique", creativeInput, refresh.id),
]);

// Extract successful results
const layouts = creativeResults.map((r, i) => {
  if (r.status === "fulfilled") return r.value;
  console.error(`Creative agent ${i} failed:`, r.reason);
  return null;
});

const successCount = layouts.filter(Boolean).length;
if (successCount === 0) {
  throw new Error("All 3 Creative Agents failed. No layouts generated.");
}
```

### Step 4: Save Results

```typescript
// Build benchmarkComparison (same logic as Enhancement E Section 5)
let benchmarkComparison = null;
if (benchmarks.length >= 3) {
  // ... percentile + dimension comparison calculation
  // (see docs/ENHANCEMENT-E-PEER-BENCHMARKING.md Section 5 for exact logic)
}

// Map layouts to the existing layout1-3 columns
await prisma.refresh.update({
  where: { id: refresh.id },
  data: {
    // Scores
    overallScore: scoreResult.scores.overall,
    clarityScore: scoreResult.scores.clarity,
    visualScore: scoreResult.scores.visual,
    hierarchyScore: scoreResult.scores.hierarchy,
    trustScore: scoreResult.scores.trust,
    conversionScore: scoreResult.scores.conversion,
    contentScore: scoreResult.scores.content,
    mobileScore: scoreResult.scores.mobile,
    performanceScore: scoreResult.scores.performance,
    scoringDetails: scoreResult.scoringDetails,
    industryDetected: industry,
    industryConfidence: industrySeo.industry.confidence,
    brandAnalysis: JSON.stringify(screenshotAnalysis),
    seoAudit: industrySeo.seo,

    // Extracted assets (keep existing columns populated for backward compat)
    extractedColors: assetResult.assets.colors,
    extractedFonts: assetResult.assets.fonts,
    extractedImages: assetResult.assets.images,
    extractedCopy: assetResult.assets.copy,
    extractedLogo: assetResult.assets.logo ?? "",

    // Layouts — map to layout1/2/3, use empty string for failed agents
    layout1Html: layouts[0]?.html ?? "",
    layout1Css: "",  // CSS is inline in the HTML (Tailwind CDN)
    layout1Template: "Modern",
    layout1CopyRefreshed: layouts[0]?.html ?? "",
    layout1Rationale: layouts[0]?.rationale ?? "",

    layout2Html: layouts[1]?.html ?? "",
    layout2Css: "",
    layout2Template: "Classy",
    layout2CopyRefreshed: layouts[1]?.html ?? "",
    layout2Rationale: layouts[1]?.rationale ?? "",

    layout3Html: layouts[2]?.html ?? "",
    layout3Css: "",
    layout3Template: "Unique",
    layout3CopyRefreshed: layouts[2]?.html ?? "",
    layout3Rationale: layouts[2]?.rationale ?? "",

    // Screenshot
    screenshotUrl: screenshotUrl ?? null,

    // New fields
    skillVersions,
    benchmarkComparison,

    // Metadata
    processingTime: Math.round((Date.now() - startTime) / 1000),
  },
});

// Update UrlProfile
await prisma.urlProfile.update({
  where: { id: urlProfile.id },
  data: {
    analysisCount: { increment: 1 },
    lastAnalyzedAt: new Date(),
    latestScore: scoreResult.scores.overall,
    bestScore: Math.max(urlProfile.bestScore ?? 0, scoreResult.scores.overall),
    industry: urlProfile.industryLocked ? undefined : industry,
  },
});

emitProgress({ step: "done", refreshId: refresh.id, viewToken: refresh.viewToken });
```

---

## SSE Progress Events

### New step union

Replace the current granular steps with 4 user-facing messages:

| Step ID | Message | When |
|---|---|---|
| `started` | *(no message — triggers loading UI)* | Pipeline begins |
| `analyzing` | "Analyzing your website..." | Step 1 starts |
| `scoring` | "Scoring against industry benchmarks..." | Step 2 starts |
| `generating` | "Generating 3 design options..." | Step 3 starts |
| `done` | "Your results are ready!" | Complete |
| `error` | Error message | Failure |

Update `components/AnalysisProgress.tsx` to map these new step IDs.

---

## PromptLog Step Names

| Agent | PromptLog `step` value |
|---|---|
| Screenshot Analysis Agent | `screenshot_analysis` |
| Industry & SEO Agent | `industry_seo` |
| Score Agent | `score` |
| Creative Agent Modern | `creative_modern` |
| Creative Agent Classy | `creative_classy` |
| Creative Agent Unique | `creative_unique` |

---

## Files to Retire (disconnect, do not delete)

Remove all imports and call paths to these from `analyze.ts`. The files remain in the repo for reference but are unreachable from the pipeline.

| File | Was Used For |
|---|---|
| `lib/templates/selector.ts` | Claude-powered template composition selection |
| `lib/templates/compose.ts` | Stitching template sections into HTML |
| `lib/templates/injector.ts` | Placeholder replacement with extracted assets |
| `lib/templates/copy-refresher.ts` | GPT-4o copy rewriting (3 parallel calls) |

Also disconnect `lib/ai/openai.ts` from the pipeline. Keep the file and the `openai` dependency in `package.json`.

Remove `USE_AI_LAYOUT_GENERATION` env var check — there's now one path (Creative Agents), no toggle.

---

## Files to Create

| File | Purpose |
|---|---|
| `lib/pipeline/agents/screenshot-analysis.ts` | Screenshot Analysis Agent runner |
| `lib/pipeline/agents/industry-seo.ts` | Industry & SEO Agent runner |
| `lib/pipeline/agents/score.ts` | Score Agent runner |
| `lib/pipeline/agents/creative.ts` | Shared Creative Agent runner (parameterized by slug) |
| `lib/pipeline/agents/types.ts` | TypeScript interfaces for all agent inputs/outputs |

## Files to Modify

| File | Change |
|---|---|
| `lib/pipeline/analyze.ts` | Complete rewrite to new 4-step flow |
| `app/api/analyze/route.ts` | Update SSE step handling if needed |
| `components/AnalysisProgress.tsx` | Map new step IDs to UI labels |
| `app/page.tsx` | Update SSE event handling if step names changed |

## Do NOT Touch

| Path | Reason |
|---|---|
| `app/admin/*` | Phase 3 |
| `app/results/[id]/page.tsx` | Already handles empty layouts. Phase 4 adds rationale display. |
| `lib/config/*` | Phase 1 built these — use them, don't modify |
| `prisma/schema.prisma` | Phase 1 migration is complete |

---

## Testing Checklist

- [ ] Submit a URL → pipeline runs new 3-step agent flow end-to-end
- [ ] Results page shows 3 AI-generated layouts (not template compositions)
- [ ] Layouts use real brand assets (actual logo URL, real colors, real copy)
- [ ] SSE progress shows 4 steps: analyzing → scoring → generating → done
- [ ] PromptLog has 6 entries per analysis (one per agent)
- [ ] UrlProfile created/updated with analysisCount, latestScore, lastAnalyzedAt
- [ ] UrlAsset rows created with blob storage keys
- [ ] Cooldown works: re-submitting same URL within 5 min returns existing results
- [ ] `skillVersions` JSON saved on Refresh with correct version numbers
- [ ] `benchmarkComparison` populated when 3+ scored benchmarks exist for industry
- [ ] `layout1Rationale` / `layout2Rationale` / `layout3Rationale` populated
- [ ] If 1 Creative Agent fails: 2 layouts shown, no crash
- [ ] If all 3 fail: clear error message, no silent template fallback
- [ ] No calls to template selector, composer, injector, or GPT-4o copy refresh
- [ ] `npm run build` passes
- [ ] Admin analysis detail still shows PromptLog entries correctly
