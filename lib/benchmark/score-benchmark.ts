/**
 * Run the scoring pipeline for a single benchmark. Used by admin score and score-all.
 * Uses benchmark's stored industry; does NOT run detectIndustry.
 *
 * Pipeline: fetch HTML + screenshots → vision analysis → score → persist.
 * Screenshot capture and vision analysis are non-fatal; falls back to HTML-only analysis.
 */

import { prisma } from "@/lib/prisma";
import { fetchHtml } from "@/lib/scraping/fetch-html";
import { detectTechStack } from "@/lib/scraping/tech-detector";
import { fetchExternalCss } from "@/lib/scraping/fetch-external-css";
import { extractAssets } from "@/lib/scraping/asset-extractor";
import { runSeoAudit } from "@/lib/seo/auditor";
import { analyzeHtmlStructure } from "@/lib/ai/claude-text";
import { scoreWebsite } from "@/lib/scoring/scorer";
import { validateUrlForScreenshot } from "@/lib/scraping/url-validator";
import { compressScreenshotToWebP } from "@/lib/scraping/screenshot-compress";
import { uploadBlob } from "@/lib/storage/blobs";
import { getAllActiveSkills } from "@/lib/config/agent-skills";
import { runScreenshotAnalysisAgent } from "@/lib/pipeline/agents/screenshot-analysis";
import type { ScreenshotAnalysisOutput } from "@/lib/pipeline/agents/types";

// ---------------------------------------------------------------------------
// Screenshot capture helpers
// ---------------------------------------------------------------------------

export interface BenchmarkScreenshot {
  type: "desktop" | "mobile" | "full-page";
  url: string;
  label: string;
}

const SCREENSHOT_CONFIGS = [
  { type: "desktop" as const, label: "Desktop", width: 1440, height: 900, fullPage: false },
  { type: "mobile" as const, label: "Mobile", width: 390, height: 844, fullPage: false },
  { type: "full-page" as const, label: "Full Page", width: 1440, height: 900, fullPage: true },
] as const;

const API_TIMEOUT_MS = 15000;

async function captureOneScreenshot(
  siteUrl: string,
  apiKey: string,
  config: (typeof SCREENSHOT_CONFIGS)[number],
): Promise<{ type: (typeof config)["type"]; buffer: Buffer } | null> {
  const params = new URLSearchParams({
    url: siteUrl,
    viewport_width: String(config.width),
    viewport_height: String(config.height),
    format: "png",
    block_ads: "true",
    block_cookie_banners: "true",
    access_key: apiKey,
  });
  if (config.fullPage) {
    params.set("full_page", "true");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.screenshotone.com/take?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "image/png" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { type: config.type, buffer: buf };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function captureBenchmarkScreenshots(
  siteUrl: string,
): Promise<{ type: (typeof SCREENSHOT_CONFIGS)[number]["type"]; buffer: Buffer }[]> {
  const key = process.env.SCREENSHOTONE_API_KEY;
  if (!key?.trim()) return [];

  try {
    validateUrlForScreenshot(siteUrl);
  } catch {
    return [];
  }

  const results = await Promise.all(
    SCREENSHOT_CONFIGS.map((cfg) => captureOneScreenshot(siteUrl, key, cfg)),
  );
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ---------------------------------------------------------------------------
// CSS extraction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Screenshot analysis → text summary
// ---------------------------------------------------------------------------

function buildScreenshotAnalysisSummary(sa: ScreenshotAnalysisOutput): string {
  const parts: string[] = [];

  if (sa.colors) {
    const entries = Object.entries(sa.colors)
      .filter(([k, v]) => k !== "additional" && typeof v === "string" && v)
      .map(([k, v]) => `${k}: ${v}`);
    if (entries.length) parts.push(`Colors: ${entries.join(", ")}`);
  }

  if (sa.typography) {
    const fonts: string[] = [];
    if (sa.typography.headingFont) fonts.push(`Heading: ${sa.typography.headingFont}`);
    if (sa.typography.bodyFont) fonts.push(`Body: ${sa.typography.bodyFont}`);
    if (fonts.length) parts.push(`Typography: ${fonts.join(", ")}`);
  }

  if (sa.layout) {
    const l: string[] = [];
    if (sa.layout.heroType) l.push(`Hero: ${sa.layout.heroType}`);
    if (sa.layout.navStyle) l.push(`Nav: ${sa.layout.navStyle}`);
    if (sa.layout.sectionCount != null) l.push(`${sa.layout.sectionCount} sections`);
    if (sa.layout.gridPattern) l.push(`Grid: ${sa.layout.gridPattern}`);
    if (l.length) parts.push(`Layout: ${l.join(", ")}`);
  }

  if (typeof sa.visualDensity === "number") parts.push(`Visual density: ${sa.visualDensity}/10`);
  if (sa.brandAssets?.imageryStyle) parts.push(`Imagery style: ${sa.brandAssets.imageryStyle}`);
  if (sa.brandAssets?.logoDetected != null) parts.push(`Logo detected: ${sa.brandAssets.logoDetected ? "yes" : "no"}`);
  if (typeof sa.qualityScore === "number") parts.push(`Visual quality score: ${sa.qualityScore}/100`);

  return parts.length > 0 ? parts.join(". ") + "." : "";
}

// ---------------------------------------------------------------------------
// Main scoring pipeline
// ---------------------------------------------------------------------------

export async function runBenchmarkScoring(benchmarkId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const benchmark = await prisma.benchmark.findUnique({ where: { id: benchmarkId } });
  if (!benchmark) return { ok: false, error: "Not found" };

  const url = benchmark.url.startsWith("http") ? benchmark.url : `https://${benchmark.url}`;

  // 1. Fetch HTML + capture all screenshot variants in parallel
  let html: string;
  let screenshotCaptures: { type: "desktop" | "mobile" | "full-page"; buffer: Buffer }[] = [];
  try {
    const [fetchResult, captures] = await Promise.all([
      fetchHtml(url),
      captureBenchmarkScreenshots(url),
    ]);
    html = fetchResult.html;
    screenshotCaptures = captures;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const desktopCapture = screenshotCaptures.find((c) => c.type === "desktop") ?? null;

  // 2. Extract data
  const techStack = detectTechStack(html);
  const inlineCss = extractInlineCss(html);
  const externalCss = await fetchExternalCss(html, url, 3);
  const css = [inlineCss, externalCss].filter(Boolean).join("\n");
  const assets = extractAssets(html, css, url);
  const seoAudit = runSeoAudit(html);

  // 3. Vision-based analysis (preferred) or HTML-only fallback
  let brandAnalysis: string;
  if (desktopCapture) {
    try {
      const skills = await getAllActiveSkills();
      const screenshotAnalysis = await runScreenshotAnalysisAgent({
        skills,
        html,
        screenshotBuffer: desktopCapture.buffer,
      });
      brandAnalysis = buildScreenshotAnalysisSummary(screenshotAnalysis);
      if (!brandAnalysis) {
        const { analysis } = await analyzeHtmlStructure(html, techStack);
        brandAnalysis = analysis;
      }
    } catch (err) {
      console.warn("[benchmark] Screenshot analysis failed, falling back to HTML-only:", err instanceof Error ? err.message : String(err));
      const { analysis } = await analyzeHtmlStructure(html, techStack);
      brandAnalysis = analysis;
    }
  } else {
    const { analysis } = await analyzeHtmlStructure(html, techStack);
    brandAnalysis = analysis;
  }

  // 4. Score
  const scoring = await scoreWebsite({
    industry: benchmark.industry,
    brandAnalysis,
    extractedCopy: assets.copy,
    seoAudit: seoAudit as unknown as Record<string, unknown>,
  });

  // 5. Compress + upload all screenshots to S3 (non-fatal)
  let screenshotUrl: string | null = null;
  const screenshots: BenchmarkScreenshot[] = [];

  for (const capture of screenshotCaptures) {
    try {
      const { buffer: optimized, contentType } = await compressScreenshotToWebP(
        capture.buffer,
        capture.type === "full-page" ? { preserveHeight: true } : undefined,
      );
      const blobKey = `benchmarks/${benchmarkId}-${capture.type}.webp`;
      const blobUrl = await uploadBlob(blobKey, optimized, contentType);
      const label = SCREENSHOT_CONFIGS.find((c) => c.type === capture.type)?.label ?? capture.type;
      screenshots.push({ type: capture.type, url: blobUrl, label });
      if (capture.type === "desktop") {
        screenshotUrl = blobUrl;
      }
    } catch (err) {
      console.warn(`[benchmark] Screenshot upload failed for ${capture.type} (non-fatal):`, err instanceof Error ? err.message : String(err));
    }
  }

  // 6. Persist
  await prisma.benchmark.update({
    where: { id: benchmarkId },
    data: {
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
      scored: true,
      scoredAt: new Date(),
      screenshotUrl,
      screenshots: screenshots as unknown as object,
    },
  });

  return { ok: true };
}
