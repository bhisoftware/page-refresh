import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: full analysis including internal notes and prompt logs. Requires admin cookie.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      internalNotes: { orderBy: { createdAt: "asc" } },
      promptHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!analysis) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  return Response.json(analysis);
}
