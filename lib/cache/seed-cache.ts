/**
 * In-memory cache for industries read on every analysis.
 * Reduces DB round-trips; rubric is already static (lib/seed-data/scoring-rubric.ts).
 * Cache is per-process (serverless: per function instance).
 */

import { prisma } from "@/lib/prisma";

export type CachedIndustry = {
  id: string;
  name: string;
  description: string;
  scoringCriteria: unknown;
  preferredTemplates: unknown;
};

const globalForCache = globalThis as unknown as {
  _industryCache: CachedIndustry[] | null;
  _industryCachePromise: Promise<CachedIndustry[]> | null;
};

function loadIndustries(): Promise<CachedIndustry[]> {
  if (globalForCache._industryCache) {
    return Promise.resolve(globalForCache._industryCache);
  }
  if (!globalForCache._industryCachePromise) {
    globalForCache._industryCachePromise = prisma.industry
      .findMany({
        select: {
          id: true,
          name: true,
          description: true,
          scoringCriteria: true,
          preferredTemplates: true,
        },
      })
      .then((rows) => {
        const arr = rows as CachedIndustry[];
        globalForCache._industryCache = arr;
        return arr;
      });
  }
  return globalForCache._industryCachePromise;
}

/** Industry by name (for scoring). */
export async function getCachedIndustryByName(
  name: string
): Promise<CachedIndustry | null> {
  const industries = await loadIndustries();
  return industries.find((i) => i.name === name) ?? null;
}

/** All industries (if ever needed). */
export async function getCachedIndustries(): Promise<CachedIndustry[]> {
  return loadIndustries();
}

/** Clear caches (e.g. after seed/import in dev). */
export function clearSeedCache(): void {
  globalForCache._industryCache = null;
  globalForCache._industryCachePromise = null;
}
