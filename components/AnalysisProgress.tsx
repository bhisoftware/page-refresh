"use client";

import { Camera, Brain, Layout } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type PipelineStep =
  | "started"
  | "analyzing"
  | "scoring"
  | "generating"
  | "done"
  | "retry"
  | "error";

const STEP_ORDER: PipelineStep[] = [
  "started",
  "analyzing",
  "scoring",
  "generating",
  "done",
];

const STEP_LABELS: Record<PipelineStep, string> = {
  started: "Starting...",
  analyzing: "Analyzing your website...",
  scoring: "Scoring against industry benchmarks...",
  generating: "Generating 3 design options...",
  done: "Your results are ready!",
  retry: "Retrying...",
  error: "Something went wrong",
};

const STEP_ICONS: Record<PipelineStep, string> = {
  started: "🚀",
  analyzing: "🔍",
  scoring: "📊",
  generating: "🎨",
  done: "✨",
  retry: "⏳",
  error: "⚠️",
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
  // started=0, analyzing=1, scoring=2, generating=3, done=4
  const screenshot = i >= 1 ? 100 : i >= 0 ? 50 : 0;
  const analysis = i < 1 ? 0 : i <= 2 ? ((i - 1) / 2) * 100 : 100;
  const layouts = i < 3 ? 0 : i <= 4 ? ((i - 3) / 2) * 100 : 100;
  return { screenshot, analysis, layouts };
}

interface AnalysisProgressProps {
  currentStep: PipelineStep;
  message?: string;
  countdownSeconds?: number;
  tokens?: Record<string, Record<string, unknown>>;
  className?: string;
}

export function AnalysisProgress({
  currentStep,
  message,
  countdownSeconds,
  tokens: _tokens,
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
              Accessing your site
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
