import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: Full URL profile with assets and analyses (refresh list).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const profile = await prisma.urlProfile.findUnique({
    where: { id },
    include: {
      assets: true,
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          viewToken: true,
          overallScore: true,
          processingTime: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(profile);
}
