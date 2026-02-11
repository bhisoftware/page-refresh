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
import { selectTemplates } from "@/lib/templates/selector";
import { injectAssets } from "@/lib/templates/injector";
import { refreshCopy } from "@/lib/templates/copy-refresher";
import {
  getCachedTemplatesByNames,
  getCachedFirstTemplate,
} from "@/lib/cache/seed-cache";
import { normalizeWebsiteUrl } from "@/lib/utils";

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

  // Create preliminary Analysis so we have analysisId for PromptLog on all AI calls
  const analysis = await prisma.analysis.create({
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

  const analysisId = analysis.id;
  const onRetry = (delayMs: number) =>
    onProgress?.({ step: "retry", message: `Analysis paused due to API limits. Retrying in ${Math.round(delayMs / 1000)} seconds...` });
  const promptLog = { analysisId, step: "", onRetry };

  onProgress?.({ step: "vision", message: "Analyzing design..." });
  onProgress?.({ step: "industry", message: "Detecting industry..." });

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
    detectIndustry(html, { ...promptLog, step: "industry_detection" }),
  ]);
  logStepElapsed("vision+industry", startTime);

  const brandAnalysis = visionResult.analysis;
  const industryDetected = industryResult.industry;
  const industryConfidence = industryResult.confidence;

  onProgress?.({ step: "score", message: "Scoring across 8 dimensions..." });

  const scoring = await scoreWebsite({
    industry: industryDetected,
    brandAnalysis,
    extractedCopy: assets.copy,
    seoAudit: seoAudit as unknown as Record<string, unknown>,
    promptLog: { analysisId, step: "dimension_scoring", onRetry },
  });
  logStepElapsed("score", startTime);

  onProgress?.({ step: "layouts", message: "Generating 6 layout proposals..." });

  const copySummary = JSON.stringify(assets.copy).slice(0, 500);
  const templateNames = await selectTemplates(
    industryDetected,
    scoring.details,
    copySummary,
    { analysisId, step: "template_selection", onRetry }
  );

  const templates = await getCachedTemplatesByNames(templateNames);
  const fallback = await getCachedFirstTemplate();
  const layout1 = templates[0] ?? fallback ?? null;
  if (!layout1) {
    throw new Error("No templates available. Run db:seed to load templates.");
  }
  const layout2 = templates[1] ?? layout1;
  const layout3 = templates[2] ?? layout1;
  const layout4 = templates[3] ?? layout1;
  const layout5 = templates[4] ?? layout1;
  const layout6 = templates[5] ?? layout1;

  const inj1 = injectAssets(layout1.htmlTemplate, layout1.cssTemplate, assets);
  const inj2 = injectAssets(layout2.htmlTemplate, layout2.cssTemplate, assets);
  const inj3 = injectAssets(layout3.htmlTemplate, layout3.cssTemplate, assets);
  const inj4 = injectAssets(layout4.htmlTemplate, layout4.cssTemplate, assets);
  const inj5 = injectAssets(layout5.htmlTemplate, layout5.cssTemplate, assets);
  const inj6 = injectAssets(layout6.htmlTemplate, layout6.cssTemplate, assets);
  logStepElapsed("layouts", startTime);

  onProgress?.({ step: "copy", message: "Refreshing copy..." });

  const [refreshed1, refreshed2, refreshed3, refreshed4, refreshed5, refreshed6] =
    await Promise.all([
      refreshCopy(industryDetected, assets.copy, layout1.description, {
        analysisId,
        step: "copy_refresh_layout1",
        onRetry,
      }),
      refreshCopy(industryDetected, assets.copy, layout2.description, {
        analysisId,
        step: "copy_refresh_layout2",
        onRetry,
      }),
      refreshCopy(industryDetected, assets.copy, layout3.description, {
        analysisId,
        step: "copy_refresh_layout3",
        onRetry,
      }),
      refreshCopy(industryDetected, assets.copy, layout4.description, {
        analysisId,
        step: "copy_refresh_layout4",
        onRetry,
      }),
      refreshCopy(industryDetected, assets.copy, layout5.description, {
        analysisId,
        step: "copy_refresh_layout5",
        onRetry,
      }),
      refreshCopy(industryDetected, assets.copy, layout6.description, {
        analysisId,
        step: "copy_refresh_layout6",
        onRetry,
      }),
    ]);
  logStepElapsed("copy", startTime);

  const htmlWithRefreshed1 = applyRefreshedCopy(inj1.html, refreshed1);
  const htmlWithRefreshed2 = applyRefreshedCopy(inj2.html, refreshed2);
  const htmlWithRefreshed3 = applyRefreshedCopy(inj3.html, refreshed3);
  const htmlWithRefreshed4 = applyRefreshedCopy(inj4.html, refreshed4);
  const htmlWithRefreshed5 = applyRefreshedCopy(inj5.html, refreshed5);
  const htmlWithRefreshed6 = applyRefreshedCopy(inj6.html, refreshed6);

  let screenshotUrl: string | null = null;
  if (screenshotBuffer) {
    const { buffer: optimized, contentType } = await compressScreenshotToWebP(screenshotBuffer);
    const blobKey = screenshotKey(analysisId, normalizedUrl);
    screenshotUrl = await uploadBlob(blobKey, optimized, contentType);
  }

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  logStepElapsed("upload+finalize", startTime);
  console.log(`[pipeline] analysis ${analysisId} complete in ${processingTime}s`);

  onProgress?.({ step: "done", message: "Finalizing..." });

  await prisma.analysis.update({
    where: { id: analysisId },
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
      layout1Html: inj1.html,
      layout1Css: inj1.css,
      layout1Template: layout1.name,
      layout1CopyRefreshed: htmlWithRefreshed1,
      layout2Html: inj2.html,
      layout2Css: inj2.css,
      layout2Template: layout2.name,
      layout2CopyRefreshed: htmlWithRefreshed2,
      layout3Html: inj3.html,
      layout3Css: inj3.css,
      layout3Template: layout3.name,
      layout3CopyRefreshed: htmlWithRefreshed3,
      layout4Html: inj4.html,
      layout4Css: inj4.css,
      layout4Template: layout4.name,
      layout4CopyRefreshed: htmlWithRefreshed4,
      layout5Html: inj5.html,
      layout5Css: inj5.css,
      layout5Template: layout5.name,
      layout5CopyRefreshed: htmlWithRefreshed5,
      layout6Html: inj6.html,
      layout6Css: inj6.css,
      layout6Template: layout6.name,
      layout6CopyRefreshed: htmlWithRefreshed6,
      processingTime,
    },
  });

  return analysisId;
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

function applyRefreshedCopy(
  html: string,
  refreshed: {
    headline: string;
    subheadline: string;
    ctaText: string;
  }
): string {
  return html
    .replace(/\{\{headline\}\}/g, refreshed.headline)
    .replace(/\{\{subheadline\}\}/g, refreshed.subheadline)
    .replace(/\{\{ctaText\}\}/g, refreshed.ctaText)
    .replace(/Your Main Headline Goes Here/g, refreshed.headline)
    .replace(/Supporting paragraph that explains your value proposition\./g, refreshed.subheadline)
    .replace(/Call to Action/g, refreshed.ctaText);
}
