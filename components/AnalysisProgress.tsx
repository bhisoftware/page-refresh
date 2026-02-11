"use client";

import { Camera, Brain, Layout } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type PipelineStep =
  | "screenshot"
  | "extract"
  | "seo"
  | "vision"
  | "industry"
  | "score"
  | "layouts"
  | "copy"
  | "done";

const STEP_ORDER: PipelineStep[] = [
  "screenshot",
  "extract",
  "seo",
  "vision",
  "industry",
  "score",
  "layouts",
  "copy",
  "done",
];

const STEP_LABELS: Record<PipelineStep, string> = {
  screenshot: "Capturing screenshot...",
  extract: "Extracting assets...",
  seo: "Running SEO audit...",
  vision: "Analyzing with Claude Vision...",
  industry: "Detecting industry...",
  score: "Scoring across 8 dimensions...",
  layouts: "Generating 3 layout proposals...",
  copy: "Refreshing copy...",
  done: "Finalizing...",
};

const STEP_ICONS: Record<PipelineStep, string> = {
  screenshot: "📸",
  extract: "🔍",
  seo: "📋",
  vision: "🤖",
  industry: "🏢",
  score: "📊",
  layouts: "🎨",
  copy: "✍️",
  done: "✨",
};

function stepIndex(step: PipelineStep): number {
  const i = STEP_ORDER.indexOf(step);
  return i === -1 ? 0 : i;
}

function phaseProgress(step: PipelineStep): {
  screenshot: number;
  analysis: number;
  layouts: number;
} {
  const i = stepIndex(step);
  // Phase 1: screenshot + extract (0-1)
  // Phase 2: seo, vision, industry, score (2-5)
  // Phase 3: layouts, copy, done (6-8)
  const screenshot = i >= 1 ? 100 : i >= 0 ? 50 : 0;
  const analysis = i < 2 ? 0 : i <= 5 ? ((i - 2) / 4) * 100 : 100;
  const layouts = i < 6 ? 0 : i <= 8 ? ((i - 6) / 3) * 100 : 100;
  return { screenshot, analysis, layouts };
}

interface AnalysisProgressProps {
  currentStep: PipelineStep;
  message?: string;
  countdownSeconds?: number;
  className?: string;
}

export function AnalysisProgress({
  currentStep,
  message,
  countdownSeconds,
  className,
}: AnalysisProgressProps) {
  const { screenshot, analysis, layouts } = phaseProgress(currentStep);
  const currentLabel = message ?? STEP_LABELS[currentStep];
  const currentIcon = STEP_ICONS[currentStep];

  return (
    <div className={cn("w-full max-w-lg space-y-8", className)}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-lg">
            {currentIcon}
          </span>
          <p className="text-lg font-medium text-foreground">{currentLabel}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
              Screenshot
            </div>
            <Progress value={screenshot} className="h-2" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Brain className="h-3.5 w-3.5" />
              Analysis
            </div>
            <Progress value={analysis} className="h-2" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layout className="h-3.5 w-3.5" />
              Layouts
            </div>
            <Progress value={layouts} className="h-2" />
          </div>
        </div>
      </div>

      {countdownSeconds != null && countdownSeconds > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          About {countdownSeconds}s remaining
        </p>
      )}

      <ul className="space-y-2 text-sm text-muted-foreground">
        {STEP_ORDER.map((step) => {
          const isActive = step === currentStep;
          const isDone = stepIndex(step) < stepIndex(currentStep);
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-2 transition-opacity",
                isActive && "font-medium text-foreground",
                isDone && "opacity-70"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                  isDone && "bg-primary/20 text-primary",
                  isActive && "bg-primary text-primary-foreground",
                  !isDone && !isActive && "bg-muted"
                )}
              >
                {isDone ? "✓" : STEP_ICONS[step]}
              </span>
              {STEP_LABELS[step]}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
