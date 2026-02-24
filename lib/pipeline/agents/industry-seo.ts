/**
 * Industry & SEO Agent: HTML + tech stack → structured JSON.
 * Uses AgentSkill "industry-seo" from DB.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { IndustrySeoOutput } from "./types";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

export interface RunIndustrySeoOptions {
  skills: AgentSkill[];
  html: string;
  css: string;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runIndustrySeoAgent(
  options: RunIndustrySeoOptions
): Promise<IndustrySeoOutput> {
  const { skills, html, css, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === "industry-seo");
  if (!skill) throw new Error("No active skill found for agent: industry-seo");

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 4096;
  const temperature = skill.temperature ?? 0.2;

  const context = `HTML (first 20000 chars):\n${html.slice(0, 20000)}\n\nCSS (first 5000 chars):\n${css.slice(0, 5000)}`;

  const startMs = Date.now();
  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: skill.systemPrompt,
        messages: [{ role: "user", content: context }],
      }),
    { onRetry }
  );

  const text = extractText(response);
  await createPromptLog({
    refreshId,
    step: "industry_seo",
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n" + context,
    responseText: text,
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens ? response.usage.input_tokens + response.usage.output_tokens : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  const parsed = safeParseJSON(text);
  if (!parsed.success || !parsed.data) {
    throw new Error("Industry & SEO Agent returned invalid JSON");
  }
  return parsed.data as IndustrySeoOutput;
}
