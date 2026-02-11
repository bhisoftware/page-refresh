"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DesignCopyToggle, type DesignCopyMode } from "@/components/DesignCopyToggle";
import { RequestQuoteForm } from "@/components/RequestQuoteForm";
import { cn } from "@/lib/utils";

function wrapInDocument(html: string, css: string): string {
  const hasHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(html.trim());
  if (hasHtml) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
}

interface LayoutCardProps {
  layoutIndex: 1 | 2 | 3;
  templateName: string;
  layoutHtml: string;
  layoutCss: string;
  layoutCopyRefreshed: string;
  analysisId: string;
  className?: string;
}

export function LayoutCard({
  layoutIndex,
  templateName,
  layoutHtml,
  layoutCss,
  layoutCopyRefreshed,
  analysisId,
  className,
}: LayoutCardProps) {
  const [mode, setMode] = useState<DesignCopyMode>("design");
  const [quoteOpen, setQuoteOpen] = useState(false);

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
          <div className="relative w-full bg-muted/30" style={{ paddingBottom: "75%" }}>
            <iframe
              title={`Layout ${layoutIndex} preview (${mode})`}
              srcDoc={srcdoc}
              className="absolute inset-0 h-full w-full border-0 rounded-b-lg"
              sandbox="allow-same-origin"
            />
          </div>
          <p className="p-3 text-sm text-muted-foreground border-t">
            {templateName}
          </p>
        </CardContent>
        <CardFooter>
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
        analysisId={analysisId}
        layoutIndex={layoutIndex}
      />
    </>
  );
}
