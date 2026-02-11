import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

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

  const { id: analysisId } = await params;

  const exists = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { id: true },
  });
  if (!exists) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  let body: { authorName?: string; content?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() || null : null;

  if (!authorName || !content) {
    return Response.json(
      { error: "authorName and content are required" },
      { status: 400 }
    );
  }

  const note = await prisma.internalNote.create({
    data: {
      analysisId,
      authorName,
      content,
      category,
    },
  });

  return Response.json(note);
}
