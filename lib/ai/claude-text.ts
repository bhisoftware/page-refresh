/**
 * Claude Text API client for industry detection and scoring.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PromptLogContext {
  analysisId: string;
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
      analysisId: promptLog.analysisId,
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
      analysisId: promptLog.analysisId,
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

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}
