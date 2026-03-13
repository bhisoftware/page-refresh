"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { wrapInDocument } from "@/lib/layout-preview";
import type { LayoutItem } from "@/components/LayoutSection";
import { Maximize2, X } from "lucide-react";

const LOCKED_TAB_BAR_HEIGHT_PX = 48;
const LOCK_TRANSITION_MS = 250;

interface LayoutTabbedViewerProps {
  refreshId: string;
  viewToken: string;
  layouts: LayoutItem[];
  stripePaymentStatus?: string;
  stripeSessionId?: string;
  /** When true, show "View Full Screen" and allow locking the viewer into the viewport (results page only). */
  enableLock?: boolean;
}

export function LayoutTabbedViewer({ refreshId, viewToken, layouts, stripePaymentStatus, stripeSessionId, enableLock = false }: LayoutTabbedViewerProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("1");
  const [isLocked, setIsLocked] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(0);
  const [showLockCta, setShowLockCta] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lockedScrollRef = useRef<HTMLDivElement | null>(null);

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

  // Ensure each layout preview starts scrolled to the top when content changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = 0;
  }, [srcdoc]);

  // In locked mode, reset iframe container scroll when switching tabs
  useEffect(() => {
    if (isLocked && lockedScrollRef.current) lockedScrollRef.current.scrollTop = 0;
  }, [isLocked, activeTab]);

  // Intersection Observer: when layout section is ~80% visible, show "View Full Screen" CTA
  useEffect(() => {
    if (!enableLock || isLocked || !containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.intersectionRatio >= 0.8) setShowLockCta(true); },
      { threshold: 0.8, rootMargin: "0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enableLock, isLocked]);

  // Lock: capture height for spacer, then enter locked state
  const enterLock = useCallback(() => {
    if (!containerRef.current) return;
    setSectionHeight(containerRef.current.getBoundingClientRect().height);
    setShowLockCta(false);
    setIsLocked(true);
  }, []);

  // Unlock: restore normal flow
  const exitLock = useCallback(() => {
    setIsLocked(false);
  }, []);

  // Body overflow when locked (freeze parent scroll)
  useEffect(() => {
    if (!isLocked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isLocked]);

  // Update spacer height on resize while locked
  useEffect(() => {
    if (!isLocked) return;
    const onResize = () => {
      if (containerRef.current) setSectionHeight(containerRef.current.getBoundingClientRect().height);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isLocked]);

  // Escape to exit locked mode
  useEffect(() => {
    if (!enableLock || !isLocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitLock();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableLock, isLocked, exitLock]);

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

  const tabBarChromeHeight = "2.5rem";
  const lockedIframeHeight = `calc(100vh - ${LOCKED_TAB_BAR_HEIGHT_PX}px - ${tabBarChromeHeight})`;

  return (
    <>
      {/* Page Refresh brand green install button styles */}
      <style>{`
        .icy-install-btn {
          background: linear-gradient(135deg, #7faa8e 0%, #2d5a3d 50%, #1e4a2e 100%);
          color: #f5f0eb;
          border: 2px solid #2d5a3d;
          box-shadow:
            0 4px 14px rgba(45, 90, 61, 0.4),
            0 0 20px rgba(45, 90, 61, 0.3);
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
            rgba(255, 255, 255, 0.25) 50%,
            transparent 70%
          );
          transform: rotate(45deg);
          animation: iceShimmer 3s ease-in-out infinite;
        }
        .icy-install-btn:hover {
          background: linear-gradient(135deg, #2d5a3d 0%, #1e4a2e 50%, #1a3d28 100%);
          color: #fff;
          transform: translateY(-2px);
          box-shadow:
            0 6px 20px rgba(45, 90, 61, 0.5),
            0 0 30px rgba(45, 90, 61, 0.5);
        }
        .icy-install-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          animation: none;
        }
        @keyframes icyPulse {
          0%, 100% {
            box-shadow:
              0 4px 14px rgba(45, 90, 61, 0.4),
              0 0 20px rgba(45, 90, 61, 0.3);
          }
          50% {
            box-shadow:
              0 4px 20px rgba(45, 90, 61, 0.6),
              0 0 35px rgba(45, 90, 61, 0.5),
              0 0 50px rgba(127, 170, 142, 0.3);
          }
        }
        @keyframes iceShimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          50%, 100% { transform: translateX(100%) rotate(45deg); }
        }
      `}</style>

      {/* Locked mode: spacer preserves scroll position; fixed overlay fills viewport */}
      {isLocked && <div aria-hidden style={{ height: sectionHeight }} />}
      <div
        className={`fixed inset-0 z-50 flex flex-col bg-[#f5f0eb] transition-opacity duration-[250ms] ease-in-out ${isLocked ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
              {/* Tab bar + close: ~48px total, touch-friendly */}
              <div
                className="flex items-center justify-between gap-2 bg-slate-50/95 backdrop-blur-sm border-b border-border/50 px-3 py-2 flex-shrink-0"
                style={{ minHeight: LOCKED_TAB_BAR_HEIGHT_PX }}
              >
                <button
                  type="button"
                  onClick={exitLock}
                  className="flex items-center gap-1.5 rounded-full bg-white/90 border border-border px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors touch-manipulation"
                  aria-label="Back to scores"
                >
                  <X className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Back to scores</span>
                </button>
                {layouts.length > 1 && (
                  <TabsList className="flex w-fit">
                    {layouts.map((layout, i) => (
                      <TabsTrigger key={i + 1} value={String(i + 1)} className="px-4 py-2 text-sm font-semibold touch-manipulation">
                        {layout.templateName || `Layout ${i + 1}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                )}
              </div>
              <div className="flex-1 min-h-0 flex flex-col px-2 pb-2 relative">
                <div className="rounded-lg border border-border bg-muted/20 shadow-lg overflow-hidden flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 flex-shrink-0" style={{ height: tabBarChromeHeight }}>
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-500/80" aria-hidden />
                      <span className="h-3 w-3 rounded-full bg-amber-500/80" aria-hidden />
                      <span className="h-3 w-3 rounded-full bg-green-500/80" aria-hidden />
                    </div>
                  </div>
                  <div
                    className="w-full overflow-x-hidden overflow-y-auto bg-muted/30 flex-1 min-h-0"
                    ref={lockedScrollRef}
                    style={{ height: lockedIframeHeight }}
                  >
                    <iframe
                      title={`Layout option ${activeTab} preview (fullscreen)`}
                      srcDoc={srcdoc}
                      className="h-full w-full border-0 align-top"
                      sandbox="allow-scripts"
                      style={{ minHeight: "100%" }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={checkoutLoading}
                  className="icy-install-btn absolute bottom-6 right-4 z-20 px-7 py-3.5 rounded-xl font-bold text-base cursor-pointer transition-all touch-manipulation"
                >
                  {checkoutLoading ? "Loading…" : isPaid ? "View Your Layout" : "Select This Refreshed Page"}
                </button>
              </div>
            </Tabs>
      </div>

      {/* Normal (in-flow) viewer: observed for 80% visibility to show CTA */}
      <div ref={containerRef}>
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
            <div className="mt-0 relative">
              {enableLock && showLockCta && (
                <button
                  type="button"
                  onClick={enterLock}
                  className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-full bg-white border border-border px-4 py-2.5 text-sm font-medium text-foreground shadow-md hover:bg-muted/50 transition-colors"
                  aria-label="View full screen"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  View Full Screen
                </button>
              )}
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
                  ref={scrollContainerRef}
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
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={checkoutLoading}
                className="icy-install-btn absolute bottom-6 right-0 z-20 px-7 py-3.5 rounded-xl font-bold text-base cursor-pointer transition-all"
              >
                {checkoutLoading ? "Loading…" : isPaid ? "View Your Layout" : "Select This Refreshed Page"}
              </button>
            </div>
          </Tabs>
        </div>
    </>
  );
}
