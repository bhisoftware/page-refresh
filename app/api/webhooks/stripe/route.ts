import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmation } from "@/lib/email";
import { buildAndDeliverLayout } from "@/lib/zip-builder";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const refreshId = session.metadata?.refreshId;
      const layoutIndex = session.metadata?.layoutIndex;

      // Extract target platform from custom fields dropdown
      const targetPlatform =
        session.custom_fields?.find((f) => f.key === "target_platform")
          ?.dropdown?.value ?? null;

      if (refreshId) {
        try {
          // Idempotency: skip if already paid
          const existing = await prisma.refresh.findUnique({
            where: { id: refreshId },
            select: { stripePaymentStatus: true },
          });

          if (existing?.stripePaymentStatus === "paid") {
            console.log(`Stripe webhook: refresh ${refreshId} already paid, skipping duplicate`);
            break;
          }

          const refresh = await prisma.refresh.update({
            where: { id: refreshId },
            data: {
              stripePaymentStatus: "paid",
              paidAt: new Date(),
              paidEmail: session.customer_details?.email ?? null,
              selectedLayoutPaid: layoutIndex ? parseInt(layoutIndex, 10) : null,
              targetPlatform,
            },
            select: { urlProfileId: true },
          });

          if (refresh.urlProfileId && session.customer_details?.email) {
            await prisma.urlProfile.update({
              where: { id: refresh.urlProfileId },
              data: { customerEmail: session.customer_details.email },
            });
          }

          if (session.customer_details?.email) {
            sendPaymentConfirmation(session.customer_details.email, refreshId).catch(
              (err) => console.error("Email send error:", err),
            );
          }

          // Fire-and-forget: build ZIP, upload to S3, send delivery email
          if (targetPlatform) {
            const selectedLayout = layoutIndex ? parseInt(layoutIndex, 10) : 1;
            buildAndDeliverLayout(refreshId, selectedLayout, targetPlatform)
              .catch((err) => console.error("[ZIP delivery failed]", err));
          }
        } catch (err) {
          console.error(`Stripe webhook DB error for refresh ${refreshId}:`, err);
          // Return 200 anyway to prevent Stripe retries
        }
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const refreshId = session.metadata?.refreshId;

      if (refreshId) {
        try {
          await prisma.refresh.updateMany({
            where: {
              id: refreshId,
              stripePaymentStatus: { not: "paid" },
            },
            data: { stripePaymentStatus: "expired" },
          });
          console.log(`Stripe webhook: session expired for refresh ${refreshId}`);
        } catch (err) {
          console.error(`Stripe webhook: error handling expired session for ${refreshId}:`, err);
        }
      }
      break;
    }

    default:
      console.log(`Stripe webhook: unhandled event type ${event.type}`);
  }

  return Response.json({ received: true });
}
