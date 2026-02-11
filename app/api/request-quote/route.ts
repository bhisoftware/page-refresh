/**
 * POST /api/request-quote - Record quote request for an analysis.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_LAYOUT_INDEXES = [1, 2, 3] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const analysisId = typeof body.analysisId === "string" ? body.analysisId.trim() : "";
  const rawLayoutIndex = typeof body.layoutIndex === "number" ? body.layoutIndex : null;
  const layoutIndex =
    rawLayoutIndex !== null && VALID_LAYOUT_INDEXES.includes(rawLayoutIndex as 1 | 2 | 3)
      ? (rawLayoutIndex as 1 | 2 | 3)
      : null;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;
  const platform = typeof body.platform === "string" ? body.platform.trim() : null;

  if (!analysisId || !email) {
    return Response.json(
      { error: "Missing required fields: analysisId, email" },
      { status: 400 }
    );
  }

  if (rawLayoutIndex !== null && layoutIndex === null) {
    return Response.json(
      { error: "layoutIndex must be 1, 2, or 3" },
      { status: 400 }
    );
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  await prisma.analysis.update({
    where: { id: analysisId },
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
