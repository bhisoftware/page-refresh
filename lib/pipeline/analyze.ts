/**
 * Phase 2 pipeline: 3-step agent architecture.
 * Step 0: UrlProfile + fetch. Step 1: Screenshot + Industry/SEO + Assets (parallel).
 * Step 2: Score Agent. Step 3: 3 Creative Agents (parallel). Step 4: Save.
 */

import { prisma } from "@/lib/prisma";
import { fetchHtml } from "@/lib/scraping/fetch-html";
import { captureScreenshotCloud } from "@/lib/scraping/cloud-screenshot";
import { uploadBlob, screenshotKey } from "@/lib/storage/netlify-blobs";
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
    throw err;
  }

  const industry = industrySeo.industry?.name ?? "General Business";

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

  // --- Step 3: Creative Agents ---
  onProgress?.({ step: "generating", message: "Generating 3 design options..." });

  // Don't pass data URIs to creative agents — they're MB-sized base64 strings
  // In production, these will be short /api/blob/ URLs from Netlify Blobs
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

  const creativeSlugs: CreativeSlug[] = ["creative-modern", "creative-classy", "creative-unique"];
  const creativeResults = await Promise.allSettled(
    creativeSlugs.map((slug) =>
      runCreativeAgent({ skills, slug, input: creativeInput, refreshId, onRetry })
    )
  );

  const layouts = creativeResults.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[pipeline] Creative agent ${i} failed:`, r.reason);
    return null;
  });
  const successCount = layouts.filter(Boolean).length;
  if (successCount === 0) {
    const msg = "All 3 Creative Agents failed. No layouts generated.";
    onProgress?.({ step: "error", message: msg });
    throw new Error(msg);
  }

  // --- Step 4: Save results ---
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

  let screenshotUrl: string | null = null;
  if (screenshotBuffer) {
    const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
    const blobKey = screenshotKey(refreshId, rawUrl);
    screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
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
      industryDetected: industry,
      industryConfidence: industrySeo.industry?.confidence ?? 0,
      brandAnalysis: JSON.stringify(screenshotAnalysis),
      seoAudit: (industrySeo.seo ?? {}) as object,
      extractedColors: assetResult.assets.colors as unknown as object,
      extractedFonts: assetResult.assets.fonts as unknown as object,
      extractedImages: assetResult.assets.images as unknown as object,
      extractedCopy: assetResult.assets.copy as object,
      extractedLogo: assetResult.assets.logo ?? null,
      layout1Html: layouts[0]?.html ?? "",
      layout1Css: "",
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
      screenshotUrl,
      skillVersions: skillVersions as object,
      ...(benchmarkComparison ? { benchmarkComparison: benchmarkComparison as object } : {}),
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

  return refreshId;
}
