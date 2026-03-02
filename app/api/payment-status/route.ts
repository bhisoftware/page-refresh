import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return Response.json({ error: "session_id required" }, { status: 400 });
  }

  const refresh = await prisma.refresh.findFirst({
    where: { stripeSessionId: sessionId },
    select: {
      id: true,
      stripePaymentStatus: true,
      selectedLayoutPaid: true,
      viewToken: true,
    },
  });

  if (!refresh) {
    return Response.json({ status: "not_found" });
  }

  return Response.json({
    status: refresh.stripePaymentStatus ?? "pending",
    refreshId: refresh.id,
    layoutIndex: refresh.selectedLayoutPaid,
    viewToken: refresh.viewToken,
  });
}
