import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { ScanningCopyOutput } from "./types";

export interface RunScanningCopyOptions {
  skills: AgentSkill[];
  input: {
    url: string;
    industry: string;
    seoChecks: Array<{ label: string; status: string; value: string }>;
    structureChecks: Array<{ label: string; status: string; value: string }>;
    colorCount: number;
    fontCount: number;
    headline: string | null;
  };
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runScanningCopyAgent(
  options: RunScanningCopyOptions
): Promise<ScanningCopyOutput> {
  const { skills, input, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === "scanning-copy");

  // Non-fatal: if skill missing or inactive, return empty (caller uses fallbacks)
  if (!skill) return {};

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-haiku-4-5";
  const maxTokens = skill.maxTokens ?? 1024;
  const temperature = skill.temperature ?? 0.4;

  const userContent = JSON.stringify(input);
  const startMs = Date.now();

  try {
    const response = await withRetry(
      () => client.messages.create({
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
        messages: [{ role: "user", content: userContent }],
      }),
      { onRetry }
    );

    const text = response.content.find(b => b.type === "text");
    const raw = text && "text" in text ? text.text : "";

    await createPromptLog({
      refreshId,
      step: "scanning_copy",
      provider: "claude",
      model: response.model,
      promptText: (skill.systemPrompt + "\n\n" + userContent).slice(0, 10000),
      responseText: raw.slice(0, 2000),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      responseTimeMs: Date.now() - startMs,
    });

    const parsed = safeParseJSON(raw);
    return (parsed.data as ScanningCopyOutput) ?? {};
  } catch (err) {
    console.warn("[scanning-copy] Agent failed, using fallback text:", err);
    return {};
  }
}
