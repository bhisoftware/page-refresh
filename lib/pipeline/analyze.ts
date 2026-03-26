/**
 * Phase 2 pipeline: 3-step agent architecture with incremental persistence.
 * Step 0: UrlProfile + fetch. Step 1: Screenshot + Industry/SEO + Assets (parallel).
 * Step 2: Score Agent. Step 3: 3 Creative Agents (sequential). Each step persists to DB immediately.
 */

import { prisma } from "@/lib/prisma";
import { fetchHtml } from "@/lib/scraping/fetch-html";
import { captureScreenshotCloud } from "@/lib/scraping/cloud-screenshot";
import { uploadBlob, screenshotKey } from "@/lib/storage/blobs";
import { compressScreenshotToWebP } from "@/lib/scraping/screenshot-compress";
import { fetchExternalCss } from "@/lib/scraping/fetch-external-css";
import { findOrCreateUrlProfile } from "@/lib/pipeline/url-profile";
import { detectCms } from "@/lib/pipeline/cms-detect";
import { extractAndPersistAssets } from "@/lib/pipeline/asset-extraction";
import { getAllActiveSkills } from "@/lib/config/agent-skills";
import { runScreenshotAnalysisAgent } from "@/lib/pipeline/agents/screenshot-analysis";
import { runIndustrySeoAgent } from "@/lib/pipeline/agents/industry-seo";
import { runScoreAgent } from "@/lib/pipeline/agents/score";
import { runCreativeAgent, type CreativeSlug } from "@/lib/pipeline/agents/creative";
import { runScanningCopyAgent } from "@/lib/pipeline/agents/scanning-copy";
import { runLogoIdentificationAgent, type LogoIdentificationOutput } from "@/lib/pipeline/agents/logo-identification";
import type { CreativeAgentInput, OriginalSiteStyle, ScreenshotAnalysisOutput, ScanningCopyOutput, SiteImage } from "@/lib/pipeline/agents/types";
import type { AgentSkill } from "@prisma/client";
import { getAnalysisCooldownDays } from "@/lib/config/app-settings";
import { fetchIndustryBenchmarks } from "@/lib/exa/fetch-benchmarks";
import { buildBenchmarkPromptBlock } from "@/lib/exa/build-benchmark-prompt";

export type PipelineProgress =
  | { step: "started"; message?: string }
  | { step: "analyzing"; message: string }
  | { step: "scoring"; message: string }
  | { step: "generating"; message: string }
  | { step: "token"; key: string; data: Record<string, unknown> }
  | { step: "done"; message?: string; refreshId?: string; viewToken?: string }
  | { step: "retry"; message: string }
  | { step: "error"; message: string };

export interface PipelineOptions {
  url: string;
  onProgress?: (p: PipelineProgress) => void;
  /** Called as soon as the Refresh row is created, so callers can reference it on timeout. */
  onRefreshCreated?: (refreshId: string, viewToken: string) => void;
}

function extractInlineCss(html: string): string {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (!styleMatch) return "";
  return styleMatch
    .map((s) => {
      const m = s.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      return m ? m[1] : "";
    })
    .join("\n");
}

/** Build loader "structure" checks from screenshot + SEO output for 5-card UX */
function buildStructureChecks(
  screenshot: Awaited<ReturnType<typeof runScreenshotAnalysisAgent>>,
  industrySeo: Awaited<ReturnType<typeof runIndustrySeoAgent>>
): Array<{ label: string; status: "ok" | "warn" | "bad"; value: string }> {
  const checks: Array<{ label: string; status: "ok" | "warn" | "bad"; value: string }> = [];
  const layout = screenshot.layout;
  if (layout?.heroType) {
    checks.push({ label: "Hero section detected", status: "ok", value: layout.heroType });
  }
  if (layout?.sectionCount != null) {
    checks.push({
      label: "Page structure",
      status: layout.sectionCount >= 2 ? "ok" : "warn",
      value: `${layout.sectionCount} main section(s)`,
    });
  }
  if (screenshot.brandAssets?.logoDetected != null) {
    checks.push({
      label: "Logo on page",
      status: screenshot.brandAssets.logoDetected ? "ok" : "warn",
      value: screenshot.brandAssets.logoDetected ? "Yes" : "Not found",
    });
  }
  const issueCount = industrySeo.seo?.issues?.length ?? 0;
  if (issueCount > 0) {
    checks.push({
      label: "SEO issues to address",
      status: issueCount > 3 ? "bad" : "warn",
      value: `${issueCount} found`,
    });
  }
  if (checks.length === 0) {
    checks.push({ label: "Site structure read", status: "ok", value: "Ready" });
  }
  return checks;
}

/** Build loader "seo" checks for 5-card UX */
function buildSeoChecks(
  industrySeo: Awaited<ReturnType<typeof runIndustrySeoAgent>>
): Array<{ label: string; status: "ok" | "warn" | "bad"; value: string }> {
  const checks: Array<{ label: string; status: "ok" | "warn" | "bad"; value: string }> = [];
  const seo = industrySeo.seo;
  const hasTitle = !!seo?.titleTag?.trim();
  checks.push({
    label: "Page title",
    status: hasTitle ? "ok" : "bad",
    value: hasTitle ? (seo!.titleTag!.length > 50 ? "Long" : "Set") : "Missing",
  });
  const hasDesc = !!seo?.metaDescription?.trim();
  checks.push({
    label: "Meta description",
    status: hasDesc ? "ok" : "warn",
    value: hasDesc ? "Set" : "Missing",
  });
  const score = seo?.score;
  if (score != null) {
    checks.push({
      label: "SEO score",
      status: score >= 70 ? "ok" : score >= 40 ? "warn" : "bad",
      value: `${score}/100`,
    });
  }
  const issues = seo?.issues ?? [];
  if (issues.length > 0) {
    checks.push({
      label: "Issues found",
      status: issues.length > 3 ? "bad" : "warn",
      value: `${issues.length} to fix`,
    });
  }
  return checks;
}

/** Classify an image by its pixel dimensions. */
function classifyImageCategory(
  w: number | undefined,
  h: number | undefined
): SiteImage["category"] {
  if (w == null || h == null) return "unknown";
  if (w < 80 && h < 80) return "icon";
  if (w < 200 || h < 200) return "badge";
  if (w >= 600 && h >= 400) return "photo";
  return "unknown";
}

/**
 * Resolve a business name from multiple sources. Always returns a non-empty string.
 * Priority: og:site_name / cleaned title → industry-seo titleTag → AI headline → domain name
 */
function resolveBusinessName(
  extractedCopy: { businessName?: string; titleTag?: string } | undefined,
  industrySeo: { seo?: { titleTag?: string | null }; copy?: { headline?: string | null } },
  rawUrl: string
): string {
  // 1. From asset extraction (og:site_name or cleaned <title>)
  if (extractedCopy?.businessName?.trim()) return extractedCopy.businessName.trim();

  // 2. From industry-seo agent's titleTag (cleaned)
  const seoTitle = industrySeo.seo?.titleTag?.trim();
  if (seoTitle) {
    const cleaned = seoTitle
      .replace(/\s*[|–—-]\s*(home|welcome|about\s*us|contact|main|official\s*site|official\s*website).*$/i, "")
      .trim();
    if (cleaned) return cleaned;
  }

  // 3. From industry-seo agent's headline extraction
  if (industrySeo.copy?.headline?.trim()) return industrySeo.copy.headline.trim();

  // 4. Humanize domain name (e.g., "murfreesboroautorepair.com" → "Murfreesboro Auto Repair")
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
    const name = hostname
      .split(".")[0]
      // Insert spaces before capitals or between lowercase-uppercase transitions
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Insert spaces around common word boundaries in domain names
      .replace(/([a-z])(auto|repair|service|shop|clinic|dental|law|legal|home|care|pro|tech|web|design|build|clean|plumb|elect|heat|cool|hvac|roofing|paint|land|scape|lawn|tree|pest|pool|fence|move|stor|rent|real|estate|insur|account|consult|market|media|photo|video|fit|gym|yoga|salon|barber|spa|beauty|vet|pet|golf|gun|church|theater|theatre|funeral|daycare|restaurant|cafe|pizza|grill|bar|brew|dental|ortho|chiro|physio|massage)/gi, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    // Title case
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Business";
  }
}

const DEFAULT_REFRESH_PLACEHOLDER = {
  url: "",
  targetWebsite: "",
  htmlSnapshot: "",
  cssSnapshot: "",
  extractedColors: [],
  extractedFonts: [],
  extractedImages: [],
  extractedCopy: {},
  extractedLogo: null,
  brandAnalysis: "",
  industryDetected: "Unknown",
  industryConfidence: 0,
  overallScore: 0,
  clarityScore: 0,
  visualScore: 0,
  hierarchyScore: 0,
  trustScore: 0,
  conversionScore: 0,
  contentScore: 0,
  mobileScore: 0,
  performanceScore: 0,
  scoringDetails: [],
  seoAudit: {},
  layout1Html: "",
  layout1Css: "",
  layout1Template: "pending",
  layout1CopyRefreshed: "",
  layout2Html: "",
  layout2Css: "",
  layout2Template: "pending",
  layout2CopyRefreshed: "",
  layout3Html: "",
  layout3Css: "",
  layout3Template: "pending",
  layout3CopyRefreshed: "",
};

/**
 * Extract actionable visual style signals from screenshot analysis for creative agent context.
 * Returns undefined if no useful data available.
 */
function buildOriginalStyle(sa: ScreenshotAnalysisOutput): OriginalSiteStyle | undefined {
  const hasColors = sa.colors && Object.values(sa.colors).some((v) => typeof v === "string" && v);
  const hasTypography = sa.typography && (sa.typography.headingFont || sa.typography.bodyFont);
  const hasLayout = sa.layout && (sa.layout.heroType || sa.layout.navStyle || sa.layout.gridPattern);
  const hasDensity = typeof sa.visualDensity === "number";
  const hasImagery = !!sa.brandAssets?.imageryStyle;

  if (!hasColors && !hasTypography && !hasLayout && !hasDensity && !hasImagery) return undefined;

  const style: OriginalSiteStyle = {};
  if (hasColors) style.colors = sa.colors;
  if (hasTypography) style.typography = { headingFont: sa.typography!.headingFont, bodyFont: sa.typography!.bodyFont };
  if (hasLayout) style.layout = { heroType: sa.layout!.heroType, navStyle: sa.layout!.navStyle, gridPattern: sa.layout!.gridPattern };
  if (hasDensity) style.visualDensity = sa.visualDensity;
  if (hasImagery) style.imageryStyle = sa.brandAssets!.imageryStyle;

  return style;
}

export async function runAnalysis(options: PipelineOptions): Promise<string> {
  const { url, onProgress, onRefreshCreated } = options;
  const startTime = Date.now();
  const rawUrl = url.startsWith("http") ? url : `https://${url}`;
  console.log("[pipeline] starting", { url: rawUrl });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onRetry = (_delayMs: number) =>
    onProgress?.({ step: "generating", message: "Still working on your designs..." });

  // --- Step 0: UrlProfile + cooldown + fetch ---
  const urlProfile = await findOrCreateUrlProfile(rawUrl);
  const cooldownDays = await getAnalysisCooldownDays();
  if (cooldownDays > 0 && urlProfile.lastAnalyzedAt) {
    const minutesSince = (Date.now() - urlProfile.lastAnalyzedAt.getTime()) / 60000;
    if (minutesSince < cooldownDays * 24 * 60) {
      const existing = await prisma.refresh.findFirst({
        where: {
          urlProfileId: urlProfile.id,
          status: "complete",
          layout1Html: { not: "" },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, viewToken: true },
      });
      if (existing) {
        return existing.id;
      }
    }
  }

  onProgress?.({ step: "started" });

  // Create Refresh row immediately so the client has a refreshId for recovery
  // if the SSE connection drops during the long-running fetch/analysis steps.
  const refresh = await prisma.refresh.create({
    data: {
      ...DEFAULT_REFRESH_PLACEHOLDER,
      status: "fetching",
      url: rawUrl,
      targetWebsite: rawUrl,
      urlProfileId: urlProfile.id,
    },
  });
  const refreshId = refresh.id;
  let pipelineCompleted = false;
  onRefreshCreated?.(refreshId, refresh.viewToken);

  try {
  // ---- begin guarded pipeline ----

  let html: string;
  let screenshotBuffer: Buffer | null;
  let fetchRetryCount = 0;

  try {
    const [fetchResult, ssBuffer] = await Promise.all([
      fetchHtml(rawUrl).then((r) => r.html),
      captureScreenshotCloud(rawUrl).catch(() => null),
    ]);
    html = fetchResult;
    screenshotBuffer = ssBuffer;
  } catch (firstErr) {
    // Auto-retry fetchHtml once after a short delay (screenshot is non-critical)
    console.warn("[pipeline] Fetch failed, retrying once in 3s:", firstErr instanceof Error ? firstErr.message : String(firstErr));
    fetchRetryCount = 1;
    try {
      await new Promise((r) => setTimeout(r, 3000));
      const [retryResult, ssBuffer] = await Promise.all([
        fetchHtml(rawUrl).then((r) => r.html),
        captureScreenshotCloud(rawUrl).catch(() => null),
      ]);
      html = retryResult;
      screenshotBuffer = ssBuffer;
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error("[pipeline] Fetch phase failed after retry:", msg);
      onProgress?.({ step: "error", message: msg });
      await prisma.refresh.update({
        where: { id: refreshId },
        data: { status: "failed", errorStep: "fetching", errorMessage: msg.slice(0, 2000) },
      }).catch(() => {});
      await prisma.urlProfile.update({
        where: { id: urlProfile.id },
        data: { lastFetchRetries: fetchRetryCount },
      }).catch(() => {});
      throw retryErr;
    }
  }

  const inlineCss = extractInlineCss(html);
  const externalCss = await fetchExternalCss(html, rawUrl, 3);
  const css = [inlineCss, externalCss].filter(Boolean).join("\n");

  // CMS auto-detection: write to UrlProfile unless admin-locked
  const detectedCms = detectCms(html);
  if (detectedCms && !urlProfile.cmsLocked) {
    await prisma.urlProfile.update({
      where: { id: urlProfile.id },
      data: { cms: detectedCms },
    });
  }

  // Backfill HTML/CSS snapshots now that fetch is complete
  await prisma.refresh.update({
    where: { id: refreshId },
    data: { htmlSnapshot: html, cssSnapshot: css },
  });
  const skills = await getAllActiveSkills();
  const skillVersions: Record<string, number> = {};
  skills.forEach((s: AgentSkill) => {
    skillVersions[s.agentSlug] = s.version;
  });

  // --- Step 1: Parallel analysis + asset extraction ---
  onProgress?.({ step: "analyzing", message: "Analyzing your website..." });
  await prisma.refresh.update({ where: { id: refreshId }, data: { status: "analyzing" } });

  let screenshotAnalysis: Awaited<ReturnType<typeof runScreenshotAnalysisAgent>>;
  let industrySeo: Awaited<ReturnType<typeof runIndustrySeoAgent>>;
  let assetResult: Awaited<ReturnType<typeof extractAndPersistAssets>>;

  try {
    [screenshotAnalysis, industrySeo, assetResult] = await Promise.all([
      runScreenshotAnalysisAgent({
        skills,
        html,
        screenshotBuffer,
        refreshId,
        onRetry,
      }),
      runIndustrySeoAgent({
        skills,
        html,
        css,
        url: rawUrl,
        refreshId,
        onRetry,
      }),
      extractAndPersistAssets(urlProfile, html, css, rawUrl, screenshotBuffer),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] Step 1 failed:", msg);
    onProgress?.({ step: "error", message: msg });
    await prisma.refresh.update({
      where: { id: refreshId },
      data: { status: "failed", errorStep: "analyzing", errorMessage: msg.slice(0, 2000) },
    }).catch(() => {});
    throw err;
  }

  const industry = industrySeo.industry?.name ?? "General Business";

  // Persist Step 1 results immediately
  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      status: "scoring",
      extractedColors: assetResult.assets.colors as unknown as object,
      extractedFonts: assetResult.assets.fonts as unknown as object,
      extractedImages: assetResult.assets.images as unknown as object,
      extractedCopy: assetResult.assets.copy as object,
      extractedLogo: assetResult.assets.logo ?? null,
      brandAnalysis: JSON.stringify(screenshotAnalysis),
      industryDetected: industry,
      industryConfidence: industrySeo.industry?.confidence ?? 0,
      seoAudit: (industrySeo.seo ?? {}) as object,
    },
  });

  // Emit loader tokens in staged order (structure → seo → colors → fonts) for 5-card UX
  const ROLE_ORDER = ["Primary", "Background", "Text", "Accent", "Secondary"] as const;
  const structureChecks = buildStructureChecks(screenshotAnalysis, industrySeo);
  const seoChecks = buildSeoChecks(industrySeo);
  const palette = assetResult.assets.colors
    .slice(0, 5)
    .map((c, i) => ({ hex: "hex" in c ? c.hex : String(c), role: ROLE_ORDER[i] ?? "Accent" }));
  const fontList = assetResult.assets.fonts.slice(0, 4).map((f, i) => {
    const name = "family" in f ? f.family : String(f);
    const role = i === 0 ? "Headings" : i === 1 ? "Body text" : "Accent";
    return { name, role, cssFamily: `${name}, sans-serif` };
  });

  onProgress?.({ step: "token", key: "structure", data: { checks: structureChecks } });
  onProgress?.({ step: "token", key: "seo", data: { checks: seoChecks } });
  onProgress?.({ step: "token", key: "colors", data: { palette } });
  onProgress?.({ step: "token", key: "fonts", data: { detected: fontList } });
  onProgress?.({ step: "token", key: "industry", data: { name: industry, confidence: industrySeo.industry?.confidence ?? 0 } });

  // Run scanning-copy agent in parallel with Step 2 (non-blocking)
  const scanningCopyPromise = runScanningCopyAgent({
    skills,
    input: {
      url: rawUrl,
      industry,
      seoChecks: seoChecks,
      structureChecks: structureChecks,
      colorCount: palette.length,
      fontCount: fontList.length,
      headline: industrySeo.copy?.headline ?? null,
    },
    refreshId,
    onRetry,
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[pipeline] scanning-copy agent failed:", msg);
    prisma.refresh.update({
      where: { id: refreshId },
      data: { errorMessage: `scanning-copy agent failed: ${msg}`.slice(0, 2000) },
    }).catch(() => {});
    return {} as ScanningCopyOutput;
  });

  // Fetch EXA industry benchmarks in parallel (non-blocking, runs alongside scanning-copy)
  const exaBenchmarkPromise = fetchIndustryBenchmarks(industry).catch((err) => {
    console.warn("[pipeline] EXA benchmark fetch failed:", err instanceof Error ? err.message : String(err));
    return null;
  });

  // --- Step 2: Score Agent + Logo Agent (parallel) ---
  onProgress?.({ step: "scoring", message: "Scoring against industry benchmarks..." });

  const benchmarks = await prisma.benchmark.findMany({
    where: { industry, scored: true, active: true },
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

  // Prepare logo candidate buffers for Logo Agent vision
  const logoCandidates = assetResult.assets.logoCandidates ?? [];
  const candidateBuffers: Array<{ index: number; buffer: Buffer; mimeType: string }> = [];
  for (let i = 0; i < Math.min(logoCandidates.length, 5); i++) {
    const candidate = logoCandidates[i];
    const buffer = assetResult.downloadedBuffers.get(candidate.url);
    if (!buffer) continue;
    const mimeType = candidate.isSvg ? "image/svg+xml"
      : /\.png(\?|$)/i.test(candidate.url) ? "image/png"
      : /\.webp(\?|$)/i.test(candidate.url) ? "image/webp"
      : /\.gif(\?|$)/i.test(candidate.url) ? "image/gif"
      : "image/jpeg";
    candidateBuffers.push({ index: i, buffer, mimeType });
  }

  const exaBenchmark = await exaBenchmarkPromise;
  const exaBenchmarkContext = buildBenchmarkPromptBlock(exaBenchmark);

  const [scoreResult, logoResult] = await Promise.all([
    runScoreAgent({
      skills,
      input: {
        screenshotAnalysis,
        industrySeo,
        benchmarks,
        benchmarkCount: benchmarks.length,
        ...(exaBenchmarkContext ? { exaBenchmarkContext } : {}),
      },
      refreshId,
      onRetry,
    }),
    runLogoIdentificationAgent({
      skills,
      screenshotBuffer,
      candidateBuffers,
      candidates: logoCandidates.slice(0, 5),
      businessName: resolveBusinessName(assetResult.assets.copy, industrySeo, rawUrl),
      websiteUrl: rawUrl,
      refreshId,
      onRetry,
    }).catch((err) => {
      console.warn("[pipeline] Logo Agent failed, using heuristic:", err instanceof Error ? err.message : String(err));
      return null as LogoIdentificationOutput | null;
    }),
  ]);

  // Calculate benchmark comparison immediately (moved from Step 4)
  let benchmarkComparison: Record<string, unknown> | null = null;
  if (benchmarks.length >= 3) {
    const beatCount = benchmarks.filter((b) => b.overallScore < scoreResult.scores.overall).length;
    const percentile = Math.round((beatCount / benchmarks.length) * 100);
    type ScoreKey = "overallScore" | "clarityScore" | "visualScore" | "hierarchyScore" | "trustScore" | "conversionScore" | "contentScore" | "mobileScore" | "performanceScore";
    const avg = (key: ScoreKey) =>
      Math.round(
        benchmarks.reduce((sum, b) => sum + (b[key] as number), 0) / benchmarks.length
      );
    const top10 = (key: ScoreKey) => {
      const sorted = benchmarks.map((b) => b[key] as number).sort((a, b) => b - a);
      return sorted[Math.max(0, Math.floor(sorted.length * 0.1))] ?? 0;
    };
    const dimensions: ScoreKey[] = ["clarityScore", "visualScore", "hierarchyScore", "trustScore", "conversionScore", "contentScore", "mobileScore", "performanceScore"];
    benchmarkComparison = {
      percentile,
      sampleSize: benchmarks.length,
      industry,
      industryAvg: avg("overallScore"),
      top10Overall: top10("overallScore"),
      dimensions: dimensions.map((dim) => ({
        dimension: dim.replace("Score", ""),
        industryAvg: avg(dim),
        top10: top10(dim),
      })),
    };
  }

  // Persist Step 2 results immediately
  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      status: "generating",
      overallScore: scoreResult.scores.overall,
      clarityScore: scoreResult.scores.clarity,
      visualScore: scoreResult.scores.visual,
      hierarchyScore: scoreResult.scores.hierarchy,
      trustScore: scoreResult.scores.trust,
      conversionScore: scoreResult.scores.conversion,
      contentScore: scoreResult.scores.content,
      mobileScore: scoreResult.scores.mobile,
      performanceScore: scoreResult.scores.performance,
      scoringDetails: (scoreResult.scoringDetails ?? []) as object,
      ...(benchmarkComparison ? { benchmarkComparison: benchmarkComparison as object } : {}),
    },
  });

  // Update URL profile scores immediately (but defer lastAnalyzedAt until after creative agents,
  // so cooldown won't block retries if all creative agents fail)
  await prisma.urlProfile.update({
    where: { id: urlProfile.id },
    data: {
      latestScore: scoreResult.scores.overall,
      bestScore: Math.max(urlProfile.bestScore ?? 0, scoreResult.scores.overall),
      lastFetchRetries: fetchRetryCount,
      ...(urlProfile.industryLocked ? {} : { industry }),
    },
  });

  // Emit score token
  const scoreEntries = Object.entries(scoreResult.scores).filter(([k]) => k !== "overall");
  const bestDim = scoreEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worstDim = scoreEntries.reduce((a, b) => (b[1] < a[1] ? b : a));
  onProgress?.({ step: "token", key: "scores", data: {
    overall: scoreResult.scores.overall,
    top: { name: bestDim[0], score: bestDim[1] },
    bottom: { name: worstDim[0], score: worstDim[1] },
  }});

  // Await scanning-copy result (should already be done by now) and emit token
  const scanningCopy = await scanningCopyPromise;
  if (scanningCopy.industry_text || scanningCopy.competitor_text || scanningCopy.scoring_text) {
    onProgress?.({ step: "token", key: "scanningCopy", data: scanningCopy as Record<string, unknown> });
  }

  // Don't pass data URIs to creative agents — they're MB-sized base64 strings
  const safeUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    if (url.startsWith("data:")) return null;
    return url;
  };

  // Resolve confirmed logo URL from Logo Agent (or fall back to heuristic)
  const heuristicLogoUrl = safeUrl(assetResult.storedAssets.find((a) => a.assetType === "logo")?.storageUrl);
  let confirmedLogoUrl: string | null = heuristicLogoUrl;

  if (logoResult && logoResult.selectedIndex >= 0 && logoResult.confidence >= 0.6) {
    const selected = logoCandidates[logoResult.selectedIndex];
    if (selected) {
      const s3Url = assetResult.siteImageUrlMap.get(selected.url)
        ?? assetResult.storedAssets.find((a) => a.sourceUrl === selected.url)?.storageUrl;
      if (s3Url) {
        confirmedLogoUrl = safeUrl(s3Url);
        console.log(`[pipeline] Logo Agent selected candidate ${logoResult.selectedIndex} (confidence: ${logoResult.confidence}): ${selected.url}`);
      }
    }
  } else if (logoResult) {
    console.log(`[pipeline] Logo Agent low confidence (${logoResult.confidence}), using heuristic`);
  }

  // Persist confirmed logo if Logo Agent changed it
  if (confirmedLogoUrl && confirmedLogoUrl !== heuristicLogoUrl) {
    await prisma.refresh.update({
      where: { id: refreshId },
      data: { extractedLogo: confirmedLogoUrl },
    }).catch(() => {});
  }

  // --- Step 3: Creative Agents ---
  console.log("[pipeline] step 3: creative agents");
  onProgress?.({ step: "generating", message: "Generating 3 design options..." });

  // Resolve business name from multiple sources
  const businessName = resolveBusinessName(assetResult.assets.copy, industrySeo, rawUrl);

  // Data quality assessment — detect SPA-like sparse data
  const hasH1 = !!assetResult.assets.copy?.h1;
  const hasHeroText = !!assetResult.assets.copy?.heroText;
  const hasNavItems = (assetResult.assets.copy?.navItems?.length ?? 0) > 0;
  const imageCount = assetResult.assets.images.length;
  const hasLogo = !!assetResult.assets.logo;
  const isSpaLikely = !hasH1 && !hasHeroText && !hasNavItems && imageCount === 0;
  if (isSpaLikely) {
    console.warn(`[pipeline] LOW DATA QUALITY for ${rawUrl}: no h1, heroText, navItems, or images (likely SPA). Business name resolved to: "${businessName}"`);
  } else if (!hasH1 || !hasLogo) {
    console.warn(`[pipeline] PARTIAL DATA for ${rawUrl}: h1=${hasH1}, logo=${hasLogo}, nav=${hasNavItems}, images=${imageCount}`);
  }

  // Build contentDirection with SPA note if needed
  let contentDirection = scoreResult.creativeBrief.contentDirection ?? "";
  if (isSpaLikely) {
    contentDirection += "\nNOTE: This site's content is JavaScript-rendered. HTML extraction returned minimal data. Use the provided businessName and industry to build an appropriate landing page. Keep the design simple rather than inventing content.";
  }

  const isHttpUrl = (s: string): boolean => {
    try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
    catch { return false; }
  };

  // Merge screenshot analysis colors with CSS-extracted colors (screenshot colors first for priority)
  const cssColors = assetResult.assets.colors.map((c) => ("hex" in c ? c.hex : String(c)));
  const screenshotColorValues = screenshotAnalysis.colors
    ? Object.values(screenshotAnalysis.colors).filter((v): v is string => typeof v === "string" && v.startsWith("#"))
    : [];
  const seenColors = new Set<string>();
  const mergedColors: string[] = [];
  for (const hex of [...screenshotColorValues, ...cssColors]) {
    const normalized = hex.toLowerCase();
    if (!seenColors.has(normalized)) {
      seenColors.add(normalized);
      mergedColors.push(hex);
    }
  }

  // Merge screenshot-detected fonts with CSS-extracted fonts (screenshot fonts first, deduped)
  const screenshotFonts: string[] = [];
  if (screenshotAnalysis.typography?.headingFont) screenshotFonts.push(screenshotAnalysis.typography.headingFont);
  if (screenshotAnalysis.typography?.bodyFont) screenshotFonts.push(screenshotAnalysis.typography.bodyFont);
  const seenFonts = new Set<string>();
  const mergedFonts: string[] = [];
  for (const font of screenshotFonts) {
    const key = font.toLowerCase();
    if (!seenFonts.has(key)) {
      seenFonts.add(key);
      mergedFonts.push(font);
    }
  }
  for (const f of assetResult.assets.fonts) {
    const name = "family" in f ? f.family : String(f);
    const key = name.toLowerCase();
    if (!seenFonts.has(key)) {
      seenFonts.add(key);
      mergedFonts.push(name);
    }
  }

  // Remap site image URLs through S3-backed blob URLs (fall back to original if download failed)
  const remapUrl = (src: string) => assetResult.siteImageUrlMap.get(src) ?? src;

  const creativeInput: CreativeAgentInput = {
    designDirection: {
      priorities: scoreResult.creativeBrief.priorities?.map((p) => ({
        area: p.dimension,
        priority: p.priority,
        guidance: p.guidance,
      })) ?? [],
      strengths: scoreResult.creativeBrief.strengths ?? [],
      industryRequirements: scoreResult.creativeBrief.industryRequirements ?? [],
      contentDirection,
      technicalRequirements: scoreResult.creativeBrief.technicalRequirements ?? [],
    },
    industry,
    businessName,
    websiteUrl: rawUrl,
    originalStyle: buildOriginalStyle(screenshotAnalysis),
    brandAssets: {
      logoUrl: confirmedLogoUrl,
      heroImageUrl:
        safeUrl(assetResult.storedAssets.find((a) => a.assetType === "hero_image")?.storageUrl)
        // Fallback: promote OG image to hero if no dedicated hero was extracted
        ?? safeUrl(assetResult.storedAssets.find((a) => a.assetType === "og_image")?.storageUrl),
      additionalImageUrls: assetResult.storedAssets
        .filter((a) => !["logo", "hero_image"].includes(a.assetType) && a.storageUrl && !a.storageUrl.startsWith("data:"))
        .map((a) => ({ url: a.storageUrl!, type: a.assetType })),
      siteImageUrls: assetResult.assets.images
        .filter((img) => img.imageType !== 'icon' && img.imageType !== 'decorative' && img.imageType !== 'illustration')
        .map((img) => img.src)
        .filter((src) => isHttpUrl(src))
        .slice(0, 8)
        .map(remapUrl),
      teamPhotos: assetResult.assets.teamPhotos?.map((p) => ({ ...p, src: remapUrl(p.src) })),
      trustBadges: assetResult.assets.trustBadges?.map((b) => ({ ...b, src: remapUrl(b.src) })),
      eventPhotos: assetResult.assets.eventPhotos?.map((e) => ({ ...e, src: remapUrl(e.src) })),
      colors: mergedColors,
      fonts: mergedFonts,
      navLinks: assetResult.assets.copy?.navItems ?? [],
      copy: assetResult.assets.copy,
    },
  };

  // Build extraction notes so agents know what's missing
  const extractionNotes: string[] = [];
  if (!creativeInput.brandAssets.logoUrl) extractionNotes.push("No logo found — use text-based branding");
  if (!creativeInput.brandAssets.heroImageUrl) extractionNotes.push("No hero image found — use a gradient or solid color hero background");
  if (creativeInput.brandAssets.siteImageUrls.length === 0) extractionNotes.push("No site images extracted — avoid placeholder image URLs");
  if (creativeInput.brandAssets.colors.length === 0) extractionNotes.push("No brand colors detected — use neutral, professional palette");
  if (creativeInput.brandAssets.fonts.length === 0) extractionNotes.push("No brand fonts detected — use system font stack");
  if (!creativeInput.brandAssets.copy?.testimonials?.length) extractionNotes.push("No testimonials found — omit testimonial section");
  if (!creativeInput.brandAssets.copy?.features?.length) extractionNotes.push("No feature list found — omit dedicated features section");
  if (!creativeInput.brandAssets.copy?.phoneNumber) extractionNotes.push("No phone number found — use a generic 'Contact Us' CTA instead of a phone number");
  if (!creativeInput.brandAssets.copy?.rating) extractionNotes.push("No aggregate rating found — do not invent star ratings or review counts");
  const filteredIconCount = assetResult.assets.images.filter(
    (img) => img.imageType === 'icon' || img.imageType === 'illustration'
  ).length;
  if (filteredIconCount > 0 && creativeInput.brandAssets.siteImageUrls.length === 0) {
    extractionNotes.push(`${filteredIconCount} icon/illustration images filtered — no photographs available. Use brand-colored gradients and strong typography instead of images.`);
  }
  // Build dimension-enriched siteImages for creative agents
  const siteImages: SiteImage[] = assetResult.assets.images
    .filter((img) => img.imageType !== "icon" && img.imageType !== "decorative" && img.imageType !== "illustration")
    .filter((img) => isHttpUrl(img.src))
    .slice(0, 8)
    .map((img) => {
      const blobUrl = remapUrl(img.src);
      const dims = assetResult.siteImageDimensions.get(img.src);
      return {
        url: blobUrl,
        alt: img.alt,
        width: dims?.width,
        height: dims?.height,
        category: classifyImageCategory(dims?.width, dims?.height),
      };
    });
  creativeInput.brandAssets.siteImages = siteImages;

  // Badge-aware extraction notes
  if (siteImages.length > 0) {
    const photoCount = siteImages.filter((img) => img.category === "photo").length;
    const badgeCount = siteImages.filter((img) => img.category === "badge").length;
    if (badgeCount > 0 && photoCount === 0) {
      extractionNotes.push(
        `Site images are primarily badges/seals (${badgeCount} badges, 0 photos) — display them small (h-12 to h-16) in a horizontal trust strip. Use gradients or solid color backgrounds for hero and feature sections.`
      );
    } else if (badgeCount > 0 && photoCount <= 2) {
      extractionNotes.push(
        `Limited photos available (${photoCount} photos, ${badgeCount} badges) — reserve photos for the hero and one feature section. Use badges in a trust strip only.`
      );
    }
  }

  if (extractionNotes.length > 0) {
    creativeInput.brandAssets.extractionNotes = extractionNotes;
  }

  // Run creative agents in parallel with a 3s stagger to avoid overwhelming the API.
  // Much faster than fully sequential (3-6s stagger vs 15-25s per agent) while avoiding 429/529 spikes.
  const allCreativeSlugs: CreativeSlug[] = ["creative-modern", "creative-classy", "creative-unique"];
  const allTemplateNames = ["Classic Refresh", "Modern Upgrade", "Bold Transformation"];
  // Only run creative agents that are active (have a matching skill in the DB)
  const activeCreativeIndices = allCreativeSlugs
    .map((slug, i) => skills.some((s) => s.agentSlug === slug) ? i : -1)
    .filter((i) => i >= 0);
  const creativeSlugs = activeCreativeIndices.map((i) => allCreativeSlugs[i]);
  const creativeTemplateNames = activeCreativeIndices.map((i) => allTemplateNames[i]);
  if (creativeSlugs.length === 0) {
    console.warn("[pipeline] No active creative agents — skipping layout generation");
    onProgress?.({ step: "error", message: "No creative agents are enabled. Scores and audit are saved below." });
  }
  const accentColor = creativeInput.brandAssets.colors[0]
    ?? screenshotAnalysis.colors?.primary
    ?? screenshotAnalysis.colors?.accent
    ?? "#1a1a2e";
  const CREATIVE_STAGGER_MS = 5000;
  const sharedRateLimitFlag = { until: 0 };
  const completedAgentIndices: number[] = [];

  const creativeResults = await Promise.allSettled(
    creativeSlugs.map(async (slug, i) => {
      // Stagger launches to avoid overwhelming the API with simultaneous requests
      if (i > 0) await new Promise((r) => setTimeout(r, i * CREATIVE_STAGGER_MS));
      console.log("[pipeline] creative agent", i + 1, "of 3 — starting");
      const result = await runCreativeAgent({
        skills,
        slug,
        input: creativeInput,
        refreshId,
        onRetry,
        rateLimitFlag: sharedRateLimitFlag,
        agentIndex: i,
      });
      // Persist this layout immediately on completion
      const templateName = result.html?.trim() ? creativeTemplateNames[i] : "pending";
      const layoutNum = i + 1;
      await prisma.refresh.update({
        where: { id: refreshId },
        data: {
          [`layout${layoutNum}Html`]: result.html ?? "",
          [`layout${layoutNum}Template`]: templateName,
          [`layout${layoutNum}CopyRefreshed`]: result.html ?? "",
          [`layout${layoutNum}Rationale`]: result.rationale ?? "",
        },
      });
      completedAgentIndices.push(i);
      console.log("[pipeline] creative agent", i + 1, "of 3 — done");
      const completedNames = completedAgentIndices
        .sort((a, b) => a - b)
        .map((idx) => creativeTemplateNames[idx]);
      onProgress?.({
        step: "token",
        key: "layouts",
        data: {
          options: completedNames.map((label) => ({ label, accentColor })),
        },
      });
      onProgress?.({ step: "generating", message: `Generated ${completedAgentIndices.length} of ${creativeSlugs.length} design options...` });
      return result;
    })
  );

  const layouts = creativeResults.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[pipeline] Creative agent ${creativeSlugs[i]} failed:`, r.reason);
    return null;
  });
  const successCount = layouts.filter(Boolean).length;
  if (successCount === 0) {
    const reasons = creativeResults
      .map((r, i) => r.status === "rejected" ? `${creativeSlugs[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}` : null)
      .filter(Boolean)
      .join(" | ");
    console.error(`[pipeline] All ${creativeSlugs.length} Creative Agents failed:`, reasons);
    await prisma.refresh.update({
      where: { id: refreshId },
      data: { errorStep: "generating", errorMessage: `All ${creativeSlugs.length} creative agents failed — ${reasons}`.slice(0, 2000) },
    }).catch(() => {});
    onProgress?.({ step: "error", message: "Layout generation was unable to complete. Your scores and audit are still saved below." });
  } else if (successCount < creativeSlugs.length) {
    const failedSlugs = creativeSlugs.filter((_, i) => creativeResults[i].status === "rejected");
    const failedCount = creativeSlugs.length - successCount;
    console.warn(`[pipeline] ${failedCount} of ${creativeSlugs.length} creative agents failed: ${failedSlugs.join(", ")}`);
    await prisma.refresh.update({
      where: { id: refreshId },
      data: {
        errorStep: "generating",
        errorMessage: `${failedCount} of ${creativeSlugs.length} creative agents failed: ${failedSlugs.join(", ")}`,
      },
    }).catch(() => {});
  }

  // Only mark profile as fully analyzed if at least one layout was generated.
  // This prevents cooldown from blocking retries after total creative failure.
  if (successCount > 0) {
    await prisma.urlProfile.update({
      where: { id: urlProfile.id },
      data: {
        analysisCount: { increment: 1 },
        lastAnalyzedAt: new Date(),
      },
    });
  }

  // --- Step 4: Finalize ---
  let screenshotUrl: string | null = null;
  if (screenshotBuffer) {
    try {
      const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
      const blobKey = screenshotKey(refreshId, rawUrl);
      screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
    } catch (ssErr) {
      console.warn("[pipeline] Screenshot upload failed (non-fatal):", ssErr instanceof Error ? ssErr.message : String(ssErr));
    }
  }

  // If all creative agents failed, mark as failed rather than complete
  const finalStatus = successCount === 0 && creativeSlugs.length > 0 ? "failed" : "complete";
  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      status: finalStatus,
      // Only clear error info when ALL creative agents succeeded.
      // Partial failures preserve their error details for diagnostics.
      ...(finalStatus === "complete" && successCount === creativeSlugs.length ? { errorStep: null, errorMessage: null } : {}),
      screenshotUrl,
      skillVersions: skillVersions as object,
      processingTime: Math.round((Date.now() - startTime) / 1000),
    },
  });

  pipelineCompleted = true;
  const elapsedSec = Math.round((Date.now() - startTime) / 1000);
  console.log("[pipeline] completed", { refreshId, elapsedSec });
  return refreshId;

  // ---- end guarded pipeline ----
  } catch (pipelineErr) {
    // If the pipeline crashes at any point after refresh creation, ensure
    // the status moves out of transient states so the user doesn't see a stale page.
    if (!pipelineCompleted) {
      const currentRefresh = await prisma.refresh.findUnique({
        where: { id: refreshId },
        select: { status: true },
      }).catch(() => null);
      const transientStatuses = ["fetching", "analyzing", "scoring", "generating"];
      if (currentRefresh && transientStatuses.includes(currentRefresh.status)) {
        const msg = pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
        await prisma.refresh.update({
          where: { id: refreshId },
          data: {
            status: "failed",
            errorStep: currentRefresh.status,
            errorMessage: (currentRefresh.status === "fetching" ? msg : `Pipeline crashed during ${currentRefresh.status}: ${msg}`).slice(0, 2000),
            processingTime: Math.round((Date.now() - startTime) / 1000),
          },
        }).catch(() => {});
        console.error(`[pipeline] Crash during "${currentRefresh.status}":`, msg);
      }
    }
    throw pipelineErr;
  }
}
