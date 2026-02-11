/**
 * GET analysis by ID - public endpoint. Requires valid token query param.
 * Returns only public-safe fields (no internal notes, prompt logs, or contact PII).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAnalysisForPublic } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string" || token.length === 0) {
    return Response.json(
      { error: "This link is invalid or has expired" },
      { status: 403 }
    );
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
  });

  if (!analysis) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  if (analysis.viewToken !== token) {
    return Response.json(
      { error: "This link is invalid or has expired" },
      { status: 403 }
    );
  }

  return Response.json(serializeAnalysisForPublic(analysis));
}
