/**
 * Claude Text API client for industry detection, HTML-structure analysis, and scoring.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import type { TechStack } from "@/lib/scraping/tech-detector";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

const INDUSTRY_LIST = [
  "Accountants",
  "Lawyers",
  "Golf Courses",
  "Beauty Salons",
  "Barbershops",
  "HOAs",
  "Veterinary Clinics",
  "Property Management",
  "Funeral Homes",
  "Daycares",
  "Lawn Care",
  "Insurance Agencies",
  "Gun Clubs",
  "Community Theatres",
  "Dentists",
  "Real Estate Agents",
  "Restaurants",
  "Fitness Studios",
  "Auto Repair",
  "General Contractors",
  "General Business",
];

export interface IndustryDetectionResult {
  industry: string;
  confidence: number;
  reasoning: string;
  alternatives?: { industry: string; confidence: number }[];
}

export async function detectIndustry(
  htmlContent: string,
  promptLog?: PromptLogContext
): Promise<IndustryDetectionResult> {
  const truncated = htmlContent.slice(0, 15000);
  const prompt = `Detect the industry/business type from this website content. 

Choose ONE from this list:
${INDUSTRY_LIST.map((i) => `- ${i}`).join("\n")}

Return valid JSON only, no other text:
{
  "industry": "Exact name from list above",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation",
  "alternatives": [{"industry": "...", "confidence": 0.x}]
}

Content (HTML stripped for analysis):
${truncated.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`;

  const startMs = Date.now();
  const message = await withRetry(
    () =>
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    { onRetry: promptLog?.onRetry }
  );

  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const tokensUsed = message.usage?.input_tokens && message.usage?.output_tokens
    ? message.usage.input_tokens + message.usage.output_tokens
    : undefined;

  if (promptLog) {
    await createPromptLog({
      refreshId: promptLog.refreshId,
      step: promptLog.step,
      provider: "claude",
      model: message.model,
      promptText: prompt,
      responseText: text,
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  try {
    const json = extractJson(text);
    const parsed = JSON.parse(json) as IndustryDetectionResult;
    if (!INDUSTRY_LIST.includes(parsed.industry)) {
      parsed.industry = "General Business";
      parsed.confidence = Math.min(parsed.confidence ?? 0.5, 0.5);
    }
    const conf = Number(parsed.confidence);
    parsed.confidence = typeof conf === "number" && !Number.isNaN(conf) ? Math.min(1, Math.max(0, conf)) : 0.5;
    if (parsed.confidence < 0.7) {
      parsed.industry = "General Business";
      parsed.reasoning = (parsed.reasoning ?? "") + " (Low confidence; using General Business for scoring.)";
    }
    return parsed;
  } catch {
    return {
      industry: "General Business",
      confidence: 0.3,
      reasoning: "Could not parse industry from response",
    };
  }
}

export async function completeText(
  prompt: string,
  system?: string,
  promptLog?: PromptLogContext
): Promise<{ text: string; tokensUsed?: number }> {
  const startMs = Date.now();
  const message = await withRetry(
    () =>
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: system ?? "You are a helpful assistant. Return only valid JSON when asked.",
        messages: [{ role: "user", content: prompt }],
      }),
    { onRetry: promptLog?.onRetry }
  );

  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const usage = message.usage;
  const tokensUsed = usage?.input_tokens && usage?.output_tokens
    ? usage.input_tokens + usage.output_tokens
    : undefined;

  if (promptLog) {
    await createPromptLog({
      refreshId: promptLog.refreshId,
      step: promptLog.step,
      provider: "claude",
      model: message.model,
      promptText: prompt,
      responseText: text,
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  return { text, tokensUsed };
}

const HTML_STRUCTURE_PROMPT = `You are analyzing a website's HTML structure (no screenshot available). Assess the same dimensions we use for visual analysis:

1. **Visual Quality** - Inferred from structure: modern vs dated, section diversity, semantic tags
2. **Layout Hierarchy** - Heading levels (h1→h2→h3), logical flow, section structure
3. **Trust Signals** - Presence of contact info, testimonials, credentials, footer/legal
4. **Mobile Responsiveness** - Meta viewport, responsive hints in markup
5. **Clarity of Messaging** - H1 and hero text clarity, value proposition
6. **CTA Visibility** - Buttons, links with CTA-like text, form presence
7. **Content Quality** - Content length, structure, readability signals
8. **Performance/Technical** - Script/style organization, potential issues

Provide specific, actionable observations for each dimension. Be concise but thorough.`;

export interface HtmlStructureAnalysisResult {
  analysis: string;
}

/** Fallback when screenshot is unavailable: analyze HTML structure for brand/design assessment. */
export async function analyzeHtmlStructure(
  html: string,
  techStack: TechStack,
  promptLog?: PromptLogContext
): Promise<HtmlStructureAnalysisResult> {
  const summary = buildHtmlStructureSummary(html);
  const techSummary = [
    ...techStack.frameworks,
    ...techStack.cms,
    ...techStack.cssFrameworks,
    ...techStack.analytics,
  ].filter(Boolean);
  const prompt = `${HTML_STRUCTURE_PROMPT}

Tech stack detected: ${techSummary.length ? techSummary.join(", ") : "Unknown"}

--- HTML structure summary (first 5000 chars, headings, tag counts) ---
${summary}`;

  const startMs = Date.now();
  const message = await withRetry(
    () =>
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    { onRetry: promptLog?.onRetry }
  );

  const textBlock = message.content.find((b) => b.type === "text");
  const analysis = textBlock && "text" in textBlock ? textBlock.text : "";
  const tokensUsed = message.usage?.input_tokens && message.usage?.output_tokens
    ? message.usage.input_tokens + message.usage.output_tokens
    : undefined;

  if (promptLog) {
    await createPromptLog({
      refreshId: promptLog.refreshId,
      step: promptLog.step,
      provider: "claude",
      model: message.model,
      promptText: prompt,
      responseText: analysis,
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  return { analysis };
}

function buildHtmlStructureSummary(html: string): string {
  const cap = 5000;
  const truncated = html.slice(0, cap);
  const headings: string[] = [];
  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    headings.push(`H${m[1]}: ${m[2].replace(/<[^>]+>/g, "").trim().slice(0, 80)}`);
  }
  const tagCounts: Record<string, number> = {};
  const tagRe = /<\/?([a-z][a-z0-9]*)\b/gi;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, n]) => `${tag}:${n}`)
    .join(", ");
  const hasForm = /<form[\s>]/i.test(html);
  const hasButton = /<button[\s>]|class="[^"]*btn[^"]*"|class="[^"]*button[^"]*"/i.test(html);
  const hasCtaLike = /(call to action|get started|contact us|sign up|subscribe|book now|learn more)/i.test(html);

  return [
    `Heading hierarchy:\n${headings.slice(0, 30).join("\n")}`,
    `Tag counts (top 20): ${topTags}`,
    `Form: ${hasForm}, Button/CTA-like: ${hasButton}, CTA text: ${hasCtaLike}`,
    `\n--- Raw HTML (first ${cap} chars) ---\n${truncated}`,
  ].join("\n\n");
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}
