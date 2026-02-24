/**
 * Screenshot Analysis Agent: vision + HTML → structured JSON.
 * Uses AgentSkill "screenshot-analysis" from DB.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { ScreenshotAnalysisOutput } from "./types";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

export interface RunScreenshotAnalysisOptions {
  skills: AgentSkill[];
  html: string;
  screenshotBuffer: Buffer | null;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runScreenshotAnalysisAgent(
  options: RunScreenshotAnalysisOptions
): Promise<ScreenshotAnalysisOutput> {
  const { skills, html, screenshotBuffer, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === "screenshot-analysis");
  if (!skill) throw new Error("No active skill found for agent: screenshot-analysis");

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 4096;
  const temperature = skill.temperature ?? 0.1;

  const htmlSlice = html.slice(0, 15000);
  const userContent = screenshotBuffer
    ? [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: screenshotBuffer.toString("base64"),
          },
        },
        {
          type: "text" as const,
          text: `Analyze this website screenshot and HTML structure.\n\nHTML (first 15000 chars):\n${htmlSlice}`,
        },
      ]
    : `Analyze this website HTML structure.\n\n${htmlSlice}`;

  const startMs = Date.now();
  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: skill.systemPrompt,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    { onRetry }
  );

  const text = extractText(response);
  const promptForLog =
    typeof userContent === "string"
      ? skill.systemPrompt + "\n---\n" + userContent
      : skill.systemPrompt + "\n---\n[vision+text]";

  await createPromptLog({
    refreshId,
    step: "screenshot_analysis",
    provider: "claude",
    model: response.model,
    promptText: promptForLog,
    responseText: text,
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens ? response.usage.input_tokens + response.usage.output_tokens : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  const parsed = safeParseJSON(text);
  if (!parsed.success || !parsed.data) {
    throw new Error("Screenshot Analysis Agent returned invalid JSON");
  }
  return parsed.data as ScreenshotAnalysisOutput;
}
