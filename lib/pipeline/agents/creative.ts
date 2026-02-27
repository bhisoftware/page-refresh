/**
 * Creative Agent runner (Modern / Classy / Unique). Parameterized by slug.
 * Uses AgentSkill from DB. Returns { html, rationale }.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { CreativeAgentInput, CreativeAgentOutput } from "./types";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

/**
 * Extract HTML and rationale from XML-style tagged output.
 * Primary parsing path — avoids JSON escaping issues entirely.
 */
function extractFromTags(text: string): CreativeAgentOutput | null {
  const htmlMatch = text.match(/<layout_html>([\s\S]*?)<\/layout_html>/);
  if (!htmlMatch) return null;
  const html = htmlMatch[1].trim();
  if (!html) return null;

  const rationaleMatch = text.match(/<rationale>([\s\S]*?)<\/rationale>/);
  const rationale = rationaleMatch ? rationaleMatch[1].trim() : "";

  return { html, rationale };
}

const CREATIVE_SLUGS = ["creative-modern", "creative-classy", "creative-unique"] as const;
export type CreativeSlug = (typeof CREATIVE_SLUGS)[number];

export function isCreativeSlug(slug: string): slug is CreativeSlug {
  return CREATIVE_SLUGS.includes(slug as CreativeSlug);
}

export interface RunCreativeAgentOptions {
  skills: AgentSkill[];
  slug: CreativeSlug;
  input: CreativeAgentInput;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runCreativeAgent(
  options: RunCreativeAgentOptions
): Promise<CreativeAgentOutput> {
  const { skills, slug, input, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === slug);
  if (!skill) throw new Error(`No active skill found for agent: ${slug}`);

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 32768;
  const temperature = skill.temperature ?? 0.7;

  const userContent = JSON.stringify(input, null, 2);

  const startMs = Date.now();
  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: skill.systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    { onRetry }
  );

  if (response.stop_reason === "max_tokens") {
    console.warn(
      `[creative] ${slug} hit max_tokens (${maxTokens}). Output likely truncated. ` +
      `Tokens used: ${response.usage?.output_tokens ?? "unknown"}`
    );
  }

  const text = extractText(response);
  const stepName = slug.replace(/-/g, "_") as "creative_modern" | "creative_classy" | "creative_unique";
  await createPromptLog({
    refreshId,
    step: stepName,
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n" + userContent.slice(0, 10000),
    responseText: text.slice(0, 2000),
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens ? response.usage.input_tokens + response.usage.output_tokens : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  // Primary path: extract from XML-style tags (avoids JSON escaping issues)
  const tagged = extractFromTags(text);
  if (tagged) return tagged;

  // Fallback: try JSON parsing (backwards compat with older prompts in DB)
  const parsed = safeParseJSON(text);
  if (parsed.success && parsed.data) {
    const data = parsed.data as Record<string, unknown>;
    const html = typeof data.html === "string" ? data.html : "";
    const rationale = typeof data.rationale === "string" ? data.rationale : "";
    if (html.trim()) return { html, rationale };
  }

  throw new Error(`Creative Agent ${slug} returned unparseable output (no tags, invalid JSON)`);
}
