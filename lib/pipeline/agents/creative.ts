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
  const maxTokens = skill.maxTokens ?? 16384;
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

  const parsed = safeParseJSON(text);
  if (!parsed.success || !parsed.data) {
    throw new Error(`Creative Agent ${slug} returned invalid JSON`);
  }
  const data = parsed.data as Record<string, unknown>;
  const html = typeof data.html === "string" ? data.html : "";
  const rationale = typeof data.rationale === "string" ? data.rationale : "";
  return { html, rationale };
}
