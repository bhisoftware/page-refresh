/**
 * PromptLog creation for all AI calls.
 * Every Claude/OpenAI call must create a PromptLog entry.
 */

import { prisma } from "@/lib/prisma";

export interface PromptLogParams {
  refreshId: string;
  step: string;
  provider: "claude" | "openai";
  model: string;
  promptText: string;
  responseText: string;
  tokensUsed?: number;
  responseTimeMs?: number;
}

export async function createPromptLog(params: PromptLogParams): Promise<void> {
  await prisma.promptLog.create({
    data: {
      refreshId: params.refreshId,
      step: params.step,
      provider: params.provider,
      model: params.model,
      promptText: params.promptText,
      responseText: params.responseText,
      tokensUsed: params.tokensUsed ?? null,
      responseTime: params.responseTimeMs ?? null,
    },
  });
}
