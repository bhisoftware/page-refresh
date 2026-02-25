"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function scoreColorClass(score: number): string {
  if (score <= 40) return "text-destructive";
  if (score >= 41 && score <= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 61 && score <= 80) return "text-green-600 dark:text-green-400";
  return "text-blue-600 dark:text-blue-400";
}

export function ScoreBreakdown({ details, className }: ScoreBreakdownProps) {
  const [openDimension, setOpenDimension] = useState<string | null>(null);

  if (!details?.length) return null;

  const selectedDetail = details.find((d) => d.dimension === openDimension) ?? null;

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {details.map((d) => {
          const label = DIMENSION_LABELS[d.dimension] ?? d.dimension;
          return (
            <div
              key={d.dimension}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 p-4 text-left text-primary hover:underline cursor-pointer transition-colors"
                onClick={() => setOpenDimension(d.dimension)}
                aria-haspopup="dialog"
                aria-expanded={openDimension === d.dimension}
              >
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
                      scoreColorClass(d.score)
                    )}
                  >
                    {d.score}/100
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={selectedDetail !== null} onOpenChange={(open) => !open && setOpenDimension(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedDetail && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {DIMENSION_LABELS[selectedDetail.dimension] ?? selectedDetail.dimension}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <span className={cn("font-semibold tabular-nums", scoreColorClass(selectedDetail.score))}>
                    {selectedDetail.score}/100
                  </span>
                  {selectedDetail.weight != null && selectedDetail.weight > 1 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {selectedDetail.weight === 2 ? "2× weight" : `${selectedDetail.weight}× weight`}
                    </Badge>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm">
                {selectedDetail.issues?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Issues</p>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {selectedDetail.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedDetail.recommendations?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Recommendations</p>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {selectedDetail.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
