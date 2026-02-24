"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BenchmarkComparisonData {
  percentile: number;
  sampleSize: number;
  industry: string;
  industryAvg: number;
  top10Overall: number;
  dimensions: Array<{
    dimension: string;
    industryAvg: number;
    top10: number;
  }>;
}

interface BenchmarkComparisonProps {
  comparison: BenchmarkComparisonData;
  userScores: Record<string, number>;
  className?: string;
}

function percentileLabel(percentile: number): string {
  if (percentile >= 90) return "top 10%";
  if (percentile >= 80) return "top 20%";
  if (percentile >= 70) return "top 30%";
  if (percentile >= 60) return "top 40%";
  if (percentile >= 50) return "top 50%";
  if (percentile >= 40) return "bottom 50%";
  if (percentile >= 30) return "bottom 40%";
  if (percentile >= 20) return "bottom 30%";
  if (percentile >= 10) return "bottom 20%";
  return "bottom 10%";
}

export function BenchmarkComparison({
  comparison,
  userScores,
  className,
}: BenchmarkComparisonProps) {
  const [open, setOpen] = useState(false);
  const { percentile, sampleSize, industry, industryAvg, top10Overall, dimensions } = comparison;

  return (
    <section className={cn("mb-10", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-xl font-semibold mb-4 hover:text-foreground/90"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        Industry benchmark
      </button>

      {open && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 space-y-4">
            <p className="text-foreground">
              Your site ranks in the <strong>{percentileLabel(percentile)}</strong> for {industry}.
            </p>
            <p className="text-sm text-muted-foreground">
              Based on {sampleSize} {industry} websites.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Your overall</span>
                <p className="font-medium">
                  {userScores.overall ?? "—"}/100
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Industry avg</span>
                <p className="font-medium">{industryAvg}/100</p>
              </div>
              <div>
                <span className="text-muted-foreground">Top 10%</span>
                <p className="font-medium">{top10Overall}/100</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">By dimension</h3>
              <ul className="space-y-2">
                {dimensions.map((d) => {
                  const userVal = userScores[d.dimension];
                  const belowAvg = typeof userVal === "number" && userVal < d.industryAvg - 20;
                  return (
                    <li
                      key={d.dimension}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm py-1",
                        belowAvg && "bg-destructive/10 rounded px-2 -mx-2"
                      )}
                    >
                      <span className="capitalize font-medium w-24">{d.dimension}</span>
                      <span>You: {typeof userVal === "number" ? userVal : "—"}</span>
                      <span className="text-muted-foreground">Avg: {d.industryAvg}</span>
                      <span className="text-muted-foreground">Top 10%: {d.top10}</span>
                      {belowAvg && (
                        <span className="text-destructive text-xs">Below average</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
