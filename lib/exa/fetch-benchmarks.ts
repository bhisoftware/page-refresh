import { exaClient } from "./client";
import { type IndustrySlug, INDUSTRY_BENCHMARK_QUERIES, normalizeIndustrySlug } from "./industry-map";
import { getCachedBenchmark, setCachedBenchmark } from "./benchmark-cache";

export interface BenchmarkContext {
  industrySlug: IndustrySlug;
  industryLabel: string;
  trustSignalsSummary: string | null;
  visualHierarchySummary: string | null;
  fetchedAt: string;
  fromCache: boolean;
}

export async function fetchIndustryBenchmarks(
  rawIndustry: string
): Promise<BenchmarkContext | null> {
  if (!exaClient) return null;

  const industrySlug = normalizeIndustrySlug(rawIndustry);
  const queries = INDUSTRY_BENCHMARK_QUERIES[industrySlug];

  const cached = await getCachedBenchmark(industrySlug);
  if (cached) {
    console.log(`[EXA] Cache hit for "${industrySlug}"`);
    return { ...cached, fromCache: true };
  }

  try {
    console.log(`[EXA] Fetching benchmarks for "${industrySlug}" (raw: "${rawIndustry}")`);

    const [trustResult, hierarchyResult] = await Promise.all([
      exaClient.searchAndContents(queries.trustSignals, {
        numResults: 3,
        useAutoprompt: true,
        summary: { query: queries.trustSummaryPrompt },
      }),
      exaClient.searchAndContents(queries.visualHierarchy, {
        numResults: 3,
        useAutoprompt: true,
        summary: { query: queries.visualSummaryPrompt },
      }),
    ]);

    const trustSignalsSummary = extractSummary(trustResult.results);
    const visualHierarchySummary = extractSummary(hierarchyResult.results);

    const benchmark: BenchmarkContext = {
      industrySlug,
      industryLabel: rawIndustry,
      trustSignalsSummary,
      visualHierarchySummary,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    await setCachedBenchmark(industrySlug, benchmark);
    console.log(`[EXA] Benchmarks fetched and cached for "${industrySlug}"`);

    return benchmark;
  } catch (error) {
    console.error("[EXA] Benchmark fetch failed:", error);
    return null;
  }
}

function extractSummary(results: Array<{ summary?: string }>): string | null {
  const summaries = results
    .map((r) => r.summary)
    .filter(Boolean)
    .join(" ");

  return summaries.length > 0 ? summaries.slice(0, 800) : null;
}
