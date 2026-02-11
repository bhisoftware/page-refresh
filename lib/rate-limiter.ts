/**
 * In-memory rate limiter for protecting expensive endpoints (e.g. /api/analyze).
 * Stores request timestamps per key; supports sliding window and cleanup.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export class RateLimiter {
  private timestamps = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.startCleanup();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let list = this.timestamps.get(key) ?? [];
    list = list.filter((t) => t > cutoff);

    if (list.length >= this.maxRequests) {
      const oldestInWindow = Math.min(...list);
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    list.push(now);
    this.timestamps.set(key, list);
    return { allowed: true };
  }

  private startCleanup(): void {
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.windowMs;
      for (const [key, list] of this.timestamps.entries()) {
        const kept = list.filter((t) => t > cutoff);
        if (kept.length === 0) this.timestamps.delete(key);
        else this.timestamps.set(key, kept);
      }
    }, intervalMs);
    if (typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }
}

/** 5 requests per minute for the analysis pipeline (8+ Claude calls per run). */
export const analysisRateLimiter = new RateLimiter(5, 60_000);
