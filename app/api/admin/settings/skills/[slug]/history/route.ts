import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const VALID_SLUGS = new Set([
  "screenshot-analysis",
  "industry-seo",
  "score",
  "creative-modern",
  "creative-classy",
  "creative-unique",
]);

/**
 * GET: All historical versions for this skill, newest first.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = decodeURIComponent((await params).slug);
  if (!VALID_SLUGS.has(slug)) {
    return Response.json({ error: "Invalid skill slug" }, { status: 404 });
  }
  const skill = await prisma.agentSkill.findUnique({
    where: { agentSlug: slug },
    select: { id: true },
  });
  if (!skill) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const history = await prisma.agentSkillHistory.findMany({
    where: { agentSkillId: skill.id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ history });
}
