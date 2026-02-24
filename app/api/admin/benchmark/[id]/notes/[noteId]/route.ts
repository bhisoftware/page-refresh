import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { benchmarkNotesSchema } from "@/lib/validations";

/**
 * PUT: Update note.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, noteId } = await params;
  const note = await prisma.benchmarkNote.findFirst({
    where: { id: noteId, benchmarkId: id },
  });
  if (!note) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = benchmarkNotesSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.benchmarkNote.update({
    where: { id: noteId },
    data: {
      ...(parsed.data.authorName != null && { authorName: parsed.data.authorName }),
      ...(parsed.data.content != null && { content: parsed.data.content }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category ?? null }),
    },
  });
  return Response.json(updated);
}

/**
 * DELETE: Remove note.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, noteId } = await params;
  const note = await prisma.benchmarkNote.findFirst({
    where: { id: noteId, benchmarkId: id },
  });
  if (!note) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.benchmarkNote.delete({ where: { id: noteId } });
  return Response.json({ ok: true });
}
