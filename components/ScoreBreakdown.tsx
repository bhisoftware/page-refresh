"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIMENSION_LABELS: Record<string, string> = {
  clarity: "Clarity",
  visual: "Visual Quality",
  hierarchy: "Information Hierarchy",
  trust: "Trust & Credibility",
  conversion: "Conversion & Actionability",
  content: "Content Quality",
  mobile: "Mobile Experience",
  performance: "Performance & Technical",
};

export interface DimensionDetail {
  dimension: string;
  score: number;
  issues: string[];
  recommendations: string[];
  /** Weight for overall score (e.g. 2 = "weighted 2x for your industry") */
  weight?: number;
}

interface ScoreBreakdownProps {
  details: DimensionDetail[];
  className?: string;
}

export function ScoreBreakdown({ details, className }: ScoreBreakdownProps) {
  const [openDimension, setOpenDimension] = useState<string | null>(
    details[0]?.dimension ?? null
  );

  if (!details?.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {details.map((d) => {
        const label = DIMENSION_LABELS[d.dimension] ?? d.dimension;
        const isOpen = openDimension === d.dimension;
        return (
          <div
            key={d.dimension}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted/50 transition-colors"
              onClick={() => setOpenDimension(isOpen ? null : d.dimension)}
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="font-medium flex-1">{label}</span>
              <span className="flex items-center gap-2">
                {d.weight != null && d.weight > 1 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {d.weight === 2 ? "2× weight" : `${d.weight}× weight`}
                  </Badge>
                )}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    d.score <= 40 && "text-destructive",
                    d.score >= 41 && d.score <= 60 && "text-amber-600 dark:text-amber-400",
                    d.score >= 61 && d.score <= 80 && "text-green-600 dark:text-green-400",
                    d.score >= 81 && "text-blue-600 dark:text-blue-400"
                  )}
                >
                  {d.score}/100
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border px-4 pb-4 pt-2 space-y-3 text-sm">
                {d.issues?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Issues</p>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {d.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.recommendations?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Recommendations</p>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {d.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
