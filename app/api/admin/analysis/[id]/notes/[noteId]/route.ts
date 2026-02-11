import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * PUT: update an internal note. Body: { authorName?, content?, category? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: analysisId, noteId } = await params;

  let body: { authorName?: string; content?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const note = await prisma.internalNote.findFirst({
    where: { id: noteId, analysisId },
  });
  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  const data: { authorName?: string; content?: string; category?: string | null } = {};
  if (typeof body.authorName === "string") data.authorName = body.authorName.trim();
  if (typeof body.content === "string") data.content = body.content.trim();
  if (body.category !== undefined)
    data.category = typeof body.category === "string" ? body.category.trim() || null : null;

  const updated = await prisma.internalNote.update({
    where: { id: noteId },
    data,
  });

  return Response.json(updated);
}

/**
 * DELETE: remove an internal note.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: analysisId, noteId } = await params;

  const note = await prisma.internalNote.findFirst({
    where: { id: noteId, analysisId },
  });
  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.internalNote.delete({
    where: { id: noteId },
  });

  return Response.json({ ok: true });
}
