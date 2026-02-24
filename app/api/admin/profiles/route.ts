import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: List URL profiles (paginated). Query: page, pageSize.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? 50)));
  const skip = (page - 1) * pageSize;

  const [profiles, total] = await Promise.all([
    prisma.urlProfile.findMany({
      skip,
      take: pageSize,
      orderBy: { lastAnalyzedAt: "desc" },
      select: {
        id: true,
        url: true,
        domain: true,
        industry: true,
        analysisCount: true,
        latestScore: true,
        bestScore: true,
        lastAnalyzedAt: true,
        createdAt: true,
      },
    }),
    prisma.urlProfile.count(),
  ]);

  return Response.json({
    items: profiles,
    total,
    page,
    pageSize,
  });
}
