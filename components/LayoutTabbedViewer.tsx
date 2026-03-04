"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { wrapInDocument } from "@/lib/layout-preview";
import type { LayoutItem } from "@/components/LayoutSection";

interface LayoutTabbedViewerProps {
  refreshId: string;
  viewToken: string;
  layouts: LayoutItem[];
  stripePaymentStatus?: string;
  stripeSessionId?: string;
}

export function LayoutTabbedViewer({ refreshId, viewToken, layouts, stripePaymentStatus, stripeSessionId }: LayoutTabbedViewerProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("1");

  const layoutByTab = useMemo(() => {
    const map: Record<string, LayoutItem> = {};
    layouts.forEach((layout, i) => {
      map[String(i + 1)] = layout;
    });
    return map;
  }, [layouts]);

  const currentLayout = layoutByTab[activeTab] ?? layouts[0];

  // Rewrite absolute blob URLs so they resolve to the current origin,
  // regardless of what NEXT_PUBLIC_APP_URL was when the pipeline ran.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const srcdoc = useMemo(() => {
    const html = (currentLayout.layoutHtml ?? "").replace(
      /https?:\/\/[^/]+\/api\/blob\//g,
      `${origin}/api/blob/`
    );
    return wrapInDocument(html, currentLayout.layoutCss ?? "", {
      desktopViewport: true,
      scaleToFit: 0.85,
      baseUrl: origin,
    });
  }, [currentLayout.layoutHtml, currentLayout.layoutCss, origin]);

  const isPaid = stripePaymentStatus === "paid";

  const handleInstallClick = async () => {
    if (isPaid && stripeSessionId) {
      window.location.href = `/refreshed-layout?session_id=${encodeURIComponent(stripeSessionId)}`;
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshId,
          layoutIndex: currentLayout.layoutIndex,
          token: viewToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.alreadyPaid) {
          toast.info("You've already purchased a layout.");
          return;
        }
        toast.error(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      {/* Icy install button styles */}
      <style>{`
        .icy-install-btn {
          background: linear-gradient(135deg, #e0f7fa 0%, #80deea 50%, #4dd0e1 100%);
          color: #006064;
          border: 2px solid #80deea;
          box-shadow:
            0 4px 14px rgba(77, 208, 225, 0.4),
            0 0 20px rgba(128, 222, 234, 0.3);
          animation: icyPulse 2s ease-in-out infinite;
          overflow: hidden;
        }
        .icy-install-btn::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.4) 50%,
            transparent 70%
          );
          transform: rotate(45deg);
          animation: iceShimmer 3s ease-in-out infinite;
        }
        .icy-install-btn:hover {
          background: linear-gradient(135deg, #b2ebf2 0%, #4dd0e1 50%, #26c6da 100%);
          color: #004d40;
          transform: translateY(-2px);
          box-shadow:
            0 6px 20px rgba(77, 208, 225, 0.5),
            0 0 30px rgba(128, 222, 234, 0.5);
        }
        .icy-install-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          animation: none;
        }
        @keyframes icyPulse {
          0%, 100% {
            box-shadow:
              0 4px 14px rgba(77, 208, 225, 0.4),
              0 0 20px rgba(128, 222, 234, 0.3);
          }
          50% {
            box-shadow:
              0 4px 20px rgba(77, 208, 225, 0.6),
              0 0 35px rgba(128, 222, 234, 0.5),
              0 0 50px rgba(224, 247, 250, 0.3);
          }
        }
        @keyframes iceShimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          50%, 100% { transform: translateX(100%) rotate(45deg); }
        }
      `}</style>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {layouts.length > 1 && (
          <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-border/50 py-2 mb-2 -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12">
            <TabsList className="mx-auto flex w-fit">
              {layouts.map((layout, i) => (
                <TabsTrigger key={i + 1} value={String(i + 1)} className="px-8 py-2.5 text-base font-semibold">
                  {layout.templateName || `Layout ${i + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}
        <div className="mt-0">
          {/* Browser-style frame with sticky install CTA */}
          <div className="relative">
            <div
              className="rounded-lg border border-border bg-muted/20 shadow-lg overflow-hidden"
              style={{ height: "85vh" }}
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" aria-hidden />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" aria-hidden />
                  <span className="h-3 w-3 rounded-full bg-green-500/80" aria-hidden />
                </div>
              </div>
              <div
                className="w-full overflow-x-hidden overflow-y-auto bg-muted/30"
                style={{ height: "calc(85vh - 2.5rem)" }}
              >
                <iframe
                  title={`Layout option ${activeTab} preview`}
                  srcDoc={srcdoc}
                  className="h-full w-full border-0 align-top"
                  sandbox="allow-scripts"
                  style={{ minHeight: "100%" }}
                />
              </div>
            </div>

            {/* Always-visible install CTA pinned to bottom-right of frame */}
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={checkoutLoading}
              className="icy-install-btn absolute bottom-6 right-0 z-20 px-6 py-3 rounded-xl
                         font-bold text-sm cursor-pointer transition-all"
            >
              {checkoutLoading ? "Loading…" : isPaid ? "View Your Layout" : "Install This Layout"}
            </button>
          </div>
        </div>
      </Tabs>

    </>
  );
}
