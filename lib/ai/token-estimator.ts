/**
 * Token estimation using cl100k_base (approximates Claude/OpenAI tokenizer).
 * Used to trim oversized prompts and avoid API failures.
 */

import { getEncoding } from "js-tiktoken";

const CL100K = "cl100k_base";
let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) encoder = getEncoding(CL100K as "cl100k_base");
  return encoder;
}

/** Returns estimated token count for the given text. */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  try {
    return getEncoder().encode(text).length;
  } catch {
    return Math.ceil(text.length / 4); // fallback ~4 chars per token
  }
}

const SAFE_CONTEXT_LIMIT = 180_000;

export interface CheckBudgetResult {
  fits: boolean;
  promptTokens: number;
  budgetRemaining: number;
  recommendedMaxTokens: number;
}

/**
 * Check if a prompt fits within a safe context limit and recommend max_tokens.
 */
export function checkBudget(
  prompt: string,
  maxTokens: number
): CheckBudgetResult {
  const promptTokens = estimateTokens(prompt);
  const budgetRemaining = SAFE_CONTEXT_LIMIT - promptTokens;
  const fits = budgetRemaining >= maxTokens;
  const recommendedMaxTokens = Math.max(
    1024,
    Math.min(maxTokens, budgetRemaining)
  );
  return {
    fits,
    promptTokens,
    budgetRemaining,
    recommendedMaxTokens,
  };
}

/**
 * Truncate text to fit within a token budget (by character approximation then encode to verify).
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return text;
  const current = estimateTokens(text);
  if (current <= maxTokens) return text;
  // Binary-search-style: start from a fraction of the string
  let low = 0;
  let high = text.length;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid);
    if (estimateTokens(candidate) <= maxTokens) low = mid;
    else high = mid;
  }
  return text.slice(0, low);
}
