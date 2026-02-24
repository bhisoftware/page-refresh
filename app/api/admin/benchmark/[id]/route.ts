import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: Full benchmark with notes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const benchmark = await prisma.benchmark.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "asc" } } },
  });
  if (!benchmark) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(benchmark);
}

/**
 * DELETE: Remove benchmark (cascade deletes notes).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.benchmark.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.benchmark.delete({ where: { id } });
  return Response.json({ ok: true });
}
