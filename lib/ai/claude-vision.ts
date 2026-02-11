/**
 * Claude Vision API client for screenshot analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PromptLogContext {
  refreshId: string;
  step: string;
  onRetry?: (delayMs: number) => void;
}

const VISION_PROMPT = `Analyze this website screenshot. Evaluate the following dimensions:

1. **Visual Quality** - Modern vs dated, cluttered vs clean, professional appearance
2. **Layout Hierarchy** - Logical flow, scannability, section structure
3. **Trust Signals** - Social proof, credentials, legitimacy indicators
4. **Mobile Responsiveness** - Indicators of mobile-friendly design (viewport, layout)
5. **Clarity of Messaging** - Can you understand what the business does quickly?
6. **CTA Visibility** - Is there a clear call-to-action? Where is it?
7. **Content Quality** - Readability, benefit-focus, jargon level
8. **Performance/Technical** - Any visible loading or layout issues

Provide specific, actionable observations for each dimension. Be concise but thorough.`;

export interface VisionAnalysisResult {
  analysis: string;
  model: string;
  tokensUsed?: number;
}

export async function analyzeScreenshot(
  imageBase64: string,
  promptLog?: PromptLogContext
): Promise<VisionAnalysisResult> {
  const startMs = Date.now();
  const message = await withRetry(
    () =>
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png" as const,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: VISION_PROMPT,
              },
            ],
          },
        ],
      }),
    { onRetry: promptLog?.onRetry }
  );

  const textBlock = message.content.find((b) => b.type === "text");
  const analysis = textBlock && "text" in textBlock ? textBlock.text : "";
  const usage = message.usage;
  const tokensUsed = usage?.input_tokens && usage?.output_tokens ? usage.input_tokens + usage.output_tokens : undefined;

  if (promptLog) {
    await createPromptLog({
      refreshId: promptLog.refreshId,
      step: promptLog.step,
      provider: "claude",
      model: message.model,
      promptText: VISION_PROMPT,
      responseText: analysis,
      tokensUsed,
      responseTimeMs: Date.now() - startMs,
    });
  }

  return {
    analysis,
    model: message.model,
    tokensUsed,
  };
}
