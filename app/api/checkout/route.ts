import { NextRequest } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

const schema = z.object({
  refreshId: z.string().min(1),
  layoutIndex: z.number().int().min(1).max(3),
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { refreshId, layoutIndex, token } = parsed.data;

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true, viewToken: true, stripePaymentStatus: true },
  });

  if (!refresh || refresh.viewToken !== token) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (refresh.stripePaymentStatus === "paid") {
    return Response.json(
      { error: "Already paid", alreadyPaid: true },
      { status: 409 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      metadata: { refreshId, layoutIndex: String(layoutIndex) },
      success_url: `${appUrl}/refreshed-layout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/results/${refreshId}?token=${token}`,
    });

    await prisma.refresh.update({
      where: { id: refreshId },
      data: {
        stripeSessionId: session.id,
        selectedLayoutPaid: layoutIndex,
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[checkout] Stripe error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
