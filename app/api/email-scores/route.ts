/**
 * POST /api/email-scores - Capture email for score breakdown delivery.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  refreshId: z.string().min(1),
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid email address" },
      { status: 400 },
    );
  }

  const { refreshId, email } = parsed.data;

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true },
  });

  if (!refresh) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: { contactEmail: email },
  });

  // TODO: Send actual email with dimension breakdown once email infra is set up.

  return Response.json({ success: true });
}
