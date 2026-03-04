"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { wrapInDocument } from "@/lib/layout-preview";
import { ScheduleInstallModal } from "@/components/ScheduleInstallModal";
import { Logo } from "@/components/Logo";

interface RefreshedLayoutClientProps {
  sessionId: string;
  initialStatus: "pending" | "paid";
  refreshId?: string;
  layoutHtml?: string;
  layoutCss?: string;
  email?: string;
  alreadyBooked?: boolean;
  zipDownloadUrl?: string;
}

export function RefreshedLayoutClient({
  sessionId,
  initialStatus,
  refreshId: initialRefreshId,
  layoutHtml,
  layoutCss,
  email,
  alreadyBooked = false,
  zipDownloadUrl: initialZipUrl,
}: RefreshedLayoutClientProps) {
  const [status] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [booked, setBooked] = useState(alreadyBooked);
  const [modalOpen, setModalOpen] = useState(
    initialStatus === "paid" && !alreadyBooked,
  );
  const [refreshId] = useState(initialRefreshId);
  const [zipDownloadUrl, setZipDownloadUrl] = useState(initialZipUrl);
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

  // Poll for ZIP download URL if not yet available
  useEffect(() => {
    if (status !== "paid" || zipDownloadUrl || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payment-status?session_id=${encodeURIComponent(sessionId)}`,
        );
        const data = await res.json();
        if (data.zipDownloadUrl) {
          setZipDownloadUrl(data.zipDownloadUrl);
          clearInterval(interval);
        }
      } catch {
        // ignore, keep polling
      }
    }, 3000);

    // Auto-reload after 2 minutes so SSR picks up the URL (or polling restarts)
    const timeout = setTimeout(() => {
      clearInterval(interval);
      window.location.reload();
    }, 120_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, zipDownloadUrl, sessionId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const srcdoc = useMemo(
    () => {
      if (!layoutHtml) return "";
      const html = layoutHtml.replace(
        /https?:\/\/[^/]+\/api\/blob\//g,
        `${origin}/api/blob/`
      );
      return wrapInDocument(html, layoutCss ?? "", {
        desktopViewport: true,
        scaleToFit: 0.85,
        refreshId,
        baseUrl: origin,
      });
    },
    [layoutHtml, layoutCss, refreshId, origin],
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
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <Logo iconSize={18} className="gap-1.5" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6" style={{ fontFamily: "Fraunces, serif" }}>
          Let&apos;s connect your new page
        </h1>

        {/* CTA bar — always visible when paid */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {zipDownloadUrl ? (
            <a
              href={zipDownloadUrl}
              download
              className="inline-flex items-center gap-2 rounded-md bg-[#2d5a3d] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1e4a2e] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Your New Page
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-default">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
              Preparing your download...
            </span>
          )}

          {!booked && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Schedule Installation
            </button>
          )}

          {booked && (
            <div className="inline-flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-sm text-green-800">
              Installation scheduled
            </div>
          )}
        </div>

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
