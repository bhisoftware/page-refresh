/**
 * Run the scoring pipeline for a single benchmark. Used by admin score and score-all.
 * Uses benchmark's stored industry; does NOT run detectIndustry.
 */

import { prisma } from "@/lib/prisma";
import { fetchHtml } from "@/lib/scraping/fetch-html";
import { detectTechStack } from "@/lib/scraping/tech-detector";
import { fetchExternalCss } from "@/lib/scraping/fetch-external-css";
import { extractAssets } from "@/lib/scraping/asset-extractor";
import { runSeoAudit } from "@/lib/seo/auditor";
import { analyzeHtmlStructure } from "@/lib/ai/claude-text";
import { scoreWebsite } from "@/lib/scoring/scorer";

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

export async function runBenchmarkScoring(benchmarkId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const benchmark = await prisma.benchmark.findUnique({ where: { id: benchmarkId } });
  if (!benchmark) return { ok: false, error: "Not found" };

  const url = benchmark.url.startsWith("http") ? benchmark.url : `https://${benchmark.url}`;
  let html: string;
  try {
    const result = await fetchHtml(url);
    html = result.html;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const techStack = detectTechStack(html);
  const inlineCss = extractInlineCss(html);
  const externalCss = await fetchExternalCss(html, url, 3);
  const css = [inlineCss, externalCss].filter(Boolean).join("\n");
  const assets = extractAssets(html, css, url);
  const seoAudit = runSeoAudit(html);
  const { analysis: brandAnalysis } = await analyzeHtmlStructure(html, techStack);

  const scoring = await scoreWebsite({
    industry: benchmark.industry,
    brandAnalysis,
    extractedCopy: assets.copy,
    seoAudit: seoAudit as unknown as Record<string, unknown>,
  });

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
    },
  });

  return { ok: true };
}
