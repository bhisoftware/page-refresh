"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Screenshot {
  type: string;
  url: string;
  label: string;
}

interface BenchmarkScreenshotsProps {
  screenshots: Screenshot[];
  siteUrl: string;
}

export function BenchmarkScreenshots({ screenshots, siteUrl }: BenchmarkScreenshotsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!screenshots.length) return null;

  const current = screenshots[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < screenshots.length - 1;

  return (
    <div className="mb-8">
      {/* Tab buttons */}
      <div className="flex gap-1 mb-3">
        {screenshots.map((ss, i) => (
          <button
            key={ss.type}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              i === activeIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {ss.label}
          </button>
        ))}
      </div>

      {/* Screenshot display */}
      <div className="relative group">
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`${current.label} screenshot`}
            className={cn(
              "h-auto",
              current.type === "mobile" ? "w-auto max-h-[600px] mx-auto" : "w-full",
            )}
          />
        </a>

        {/* Prev / Next arrows */}
        {screenshots.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => i - 1)}
              disabled={!hasPrev}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 border shadow-sm transition-opacity",
                hasPrev ? "opacity-0 group-hover:opacity-100 hover:bg-background" : "hidden",
              )}
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => i + 1)}
              disabled={!hasNext}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 border shadow-sm transition-opacity",
                hasNext ? "opacity-0 group-hover:opacity-100 hover:bg-background" : "hidden",
              )}
              aria-label="Next screenshot"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Counter */}
      {screenshots.length > 1 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {activeIndex + 1} of {screenshots.length}
        </p>
      )}
    </div>
  );
}
