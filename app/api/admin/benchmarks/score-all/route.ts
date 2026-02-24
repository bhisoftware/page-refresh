import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { runBenchmarkScoring } from "@/lib/benchmark/score-benchmark";

/**
 * POST: Score all unscored benchmarks (or all if force=true). Sequential to avoid rate limits.
 * Returns { scored, failed, errors }.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = request.nextUrl.searchParams.get("force") === "true";

  const benchmarks = await prisma.benchmark.findMany({
    where: force ? {} : { scored: false },
    orderBy: { createdAt: "asc" },
  });

  let scored = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const b of benchmarks) {
    const result = await runBenchmarkScoring(b.id);
    if (result.ok) {
      scored++;
    } else {
      failed++;
      errors.push(`${b.url}: ${result.error}`);
    }
  }

  return Response.json({ scored, failed, errors });
}
