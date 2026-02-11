/**
 * POST /api/request-quote - Record quote request for a refresh.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_LAYOUT_INDEXES = [1, 2, 3] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const refreshId = typeof body.refreshId === "string" ? body.refreshId.trim() : "";
  const rawLayoutIndex = typeof body.layoutIndex === "number" ? body.layoutIndex : null;
  const layoutIndex =
    rawLayoutIndex !== null && VALID_LAYOUT_INDEXES.includes(rawLayoutIndex as 1 | 2 | 3)
      ? (rawLayoutIndex as 1 | 2 | 3)
      : null;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;
  const platform = typeof body.platform === "string" ? body.platform.trim() : null;

  if (!refreshId || !email) {
    return Response.json(
      { error: "Missing required fields: refreshId, email" },
      { status: 400 }
    );
  }

  if (rawLayoutIndex !== null && layoutIndex === null) {
    return Response.json(
      { error: "layoutIndex must be 1, 2, or 3" },
      { status: 400 }
    );
  }

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
  });

  if (!refresh) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      quoteRequested: true,
      ...(layoutIndex !== null && { selectedLayout: layoutIndex }),
      contactEmail: email,
      contactPhone: phone ?? undefined,
      notes: notes ?? undefined,
      hostingPlatform: platform ?? undefined,
    },
  });

  return Response.json({ success: true });
}
