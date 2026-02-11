/**
 * Retry logic for API rate limits (429) and transient errors.
 * Uses exponential backoff: 10s, 30s.
 */

const RETRY_DELAYS_MS = [10_000, 30_000];
const MAX_RETRIES = 2;

/** Quota/billing errors look like 429s but will never resolve with retrying. */
function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("exceeded") ||
    msg.includes("quota") ||
    msg.includes("billing") ||
    msg.includes("insufficient_quota")
  );
}

export function isRetryableError(err: unknown): boolean {
  if (isQuotaError(err)) return false;

  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.status === "number") {
      if (o.status === 429) return true;
      if (o.status >= 500 && o.status < 600) return true;
    }
    if (o.error && typeof o.error === "object") {
      const inner = (o.error as Record<string, unknown>).type;
      if (inner === "rate_limit_error") return true;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("overloaded") ||
    msg.includes("capacity") ||
    msg.includes("rate_limit_error")
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { onRetry?: (delayMs: number) => void }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isRetryableError(err)) {
        const delayMs = RETRY_DELAYS_MS[attempt] ?? 30_000;
        options?.onRetry?.(delayMs);
        await sleep(delayMs);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
