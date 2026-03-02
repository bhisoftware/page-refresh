import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Stripe webhook signature verification failed: ${message}`);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const refreshId = session.metadata?.refreshId;
    const layoutIndex = session.metadata?.layoutIndex;

    if (refreshId) {
      try {
        const refresh = await prisma.refresh.update({
          where: { id: refreshId },
          data: {
            stripePaymentStatus: "paid",
            paidAt: new Date(),
            paidEmail: session.customer_details?.email ?? null,
            selectedLayoutPaid: layoutIndex ? parseInt(layoutIndex, 10) : null,
          },
          select: { urlProfileId: true },
        });

        if (refresh.urlProfileId && session.customer_details?.email) {
          await prisma.urlProfile.update({
            where: { id: refresh.urlProfileId },
            data: { customerEmail: session.customer_details.email },
          });
        }
      } catch (err) {
        console.error(`Stripe webhook DB error for refresh ${refreshId}:`, err);
        // Return 200 anyway to prevent Stripe retries
      }
    }
  }

  return Response.json({ received: true });
}
