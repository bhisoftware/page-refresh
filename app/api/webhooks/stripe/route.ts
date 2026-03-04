import Stripe from "stripe";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmation } from "@/lib/email";
import { buildAndDeliverLayout } from "@/lib/zip-builder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
          // Idempotency: skip DB update if already paid, but still ensure ZIP was built
          const existing = await prisma.refresh.findUnique({
            where: { id: refreshId },
            select: { stripePaymentStatus: true, zipS3Key: true },
          });

          if (existing?.stripePaymentStatus === "paid") {
            if (!existing.zipS3Key) {
              // Fallback marked paid but ZIP wasn't built yet — trigger it
              const selectedLayout = layoutIndex ? parseInt(layoutIndex, 10) : 1;
              const platform = targetPlatform ?? "custom";
              after(async () => {
                try {
                  await buildAndDeliverLayout(refreshId, selectedLayout, platform);
                } catch (err) {
                  console.error("[ZIP delivery failed via webhook retry]", err);
                }
              });
            }
            console.log(`Stripe webhook: refresh ${refreshId} already paid, skipping DB update`);
            break;
          }

          const refresh = await prisma.refresh.update({
            where: { id: refreshId },
            data: {
              stripePaymentStatus: "paid",
              paidAt: new Date(),
              paidEmail: session.customer_details?.email ?? null,
              contactEmail: session.customer_details?.email ?? undefined,
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
            const emailTo = session.customer_details.email;
            after(async () => {
              try {
                await sendPaymentConfirmation(emailTo, refreshId);
              } catch (err) {
                console.error("Email send error:", err);
              }
            });
          }

          // Build ZIP, upload to S3, send delivery email (runs after response)
          const selectedLayout = layoutIndex ? parseInt(layoutIndex, 10) : 1;
          const platform = targetPlatform ?? "custom";
          after(async () => {
            try {
              await buildAndDeliverLayout(refreshId, selectedLayout, platform);
            } catch (err) {
              console.error("[ZIP delivery failed]", err);
            }
          });
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
