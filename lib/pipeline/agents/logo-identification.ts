/**
 * Logo Identification Agent: vision-based logo selection from ranked candidates.
 * Uses AgentSkill "logo-identification" from DB. Non-fatal: returns null on failure.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { LogoCandidate } from "@/lib/scraping/asset-extractor";

export interface LogoIdentificationOutput {
  selectedIndex: number;
  confidence: number;
  reasoning: string;
}

export interface RunLogoAgentOptions {
  skills: AgentSkill[];
  screenshotBuffer: Buffer | null;
  candidateBuffers: Array<{ index: number; buffer: Buffer; mimeType: string }>;
  candidates: LogoCandidate[];
  businessName: string;
  websiteUrl: string;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

/** Convert SVG buffer to PNG via sharp (Anthropic vision doesn't support SVG). */
async function svgToPng(svgBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(svgBuffer).resize(256, 256, { fit: "inside" }).png().toBuffer();
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

export async function runLogoIdentificationAgent(
  options: RunLogoAgentOptions
): Promise<LogoIdentificationOutput | null> {
  const { skills, screenshotBuffer, candidateBuffers, candidates, businessName, websiteUrl, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === "logo-identification");

  // Non-fatal: if skill missing or inactive, return null (caller uses heuristic)
  if (!skill) return null;

  // Need at least one image to analyze
  if (!screenshotBuffer && candidateBuffers.length === 0) return null;

  // Convert SVG candidates to PNG for vision API
  const processedBuffers: Array<{ index: number; buffer: Buffer; mimeType: string }> = [];
  for (const cb of candidateBuffers) {
    if (cb.mimeType === "image/svg+xml") {
      try {
        const pngBuffer = await svgToPng(cb.buffer);
        processedBuffers.push({ index: cb.index, buffer: pngBuffer, mimeType: "image/png" });
      } catch {
        // SVG conversion failed — skip this candidate
        continue;
      }
    } else {
      processedBuffers.push(cb);
    }
  }

  if (!screenshotBuffer && processedBuffers.length === 0) return null;

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-haiku-4-5-20251001";
  const maxTokens = skill.maxTokens ?? 1024;
  const temperature = skill.temperature ?? 0.1;

  // Build vision content: screenshot + candidate images with metadata
  type ContentPart = Anthropic.ImageBlockParam | Anthropic.TextBlockParam;
  const contentParts: ContentPart[] = [];

  if (screenshotBuffer) {
    contentParts.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: screenshotBuffer.toString("base64") },
    });
    contentParts.push({ type: "text", text: "Above: screenshot of the website." });
  }

  for (const cb of processedBuffers) {
    contentParts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: cb.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: cb.buffer.toString("base64"),
      },
    });
    const meta = candidates[cb.index];
    contentParts.push({
      type: "text",
      text: `Candidate ${cb.index}: alt="${meta.alt}", position=${meta.position}, external=${meta.isExternal}`,
    });
  }

  contentParts.push({
    type: "text",
    text: `Business: "${businessName}" (${websiteUrl}). Which candidate is the business's own logo? Return JSON: { "selectedIndex": number, "confidence": number, "reasoning": "string" }. Use -1 if none.`,
  });

  const startMs = Date.now();
  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: [
          {
            type: "text" as const,
            text: skill.systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: contentParts }],
      }),
    { onRetry }
  );

  const text = extractText(response);
  await createPromptLog({
    refreshId,
    step: "logo_identification",
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n[vision: screenshot + " + processedBuffers.length + " candidates]",
    responseText: text,
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens
      ? response.usage.input_tokens + response.usage.output_tokens
      : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  const parsed = safeParseJSON(text);
  if (!parsed.success || !parsed.data) {
    console.warn("[logo-identification] Invalid JSON response");
    return null;
  }
  return parsed.data as LogoIdentificationOutput;
}
