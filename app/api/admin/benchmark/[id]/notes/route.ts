import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { benchmarkNotesSchema } from "@/lib/validations";

/**
 * POST: Add note to benchmark.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const benchmark = await prisma.benchmark.findUnique({ where: { id } });
  if (!benchmark) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = benchmarkNotesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.parentId) {
    const parent = await prisma.benchmarkNote.findFirst({
      where: { id: parsed.data.parentId, benchmarkId: id, parentId: null },
    });
    if (!parent) {
      return Response.json({ error: "Parent not found or is itself a reply" }, { status: 400 });
    }
  }

  const note = await prisma.benchmarkNote.create({
    data: {
      benchmarkId: id,
      authorName: parsed.data.authorName,
      content: parsed.data.content,
      category: parsed.data.category ?? undefined,
      anchor: parsed.data.anchor ?? undefined,
      parentId: parsed.data.parentId ?? undefined,
    },
  });
  return Response.json(note);
}
