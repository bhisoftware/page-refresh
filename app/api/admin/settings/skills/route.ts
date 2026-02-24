import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: List all agent skills (no full systemPrompt).
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const skills = await prisma.agentSkill.findMany({
    orderBy: [{ category: "asc" }, { agentSlug: "asc" }],
    select: {
      agentSlug: true,
      agentName: true,
      category: true,
      active: true,
      version: true,
      updatedAt: true,
    },
  });
  return Response.json({ skills });
}
