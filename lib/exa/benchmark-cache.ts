/**
 * EXA benchmark cache backed by Upstash Redis.
 * Falls back gracefully if Redis is unavailable.
 */

import { Redis } from "@upstash/redis";
import type { BenchmarkContext } from "./fetch-benchmarks";
import type { IndustrySlug } from "./industry-map";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CACHE_KEY_PREFIX = "exa:benchmark:";

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export async function getCachedBenchmark(
  industrySlug: IndustrySlug
): Promise<BenchmarkContext | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<BenchmarkContext>(`${CACHE_KEY_PREFIX}${industrySlug}`);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedBenchmark(
  industrySlug: IndustrySlug,
  data: BenchmarkContext
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${CACHE_KEY_PREFIX}${industrySlug}`, data, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error("[EXA Cache] Failed to set cache:", error);
  }
}
