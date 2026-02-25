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
import { extractAndPersistAssets } from "@/lib/pipeline/asset-extraction";
import { getAllActiveSkills } from "@/lib/config/agent-skills";
import { runScreenshotAnalysisAgent } from "@/lib/pipeline/agents/screenshot-analysis";
import { runIndustrySeoAgent } from "@/lib/pipeline/agents/industry-seo";
import { runScoreAgent } from "@/lib/pipeline/agents/score";
import { runCreativeAgent, type CreativeSlug } from "@/lib/pipeline/agents/creative";
import type { CreativeAgentInput } from "@/lib/pipeline/agents/types";
import type { AgentSkill } from "@prisma/client";

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
  layout4Html: "",
  layout4Css: "",
  layout4Template: "",
  layout4CopyRefreshed: "",
  layout5Html: "",
  layout5Css: "",
  layout5Template: "",
  layout5CopyRefreshed: "",
  layout6Html: "",
  layout6Css: "",
  layout6Template: "",
  layout6CopyRefreshed: "",
};

export async function runAnalysis(options: PipelineOptions): Promise<string> {
  const { url, onProgress } = options;
  const startTime = Date.now();
  const rawUrl = url.startsWith("http") ? url : `https://${url}`;
  console.log("[pipeline] starting", { url: rawUrl });

  const onRetry = (delayMs: number) =>
    onProgress?.({ step: "retry", message: `Refresh paused due to API limits. Retrying in ${Math.round(delayMs / 1000)} seconds...` });

  // --- Step 0: UrlProfile + cooldown + fetch ---
  const urlProfile = await findOrCreateUrlProfile(rawUrl);
  if (urlProfile.lastAnalyzedAt) {
    const minutesSince = (Date.now() - urlProfile.lastAnalyzedAt.getTime()) / 60000;
    if (minutesSince < 5) {
      const existing = await prisma.refresh.findFirst({
        where: { urlProfileId: urlProfile.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, viewToken: true },
      });
      if (existing) {
        return existing.id;
      }
    }
  }

  onProgress?.({ step: "started" });

  const [fetchResult, screenshotBuffer] = await Promise.all([
    fetchHtml(rawUrl).then((r) => r.html),
    captureScreenshotCloud(rawUrl).catch(() => null),
  ]);
  const html = fetchResult;

  const inlineCss = extractInlineCss(html);
  const externalCss = await fetchExternalCss(html, rawUrl, 3);
  const css = [inlineCss, externalCss].filter(Boolean).join("\n");

  const refresh = await prisma.refresh.create({
    data: {
      ...DEFAULT_REFRESH_PLACEHOLDER,
      status: "fetching",
      url: rawUrl,
      targetWebsite: rawUrl,
      urlProfileId: urlProfile.id,
      htmlSnapshot: html,
      cssSnapshot: css,
    },
  });
  const refreshId = refresh.id;
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
        refreshId,
        onRetry,
      }),
      extractAndPersistAssets(urlProfile, html, css, rawUrl, screenshotBuffer),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] Step 1 failed:", msg);
    onProgress?.({ step: "error", message: msg });
    await prisma.refresh.update({ where: { id: refreshId }, data: { status: "failed" } }).catch(() => {});
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

  // Emit tokens — lightweight signals for frontend
  const topColors = assetResult.assets.colors
    .slice(0, 5)
    .map((c) => ("hex" in c ? c.hex : String(c)));
  const topFonts = assetResult.assets.fonts
    .slice(0, 4)
    .map((f) => ("family" in f ? f.family : String(f)));

  onProgress?.({ step: "token", key: "industry", data: {
    name: industry,
    confidence: industrySeo.industry?.confidence ?? 0,
  }});
  onProgress?.({ step: "token", key: "colors", data: { palette: topColors }});
  onProgress?.({ step: "token", key: "fonts", data: { families: topFonts }});
  onProgress?.({ step: "token", key: "seo", data: {
    score: industrySeo.seo?.score ?? null,
    issueCount: industrySeo.seo?.issues?.length ?? 0,
  }});
  onProgress?.({ step: "token", key: "structure", data: {
    heroType: screenshotAnalysis.layout?.heroType ?? null,
    sectionCount: screenshotAnalysis.layout?.sectionCount ?? null,
  }});

  // --- Step 2: Score Agent ---
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

  const scoreResult = await runScoreAgent({
    skills,
    input: {
      screenshotAnalysis,
      industrySeo,
      benchmarks,
      benchmarkCount: benchmarks.length,
    },
    refreshId,
    onRetry,
  });

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

  // Emit score token
  const scoreEntries = Object.entries(scoreResult.scores).filter(([k]) => k !== "overall");
  const bestDim = scoreEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worstDim = scoreEntries.reduce((a, b) => (b[1] < a[1] ? b : a));
  onProgress?.({ step: "token", key: "scores", data: {
    overall: scoreResult.scores.overall,
    top: { name: bestDim[0], score: bestDim[1] },
    bottom: { name: worstDim[0], score: worstDim[1] },
  }});

  // --- Step 3: Creative Agents ---
  console.log("[pipeline] step 3: creative agents");
  onProgress?.({ step: "generating", message: "Generating 3 design options..." });

  // Don't pass data URIs to creative agents — they're MB-sized base64 strings
  const safeUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    if (url.startsWith("data:")) return null;
    return url;
  };

  const creativeInput: CreativeAgentInput = {
    creativeBrief: scoreResult.creativeBrief,
    industry,
    brandAssets: {
      logoUrl: safeUrl(assetResult.storedAssets.find((a) => a.assetType === "logo")?.storageUrl),
      heroImageUrl: safeUrl(assetResult.storedAssets.find((a) => a.assetType === "hero_image")?.storageUrl),
      colors: assetResult.assets.colors.map((c) => ("hex" in c ? c.hex : String(c))),
      fonts: assetResult.assets.fonts.map((f) => ("family" in f ? f.family : String(f))),
      navLinks: assetResult.assets.copy?.navItems ?? [],
      copy: assetResult.assets.copy,
    },
  };

  // Run creative agents sequentially with a short delay to reduce rate-limit (429) failures.
  // All 3 layouts are required for the product; sequential calls are more reliable than parallel.
  // Send progress after each so the SSE stream doesn't hit Vercel's ~60s idle timeout.
  const creativeSlugs: CreativeSlug[] = ["creative-modern", "creative-classy", "creative-unique"];
  const creativeTemplateNames = ["Modern", "Classy", "Unique"];
  const CREATIVE_DELAY_MS = 2000;
  const layouts: (Awaited<ReturnType<typeof runCreativeAgent>> | null)[] = [];
  for (let i = 0; i < creativeSlugs.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, CREATIVE_DELAY_MS));
    console.log("[pipeline] creative agent", i + 1, "of 3");
    onProgress?.({ step: "generating", message: `Starting layout ${i + 1} of 3...` });
    try {
      const result = await runCreativeAgent({
        skills,
        slug: creativeSlugs[i],
        input: creativeInput,
        refreshId,
        onRetry,
      });
      layouts.push(result);

      // Persist this layout immediately
      const templateName = result.html?.trim() ? creativeTemplateNames[i] : "pending";
      const layoutNum = i + 1;
      await prisma.refresh.update({
        where: { id: refreshId },
        data: {
          [`layout${layoutNum}Html`]: result.html ?? "",
          [`layout${layoutNum}Css`]: "",
          [`layout${layoutNum}Template`]: templateName,
          [`layout${layoutNum}CopyRefreshed`]: result.html ?? "",
          [`layout${layoutNum}Rationale`]: result.rationale ?? "",
        },
      });

      onProgress?.({ step: "token", key: "layout", data: { index: layoutNum, template: creativeTemplateNames[i] }});
      onProgress?.({ step: "generating", message: `Generated ${i + 1} of 3 design options...` });
    } catch (err) {
      console.error(`[pipeline] Creative agent ${creativeSlugs[i]} failed:`, err);
      layouts.push(null);
      onProgress?.({ step: "generating", message: `Layout ${i + 1} skipped. Continuing...` });
    }
  }
  const successCount = layouts.filter(Boolean).length;
  if (successCount === 0) {
    console.error("[pipeline] All 3 Creative Agents failed. Saving scores/SEO/benchmarks without layouts.");
    onProgress?.({ step: "error", message: "Layout generation was unable to complete. Your scores and audit are still saved below." });
  }

  // --- Step 4: Finalize ---
  let screenshotUrl: string | null = null;
  if (screenshotBuffer) {
    const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
    const blobKey = screenshotKey(refreshId, rawUrl);
    screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      status: "complete",
      screenshotUrl,
      skillVersions: skillVersions as object,
      processingTime: Math.round((Date.now() - startTime) / 1000),
    },
  });

  await prisma.urlProfile.update({
    where: { id: urlProfile.id },
    data: {
      analysisCount: { increment: 1 },
      lastAnalyzedAt: new Date(),
      latestScore: scoreResult.scores.overall,
      bestScore: Math.max(urlProfile.bestScore ?? 0, scoreResult.scores.overall),
      ...(urlProfile.industryLocked ? {} : { industry }),
    },
  });

  const elapsedSec = Math.round((Date.now() - startTime) / 1000);
  console.log("[pipeline] completed", { refreshId, elapsedSec });
  return refreshId;
}
