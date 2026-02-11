"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SeoCheckItem {
  check: string;
  pass: boolean;
  message: string;
}

export interface SeoRecommendation {
  severity: "critical" | "warning" | "info";
  message: string;
  check: string;
}

interface SeoAuditSectionProps {
  checks: SeoCheckItem[];
  recommendations: SeoRecommendation[];
  className?: string;
}

export function SeoAuditSection({
  checks,
  recommendations,
  className,
}: SeoAuditSectionProps) {
  const [open, setOpen] = useState(false);

  if (!checks?.length && !recommendations?.length) return null;

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
        SEO Audit
      </button>

      {open && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 space-y-4">
            {checks?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Checklist
                </h3>
                <ul className="space-y-2">
                  {checks.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm"
                    >
                      {item.pass ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className={item.pass ? "text-foreground" : "text-muted-foreground"}>
                        {item.check}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {item.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendations?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className={cn(
                        "text-sm pl-3 border-l-2",
                        rec.severity === "critical" &&
                          "border-destructive text-destructive",
                        rec.severity === "warning" &&
                          "border-amber-500 text-amber-700 dark:text-amber-400",
                        rec.severity === "info" &&
                          "border-muted-foreground text-muted-foreground"
                      )}
                    >
                      <span className="font-medium capitalize mr-1">
                        {rec.severity}:
                      </span>
                      {rec.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
