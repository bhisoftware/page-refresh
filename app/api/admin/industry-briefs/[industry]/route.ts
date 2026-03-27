import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { z } from "zod";

const briefSchema = z.object({
  brief: z.string().min(1, "Brief cannot be empty").max(5000),
});

/**
 * GET: Fetch brief for a specific industry.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { industry } = await params;
  const decoded = decodeURIComponent(industry);

  const brief = await prisma.industryBrief.findUnique({
    where: { industry: decoded },
  });

  return Response.json(brief ?? { industry: decoded, brief: "" });
}

/**
 * PUT: Create or update brief for an industry.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { industry } = await params;
  const decoded = decodeURIComponent(industry);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await prisma.industryBrief.upsert({
    where: { industry: decoded },
    update: { brief: parsed.data.brief },
    create: { industry: decoded, brief: parsed.data.brief },
  });

  return Response.json(result);
}

/**
 * DELETE: Remove brief for an industry.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { industry } = await params;
  const decoded = decodeURIComponent(industry);

  await prisma.industryBrief.deleteMany({
    where: { industry: decoded },
  });

  return Response.json({ ok: true });
}
