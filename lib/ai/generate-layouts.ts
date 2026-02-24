/**
 * AI-generated layout pages: Claude generates 3 complete, unique HTML/CSS landing pages
 * from the scraped assets and scoring context. Uses 3 parallel calls (one per creative
 * direction) for smaller output per call, more reliable JSON, and partial success if one fails.
 */

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import { checkBudget, truncateToTokenBudget, estimateTokens } from "@/lib/ai/token-estimator";
import { createPromptLog } from "@/lib/ai/prompt-log";
import type { ExtractedCopy } from "@/lib/scraping/asset-extractor";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";
const MAX_OUTPUT_TOKENS_PER_LAYOUT = 6000;
const PROMPT_TOKEN_BUDGET = 45_000;
const BODY_SAMPLES_MAX = 5;
const IMAGES_MAX = 8;

const CREATIVE_DIRECTIONS = [
  {
    label: "Bold & Modern",
    direction:
      "Strong visual hierarchy, large typography, full-width hero with the business's primary image. Use dark or vibrant accent sections. High impact.",
  },
  {
    label: "Clean & Professional",
    direction:
      "Lots of whitespace, structured grid layout, subtle colors. Include trust-building elements: credentials, process steps, contact info. Polished and corporate-friendly.",
  },
  {
    label: "Warm & Engaging",
    direction:
      "Editorial feel, story-driven flow, lifestyle imagery, social proof. Use warm tones from the brand palette. Approachable and conversion-focused.",
  },
] as const;

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

export interface GenerateLayoutsInput {
  url: string;
  industry: string;
  brandAnalysis: string;
  scores: Array<{ dimension: string; score: number; issues?: string[]; recommendations?: string[] }>;
  assets: {
    colors: Array<{ hex: string; count?: number }>;
    fonts: Array<{ family: string }>;
    images: Array<{ src: string; alt?: string }>;
    logo: string | null;
    copy: ExtractedCopy;
  };
  screenshotUrl: string | null;
  promptLog: PromptLogContext;
}

export interface GenerateLayoutsResult {
  layouts: Array<{ html: string; css: string; label: string }>;
}

function buildCreativeBrief(input: GenerateLayoutsInput): string {
  const { url, industry, brandAnalysis, assets, scores } = input;
  const c = assets.copy;

  const colorsText =
    assets.colors.length > 0
      ? assets.colors
          .slice(0, 10)
          .map((x) => x.hex)
          .join(", ")
      : "none extracted — use a modern default palette";
  const fontsText =
    assets.fonts.length > 0
      ? assets.fonts
          .slice(0, 5)
          .map((f) => f.family)
          .join(", ")
      : "system-ui, sans-serif";
  const imagesText =
    assets.images.length > 0
      ? assets.images
          .slice(0, IMAGES_MAX)
          .map((img) => `${img.src}${img.alt ? ` (alt: ${img.alt})` : ""}`)
          .join("\n")
      : "none";
  const logoText = assets.logo ?? "none";

  const copyText = [
    c.h1 && `H1: ${c.h1}`,
    c.heroText && `Hero: ${c.heroText}`,
    c.h2?.length && `H2s: ${c.h2.slice(0, 5).join(" | ")}`,
    c.ctaText && `CTA: ${c.ctaText}`,
    c.navItems?.length && `Nav: ${c.navItems.slice(0, 8).join(", ")}`,
    c.bodySamples?.length &&
      `Body samples: ${c.bodySamples.slice(0, BODY_SAMPLES_MAX).join(" | ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const scoresText = scores
    .map(
      (s) =>
        `- ${s.dimension}: ${s.score}/100${s.issues?.length ? ` — ${s.issues.slice(0, 2).join("; ")}` : ""}`
    )
    .join("\n");

  return `
BUSINESS & CONTEXT
- URL: ${url}
- Industry: ${industry}

BRAND ANALYSIS (from vision step)
${brandAnalysis.slice(0, 3000)}

EXTRACTED COLORS (use these as the color palette)
${colorsText}

EXTRACTED FONTS (use these font families; add Google Fonts link if needed)
${fontsText}

EXTRACTED IMAGES (use these EXACT absolute URLs in <img src="..."> — do NOT use placeholders)
${imagesText}

LOGO (place prominently in header)
${logoText}

EXTRACTED COPY (use as raw material; improve and expand for the page)
${copyText.slice(0, 2000)}

DIMENSION SCORES (address the weakest dimensions in your designs)
${scoresText}
`;
}

function buildSingleLayoutPrompt(
  input: GenerateLayoutsInput,
  label: string,
  direction: string
): string {
  const brief = buildCreativeBrief(input);
  return `${brief}

CREATIVE DIRECTION FOR THIS PAGE: "${label}"
${direction}

TECHNICAL REQUIREMENTS
- Produce ONE complete self-contained HTML document: <!DOCTYPE html> through </html>.
- Put ALL CSS inside a single <style> tag in the <head>. No external stylesheets except Google Fonts.
- Include a <link> for Google Fonts if you use the extracted font families (or sensible alternatives).
- All images MUST use the exact absolute URLs from EXTRACTED IMAGES above. Do NOT invent or placeholder URLs.
- Fully responsive: mobile-first, with media queries for tablet and desktop.
- Include: header/nav with logo, hero section, 2–3 middle sections (features, testimonials, about, stats — based on available content), footer with CTA.
- Use semantic HTML5: <header>, <main>, <section>, <footer>.
- No JavaScript. CSS-only interactions (hover, transitions) are fine.
- Target production-quality design — not a wireframe or prototype.

OUTPUT FORMAT — Return valid JSON only, no other text:
{
  "label": "${label}",
  "html": "<!DOCTYPE html>...full document with <style> in head...",
  "css": "/* full CSS string for storage/export */"
}

The "html" field must be the complete renderable document (including <style> in head). The "css" field is a duplicate of the CSS for pipeline storage.`;
}

async function generateOneLayout(
  input: GenerateLayoutsInput,
  label: string,
  direction: string,
  stepSuffix: string
): Promise<{ html: string; css: string; label: string } | null> {
  const prompt = buildSingleLayoutPrompt(input, label, direction);
  const budget = checkBudget(prompt, MAX_OUTPUT_TOKENS_PER_LAYOUT);
  let finalPrompt = prompt;
  if (!budget.fits && estimateTokens(prompt) > PROMPT_TOKEN_BUDGET) {
    const truncatedBrief = truncateToTokenBudget(buildCreativeBrief(input), 25_000);
    finalPrompt = prompt.replace(buildCreativeBrief(input), truncatedBrief);
  }
  const maxTokens = Math.min(MAX_OUTPUT_TOKENS_PER_LAYOUT, budget.recommendedMaxTokens);

  const startMs = Date.now();
  const message = await withRetry(
    () =>
      client.messages.create({
        model: MODEL,
        max_tokens: Math.max(4096, maxTokens),
        system:
          "You are an expert web designer and frontend developer. You create beautiful, modern, conversion-optimized landing pages. Return only valid JSON.",
        messages: [{ role: "user", content: finalPrompt }],
      }),
    { onRetry: input.promptLog?.onRetry }
  );

  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const tokensUsed =
    message.usage?.input_tokens && message.usage?.output_tokens
      ? message.usage.input_tokens + message.usage.output_tokens
      : undefined;

  if (input.promptLog) {
    await createPromptLog({
      refreshId: input.promptLog.refreshId,
      step: `${input.promptLog.step}_${stepSuffix}`,
      provider: "claude",
      model: message.model,
      promptText: finalPrompt.slice(0, 5000),
      responseText: text.slice(0, 2000),
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  const result = safeParseJSON(text);
  if (!result.success || result.data == null) {
    throw new Error(`generateLayouts: failed to parse JSON for ${label}`);
  }
  const parsed = result.data as { label?: string; html?: string; css?: string };
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const css = typeof parsed.css === "string" ? parsed.css : "";
  if (!html) throw new Error(`generateLayouts: missing html for ${label}`);

  return {
    label: typeof parsed.label === "string" ? parsed.label : label,
    html,
    css,
  };
}

export async function generateLayouts(
  input: GenerateLayoutsInput
): Promise<GenerateLayoutsResult> {
  const results = await Promise.allSettled(
    CREATIVE_DIRECTIONS.map(({ label, direction }, i) =>
      generateOneLayout(
        input,
        label,
        direction,
        `layout${i + 1}`
      )
    )
  );

  const layouts: Array<{ html: string; css: string; label: string }> = [];
  results.forEach((settled, i) => {
    if (settled.status === "fulfilled" && settled.value) {
      layouts.push(settled.value);
    } else {
      const reason = settled.status === "rejected" ? settled.reason : "no value";
      console.warn(`[generateLayouts] Layout ${i + 1} (${CREATIVE_DIRECTIONS[i]!.label}) failed:`, reason);
    }
  });

  if (layouts.length === 0) {
    throw new Error(
      "generateLayouts: all 3 layout calls failed — " +
        results
          .map((r) => (r.status === "rejected" ? (r.reason as Error)?.message : null))
          .filter(Boolean)
          .join("; ")
    );
  }

  return { layouts };
}
