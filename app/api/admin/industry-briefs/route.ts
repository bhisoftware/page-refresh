import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: List all industry briefs.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const briefs = await prisma.industryBrief.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(briefs);
}
