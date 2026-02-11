"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DesignCopyToggle, type DesignCopyMode } from "@/components/DesignCopyToggle";
import { RequestQuoteForm } from "@/components/RequestQuoteForm";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

function wrapInDocument(html: string, css: string): string {
  const hasHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(html.trim());
  if (hasHtml) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
}

const EXPORT_PLATFORMS = [
  { value: "html", label: "HTML/CSS" },
  { value: "wordpress", label: "WordPress" },
  { value: "squarespace", label: "Squarespace" },
  { value: "wix", label: "Wix" },
] as const;

interface LayoutCardProps {
  layoutIndex: 1 | 2 | 3 | 4 | 5 | 6;
  templateName: string;
  layoutHtml: string;
  layoutCss: string;
  layoutCopyRefreshed: string;
  refreshId: string;
  viewToken: string;
  className?: string;
}

export function LayoutCard({
  layoutIndex,
  templateName,
  layoutHtml,
  layoutCss,
  layoutCopyRefreshed,
  refreshId,
  viewToken,
  className,
}: LayoutCardProps) {
  const [mode, setMode] = useState<DesignCopyMode>("design");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [exportPlatform, setExportPlatform] = useState<string>("html");
  const [exportLoading, setExportLoading] = useState(false);

  const docDesign = useMemo(
    () => wrapInDocument(layoutHtml, layoutCss),
    [layoutHtml, layoutCss]
  );
  const docDesignCopy = useMemo(
    () => wrapInDocument(layoutCopyRefreshed, layoutCss),
    [layoutCopyRefreshed, layoutCss]
  );
  const srcdoc = mode === "design" ? docDesign : docDesignCopy;

  return (
    <>
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Layout {layoutIndex}</CardTitle>
          <DesignCopyToggle value={mode} onChange={setMode} />
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <div className="relative w-full bg-muted/30" style={{ height: "80vh" }}>
            <iframe
              title={`Layout ${layoutIndex} preview (${mode})`}
              srcDoc={srcdoc}
              className="absolute inset-0 h-full w-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
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
                      layoutIndex,
                      platform: exportPlatform,
                      token: viewToken,
                    }),
                  });
                  if (!res.ok) throw new Error("Export failed");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? `layout-${layoutIndex}-${exportPlatform}.zip`;
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
          </div>
          <Button
            className="w-full"
            onClick={() => setQuoteOpen(true)}
          >
            Select This Layout
          </Button>
        </CardFooter>
      </Card>

      <RequestQuoteForm
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        refreshId={refreshId}
        layoutIndex={layoutIndex}
      />
    </>
  );
}
