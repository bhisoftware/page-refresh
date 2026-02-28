/**
 * POST /api/checkout — Create Stripe Checkout session (stub).
 *
 * TODO: Install `stripe` and `@stripe/stripe-js` packages.
 * TODO: Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.
 * TODO: Create a Stripe Price for the layout install product.
 * TODO: Replace the stub below with:
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *   const session = await stripe.checkout.sessions.create({
 *     mode: "payment",
 *     line_items: [{ price: PRICE_ID, quantity: 1 }],
 *     metadata: { refreshId, layoutIndex: String(layoutIndex) },
 *     success_url: `${process.env.NEXT_PUBLIC_APP_URL}/results/${refreshId}?token=${token}&paid=1`,
 *     cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/results/${refreshId}?token=${token}`,
 *   });
 *   return Response.json({ url: session.url });
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

  const { refreshId, token } = parsed.data;

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true, viewToken: true },
  });

  if (!refresh || refresh.viewToken !== token) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Stub — Stripe not yet configured
  return Response.json({
    url: null,
    message: "Stripe checkout not yet configured",
  });
}
