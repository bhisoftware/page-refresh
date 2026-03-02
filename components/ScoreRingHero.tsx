"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScoreBreakdown, type DimensionDetail } from "@/components/ScoreBreakdown";
import { cn } from "@/lib/utils";

interface ScoreRingHeroProps {
  score: number;
  headline: string;
  summary: string;
  analysisUrl?: string | null;
  /** e.g. "Top 75th percentile in Restaurants" */
  benchmarkBadge?: string | null;
  /** Optional subtitle below the summary (e.g. date/time, industry) */
  subtitle?: string | null;
  /** Optional dimension details; when provided, shows expandable "Score by dimension" */
  details?: DimensionDetail[];
}

export function ScoreRingHero({
  score,
  headline,
  summary,
  analysisUrl,
  benchmarkBadge,
  subtitle,
  details,
}: ScoreRingHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = details?.length;
  const analysisHref =
    analysisUrl && /^https?:\/\//i.test(analysisUrl) ? analysisUrl : analysisUrl ? `https://${analysisUrl}` : null;

  return (
    <div className="bg-card rounded-2xl shadow-sm p-10 mb-8 flex flex-col">
      <div className="flex flex-col sm:flex-row items-center gap-10">
        {/* Score Ring */}
        <div
          className="w-40 h-40 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `conic-gradient(
            #4F46E5 0deg,
            #06B6D4 ${(score / 100) * 240}deg,
            #F59E0B ${(score / 100) * 360}deg,
            #E2E8F0 ${(score / 100) * 360}deg
          )`,
          }}
        >
          <div className="w-32 h-32 rounded-full bg-card flex flex-col items-center justify-center">
            <span className="text-5xl font-black tracking-tighter leading-none text-foreground">
              {score}
            </span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Overall
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex-1 text-center sm:text-left w-full">
        {analysisUrl && analysisHref && (
          <a
            href={analysisHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 mb-2 break-all"
          >
            {analysisUrl}
          </a>
        )}
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">
            {headline}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {summary}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mb-3">{subtitle}</p>
          )}
          {benchmarkBadge && (
            <span className="inline-block bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-semibold">
              {benchmarkBadge}
            </span>
          )}
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
              aria-expanded={expanded}
            >
              Score by dimension
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
              />
            </button>
          ) : null}
        </div>
      </div>

      {hasDetails && expanded ? (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-4">Score by dimension</h3>
          <ScoreBreakdown details={details} />
        </div>
      ) : null}
    </div>
  );
}
