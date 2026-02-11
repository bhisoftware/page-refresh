/**
 * In-memory cache for industries and templates read on every analysis.
 * Reduces DB round-trips; rubric is already static (lib/seed-data/scoring-rubric.ts).
 * Cache is per-process (serverless: per function instance).
 */

import { prisma } from "@/lib/prisma";

export type CachedTemplate = {
  id: string;
  name: string;
  description: string;
  htmlTemplate: string;
  cssTemplate: string;
};

export type CachedIndustry = {
  id: string;
  name: string;
  description: string;
  scoringCriteria: unknown;
  preferredTemplates: unknown;
};

const globalForCache = globalThis as unknown as {
  _templateCache: CachedTemplate[] | null;
  _templateCachePromise: Promise<CachedTemplate[]> | null;
  _industryCache: CachedIndustry[] | null;
  _industryCachePromise: Promise<CachedIndustry[]> | null;
};

function loadTemplates(): Promise<CachedTemplate[]> {
  if (globalForCache._templateCache) {
    return Promise.resolve(globalForCache._templateCache);
  }
  if (!globalForCache._templateCachePromise) {
    globalForCache._templateCachePromise = prisma.template
      .findMany({
        select: {
          id: true,
          name: true,
          description: true,
          htmlTemplate: true,
          cssTemplate: true,
        },
      })
      .then((rows) => {
        const arr = rows as CachedTemplate[];
        globalForCache._templateCache = arr;
        return arr;
      });
  }
  return globalForCache._templateCachePromise;
}

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

/** Template names only (for selector prompt). */
export async function getCachedTemplateNames(): Promise<string[]> {
  const templates = await loadTemplates();
  return templates.map((t) => t.name);
}

/** Full templates by names (for pipeline layout injection). Returns in requested order; missing names omitted. */
export async function getCachedTemplatesByNames(
  names: string[]
): Promise<CachedTemplate[]> {
  const templates = await loadTemplates();
  const byName = new Map(templates.map((t) => [t.name, t]));
  return names.map((n) => byName.get(n)).filter(Boolean) as CachedTemplate[];
}

/** Full templates by IDs (for rule-based fallback when industry.preferredTemplates are IDs). */
export async function getCachedTemplatesByIds(
  ids: string[]
): Promise<CachedTemplate[]> {
  const templates = await loadTemplates();
  const byId = new Map(templates.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as CachedTemplate[];
}

/** Single template by name. */
export async function getCachedTemplateByName(
  name: string
): Promise<CachedTemplate | null> {
  const templates = await loadTemplates();
  return templates.find((t) => t.name === name) ?? null;
}

/** First available template (for pipeline fallback when selected names yield < 3). */
export async function getCachedFirstTemplate(): Promise<CachedTemplate | null> {
  const templates = await loadTemplates();
  return templates[0] ?? null;
}

/** Industry by name (for rule-based template fallback). */
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
  globalForCache._templateCache = null;
  globalForCache._templateCachePromise = null;
  globalForCache._industryCache = null;
  globalForCache._industryCachePromise = null;
}
