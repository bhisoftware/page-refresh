import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { runBenchmarkScoring } from "@/lib/benchmark/score-benchmark";

/**
 * POST: Run scoring pipeline for this benchmark URL. Uses stored industry (no detectIndustry).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const benchmark = await prisma.benchmark.findUnique({ where: { id } });
  if (!benchmark) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await runBenchmarkScoring(id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const updated = await prisma.benchmark.findUnique({ where: { id } });
  return Response.json(updated);
}
