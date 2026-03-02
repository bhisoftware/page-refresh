/**
 * Score Agent: Step 1 outputs + benchmark data → scores + creative brief.
 * Uses AgentSkill "score" from DB.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { ScoreAgentInput, ScoreAgentOutput, BenchmarkRow } from "./types";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

function benchmarkSummary(benchmarks: BenchmarkRow[]): string {
  if (benchmarks.length === 0) return "No benchmark data for this industry.";
  const n = benchmarks.length;
  const avg = (key: keyof BenchmarkRow) => {
    const sum = benchmarks.reduce((s, b) => s + (b[key] as number), 0);
    return Math.round(sum / n);
  };
  const dims = ["overall", "clarity", "visual", "hierarchy", "trust", "conversion", "content", "mobile", "performance"] as const;
  const lines = dims.map((d) => {
    const k = d === "overall" ? "overallScore" : `${d}Score`;
    return `  ${d}: industry avg ${avg(k as keyof BenchmarkRow)}`;
  });
  return `Benchmark data: ${n} scored sites.\nIndustry averages:\n${lines.join("\n")}`;
}

export interface RunScoreAgentOptions {
  skills: AgentSkill[];
  input: ScoreAgentInput;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runScoreAgent(
  options: RunScoreAgentOptions
): Promise<ScoreAgentOutput> {
  const { skills, input, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === "score");
  if (!skill) throw new Error("No active skill found for agent: score");

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 8192;
  const temperature = skill.temperature ?? 0.3;

  const benchmarkNote =
    input.benchmarkCount >= 3
      ? benchmarkSummary(input.benchmarks)
      : input.benchmarkCount > 0
        ? "Limited industry benchmark data (1–2 sites). Use general best practices."
        : "No benchmark data. Use absolute scoring with general industry knowledge.";

  const payload = {
    screenshotAnalysis: input.screenshotAnalysis,
    industrySeo: input.industrySeo,
    benchmarkNote,
    benchmarkCount: input.benchmarkCount,
  };
  const userContent = JSON.stringify(payload, null, 2);

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
  await createPromptLog({
    refreshId,
    step: "score",
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n" + userContent.slice(0, 15000),
    responseText: text,
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens ? response.usage.input_tokens + response.usage.output_tokens : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  const parsed = safeParseJSON(text);
  if (!parsed.success || !parsed.data) {
    throw new Error("Score Agent returned invalid JSON");
  }
  return parsed.data as ScoreAgentOutput;
}
