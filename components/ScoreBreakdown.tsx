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

const SHORT_LABELS: Record<string, string> = {
  clarity: "Clarity",
  visual: "Visual",
  hierarchy: "Hierarchy",
  trust: "Trust",
  conversion: "Conversion",
  content: "Content",
  mobile: "Mobile",
  performance: "Performance",
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

function colorClass(score: number): string {
  if (score <= 40) return "text-red-500";
  if (score <= 60) return "text-amber-500";
  if (score <= 80) return "text-emerald-500";
  return "text-blue-500";
}

function barColorClass(score: number): string {
  if (score <= 40) return "bg-red-500";
  if (score <= 60) return "bg-amber-500";
  if (score <= 80) return "bg-emerald-500";
  return "bg-blue-500";
}

export function ScoreBreakdown({ details, className }: ScoreBreakdownProps) {
  const [openDimension, setOpenDimension] = useState<string | null>(null);

  if (!details?.length) return null;

  const selectedDetail = details.find((d) => d.dimension === openDimension) ?? null;

  return (
    <>
      <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", className)}>
        {details.map((d) => (
          <button
            key={d.dimension}
            type="button"
            onClick={() => setOpenDimension(d.dimension)}
            className="bg-white rounded-2xl p-5 text-center
                       hover:-translate-y-0.5 hover:shadow-sm transition-all cursor-pointer"
            aria-haspopup="dialog"
            aria-expanded={openDimension === d.dimension}
          >
            <div className={cn("text-3xl font-black tracking-tight leading-none mb-1.5", colorClass(d.score))}>
              {d.score}
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {SHORT_LABELS[d.dimension] ?? d.dimension}
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", barColorClass(d.score))}
                style={{ width: `${d.score}%` }}
              />
            </div>
          </button>
        ))}
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
                  <span className={cn("font-semibold tabular-nums", colorClass(selectedDetail.score))}>
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
