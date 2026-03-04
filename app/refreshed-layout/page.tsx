import { prisma } from "@/lib/prisma";
import { s3GetSignedUrl } from "@/lib/storage/s3";
import { RefreshedLayoutClient } from "./RefreshedLayoutClient";

export default async function RefreshedLayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; refreshId?: string }>;
}) {
  const { session_id, refreshId: refreshIdParam } = await searchParams;

  if (!session_id && !refreshIdParam) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid link — no session ID provided.</p>
      </main>
    );
  }

  // Support both session_id (from Stripe redirect) and refreshId (from email link)
  const selectFields = {
    id: true,
    url: true,
    selectedLayoutPaid: true,
    paidEmail: true,
    layout1Html: true,
    layout1Css: true,
    layout2Html: true,
    layout2Css: true,
    layout3Html: true,
    layout3Css: true,
    bookingConfirmed: true,
    zipS3Key: true,
    stripeSessionId: true,
    urlProfile: { select: { domain: true } },
  } as const;

  const refresh = session_id
    ? await prisma.refresh.findFirst({
        where: { stripeSessionId: session_id, stripePaymentStatus: "paid" },
        select: selectFields,
      })
    : await prisma.refresh.findFirst({
        where: { id: refreshIdParam!, stripePaymentStatus: "paid" },
        select: selectFields,
      });

  if (!refresh) {
    // Only show pending/polling state if we have a session_id to poll with
    if (session_id) {
      return <RefreshedLayoutClient sessionId={session_id} initialStatus="pending" />;
    }
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Payment not found or not yet confirmed.</p>
      </main>
    );
  }

  const layoutIndex = refresh.selectedLayoutPaid ?? 1;
  const layoutHtmlKey = `layout${layoutIndex}Html` as keyof typeof refresh;
  const layoutCssKey = `layout${layoutIndex}Css` as keyof typeof refresh;
  const layoutHtml = (refresh[layoutHtmlKey] as string) ?? "";
  const layoutCss = (refresh[layoutCssKey] as string) ?? "";

  // Generate a fresh signed URL (the stored one expires after 7 days)
  const domain = refresh.urlProfile?.domain
    ?? new URL(refresh.url).hostname.replace(/^www\./, "");
  const safeDomain = domain.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const downloadFilename = `${safeDomain}-page-refresh-layout-${layoutIndex}.zip`;
  const zipDownloadUrl = refresh.zipS3Key
    ? (await s3GetSignedUrl(refresh.zipS3Key, 60 * 60 * 24 * 7, downloadFilename)) ?? undefined
    : undefined;

  return (
    <RefreshedLayoutClient
      sessionId={session_id ?? refresh.stripeSessionId ?? ""}
      initialStatus="paid"
      refreshId={refresh.id}
      layoutHtml={layoutHtml}
      layoutCss={layoutCss}
      email={refresh.paidEmail ?? undefined}
      alreadyBooked={refresh.bookingConfirmed}
      zipDownloadUrl={zipDownloadUrl}
    />
  );
}
