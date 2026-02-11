/**
 * POST /api/request-quote - Record quote request for a refresh.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestQuoteSchema } from "@/lib/validations";

const VALID_LAYOUT_INDEXES = [1, 2, 3] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { refreshId, layoutIndex: rawLayoutIndex, email, phone, notes, platform } = parsed.data;
  const layoutIndex =
    rawLayoutIndex !== undefined &&
    VALID_LAYOUT_INDEXES.includes(rawLayoutIndex as 1 | 2 | 3)
      ? (rawLayoutIndex as 1 | 2 | 3)
      : null;

  if (rawLayoutIndex !== undefined && layoutIndex === null) {
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
