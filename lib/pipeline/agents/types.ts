/**
 * TypeScript interfaces for Phase 2 agent inputs/outputs.
 */

import type { ExtractedAssets } from "@/lib/scraping/asset-extractor";

// --- Screenshot Analysis Agent ---
export interface ScreenshotAnalysisOutput {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    additional?: string[];
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    headingSizes?: string[];
    weights?: string[];
  };
  layout?: {
    heroType?: string;
    navStyle?: string;
    sectionCount?: number;
    gridPattern?: string;
  };
  visualDensity?: number;
  brandAssets?: {
    logoDetected?: boolean;
    imageryStyle?: string;
    iconUsage?: string;
  };
  qualityScore?: number;
}

// --- Industry & SEO Agent ---
export interface IndustrySeoOutput {
  industry: {
    name: string;
    confidence: number;
    reasoning?: string;
    alternatives?: Array<{ name: string; confidence: number }>;
  };
  seo: {
    titleTag?: string | null;
    metaDescription?: string | null;
    h1Count?: number;
    hasCanonical?: boolean;
    hasOpenGraph?: boolean;
    hasStructuredData?: boolean;
    issues?: string[];
    score?: number;
  };
  copy: {
    headline?: string | null;
    valueProposition?: string | null;
    ctas?: string[];
    toneOfVoice?: string;
    navLabels?: string[];
  };
}

// --- Score Agent ---
export interface BenchmarkRow {
  overallScore: number;
  clarityScore: number;
  visualScore: number;
  hierarchyScore: number;
  trustScore: number;
  conversionScore: number;
  contentScore: number;
  mobileScore: number;
  performanceScore: number;
}

export interface ScoreAgentInput {
  screenshotAnalysis: ScreenshotAnalysisOutput;
  industrySeo: IndustrySeoOutput;
  benchmarks: BenchmarkRow[];
  benchmarkCount: number;
}

export interface CreativeBriefPriority {
  dimension: string;
  userScore: number;
  industryAvg: number | null;
  gap: number | null;
  priority: number;
  guidance: string;
}

export interface CreativeBrief {
  priorities?: CreativeBriefPriority[];
  strengths?: string[];
  industryRequirements?: string[];
  contentDirection?: string;
  technicalRequirements?: string[];
}

export interface ScoreAgentOutput {
  scores: {
    overall: number;
    clarity: number;
    visual: number;
    hierarchy: number;
    trust: number;
    conversion: number;
    content: number;
    mobile: number;
    performance: number;
  };
  scoringDetails: Array<{
    dimension: string;
    score: number;
    issues?: string[];
    recommendations?: string[];
  }>;
  benchmark?: {
    hasData: boolean;
    percentile: number | null;
    dimensionComparisons?: Record<string, unknown> | null;
  };
  creativeBrief: CreativeBrief;
}

// --- Creative Agent ---
export interface CreativeAgentInput {
  creativeBrief: CreativeBrief;
  industry: string;
  brandAssets: {
    logoUrl: string | null;
    heroImageUrl: string | null;
    colors: string[];
    fonts: string[];
    navLinks: string[];
    copy: ExtractedAssets["copy"];
  };
}

export interface CreativeAgentOutput {
  html: string;
  rationale: string;
}
