/**
 * Main analysis pipeline: URL → Screenshot → Assets → SEO → Vision + Industry (parallel) → Score → Layouts → Copy
 *
 * Performance (Phase 5): Vision+Industry and refreshCopy×3 use Promise.all; scorer runs 8 dimensions in parallel.
 * Industries/templates loaded via in-memory cache (lib/cache/seed-cache.ts). No N+1 queries.
 */

import { prisma } from "@/lib/prisma";
import { fetchHtml } from "@/lib/scraping/fetch-html";
import { captureScreenshotCloud } from "@/lib/scraping/cloud-screenshot";
import { detectTechStack } from "@/lib/scraping/tech-detector";
import { extractAssets } from "@/lib/scraping/asset-extractor";
import { fetchExternalCss } from "@/lib/scraping/fetch-external-css";
import { runSeoAudit } from "@/lib/seo/auditor";
import { uploadBlob, screenshotKey } from "@/lib/storage/netlify-blobs";
import { compressScreenshotToWebP } from "@/lib/scraping/screenshot-compress";
import { analyzeScreenshot } from "@/lib/ai/claude-vision";
import { detectIndustry, analyzeHtmlStructure } from "@/lib/ai/claude-text";
import { scoreWebsite } from "@/lib/scoring/scorer";
import { selectCompositions } from "@/lib/templates/selector";
import { composePage } from "@/lib/templates/compose";
import { injectAssets, replacePlaceholders, escapeHtml, stripUnresolvedPlaceholders, stripFallbackPlaceholderText } from "@/lib/templates/injector";
import { refreshCopy, type RefreshedCopy } from "@/lib/templates/copy-refresher";
import {
  getCachedTemplatesByNames,
  getCachedFirstTemplate,
} from "@/lib/cache/seed-cache";
import { normalizeWebsiteUrl } from "@/lib/utils";
import {
  estimateTokens,
  checkBudget,
  truncateToTokenBudget,
} from "@/lib/ai/token-estimator";

export type PipelineProgress =
  | { step: "screenshot"; message: string }
  | { step: "extract"; message: string }
  | { step: "seo"; message: string }
  | { step: "vision"; message: string }
  | { step: "industry"; message: string }
  | { step: "score"; message: string }
  | { step: "layouts"; message: string }
  | { step: "copy"; message: string }
  | { step: "retry"; message: string }
  | { step: "done"; message: string };

export interface PipelineOptions {
  url: string;
  onProgress?: (p: PipelineProgress) => void;
}

function logStepElapsed(step: string, startTime: number): void {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[pipeline] ${step} completed in ${elapsed}s (total: ${elapsed}s)`);
}

export async function runAnalysis(options: PipelineOptions): Promise<string> {
  const { url, onProgress } = options;
  const startTime = Date.now();
  const normalizedUrl = normalizeWebsiteUrl(
    url.startsWith("http") ? url : `https://${url}`
  );

  onProgress?.({ step: "screenshot", message: "Fetching website..." });

  const [{ html }, screenshotBuffer] = await Promise.all([
    fetchHtml(normalizedUrl),
    captureScreenshotCloud(normalizedUrl).catch(() => null),
  ]);
  logStepElapsed("screenshot", startTime);

  onProgress?.({ step: "extract", message: "Extracting assets..." });

  const inlineCss = extractInlineCss(html);
  const externalCss = await fetchExternalCss(html, normalizedUrl, 3);
  const css = [inlineCss, externalCss].filter(Boolean).join("\n");
  const assets = extractAssets(html, css, normalizedUrl);
  const techStack = detectTechStack(html);
  logStepElapsed("extract", startTime);

  onProgress?.({ step: "seo", message: "Running SEO audit..." });

  const seoAudit = runSeoAudit(html);

  // Create preliminary Refresh so we have refreshId for PromptLog on all AI calls
  const refresh = await prisma.refresh.create({
    data: {
      url: normalizedUrl,
      targetWebsite: normalizedUrl,
      screenshotUrl: null,
      htmlSnapshot: html,
      cssSnapshot: css,
      extractedColors: assets.colors as unknown as object,
      extractedFonts: assets.fonts as unknown as object,
      extractedImages: assets.images as unknown as object,
      extractedCopy: assets.copy as unknown as object,
      extractedLogo: assets.logo ?? null,
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
      seoAudit: seoAudit as unknown as object,
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
      layout4Template: "pending",
      layout4CopyRefreshed: "",
      layout5Html: "",
      layout5Css: "",
      layout5Template: "pending",
      layout5CopyRefreshed: "",
      layout6Html: "",
      layout6Css: "",
      layout6Template: "pending",
      layout6CopyRefreshed: "",
    },
  });
  logStepElapsed("seo+db_create", startTime);

  const refreshId = refresh.id;
  const onRetry = (delayMs: number) =>
    onProgress?.({ step: "retry", message: `Refresh paused due to API limits. Retrying in ${Math.round(delayMs / 1000)} seconds...` });
  const promptLog = { refreshId, step: "", onRetry };

  onProgress?.({ step: "vision", message: "Analyzing design..." });
  onProgress?.({ step: "industry", message: "Detecting industry..." });

  const INDUSTRY_HTML_TOKEN_BUDGET = 40_000;
  const htmlForIndustry =
    estimateTokens(html) > INDUSTRY_HTML_TOKEN_BUDGET
      ? truncateToTokenBudget(html, INDUSTRY_HTML_TOKEN_BUDGET)
      : html;
  if (htmlForIndustry !== html) {
    console.warn(
      `[pipeline] HTML truncated for industry step (${estimateTokens(html)} -> ${estimateTokens(htmlForIndustry)} tokens)`
    );
  }

  const visionPromise = screenshotBuffer
    ? analyzeScreenshot(screenshotBuffer.toString("base64"), {
        ...promptLog,
        step: "screenshot_analysis",
      })
    : analyzeHtmlStructure(html, techStack, {
        ...promptLog,
        step: "html_structure_analysis",
      });

  const [visionResult, industryResult] = await Promise.all([
    visionPromise,
    detectIndustry(htmlForIndustry, { ...promptLog, step: "industry_detection" }),
  ]);
  logStepElapsed("vision+industry", startTime);

  const brandAnalysis = visionResult.analysis;
  const industryDetected = industryResult.industry;
  const industryConfidence = industryResult.confidence;

  onProgress?.({ step: "score", message: "Scoring across 8 dimensions..." });

  const SCORING_CONTEXT_TOKEN_BUDGET = 25_000;
  const scoringBrandAnalysis =
    estimateTokens(brandAnalysis) > SCORING_CONTEXT_TOKEN_BUDGET
      ? truncateToTokenBudget(brandAnalysis, SCORING_CONTEXT_TOKEN_BUDGET)
      : brandAnalysis;
  if (scoringBrandAnalysis !== brandAnalysis) {
    console.warn(
      `[pipeline] brandAnalysis truncated for scoring (${estimateTokens(brandAnalysis)} -> ${estimateTokens(scoringBrandAnalysis)} tokens)`
    );
  }
  const scoringContext = `${scoringBrandAnalysis}\n${JSON.stringify(assets.copy)}\n${JSON.stringify(seoAudit)}`;
  const budgetCheck = checkBudget(scoringContext, 1024);
  if (!budgetCheck.fits) {
    console.warn(
      `[pipeline] Scoring context large (${budgetCheck.promptTokens} tokens); using truncated brand analysis`
    );
  }

  const scoring = await scoreWebsite({
    industry: industryDetected,
    brandAnalysis: scoringBrandAnalysis,
    extractedCopy: assets.copy,
    seoAudit: seoAudit as unknown as Record<string, unknown>,
    promptLog: { refreshId, step: "dimension_scoring", onRetry },
  });
  logStepElapsed("score", startTime);

  onProgress?.({ step: "layouts", message: "Generating 3 layout proposals..." });

  const copySummary = JSON.stringify(assets.copy).slice(0, 500);
  const compositions = await selectCompositions(
    industryDetected,
    scoring.details,
    copySummary,
    { refreshId, step: "composition_selection", onRetry }
  );

  const fallback = await getCachedFirstTemplate();
  if (!fallback) {
    throw new Error("No templates available. Run db:seed to load templates.");
  }

  // Phase 2: build 3 full pages from compositions (each composition = 3–5 section names)
  const builtLayouts: Array<{ html: string; css: string; templateLabel: string; layoutContext: string }> = [];
  for (let i = 0; i < 3; i++) {
    const sectionNames = compositions[i] ?? compositions[0]!;
    const sectionTemplates = await getCachedTemplatesByNames(sectionNames);
    const templatesInOrder = sectionNames
      .map((name) => sectionTemplates.find((t) => t.name === name))
      .filter(Boolean) as Awaited<ReturnType<typeof getCachedTemplatesByNames>>;
    const sections = templatesInOrder.length >= 3 ? templatesInOrder : [fallback, fallback, fallback];
    const { html: composedHtml, css: composedCss } = composePage(sections);
    const inj = injectAssets(composedHtml, composedCss, assets);
    const layoutContext = sections.map((s) => s.description).join(" | ");
    const templateLabel = sectionNames.slice(0, 3).join(" + ") + (sectionNames.length > 3 ? ` + ${sectionNames.length - 3} more` : "");
    builtLayouts.push({ html: inj.html, css: inj.css, templateLabel, layoutContext });
  }
  logStepElapsed("layouts", startTime);

  onProgress?.({ step: "copy", message: "Refreshing copy..." });

  const [refreshed1, refreshed2, refreshed3] = await Promise.all([
    refreshCopy(industryDetected, assets.copy, builtLayouts[0]!.layoutContext, {
      refreshId,
      step: "copy_refresh_layout1",
      onRetry,
    }),
    refreshCopy(industryDetected, assets.copy, builtLayouts[1]!.layoutContext, {
      refreshId,
      step: "copy_refresh_layout2",
      onRetry,
    }),
    refreshCopy(industryDetected, assets.copy, builtLayouts[2]!.layoutContext, {
      refreshId,
      step: "copy_refresh_layout3",
      onRetry,
    }),
  ]);
  logStepElapsed("copy", startTime);

  const htmlWithRefreshed1 = applyRefreshedCopy(builtLayouts[0]!.html, refreshedCopyToMap(refreshed1));
  const htmlWithRefreshed2 = applyRefreshedCopy(builtLayouts[1]!.html, refreshedCopyToMap(refreshed2));
  const htmlWithRefreshed3 = applyRefreshedCopy(builtLayouts[2]!.html, refreshedCopyToMap(refreshed3));

  // Phase 2 watch-out: validate no raw {{...}} in final composed output; strip any before persisting. Also strip fallback placeholder text (e.g. "Customer Name, Title, Company", "info@example.com").
  const cleaned = [0, 1, 2].map((i) => {
    const inj = { html: builtLayouts[i]!.html, css: builtLayouts[i]!.css };
    const refreshed = [htmlWithRefreshed1, htmlWithRefreshed2, htmlWithRefreshed3][i]!;
    const design = stripUnresolvedPlaceholders(inj.html);
    const copy = stripUnresolvedPlaceholders(refreshed);
    if (design.stripped || copy.stripped) {
      console.warn(`[pipeline] Layout ${i + 1}: stripped unresolved {{placeholders}} before save`);
    }
    return {
      html: stripFallbackPlaceholderText(design.html),
      css: inj.css,
      copyRefreshed: stripFallbackPlaceholderText(copy.html),
    };
  });

  let screenshotUrl: string | null = null;
  if (screenshotBuffer) {
    const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
    const blobKey = screenshotKey(refreshId, normalizedUrl);
    screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
  }

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  logStepElapsed("upload+finalize", startTime);
  console.log(`[pipeline] refresh ${refreshId} complete in ${processingTime}s`);

  onProgress?.({ step: "done", message: "Finalizing..." });

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      screenshotUrl,
      brandAnalysis,
      industryDetected,
      industryConfidence,
      overallScore: scoring.overallScore,
      clarityScore: scoring.dimensionScores.clarity,
      visualScore: scoring.dimensionScores.visual,
      hierarchyScore: scoring.dimensionScores.hierarchy,
      trustScore: scoring.dimensionScores.trust,
      conversionScore: scoring.dimensionScores.conversion,
      contentScore: scoring.dimensionScores.content,
      mobileScore: scoring.dimensionScores.mobile,
      performanceScore: scoring.dimensionScores.performance,
      scoringDetails: scoring.details as unknown as object,
      layout1Html: cleaned[0].html,
      layout1Css: cleaned[0].css,
      layout1Template: builtLayouts[0]!.templateLabel,
      layout1CopyRefreshed: cleaned[0].copyRefreshed,
      layout2Html: cleaned[1].html,
      layout2Css: cleaned[1].css,
      layout2Template: builtLayouts[1]!.templateLabel,
      layout2CopyRefreshed: cleaned[1].copyRefreshed,
      layout3Html: cleaned[2].html,
      layout3Css: cleaned[2].css,
      layout3Template: builtLayouts[2]!.templateLabel,
      layout3CopyRefreshed: cleaned[2].copyRefreshed,
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
      processingTime,
    },
  });

  return refreshId;
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

function refreshedCopyToMap(refreshed: RefreshedCopy): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {
    headline: refreshed.headline,
    subheadline: refreshed.subheadline,
    ctaText: refreshed.ctaText,
    ctaSecondary: (() => {
      const r = refreshed as unknown as Record<string, unknown>;
      return typeof r.ctaSecondary === "string" ? r.ctaSecondary : undefined;
    })(),
    heroSection: refreshed.heroSection,
  };
  if (refreshed.sections) {
    refreshed.sections.forEach((s, i) => {
      map[`section${i + 1}_title`] = s.title;
      map[`section${i + 1}_body`] = s.body;
    });
  }
  for (const [key, value] of Object.entries(refreshed)) {
    if (typeof value === "string" && !(key in map)) map[key] = value;
  }
  return map;
}

function applyRefreshedCopy(
  html: string,
  refreshed: Record<string, string | undefined>
): string {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(refreshed)) {
    if (typeof value === "string") map[key] = escapeHtml(value);
  }
  return replacePlaceholders(html, map);
}
