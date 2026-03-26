import { exaClient } from "./client";
import { normalizeIndustrySlug, INDUSTRY_BENCHMARK_QUERIES } from "./industry-map";
import { prisma } from "@/lib/prisma";

export interface DiscoveredSite {
  url: string;
  title: string;
}

/**
 * Uses EXA to discover top-performing competitor websites for an industry.
 * Deduplicates against existing benchmarks in the DB.
 */
export async function discoverCompetitorSites(
  industry: string,
  count: number = 10
): Promise<DiscoveredSite[]> {
  if (!exaClient) {
    throw new Error("EXA_API_KEY not configured");
  }

  const slug = normalizeIndustrySlug(industry);
  const queries = INDUSTRY_BENCHMARK_QUERIES[slug];

  // Search for high-quality sites using both dimension queries
  const [trustResults, visualResults] = await Promise.all([
    exaClient.search(queries.trustSignals.replace("trust signals", "best website examples"), {
      numResults: count,
      useAutoprompt: true,
    }),
    exaClient.search(queries.visualHierarchy.replace("visual hierarchy", "best website examples"), {
      numResults: count,
      useAutoprompt: true,
    }),
  ]);

  // Merge and deduplicate by domain
  const seen = new Set<string>();
  const candidates: DiscoveredSite[] = [];

  for (const result of [...trustResults.results, ...visualResults.results]) {
    if (!result.url) continue;
    try {
      const domain = new URL(result.url).hostname.replace(/^www\./, "");
      if (seen.has(domain)) continue;
      seen.add(domain);
      candidates.push({ url: result.url, title: result.title ?? domain });
    } catch {
      continue;
    }
  }

  // Filter out domains that already exist as benchmarks
  const existingDomains = new Set(
    (
      await prisma.benchmark.findMany({
        where: { industry },
        select: { domain: true },
      })
    )
      .map((b) => b.domain)
      .filter(Boolean) as string[]
  );

  return candidates
    .filter((c) => {
      try {
        const domain = new URL(c.url).hostname.replace(/^www\./, "");
        return !existingDomains.has(domain);
      } catch {
        return false;
      }
    })
    .slice(0, count);
}
