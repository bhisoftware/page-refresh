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
          <div
            className="relative w-full bg-muted/30 overflow-x-auto"
            style={{ height: "80vh", minWidth: "min(100%, 1280px)" }}
          >
            <iframe
              title={`Layout option ${activeTab} preview`}
              srcDoc={srcdoc}
              className="h-full w-full min-w-[1280px] border-0"
              sandbox="allow-scripts"
            />
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
