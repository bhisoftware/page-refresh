/**
 * OpenAI API client for layout generation and copy refresh.
 */

import OpenAI from "openai";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

export async function completeChat(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options?: { maxTokens?: number; promptLog?: PromptLogContext }
): Promise<{ text: string; tokensUsed?: number }> {
  const startMs = Date.now();
  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    { onRetry: options?.promptLog?.onRetry }
  );

  const content = response.choices[0]?.message?.content ?? "";
  const usage = response.usage;
  const tokensUsed =
    usage && "prompt_tokens" in usage && "completion_tokens" in usage
      ? usage.prompt_tokens + usage.completion_tokens
      : undefined;

  if (options?.promptLog) {
    const promptText = JSON.stringify(messages, null, 2);
    await createPromptLog({
      refreshId: options.promptLog.refreshId,
      step: options.promptLog.step,
      provider: "openai",
      model: "gpt-4o",
      promptText,
      responseText: content,
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  return { text: content, tokensUsed };
}
