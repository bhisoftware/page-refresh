/**
 * Template selection logic - Phase 2: choose 3 full-page compositions (each 3–5 sections).
 * Uses Claude (analysis step). Falls back to rule-based compositions on failure.
 */

import { completeText } from "@/lib/ai/claude-text";
import { safeParseJSON } from "@/lib/ai/json-repair";
import { buildCompositionSelectionPrompt } from "@/lib/ai/prompt-templates";
import {
  getCachedTemplateNames,
  getCachedIndustryByName,
  getCachedTemplatesByIds,
} from "@/lib/cache/seed-cache";
import type { DimensionScore } from "@/lib/scoring/scorer";

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

/** Phase 2: Return 3 compositions; each composition is an array of 3–5 section names (in order). */
export async function selectCompositions(
  industry: string,
  scoringDetails: DimensionScore[],
  extractedCopySummary: string,
  promptLog?: PromptLogContext
): Promise<string[][]> {
  const templateNames = await getCachedTemplateNames();

  try {
    const prompt = buildCompositionSelectionPrompt(
      industry,
      scoringDetails,
      templateNames,
      extractedCopySummary
    );

    const { text } = await completeText(
      prompt,
      "You recommend full-page layouts. Return only valid JSON.",
      promptLog
    );

    const result = safeParseJSON(text);
    if (!result.success || result.data == null) throw new Error("Parse failed");
    if (result.method && result.method !== "direct") {
      console.warn(`[selector] composition_selection JSON parse used method: ${result.method}`);
    }
    const parsed = result.data as { compositions?: string[][] };
    const raw = parsed.compositions ?? [];

    const validCompositions = raw
      .filter(Array.isArray)
      .map((arr: unknown) =>
        (arr as string[]).filter((n) => typeof n === "string" && templateNames.includes(n))
      )
      .filter((arr: string[]) => arr.length >= 3 && arr.length <= 5);

    if (validCompositions.length >= 3) {
      return validCompositions.slice(0, 3);
    }
  } catch {
    // fallback
  }

  return selectCompositionsRuleBased(industry, templateNames);
}

/** Rule-based fallback: 3 compositions of 3 sections each from industry preferred or first 9. */
async function selectCompositionsRuleBased(
  industry: string,
  templateNames: string[]
): Promise<string[][]> {
  let names: string[] = templateNames;
  try {
    const ind = await getCachedIndustryByName(industry);
    const ids = Array.isArray(ind?.preferredTemplates)
      ? (ind.preferredTemplates as string[])
      : [];
    if (ids.length > 0) {
      const recs = await getCachedTemplatesByIds(ids);
      const preferred = recs.map((r) => r.name).filter((n) => templateNames.includes(n));
      if (preferred.length >= 3) {
        const remaining = templateNames.filter((n) => !preferred.includes(n));
        names = [...preferred, ...remaining];
      }
    }
  } catch {
    // use templateNames as-is
  }
  return [
    names.slice(0, 3),
    names.slice(3, 6),
    names.slice(6, 9),
  ].map((arr) => (arr.length >= 3 ? arr : [...arr, ...names].slice(0, 3)));
}

