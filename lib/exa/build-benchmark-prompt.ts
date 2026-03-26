import type { BenchmarkContext } from "./fetch-benchmarks";

/**
 * Formats EXA benchmark data into a prompt block for injection
 * into the scoring agent payload. Returns empty string if no data.
 */
export function buildBenchmarkPromptBlock(
  benchmark: BenchmarkContext | null
): string {
  if (!benchmark) return "";

  const lines: string[] = [
    `## Industry Benchmark Context (via EXA)`,
    `Industry: ${benchmark.industryLabel}`,
    ``,
    `The following data represents what top-performing websites in this industry`,
    `typically demonstrate. Use this as a relative reference frame when scoring.`,
    `Do not penalize the site for failing to match every benchmark — use this context`,
    `to make your scores more accurate and your written feedback more specific.`,
    ``,
  ];

  if (benchmark.trustSignalsSummary) {
    lines.push(`### Trust Signals — Industry Benchmarks`);
    lines.push(benchmark.trustSignalsSummary);
    lines.push("");
  }

  if (benchmark.visualHierarchySummary) {
    lines.push(`### Visual Hierarchy — Industry Benchmarks`);
    lines.push(benchmark.visualHierarchySummary);
    lines.push("");
  }

  lines.push(
    `When reporting Trust Signals and Visual Hierarchy scores, include a brief note`,
    `comparing the site to this industry context (e.g., "Top ${benchmark.industryLabel} sites`,
    `typically show X — this site is missing Y").`
  );

  return lines.join("\n");
}
