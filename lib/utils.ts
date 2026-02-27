import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Refresh } from "@prisma/client";

/**
 * Public-safe shape for refresh results. Allowlist only — no internal notes,
 * prompt logs, or contact PII. Used by the public results API and page.
 */
export type PublicRefresh = Pick<
  Refresh,
  | "id"
  | "url"
  | "targetWebsite"
  | "screenshotUrl"
  | "extractedColors"
  | "extractedFonts"
  | "extractedImages"
  | "extractedCopy"
  | "extractedLogo"
  | "brandAnalysis"
  | "industryDetected"
  | "industryConfidence"
  | "overallScore"
  | "clarityScore"
  | "visualScore"
  | "hierarchyScore"
  | "trustScore"
  | "conversionScore"
  | "contentScore"
  | "mobileScore"
  | "performanceScore"
  | "scoringDetails"
  | "seoAudit"
  | "layout1Html"
  | "layout1Css"
  | "layout1Template"
  | "layout1CopyRefreshed"
  | "layout1Rationale"
  | "layout2Html"
  | "layout2Css"
  | "layout2Template"
  | "layout2CopyRefreshed"
  | "layout2Rationale"
  | "layout3Html"
  | "layout3Css"
  | "layout3Template"
  | "layout3CopyRefreshed"
  | "layout3Rationale"
  | "selectedLayout"
  | "quoteRequested"
  | "installRequested"
  | "createdAt"
  | "processingTime"
  | "benchmarkComparison"
>;

/**
 * Serialize a Refresh for public consumption. Explicit allowlist — never
 * includes internalNotes, promptHistory, contactEmail, contactPhone, notes,
 * viewToken, or other internal fields.
 */
export function serializeRefreshForPublic(refresh: Refresh): PublicRefresh {
  return {
    id: refresh.id,
    url: refresh.url,
    targetWebsite: refresh.targetWebsite,
    screenshotUrl: refresh.screenshotUrl,
    extractedColors: refresh.extractedColors,
    extractedFonts: refresh.extractedFonts,
    extractedImages: refresh.extractedImages,
    extractedCopy: refresh.extractedCopy,
    extractedLogo: refresh.extractedLogo,
    brandAnalysis: refresh.brandAnalysis,
    industryDetected: refresh.industryDetected,
    industryConfidence: refresh.industryConfidence,
    overallScore: refresh.overallScore,
    clarityScore: refresh.clarityScore,
    visualScore: refresh.visualScore,
    hierarchyScore: refresh.hierarchyScore,
    trustScore: refresh.trustScore,
    conversionScore: refresh.conversionScore,
    contentScore: refresh.contentScore,
    mobileScore: refresh.mobileScore,
    performanceScore: refresh.performanceScore,
    scoringDetails: refresh.scoringDetails,
    seoAudit: refresh.seoAudit,
    layout1Html: refresh.layout1Html,
    layout1Css: refresh.layout1Css,
    layout1Template: refresh.layout1Template,
    layout1CopyRefreshed: refresh.layout1CopyRefreshed,
    layout1Rationale: refresh.layout1Rationale,
    layout2Html: refresh.layout2Html,
    layout2Css: refresh.layout2Css,
    layout2Template: refresh.layout2Template,
    layout2CopyRefreshed: refresh.layout2CopyRefreshed,
    layout2Rationale: refresh.layout2Rationale,
    layout3Html: refresh.layout3Html,
    layout3Css: refresh.layout3Css,
    layout3Template: refresh.layout3Template,
    layout3CopyRefreshed: refresh.layout3CopyRefreshed,
    layout3Rationale: refresh.layout3Rationale,
    selectedLayout: refresh.selectedLayout,
    quoteRequested: refresh.quoteRequested,
    installRequested: refresh.installRequested,
    createdAt: refresh.createdAt,
    processingTime: refresh.processingTime,
    benchmarkComparison: refresh.benchmarkComparison,
  };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a pasted website URL by:
 * - Stripping duplicate schemes and redundant "www."
 * - Reducing to just the origin (protocol + host), dropping path and query
 * e.g. "https://bubblesmiamishop.com/pages/contact-us?srsltid=..." -> "https://bubblesmiamishop.com"
 */
export function normalizeWebsiteUrl(input: string): string {
  let s = input.trim();
  if (!s) return s;
  while (true) {
    const lower = s.toLowerCase();
    if (lower.startsWith("https://")) {
      s = s.slice(8).trim();
      continue;
    }
    if (lower.startsWith("http://")) {
      s = s.slice(7).trim();
      continue;
    }
    if (lower.startsWith("www.")) {
      s = s.slice(4).trim();
      continue;
    }
    break;
  }
  const withScheme = s ? `https://${s}` : input.trim();
  if (!withScheme) return input.trim();
  try {
    const parsed = new URL(withScheme);
    return parsed.origin;
  } catch {
    return withScheme;
  }
}
