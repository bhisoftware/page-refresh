/**
 * POST /api/request-install - Record install request for a refresh.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestInstallSchema } from "@/lib/validations";

const VALID_LAYOUT_INDEXES = [1, 2, 3] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestInstallSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const {
    refreshId,
    layoutIndex: rawLayoutIndex,
    email,
    phone,
    hostingPlatform,
    hasCredentialsReady,
    preferredTime,
    notes,
  } = parsed.data;
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
      installRequested: true,
      ...(layoutIndex !== null && { selectedLayout: layoutIndex }),
      contactEmail: email,
      contactPhone: phone,
      hostingPlatform: hostingPlatform ?? undefined,
      notes: (() => {
        const parts = [
          refresh.notes,
          hasCredentialsReady ? "Has hosting credentials ready" : null,
          preferredTime ? `Preferred time: ${preferredTime}` : null,
          notes,
        ]
          .filter(Boolean)
          .join("\n");
        return (parts || notes) ?? undefined;
      })(),
    },
  });

  // Promote contact info to UrlProfile
  if (refresh.urlProfileId) {
    await prisma.urlProfile.update({
      where: { id: refresh.urlProfileId },
      data: {
        customerEmail: email,
        contactPhone: phone,
        hostingPlatform: hostingPlatform ?? undefined,
      },
    });
  }

  return Response.json({ success: true });
}
