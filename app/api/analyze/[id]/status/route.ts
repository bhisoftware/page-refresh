/**
 * Lightweight status endpoint for SSE recovery polling.
 * Returns { status } for a given refresh ID + viewToken.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || token.length === 0) {
    return Response.json({ error: "Token required" }, { status: 403 });
  }

  const refresh = await prisma.refresh.findUnique({
    where: { id },
    select: {
      status: true,
      viewToken: true,
      layout1Html: true,
      layout2Html: true,
      layout3Html: true,
    },
  });

  if (!refresh) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (refresh.viewToken !== token) {
    return Response.json({ error: "Invalid token" }, { status: 403 });
  }

  const layoutCount = [refresh.layout1Html, refresh.layout2Html, refresh.layout3Html]
    .filter((html) => html?.trim()).length;

  return Response.json({ status: refresh.status, layoutCount });
}
