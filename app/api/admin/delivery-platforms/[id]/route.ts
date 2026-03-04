import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.sectionSplit !== undefined) data.sectionSplit = body.sectionSplit;
  if (body.readmeTemplate !== undefined) data.readmeTemplate = body.readmeTemplate;
  if (body.platformNotes !== undefined) data.platformNotes = body.platformNotes;
  if (body.folderStructure !== undefined) data.folderStructure = body.folderStructure;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.deliveryPlatform.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.deliveryPlatform.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
