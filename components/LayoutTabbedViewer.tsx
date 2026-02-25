"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RequestQuoteForm } from "@/components/RequestQuoteForm";
import { Download } from "lucide-react";
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
  /** Exactly 3 layouts (Option 1, 2, 3) */
  layouts: [LayoutItem, LayoutItem, LayoutItem];
}

export function LayoutTabbedViewer({ refreshId, viewToken, layouts }: LayoutTabbedViewerProps) {
  const [exportPlatform, setExportPlatform] = useState<string>("html");
  const [exportLoading, setExportLoading] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("1");

  const layoutByTab = useMemo(() => {
    const map: Record<string, LayoutItem> = {};
    layouts.forEach((layout) => {
      map[String(layout.layoutIndex)] = layout;
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

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="1">Option 1</TabsTrigger>
          <TabsTrigger value="2">Option 2</TabsTrigger>
          <TabsTrigger value="3">Option 3</TabsTrigger>
        </TabsList>
        <div className="mt-0">
          {/* Browser-style frame: rounded border, title bar, no horizontal scroll */}
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
              <div className="flex-1 min-w-0 flex justify-center">
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  Layout preview
                </span>
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
