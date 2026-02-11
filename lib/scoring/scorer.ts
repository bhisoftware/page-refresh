/**
 * 0-100 scoring engine across 8 dimensions.
 * Uses Claude Text API with rubric + industry criteria.
 * Overall score is weighted by industry dimensionWeights when present.
 */

import {
  DIMENSIONS,
  type DimensionKey,
  getRubricEntries,
} from "@/lib/seed-data/scoring-rubric";
import { completeText } from "@/lib/ai/claude-text";
import { safeParseJSON } from "@/lib/ai/json-repair";
import { buildDimensionScoringPrompt } from "@/lib/ai/prompt-templates";
import type { ExtractedCopy } from "@/lib/scraping/asset-extractor";
import { getCachedIndustryByName } from "@/lib/cache/seed-cache";

const DEFAULT_WEIGHTS: Record<DimensionKey, number> = {
  clarity: 1.0,
  visual: 1.0,
  hierarchy: 1.0,
  trust: 1.0,
  conversion: 1.0,
  content: 1.0,
  mobile: 1.0,
  performance: 1.0,
};

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  clarity: "Clarity",
  visual: "Visual Quality",
  hierarchy: "Information Hierarchy",
  trust: "Trust & Credibility",
  conversion: "Conversion & Actionability",
  content: "Content Quality",
  mobile: "Mobile Experience",
  performance: "Performance & Technical",
};

export interface DimensionScore {
  dimension: string;
  score: number;
  issues: string[];
  recommendations: string[];
  /** Weight for this dimension in overall score (e.g. 2.0 = "weighted 2x for your industry") */
  weight?: number;
}

export interface ScoringResult {
  overallScore: number;
  dimensionScores: Record<DimensionKey, number>;
  details: DimensionScore[];
}

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

export interface ScoringInput {
  industry: string;
  brandAnalysis: string;
  extractedCopy: ExtractedCopy;
  seoAudit: Record<string, unknown>;
  promptLog?: PromptLogContext;
}

export async function scoreWebsite(input: ScoringInput): Promise<ScoringResult> {
  const dimensionScores: Partial<Record<DimensionKey, number>> = {};
  const details: DimensionScore[] = [];

  const rubricEntries = getRubricEntries();
  const byDimension = new Map<string, Array<{ scoreRange: string; criteria: import("@/lib/seed-data/scoring-rubric").RubricCriteria }>>();
  for (const e of rubricEntries) {
    if (!byDimension.has(e.dimension)) byDimension.set(e.dimension, []);
    byDimension.get(e.dimension)!.push({ scoreRange: e.scoreRange, criteria: e.criteria });
  }

  const context = {
    industry: input.industry,
    brandAnalysis: input.brandAnalysis,
    extractedCopy: input.extractedCopy as Record<string, unknown>,
    seoAudit: input.seoAudit,
  };

  const results = await Promise.all(
    DIMENSIONS.map(async (dim) => {
      const entries = byDimension.get(dim) ?? [];
      const prompt = buildDimensionScoringPrompt(
        dim,
        DIMENSION_LABELS[dim],
        entries,
        context
      );

      const promptLogCtx = input.promptLog
        ? { refreshId: input.promptLog.refreshId, step: `dimension_scoring_${dim}`, onRetry: input.promptLog.onRetry }
        : undefined;
      const { text } = await completeText(prompt, undefined, promptLogCtx);

      let score = 50;
      let issues: string[] = [];
      let recommendations: string[] = [];

      try {
        const parseResult = safeParseJSON(text);
        if (!parseResult.success || parseResult.data == null) throw new Error("Parse failed");
        if (parseResult.method && parseResult.method !== "direct") {
          console.warn(`[scorer] dimension_scoring_${dim} JSON parse used method: ${parseResult.method}`);
        }
        const parsed = parseResult.data as {
          score?: number;
          issues?: string[];
          recommendations?: string[];
        };
        const rawScore = Number(parsed.score);
        score = Math.min(100, Math.max(0, typeof rawScore === "number" && !Number.isNaN(rawScore) ? rawScore : 50));
        issues = Array.isArray(parsed.issues) ? parsed.issues : [];
        recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
      } catch {
        // Fallback: use midpoint
      }

      return { dim, score, issues, recommendations };
    })
  );

  const industry = await getCachedIndustryByName(input.industry);
  const criteria = industry?.scoringCriteria as { dimensionWeights?: Partial<Record<DimensionKey, number>> } | undefined;
  const weights: Record<DimensionKey, number> = { ...DEFAULT_WEIGHTS, ...criteria?.dimensionWeights };

  for (const { dim, score, issues, recommendations } of results) {
    dimensionScores[dim] = score;
    details.push({
      dimension: dim,
      score,
      issues,
      recommendations,
      weight: weights[dim] !== 1 ? weights[dim] : undefined,
    });
  }

  const weightedSum = DIMENSIONS.reduce((sum, dim) => sum + (dimensionScores[dim] ?? 0) * weights[dim], 0);
  const weightSum = DIMENSIONS.reduce((sum, dim) => sum + weights[dim], 0);
  const overallScore = Math.round(weightSum > 0 ? weightedSum / weightSum : 0);

  return {
    overallScore,
    dimensionScores: dimensionScores as Record<DimensionKey, number>,
    details,
  };
}

