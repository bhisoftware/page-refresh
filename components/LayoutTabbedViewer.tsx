"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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

/** Icy "Install This Layout" button injected at the end of each iframe's content flow. */
const INSTALL_BUTTON_HTML = `
<div style="padding:48px 24px;text-align:center;">
  <style>
    .pr-install-btn{
      display:inline-block;
      background:linear-gradient(135deg,#e0f7fa 0%,#80deea 50%,#4dd0e1 100%);
      color:#006064;border:2px solid #80deea;
      box-shadow:0 4px 14px rgba(77,208,225,.4),0 0 20px rgba(128,222,234,.3);
      padding:16px 36px;border-radius:14px;
      font-weight:700;font-size:17px;
      font-family:system-ui,-apple-system,sans-serif;
      cursor:pointer;position:relative;overflow:hidden;
      animation:prPulse 2s ease-in-out infinite;
      transition:all .2s;text-decoration:none;
    }
    .pr-install-btn::before{
      content:'';position:absolute;top:-50%;left:-50%;
      width:200%;height:200%;
      background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,.4) 50%,transparent 70%);
      transform:rotate(45deg);animation:prShimmer 3s ease-in-out infinite;
    }
    .pr-install-btn:hover{
      background:linear-gradient(135deg,#b2ebf2 0%,#4dd0e1 50%,#26c6da 100%);
      color:#004d40;transform:translateY(-2px);
      box-shadow:0 6px 20px rgba(77,208,225,.5),0 0 30px rgba(128,222,234,.5);
    }
    @keyframes prPulse{
      0%,100%{box-shadow:0 4px 14px rgba(77,208,225,.4),0 0 20px rgba(128,222,234,.3)}
      50%{box-shadow:0 4px 20px rgba(77,208,225,.6),0 0 35px rgba(128,222,234,.5),0 0 50px rgba(224,247,250,.3)}
    }
    @keyframes prShimmer{
      0%{transform:translateX(-100%) rotate(45deg)}
      50%,100%{transform:translateX(100%) rotate(45deg)}
    }
  </style>
  <button class="pr-install-btn" onclick="window.parent.postMessage({type:'installLayout'},'*')">
    Install This Layout
  </button>
</div>`;

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

  const srcdoc = useMemo(() => {
    const doc = wrapInDocument(currentLayout.layoutHtml, currentLayout.layoutCss ?? "", {
      desktopViewport: true,
      scaleToFit: 0.85,
    });
    // Inject install button at the end of the content flow (before </body>)
    return doc.replace("</body>", INSTALL_BUTTON_HTML + "</body>");
  }, [currentLayout.layoutHtml, currentLayout.layoutCss]);

  const handleInstallClick = useCallback(async () => {
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
  }, [refreshId, currentLayout.layoutIndex, viewToken]);

  // Listen for install button clicks from inside the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "installLayout") {
        handleInstallClick();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleInstallClick]);

  return (
    <>
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
          {/* Browser-style frame */}
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
