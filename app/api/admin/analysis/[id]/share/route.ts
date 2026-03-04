import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { randomBytes } from "crypto";

const SHARE_TTL_DAYS = 7;

/**
 * POST: generate (or regenerate) a 7-day share token for a refresh report.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const exists = await prisma.refresh.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  const shareToken = randomBytes(24).toString("base64url");
  const shareExpiry = new Date(
    Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refresh.update({
    where: { id },
    data: { shareToken, shareExpiry },
  });

  return Response.json({ shareToken, shareExpiry });
}

/**
 * DELETE: revoke the share token for a refresh report.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.refresh.update({
    where: { id },
    data: { shareToken: null, shareExpiry: null },
  });

  return Response.json({ ok: true });
}
