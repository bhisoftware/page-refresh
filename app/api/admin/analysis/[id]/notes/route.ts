import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { adminNotesSchema } from "@/lib/validations";

/**
 * POST: add an internal note. Body: { authorName, content, category? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: refreshId } = await params;

  const exists = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true },
  });
  if (!exists) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminNotesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { authorName, content, category } = parsed.data;

  const note = await prisma.internalNote.create({
    data: {
      refreshId,
      authorName,
      content,
      category: category ?? undefined,
    },
  });

  return Response.json(note);
}
