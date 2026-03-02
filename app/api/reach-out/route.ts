/**
 * POST /api/reach-out - Capture contact (first name + email) from results page and promote to URL profile.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reachOutSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = reachOutSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { refreshId, token, email, firstName } = parsed.data;

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true, viewToken: true, urlProfileId: true },
  });

  if (!refresh) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  if (refresh.viewToken !== token) {
    return Response.json({ error: "Invalid token" }, { status: 403 });
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      quoteRequested: true,
      contactEmail: email.trim(),
      contactFirstName: firstName.trim(),
    },
  });

  if (refresh.urlProfileId) {
    await prisma.urlProfile.update({
      where: { id: refresh.urlProfileId },
      data: {
        customerEmail: email.trim(),
        customerFirstName: firstName.trim(),
      },
    });
  }

  return Response.json({ success: true });
}
