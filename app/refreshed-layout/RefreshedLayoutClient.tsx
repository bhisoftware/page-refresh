"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wrapInDocument } from "@/lib/layout-preview";
import { ScheduleInstallModal } from "@/components/ScheduleInstallModal";

interface RefreshedLayoutClientProps {
  sessionId: string;
  initialStatus: "pending" | "paid";
  refreshId?: string;
  layoutHtml?: string;
  layoutCss?: string;
  email?: string;
  alreadyBooked?: boolean;
}

export function RefreshedLayoutClient({
  sessionId,
  initialStatus,
  refreshId: initialRefreshId,
  layoutHtml,
  layoutCss,
  email,
  alreadyBooked = false,
}: RefreshedLayoutClientProps) {
  const [status] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [booked, setBooked] = useState(alreadyBooked);
  const [modalOpen, setModalOpen] = useState(
    initialStatus === "paid" && !alreadyBooked,
  );
  const [refreshId] = useState(initialRefreshId);
  const pollCount = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/payment-status?session_id=${encodeURIComponent(sessionId)}`,
      );
      const data = await res.json();
      if (data.status === "paid") {
        window.location.reload();
      }
    } catch {
      // ignore network errors, keep polling
    }
  }, [sessionId]);

  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current >= 15) {
        setTimedOut(true);
        clearInterval(interval);
        return;
      }
      poll();
    }, 2000);

    return () => clearInterval(interval);
  }, [status, poll]);

  const srcdoc = useMemo(
    () =>
      layoutHtml
        ? wrapInDocument(layoutHtml, layoutCss ?? "", {
            desktopViewport: true,
            scaleToFit: 0.85,
          })
        : "",
    [layoutHtml, layoutCss],
  );

  if (status === "pending") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          {timedOut ? (
            <>
              <p className="text-lg font-medium">
                Taking longer than expected.
              </p>
              <p className="text-muted-foreground max-w-md">
                Your payment was received — please check your email or contact
                support.
              </p>
            </>
          ) : (
            <>
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <p className="text-muted-foreground">
                Verifying your payment...
              </p>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="px-4 sm:px-8 lg:px-12 max-w-[1400px] mx-auto py-8">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6" style={{ fontFamily: "Fraunces, serif" }}>
          Let&apos;s get your new page connected
        </h1>

        {booked && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-sm text-green-800">
            Installation scheduled ✓
          </div>
        )}

        <div className="relative">
          <div className="rounded-lg border border-border bg-muted/20 shadow-lg overflow-hidden" style={{ height: "90vh" }}>
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/80" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-green-500/80" aria-hidden />
              </div>
            </div>
            <div
              className="w-full overflow-x-hidden overflow-y-auto bg-muted/30"
              style={{ height: "calc(90vh - 2.5rem)" }}
            >
              <iframe
                title="Your refreshed layout"
                srcDoc={srcdoc}
                className="h-full w-full border-0 align-top"
                sandbox="allow-scripts"
                style={{ minHeight: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {refreshId && (
        <ScheduleInstallModal
          refreshId={refreshId}
          email={email}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onBooked={() => setBooked(true)}
        />
      )}
    </main>
  );
}
