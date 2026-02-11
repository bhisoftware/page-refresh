import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET: paginated list of analyses. Requires admin cookie.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10))
  );
  const skip = (page - 1) * limit;

  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        targetWebsite: true,
        industryDetected: true,
        overallScore: true,
        createdAt: true,
        quoteRequested: true,
        installRequested: true,
        _count: { select: { internalNotes: true } },
      },
    }),
    prisma.analysis.count(),
  ]);

  const items = analyses.map((a) => ({
    id: a.id,
    url: a.url,
    targetWebsite: a.targetWebsite,
    industryDetected: a.industryDetected,
    overallScore: a.overallScore,
    createdAt: a.createdAt,
    quoteRequested: a.quoteRequested,
    installRequested: a.installRequested,
    hasNotes: (a._count?.internalNotes ?? 0) > 0,
  }));

  return Response.json({
    items,
    total,
    page,
    limit,
  });
}
