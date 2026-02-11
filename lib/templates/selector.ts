/**
 * Template selection logic - choose 3 templates based on industry and scoring.
 * Uses Claude (analysis step, not copy writing). Falls back to rule-based selection on failure.
 * Uses in-memory cache for template names and industry data (Phase 5).
 */

import { completeText } from "@/lib/ai/claude-text";
import { buildTemplateSelectionPrompt } from "@/lib/ai/prompt-templates";
import {
  getCachedTemplateNames,
  getCachedIndustryByName,
  getCachedTemplatesByIds,
} from "@/lib/cache/seed-cache";
import type { DimensionScore } from "@/lib/scoring/scorer";

export interface PromptLogContext {
  analysisId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

export async function selectTemplates(
  industry: string,
  scoringDetails: DimensionScore[],
  extractedCopySummary: string,
  promptLog?: PromptLogContext
): Promise<string[]> {
  const templateNames = await getCachedTemplateNames();

  try {
    const prompt = buildTemplateSelectionPrompt(
      industry,
      scoringDetails,
      templateNames,
      extractedCopySummary
    );

    const { text } = await completeText(
      prompt,
      "You recommend website templates. Return only valid JSON.",
      promptLog
    );

    const json = extractJson(text);
    const parsed = JSON.parse(json) as { templateNames?: string[] };
    const names = parsed.templateNames ?? [];

    const valid = names.filter((n) => templateNames.includes(n));
    if (valid.length >= 3) return valid.slice(0, 3);
    if (valid.length > 0) {
      const remaining = templateNames.filter((n) => !valid.includes(n));
      return [...valid, ...remaining].slice(0, 3);
    }
  } catch {
    // Fallback: rule-based selection by industry
    return selectTemplatesRuleBased(industry, templateNames);
  }

  return selectTemplatesRuleBased(industry, templateNames);
}

/** Rule-based fallback when AI fails: use industry preferred templates or first 3. */
async function selectTemplatesRuleBased(
  industry: string,
  templateNames: string[]
): Promise<string[]> {
  try {
    const ind = await getCachedIndustryByName(industry);
    const ids = Array.isArray(ind?.preferredTemplates)
      ? (ind.preferredTemplates as string[])
      : [];
    if (!ids.length) return templateNames.slice(0, 3);
    const recs = await getCachedTemplatesByIds(ids);
    const names = recs.map((r) => r.name).filter((n) => templateNames.includes(n));
    if (names.length >= 3) return names.slice(0, 3);
    const remaining = templateNames.filter((n) => !names.includes(n));
    return [...names, ...remaining].slice(0, 3);
  } catch {
    return templateNames.slice(0, 3);
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}
