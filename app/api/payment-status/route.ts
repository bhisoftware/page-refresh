import { NextRequest } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { s3GetSignedUrl } from "@/lib/storage/s3";
import { buildAndDeliverLayout } from "@/lib/zip-builder";

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
      url: true,
      stripePaymentStatus: true,
      selectedLayoutPaid: true,
      zipS3Key: true,
      urlProfile: { select: { domain: true } },
    },
  });

  if (!refresh) {
    return Response.json({ status: "not_found" });
  }

  function zipFilename(layoutIdx: number) {
    const domain = refresh!.urlProfile?.domain
      ?? new URL(refresh!.url).hostname.replace(/^www\./, "");
    const safe = domain.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
    return `${safe}-page-refresh-layout-${layoutIdx}.zip`;
  }

  // Fallback: if DB still says pending, check Stripe directly.
  // This handles cases where the webhook is delayed or misconfigured.
  if (refresh.stripePaymentStatus !== "paid") {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        const layoutIndex = session.metadata?.layoutIndex;
        const targetPlatform =
          session.custom_fields?.find((f: { key: string }) => f.key === "target_platform")
            ?.dropdown?.value ?? null;

        await prisma.refresh.update({
          where: { id: refresh.id },
          data: {
            stripePaymentStatus: "paid",
            paidAt: new Date(),
            paidEmail: session.customer_details?.email ?? null,
            selectedLayoutPaid: layoutIndex ? parseInt(layoutIndex, 10) : null,
            targetPlatform,
          },
        });

        // Trigger ZIP build (runs after response)
        const selectedLayout = layoutIndex ? parseInt(layoutIndex, 10) : 1;
        const platform = targetPlatform ?? "custom";
        after(async () => {
          try {
            await buildAndDeliverLayout(refresh.id, selectedLayout, platform);
          } catch (err) {
            console.error("[ZIP delivery failed via fallback]", err);
          }
        });

        const selectedIdx = layoutIndex ? parseInt(layoutIndex, 10) : 1;
        const zipDownloadUrl = refresh.zipS3Key
          ? await s3GetSignedUrl(refresh.zipS3Key, 60 * 60 * 24 * 7, zipFilename(selectedIdx))
          : null;

        return Response.json({
          status: "paid",
          refreshId: refresh.id,
          layoutIndex: layoutIndex ? parseInt(layoutIndex, 10) : null,
          zipDownloadUrl,
        });
      }
    } catch (err) {
      console.error("[payment-status] Stripe fallback check failed:", err);
      // Fall through to return DB status
    }
  }

  const zipDownloadUrl = refresh.zipS3Key
    ? await s3GetSignedUrl(refresh.zipS3Key, 60 * 60 * 24 * 7, zipFilename(refresh.selectedLayoutPaid ?? 1))
    : null;

  return Response.json({
    status: refresh.stripePaymentStatus ?? "pending",
    refreshId: refresh.id,
    layoutIndex: refresh.selectedLayoutPaid,
    zipDownloadUrl,
  });
}
