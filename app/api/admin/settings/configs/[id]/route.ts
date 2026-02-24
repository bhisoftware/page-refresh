import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { encrypt } from "@/lib/config/encryption";

/**
 * PUT: Update config value, label, or active status.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { configValue?: string; label?: string; active?: boolean; encrypted?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.apiConfig.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data: { configValue?: string; label?: string | null; active?: boolean } = {};
  if (typeof body.configValue === "string") {
    data.configValue = body.encrypted ? encrypt(body.configValue) : body.configValue;
  }
  if (typeof body.label === "string") data.label = body.label.trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;

  const updated = await prisma.apiConfig.update({
    where: { id },
    data,
  });
  return Response.json(updated);
}

/**
 * DELETE: Remove config.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.apiConfig.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.apiConfig.delete({ where: { id } });
  return Response.json({ ok: true });
}
