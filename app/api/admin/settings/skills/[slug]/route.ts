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
 * GET: Full skill detail including systemPrompt, outputSchema, etc.
 */
export async function GET(
  _request: NextRequest,
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
  });
  if (!skill) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(skill);
}

/**
 * PUT: Update skill. Archives current to AgentSkillHistory, increments version.
 * Body: { systemPrompt?, outputSchema?, modelOverride?, maxTokens?, temperature?, active?, editedBy?, changeNote? }
 */
export async function PUT(
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

  let body: {
    systemPrompt?: string;
    outputSchema?: object;
    modelOverride?: string;
    maxTokens?: number;
    temperature?: number;
    active?: boolean;
    editedBy?: string;
    changeNote?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const skill = await prisma.agentSkill.findUnique({
    where: { agentSlug: slug },
  });
  if (!skill) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.agentSkillHistory.create({
    data: {
      agentSkillId: skill.id,
      agentSlug: skill.agentSlug,
      systemPrompt: skill.systemPrompt,
      version: skill.version,
      editedBy: skill.lastEditedBy ?? undefined,
      changeNote: undefined,
    },
  });

  const updated = await prisma.agentSkill.update({
    where: { id: skill.id },
    data: {
      ...(typeof body.systemPrompt === "string" && { systemPrompt: body.systemPrompt }),
      ...(body.outputSchema !== undefined && { outputSchema: body.outputSchema as object }),
      ...(body.modelOverride !== undefined && { modelOverride: body.modelOverride || null }),
      ...(typeof body.maxTokens === "number" && { maxTokens: body.maxTokens }),
      ...(typeof body.temperature === "number" && { temperature: body.temperature }),
      ...(typeof body.active === "boolean" && { active: body.active }),
      ...(typeof body.editedBy === "string" && { lastEditedBy: body.editedBy }),
      version: skill.version + 1,
    },
  });

  return Response.json(updated);
}
