/**
 * AI copy refresh for Design+Copy toggle.
 */

import { completeChat } from "@/lib/ai/openai";
import { safeParseJSON } from "@/lib/ai/json-repair";
import { buildCopyRefreshPrompt } from "@/lib/ai/prompt-templates";
import type { ExtractedCopy } from "@/lib/scraping/asset-extractor";

export interface PromptLogContext {
  refreshId: string;
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

    const result = safeParseJSON(text);
    if (!result.success || result.data == null) throw new Error("Parse failed");
    if (result.method && result.method !== "direct") {
      console.warn(`[copy-refresher] JSON parse used method: ${result.method}`);
    }
    const parsed = result.data as RefreshedCopy;
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

