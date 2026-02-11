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
