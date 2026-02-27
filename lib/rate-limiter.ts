/**
 * Rate limiter for protecting expensive endpoints (e.g. /api/analyze).
 * Uses Upstash Redis in production (shared across all Vercel instances).
 * Falls back to in-memory sliding window for local development.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/* ── In-memory fallback (local dev without Redis) ── */

class InMemoryRateLimiter {
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
    const intervalMs = 5 * 60 * 1000;
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

/* ── Upstash Redis rate limiter (production) ── */

// Vercel's Upstash integration uses KV_REST_API_* env vars
const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashConfigured = !!redisUrl && !!redisToken;

const upstashLimiter = upstashConfigured
  ? new Ratelimit({
      redis: new Redis({
        url: redisUrl!,
        token: redisToken!,
      }),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "analysis",
    })
  : null;

const inMemoryFallback = new InMemoryRateLimiter(5, 60_000);

/* ── Exported limiter (same interface, async) ── */

/** 5 requests per minute for the analysis pipeline. */
export const analysisRateLimiter = {
  async check(key: string): Promise<RateLimitResult> {
    if (!upstashLimiter) {
      return inMemoryFallback.check(key);
    }
    try {
      const { success, reset } = await upstashLimiter.limit(key);
      if (success) return { allowed: true };
      return { allowed: false, retryAfterMs: Math.max(0, reset - Date.now()) };
    } catch (err) {
      console.warn("[rate-limiter] Upstash error, falling back to in-memory:", err);
      return inMemoryFallback.check(key);
    }
  },
};
