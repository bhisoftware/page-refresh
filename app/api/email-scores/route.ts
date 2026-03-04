/**
 * POST /api/email-scores - Capture email for score breakdown delivery.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendScoreBreakdown } from "@/lib/email";

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
    select: {
      id: true,
      urlProfileId: true,
      url: true,
      overallScore: true,
      clarityScore: true,
      visualScore: true,
      hierarchyScore: true,
      trustScore: true,
      conversionScore: true,
      contentScore: true,
      mobileScore: true,
      performanceScore: true,
    },
  });

  if (!refresh) {
    return Response.json({ error: "Refresh not found" }, { status: 404 });
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: { contactEmail: email },
  });

  // Promote contact email to UrlProfile
  if (refresh.urlProfileId) {
    await prisma.urlProfile.update({
      where: { id: refresh.urlProfileId },
      data: { customerEmail: email },
    });
  }

  sendScoreBreakdown(email, {
    url: refresh.url,
    overallScore: refresh.overallScore,
    clarityScore: refresh.clarityScore,
    visualScore: refresh.visualScore,
    hierarchyScore: refresh.hierarchyScore,
    trustScore: refresh.trustScore,
    conversionScore: refresh.conversionScore,
    contentScore: refresh.contentScore,
    mobileScore: refresh.mobileScore,
    performanceScore: refresh.performanceScore,
  }).catch((err) => console.error("Score email error:", err));

  return Response.json({ success: true });
}
