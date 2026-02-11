import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: full refresh including internal notes and prompt logs. Requires admin cookie.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const refresh = await prisma.refresh.findUnique({
    where: { id },
    include: {
      internalNotes: { orderBy: { createdAt: "asc" } },
      promptHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!refresh) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  return Response.json(refresh);
}
