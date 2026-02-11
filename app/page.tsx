"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnalysisProgress, type PipelineStep } from "@/components/AnalysisProgress";
import { cn, normalizeWebsiteUrl } from "@/lib/utils";

const PIPELINE_STEP_MAP: Record<string, PipelineStep> = {
  screenshot: "screenshot",
  extract: "extract",
  seo: "seo",
  vision: "vision",
  industry: "industry",
  score: "score",
  layouts: "layouts",
  copy: "copy",
  done: "done",
};

function parseProgressStep(step: string): PipelineStep {
  return PIPELINE_STEP_MAP[step] ?? "screenshot";
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep>("screenshot");
  const [progressMessage, setProgressMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) {
      setError("Please enter your website URL.");
      return;
    }
    const normalized = normalizeWebsiteUrl(raw);
    try {
      new URL(normalized);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    setError("");
    setIsAnalyzing(true);
    setCurrentStep("screenshot");
    setProgressMessage("Starting analysis...");
    const startTime = Date.now();
    const targetDuration = 40;
    const countdownInterval = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, Math.round(targetDuration - elapsed));
      setCountdown(remaining);
    }, 1000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ url: normalized }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Analysis failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as {
                type: string;
                step?: string;
                message?: string;
                analysisId?: string;
                viewToken?: string;
              };
              if (data.type === "progress" && data.step) {
                if (data.step === "retry") {
                  setProgressMessage(data.message ?? "Retrying...");
                } else {
                  setCurrentStep(parseProgressStep(data.step));
                  setProgressMessage(data.message ?? "");
                }
              } else if (data.type === "done" && data.analysisId) {
                clearInterval(countdownInterval);
                setCountdown(null);
                const viewToken = data.viewToken;
                const path =
                  typeof viewToken === "string" && viewToken.length > 0
                    ? `/results/${data.analysisId}?token=${encodeURIComponent(viewToken)}`
                    : `/results/${data.analysisId}`;
                router.push(path);
                return;
              } else if (data.type === "error") {
                clearInterval(countdownInterval);
                setCountdown(null);
                throw new Error(data.message ?? "Analysis failed");
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      }
      throw new Error(
        "Analysis ended without result. This often happens when the analysis times out on the server (common with larger sites). Try again or use a simpler URL. If it persists, check Netlify function logs."
      );
    } catch (err) {
      clearInterval(countdownInterval);
      setCountdown(null);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-xl mx-auto text-center space-y-8">
        {!isAnalyzing ? (
          <>
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                pagerefresh.ai
              </h1>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  inputMode="url"
                  placeholder="https://yoursite.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 h-11 text-base"
                  disabled={isAnalyzing}
                  aria-label="Website URL"
                />
                <Button type="submit" size="lg" className="h-11 px-6 shrink-0">
                  Analyze My Website
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive text-left" role="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        ) : (
          <div className={cn("flex flex-col items-center")}>
            <h2 className="text-xl font-semibold mb-2">Analyzing your website</h2>
            <p className="text-muted-foreground text-sm mb-6">
              This usually takes 30–45 seconds.
            </p>
            <AnalysisProgress
              currentStep={currentStep}
              message={progressMessage}
              countdownSeconds={countdown ?? undefined}
            />
          </div>
        )}
      </div>
    </main>
  );
}
