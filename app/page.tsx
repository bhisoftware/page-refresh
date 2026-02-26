"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PipelineStep } from "@/components/AnalysisProgress";
import { AnalysisLoaderCards } from "@/components/AnalysisLoaderCards";
import { Loader2 } from "lucide-react";
import { cn, normalizeWebsiteUrl } from "@/lib/utils";

function isUnreachableWebsiteError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("could not reach") ||
    m.includes("couldn't reach") ||
    m.includes("request timed out") ||
    m.includes("took too long") ||
    m.includes("enotfound") ||
    m.includes("econnrefused") ||
    m.includes("econnreset")
  );
}

const PIPELINE_STEP_MAP: Record<string, PipelineStep> = {
  started: "started",
  analyzing: "analyzing",
  scoring: "scoring",
  generating: "generating",
  done: "done",
  retry: "retry",
  error: "error",
};

function parseProgressStep(step: string): PipelineStep {
  return PIPELINE_STEP_MAP[step] ?? "started";
}

export default function Home() {
  const router = useRouter();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [urlFieldHint, setUrlFieldHint] = useState(false);
  const [isPreflightInProgress, setIsPreflightInProgress] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (urlFieldHint && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [urlFieldHint]);
  const [currentStep, setCurrentStep] = useState<PipelineStep>("started");
  const [progressMessage, setProgressMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Record<string, Record<string, unknown>>>({});

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
    setUrlFieldHint(false);
    setIsPreflightInProgress(true);

    // Pre-flight: server checks URL is reachable and not bot-blocked. No progress UI until this succeeds.
    try {
      const preflightRes = await fetch("/api/analyze/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const preflightData = (await preflightRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errorDetail?: string;
      };
      if (!preflightData.ok) {
        const main = preflightData.error ?? "We couldn't reach this website. Check the URL and try again.";
        const detail = preflightData.errorDetail ? ` [${preflightData.errorDetail}]` : "";
        setError(main + detail);
        return;
      }
    } catch {
      setError("Pre-flight check failed. Please try again.");
      return;
    } finally {
      setIsPreflightInProgress(false);
    }

    setIsAnalyzing(true);
    setCurrentStep("started");
    setProgressMessage("Starting analysis...");
    setTokens({});
    const startTime = Date.now();
    const targetDuration = 50;
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
        throw new Error(data.error ?? `Refresh failed (${res.status})`);
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
                key?: string;
                data?: Record<string, unknown>;
                message?: string;
                refreshId?: string;
                viewToken?: string;
              };
              if (data.type === "progress" && data.step === "token" && data.key && data.data) {
                setTokens(prev => ({ ...prev, [data.key!]: data.data! }));
              } else if (data.type === "progress" && data.step) {
                if (data.step === "retry") {
                  // Silently ignore retry events — don't surface API internals to users
                } else {
                  setCurrentStep(parseProgressStep(data.step));
                  setProgressMessage(data.message ?? "");
                }
              } else if (data.type === "done" && data.refreshId) {
                clearInterval(countdownInterval);
                setCountdown(null);
                const viewToken = data.viewToken;
                const path =
                  typeof viewToken === "string" && viewToken.length > 0
                    ? `/results/${data.refreshId}?token=${encodeURIComponent(viewToken)}`
                    : `/results/${data.refreshId}`;
                router.push(path);
                return;
              } else if (data.type === "error") {
                clearInterval(countdownInterval);
                setCountdown(null);
                throw new Error(data.message ?? "Refresh failed");
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      }
      throw new Error("Refresh ended without result");
    } catch (err) {
      clearInterval(countdownInterval);
      setCountdown(null);
      const rawMessage = err instanceof Error ? err.message : "Refresh failed";
      if (isUnreachableWebsiteError(rawMessage)) {
        setUrlFieldHint(true);
        setError("");
      } else {
        setUrlFieldHint(false);
        // Don't show raw API error JSON to users
        const isRawApiError = rawMessage.includes('"type":"error"') || rawMessage.includes("overloaded") || rawMessage.includes("rate_limit");
        setError(isRawApiError ? "Our servers are busy. Please try again in a moment." : rawMessage);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-xl mx-auto text-center space-y-8">
        <>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              PageRefresh
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              $50,000 refresh in 5 minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 relative">
              <div className="relative flex-1">
                <Input
                  ref={urlInputRef}
                  type="text"
                  inputMode="url"
                  placeholder="https://www.website.com/"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlFieldHint) setUrlFieldHint(false);
                  }}
                  onBlur={() => {
                    const trimmed = url.trim();
                    if (trimmed) {
                      const normalized = normalizeWebsiteUrl(trimmed);
                      if (normalized !== trimmed) setUrl(normalized);
                    }
                  }}
                  className={cn(
                    "flex-1 w-full h-11 text-base",
                    urlFieldHint && "ring-2 ring-amber-500 ring-offset-2 animate-pulse"
                  )}
                  disabled={isPreflightInProgress || isAnalyzing}
                  aria-label="Website URL"
                  aria-invalid={urlFieldHint}
                />
                {urlFieldHint && (
                  <div
                    role="alert"
                    className="absolute left-0 right-0 top-full mt-2 z-10 animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="relative flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-lg dark:border-amber-800 dark:bg-amber-950/90">
                      <span
                        className="absolute -top-2 left-4 h-0 w-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-amber-50 dark:border-b-amber-950/90"
                        aria-hidden
                      />
                      <span className="text-sm text-amber-900 dark:text-amber-100">
                        We couldn&apos;t reach this website. Check for typos in your URL and try again.
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "h-11 px-6 shrink-0",
                  (isPreflightInProgress || isAnalyzing) &&
                    "bg-[#2d5016] text-white hover:bg-[#2d5016]/90 hover:text-white"
                )}
                disabled={isPreflightInProgress || isAnalyzing}
              >
                {isPreflightInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Checking…
                  </>
                ) : isAnalyzing ? (
                  "Pay Only If You Love It"
                ) : (
                  "Analyze My Website"
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive text-left" role="alert">
                {error}
              </p>
            )}
          </form>

          {isAnalyzing && !isPreflightInProgress && (
            <div className={cn("flex flex-col items-center w-full")}>
              <h2 className="text-xl font-semibold mb-6">
                Analyzing <em className="not-italic text-[#6b8f71]">{url || "your website"}</em>
              </h2>
              {progressMessage ? (
                <p className="text-sm text-muted-foreground mb-4 -mt-2">{progressMessage}</p>
              ) : null}
              <AnalysisLoaderCards
                tokens={tokens}
                currentStep={currentStep}
                countdownSeconds={countdown ?? undefined}
              />
            </div>
          )}
        </>
      </div>
    </main>
  );
}
