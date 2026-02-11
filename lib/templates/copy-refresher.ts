/**
 * AI copy refresh for Design+Copy toggle.
 */

import { completeChat } from "@/lib/ai/openai";
import { buildCopyRefreshPrompt } from "@/lib/ai/prompt-templates";
import type { ExtractedCopy } from "@/lib/scraping/asset-extractor";

export interface PromptLogContext {
  analysisId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

export interface RefreshedCopy {
  headline: string;
  subheadline: string;
  ctaText: string;
  heroSection?: string;
  sections?: Array<{ title: string; body: string }>;
}

const FALLBACK_COPY = (oc: ExtractedCopy): RefreshedCopy => ({
  headline: oc.h1 ?? "Your Headline",
  subheadline: oc.heroText ?? "Supporting text.",
  ctaText: oc.ctaText ?? "Get Started",
});

export async function refreshCopy(
  industry: string,
  originalCopy: ExtractedCopy,
  layoutContext: string,
  promptLog?: PromptLogContext
): Promise<RefreshedCopy> {
  try {
    const prompt = buildCopyRefreshPrompt(
      industry,
      originalCopy as unknown as Record<string, unknown>,
      layoutContext
    );

    const { text } = await completeChat(
      [
        { role: "system", content: "You rewrite website copy. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      { promptLog }
    );

    const json = extractJson(text);
    const parsed = JSON.parse(json) as RefreshedCopy;
    return {
      headline: parsed.headline ?? originalCopy.h1 ?? "Your Headline",
      subheadline: parsed.subheadline ?? originalCopy.heroText ?? "Supporting text.",
      ctaText: parsed.ctaText ?? originalCopy.ctaText ?? "Get Started",
      heroSection: parsed.heroSection,
      sections: parsed.sections,
    };
  } catch {
    return FALLBACK_COPY(originalCopy);
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}
