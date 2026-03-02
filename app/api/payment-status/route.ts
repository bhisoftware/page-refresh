import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

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
    },
  });

  if (!refresh) {
    return Response.json({ status: "not_found" });
  }

  // Fallback: if DB still says pending, check Stripe directly.
  // This handles cases where the webhook is delayed or misconfigured.
  if (refresh.stripePaymentStatus !== "paid") {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        await prisma.refresh.update({
          where: { id: refresh.id },
          data: {
            stripePaymentStatus: "paid",
            paidAt: new Date(),
            paidEmail: session.customer_details?.email ?? null,
          },
        });

        return Response.json({
          status: "paid",
          refreshId: refresh.id,
          layoutIndex: refresh.selectedLayoutPaid,
        });
      }
    } catch (err) {
      console.error("[payment-status] Stripe fallback check failed:", err);
      // Fall through to return DB status
    }
  }

  return Response.json({
    status: refresh.stripePaymentStatus ?? "pending",
    refreshId: refresh.id,
    layoutIndex: refresh.selectedLayoutPaid,
  });
}
