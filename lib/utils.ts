import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Analysis } from "@prisma/client";

/**
 * Public-safe shape for analysis results. Allowlist only — no internal notes,
 * prompt logs, or contact PII. Used by the public results API and page.
 */
export type PublicAnalysis = Pick<
  Analysis,
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
  | "layout2Html"
  | "layout2Css"
  | "layout2Template"
  | "layout2CopyRefreshed"
  | "layout3Html"
  | "layout3Css"
  | "layout3Template"
  | "layout3CopyRefreshed"
  | "layout4Html"
  | "layout4Css"
  | "layout4Template"
  | "layout4CopyRefreshed"
  | "layout5Html"
  | "layout5Css"
  | "layout5Template"
  | "layout5CopyRefreshed"
  | "layout6Html"
  | "layout6Css"
  | "layout6Template"
  | "layout6CopyRefreshed"
  | "selectedLayout"
  | "quoteRequested"
  | "installRequested"
  | "createdAt"
  | "processingTime"
>;

/**
 * Serialize an Analysis for public consumption. Explicit allowlist — never
 * includes internalNotes, promptHistory, contactEmail, contactPhone, notes,
 * viewToken, or other internal fields.
 */
export function serializeAnalysisForPublic(analysis: Analysis): PublicAnalysis {
  return {
    id: analysis.id,
    url: analysis.url,
    targetWebsite: analysis.targetWebsite,
    screenshotUrl: analysis.screenshotUrl,
    extractedColors: analysis.extractedColors,
    extractedFonts: analysis.extractedFonts,
    extractedImages: analysis.extractedImages,
    extractedCopy: analysis.extractedCopy,
    extractedLogo: analysis.extractedLogo,
    brandAnalysis: analysis.brandAnalysis,
    industryDetected: analysis.industryDetected,
    industryConfidence: analysis.industryConfidence,
    overallScore: analysis.overallScore,
    clarityScore: analysis.clarityScore,
    visualScore: analysis.visualScore,
    hierarchyScore: analysis.hierarchyScore,
    trustScore: analysis.trustScore,
    conversionScore: analysis.conversionScore,
    contentScore: analysis.contentScore,
    mobileScore: analysis.mobileScore,
    performanceScore: analysis.performanceScore,
    scoringDetails: analysis.scoringDetails,
    seoAudit: analysis.seoAudit,
    layout1Html: analysis.layout1Html,
    layout1Css: analysis.layout1Css,
    layout1Template: analysis.layout1Template,
    layout1CopyRefreshed: analysis.layout1CopyRefreshed,
    layout2Html: analysis.layout2Html,
    layout2Css: analysis.layout2Css,
    layout2Template: analysis.layout2Template,
    layout2CopyRefreshed: analysis.layout2CopyRefreshed,
    layout3Html: analysis.layout3Html,
    layout3Css: analysis.layout3Css,
    layout3Template: analysis.layout3Template,
    layout3CopyRefreshed: analysis.layout3CopyRefreshed,
    layout4Html: analysis.layout4Html,
    layout4Css: analysis.layout4Css,
    layout4Template: analysis.layout4Template,
    layout4CopyRefreshed: analysis.layout4CopyRefreshed,
    layout5Html: analysis.layout5Html,
    layout5Css: analysis.layout5Css,
    layout5Template: analysis.layout5Template,
    layout5CopyRefreshed: analysis.layout5CopyRefreshed,
    layout6Html: analysis.layout6Html,
    layout6Css: analysis.layout6Css,
    layout6Template: analysis.layout6Template,
    layout6CopyRefreshed: analysis.layout6CopyRefreshed,
    selectedLayout: analysis.selectedLayout,
    quoteRequested: analysis.quoteRequested,
    installRequested: analysis.installRequested,
    createdAt: analysis.createdAt,
    processingTime: analysis.processingTime,
  };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a pasted website URL by stripping duplicate schemes and redundant "www."
 * e.g. "https://www.https://bubblesmiamishop.com/" -> "https://bubblesmiamishop.com/"
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
  return s ? `https://${s}` : input.trim();
}
