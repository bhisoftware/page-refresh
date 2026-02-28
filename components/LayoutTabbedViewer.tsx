"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RequestQuoteForm } from "@/components/RequestQuoteForm";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { wrapInDocument } from "@/lib/layout-preview";
import type { LayoutItem } from "@/components/LayoutSection";

const EXPORT_PLATFORMS = [
  { value: "html", label: "HTML/CSS" },
  { value: "wordpress", label: "WordPress" },
  { value: "squarespace", label: "Squarespace" },
  { value: "wix", label: "Wix" },
] as const;

interface LayoutTabbedViewerProps {
  refreshId: string;
  viewToken: string;
  layouts: LayoutItem[];
}

export function LayoutTabbedViewer({ refreshId, viewToken, layouts }: LayoutTabbedViewerProps) {
  const [exportPlatform, setExportPlatform] = useState<string>("html");
  const [exportLoading, setExportLoading] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
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

  const srcdoc = useMemo(
    () =>
      wrapInDocument(currentLayout.layoutHtml, currentLayout.layoutCss ?? "", {
        desktopViewport: true,
        scaleToFit: 0.85,
      }),
    [currentLayout.layoutHtml, currentLayout.layoutCss]
  );

  const handleInstallClick = async () => {
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
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.info("Checkout coming soon — we'll notify you when it's ready.");
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
          position: relative;
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
          <TabsList className="mb-2 mx-auto flex w-fit">
            {layouts.map((_, i) => (
              <TabsTrigger key={i + 1} value={String(i + 1)} className="px-8">
                Layout {i + 1}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <div className="mt-0">
          {/* Browser-style frame with sticky install CTA */}
          <div className="relative">
            <div
              className="rounded-lg border border-border bg-muted/20 shadow-lg overflow-hidden"
              style={{ height: "80vh" }}
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
                style={{ height: "calc(80vh - 2.5rem)" }}
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
              className="icy-install-btn absolute bottom-6 right-6 z-20 px-6 py-3 rounded-xl
                         font-bold text-sm cursor-pointer transition-all"
            >
              {checkoutLoading ? "Loading…" : "Install This Layout"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full mt-4">
            <select
              value={exportPlatform}
              onChange={(e) => setExportPlatform(e.target.value)}
              disabled={exportLoading}
              className="flex h-10 w-full sm:w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {EXPORT_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={exportLoading}
              onClick={async () => {
                setExportLoading(true);
                try {
                  const res = await fetch("/api/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      refreshId,
                      layoutIndex: currentLayout.layoutIndex,
                      platform: exportPlatform,
                      token: viewToken,
                    }),
                  });
                  if (!res.ok) throw new Error("Export failed");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download =
                    res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ??
                    `layout-${currentLayout.layoutIndex}-${exportPlatform}.zip`;
                  a.click();
                  URL.revokeObjectURL(url);
                } finally {
                  setExportLoading(false);
                }
              }}
            >
              <Download className="h-4 w-4" />
              {exportLoading ? "Generating…" : "Download"}
            </Button>
            <Button className="sm:w-auto" onClick={() => setQuoteOpen(true)}>
              Select This Layout
            </Button>
          </div>
        </div>
      </Tabs>

      <RequestQuoteForm
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        refreshId={refreshId}
        layoutIndex={currentLayout.layoutIndex}
      />
    </>
  );
}
