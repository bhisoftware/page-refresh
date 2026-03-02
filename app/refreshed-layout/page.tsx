import { prisma } from "@/lib/prisma";
import { RefreshedLayoutClient } from "./RefreshedLayoutClient";

export default async function RefreshedLayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  if (!session_id) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid link — no session ID provided.</p>
      </main>
    );
  }

  const refresh = await prisma.refresh.findFirst({
    where: { stripeSessionId: session_id, stripePaymentStatus: "paid" },
    select: {
      id: true,
      selectedLayoutPaid: true,
      paidEmail: true,
      layout1Html: true,
      layout1Css: true,
      layout2Html: true,
      layout2Css: true,
      layout3Html: true,
      layout3Css: true,
      bookingConfirmed: true,
    },
  });

  if (!refresh) {
    return <RefreshedLayoutClient sessionId={session_id} initialStatus="pending" />;
  }

  const layoutIndex = refresh.selectedLayoutPaid ?? 1;
  const layoutHtmlKey = `layout${layoutIndex}Html` as keyof typeof refresh;
  const layoutCssKey = `layout${layoutIndex}Css` as keyof typeof refresh;
  const layoutHtml = (refresh[layoutHtmlKey] as string) ?? "";
  const layoutCss = (refresh[layoutCssKey] as string) ?? "";

  return (
    <RefreshedLayoutClient
      sessionId={session_id}
      initialStatus="paid"
      refreshId={refresh.id}
      layoutHtml={layoutHtml}
      layoutCss={layoutCss}
      email={refresh.paidEmail ?? undefined}
      alreadyBooked={refresh.bookingConfirmed}
    />
  );
}
