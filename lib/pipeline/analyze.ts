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
  /** Called as soon as the Refresh row is created, so callers can reference it on timeout. */
  onRefreshCreated?: (refreshId: string) => void;
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

export async function runAnalysis(options: PipelineOptions): Promise<string> {
  const { url, onProgress, onRefreshCreated } = options;
  const startTime = Date.now();
  const rawUrl = url.startsWith("http") ? url : `https://${url}`;
  console.log("[pipeline] starting", { url: rawUrl });
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:runAnalysis", message: "runAnalysis entry", data: { url: rawUrl }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
  // #endregion

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onRetry = (_delayMs: number) =>
    onProgress?.({ step: "generating", message: "Still working on your designs..." });

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
  onRefreshCreated?.(refreshId);
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:refreshCreated", message: "refresh row created", data: { refreshId }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
  // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:step1Catch", message: "Step 1 failed", data: { refreshId, message: msg }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
    // #endregion
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

  // --- Step 2: Score Agent ---
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:step2Start", message: "Step 2 starting", data: { refreshId }, timestamp: Date.now(), hypothesisId: "B" }) }).catch(() => {});
  // #endregion
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
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:step3Start", message: "Step 3 starting", data: { refreshId }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
  // #endregion
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

  // Run creative agents in parallel with a 3s stagger to avoid overwhelming the API.
  // Much faster than fully sequential (3-6s stagger vs 15-25s per agent) while avoiding 429/529 spikes.
  const creativeSlugs: CreativeSlug[] = ["creative-modern", "creative-classy", "creative-unique"];
  const creativeTemplateNames = ["Modern", "Classy", "Unique"];
  const accentColor = creativeInput.brandAssets.colors[0] ?? "#2d5016";
  const CREATIVE_STAGGER_MS = 3000;
  let completedCount = 0;

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
      });
      // Persist this layout immediately on completion
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
      completedCount++;
      console.log("[pipeline] creative agent", i + 1, "of 3 — done");
      onProgress?.({
        step: "token",
        key: "layouts",
        data: {
          options: creativeTemplateNames.slice(0, completedCount).map((label) => ({ label, accentColor })),
        },
      });
      onProgress?.({ step: "generating", message: `Generated ${completedCount} of 3 design options...` });
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
    console.error("[pipeline] All 3 Creative Agents failed:", reasons);
    await prisma.refresh.update({
      where: { id: refreshId },
      data: { errorStep: "generating", errorMessage: `All 3 creative agents failed — ${reasons}`.slice(0, 2000) },
    }).catch(() => {});
    onProgress?.({ step: "error", message: "Layout generation was unable to complete. Your scores and audit are still saved below." });
  } else if (successCount < 3) {
    const failedSlugs = creativeSlugs.filter((_, i) => creativeResults[i].status === "rejected");
    const failedCount = 3 - successCount;
    console.warn(`[pipeline] ${failedCount} of 3 creative agents failed: ${failedSlugs.join(", ")}`);
    await prisma.refresh.update({
      where: { id: refreshId },
      data: {
        errorStep: "generating",
        errorMessage: `${failedCount} of 3 creative agents failed: ${failedSlugs.join(", ")}`,
      },
    }).catch(() => {});
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
  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "lib/pipeline/analyze.ts:runAnalysisReturn", message: "runAnalysis returning refreshId", data: { refreshId, elapsedSec }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
  // #endregion
  console.log("[pipeline] completed", { refreshId, elapsedSec });
  return refreshId;
}
