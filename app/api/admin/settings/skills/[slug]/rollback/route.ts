import { NextRequest } from "next/server";
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
 * POST: Rollback to a historical version. Body: { version: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = decodeURIComponent((await params).slug);
  if (!VALID_SLUGS.has(slug)) {
    return Response.json({ error: "Invalid skill slug" }, { status: 404 });
  }

  let body: { version?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const targetVersion = body.version;
  if (typeof targetVersion !== "number") {
    return Response.json({ error: "version required" }, { status: 400 });
  }

  const skill = await prisma.agentSkill.findUnique({
    where: { agentSlug: slug },
  });
  if (!skill) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const historical = await prisma.agentSkillHistory.findFirst({
    where: { agentSkillId: skill.id, version: targetVersion },
  });
  if (!historical) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  await prisma.agentSkillHistory.create({
    data: {
      agentSkillId: skill.id,
      agentSlug: skill.agentSlug,
      systemPrompt: skill.systemPrompt,
      version: skill.version,
      editedBy: skill.lastEditedBy ?? undefined,
      changeNote: `Rollback from v${skill.version} to v${targetVersion}`,
    },
  });

  const updated = await prisma.agentSkill.update({
    where: { id: skill.id },
    data: {
      systemPrompt: historical.systemPrompt,
      version: skill.version + 1,
    },
  });

  return Response.json(updated);
}
