"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PipelineStep } from "@/components/AnalysisProgress";
import { ScanningExperience } from "@/components/ScanningExperience";
import { Loader2 } from "lucide-react";
import { LogoIcon } from "@/components/Logo";
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
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRefreshRef = useRef<{ id: string; token: string } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRetryAttemptRef = useRef(false);
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
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Handle ?retry= (auto-submit) and ?url= (pre-fill only)
  useEffect(() => {
    const retryUrl = searchParams.get("retry");
    const prefillUrl = searchParams.get("url");
    if (retryUrl) {
      isRetryAttemptRef.current = true;
      setUrl(retryUrl);
      router.replace("/", { scroll: false });
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 100);
    } else if (prefillUrl) {
      setUrl(prefillUrl);
      router.replace("/", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [backendStep, setBackendStep] = useState<PipelineStep>("started");
  const [progressMessage, setProgressMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Record<string, Record<string, unknown>>>({});
  const [analysisTimerDone, setAnalysisTimerDone] = useState(false);
  const [inDesignPhase, setInDesignPhase] = useState(false);
  const timerConfigRef = useRef({ startTime: 0, target: 90 });
  const analysisTimerDoneRef = useRef(false);
  const countdownIntervalRef = useRef<number | null>(null);
  const pipelineDonePathRef = useRef<string | null>(null);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [designTimerDone, setDesignTimerDone] = useState(false);
  const designTimerDoneRef = useRef(false);

  // Transition to design phase when analysis timer expires AND backend is ready
  useEffect(() => {
    const backendReady = backendStep === "generating" || backendStep === "done";
    if (analysisTimerDone && backendReady && !inDesignPhase) {
      setInDesignPhase(true);
      timerConfigRef.current = { startTime: Date.now(), target: 240 };
    }
  }, [analysisTimerDone, backendStep, inDesignPhase]);

  // Compute display step: hold back "scoring"/"generating"/"done" until timers expire
  const displayStep: PipelineStep = (() => {
    if (backendStep === "error") return "error";
    if (inDesignPhase) return "generating";
    if (backendStep === "scoring" || backendStep === "generating" || backendStep === "done") return "analyzing";
    return backendStep;
  })();

  // Redirect to results when pipeline is done AND design timer has expired
  useEffect(() => {
    if (!pipelineDone || !designTimerDone) return;
    const path = pipelineDonePathRef.current;
    if (!path) return;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    router.push(path);
  }, [pipelineDone, designTimerDone, router]);

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
    let analyzeUrl = normalized;

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
        resolvedUrl?: string;
        existing?: boolean;
        refreshId?: string;
        viewToken?: string;
      };
      if (!preflightData.ok) {
        const main = preflightData.error ?? "We couldn't reach this website. Check the URL and try again.";
        const detail = preflightData.errorDetail ? ` [${preflightData.errorDetail}]` : "";
        setError(main + detail);
        return;
      }
      // Redirect immediately if a complete analysis with layouts already exists
      if (preflightData.existing && preflightData.refreshId) {
        const token = preflightData.viewToken;
        const path = typeof token === "string" && token.length > 0
          ? `/results/${preflightData.refreshId}?token=${encodeURIComponent(token)}&cached=1`
          : `/results/${preflightData.refreshId}?cached=1`;
        router.push(path);
        return;
      }
      // Use the URL that preflight successfully reached (may be HTTP fallback)
      analyzeUrl = preflightData.resolvedUrl ?? normalized;
    } catch {
      setError("Pre-flight check failed. Please try again.");
      return;
    } finally {
      setIsPreflightInProgress(false);
    }

    setIsAnalyzing(true);
    setBackendStep("started");
    setProgressMessage("Starting analysis...");
    setTokens({});
    pendingRefreshRef.current = null;
    setAnalysisTimerDone(false);
    setInDesignPhase(false);
    analysisTimerDoneRef.current = false;
    setPipelineDone(false);
    pipelineDonePathRef.current = null;
    setDesignTimerDone(false);
    designTimerDoneRef.current = false;
    timerConfigRef.current = { startTime: Date.now(), target: 90 };
    countdownIntervalRef.current = window.setInterval(() => {
      const { startTime: ts, target } = timerConfigRef.current;
      const elapsed = (Date.now() - ts) / 1000;
      const remaining = Math.max(0, Math.round(target - elapsed));
      setCountdown(remaining);
      if (remaining === 0 && !analysisTimerDoneRef.current) {
        analysisTimerDoneRef.current = true;
        setAnalysisTimerDone(true);
      }
      if (remaining === 0 && target === 240 && !designTimerDoneRef.current) {
        designTimerDoneRef.current = true;
        setDesignTimerDone(true);
      }
    }, 1000);

    let isPolling = false;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ url: analyzeUrl }),
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
              if (data.type === "refresh_created" && data.refreshId && data.viewToken) {
                pendingRefreshRef.current = { id: data.refreshId, token: data.viewToken };
              } else if (data.type === "progress" && data.step === "token" && data.key && data.data) {
                setTokens(prev => ({ ...prev, [data.key!]: data.data! }));
              } else if (data.type === "progress" && data.step) {
                if (data.step === "retry") {
                  // Silently ignore retry events — don't surface API internals to users
                } else {
                  setBackendStep(parseProgressStep(data.step));
                  setProgressMessage(data.message ?? "");
                }
              } else if (data.type === "done" && data.refreshId) {
                const viewToken = data.viewToken;
                const path =
                  typeof viewToken === "string" && viewToken.length > 0
                    ? `/results/${data.refreshId}?token=${encodeURIComponent(viewToken)}`
                    : `/results/${data.refreshId}`;
                pipelineDonePathRef.current = path;
                setPipelineDone(true);
                setBackendStep("done");
              } else if (data.type === "error") {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
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
      if (!pipelineDonePathRef.current) {
        throw new Error("Refresh ended without result");
      }
    } catch (err) {
      // Pipeline succeeded and stream closed — waiting for design timer to redirect
      if (pipelineDonePathRef.current) return;

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);

      // If we have a refreshId, the server is still running — poll for completion
      const pending = pendingRefreshRef.current;
      if (pending) {
        isPolling = true;
        setProgressMessage("Reconnecting...");
        const POLL_INTERVAL_MS = 3_000;
        const POLL_TIMEOUT_MS = 90_000;
        const LAYOUT_GRACE_MS = 20_000; // extra wait after "complete" for background agents
        const pollStart = Date.now();
        let completeSeenAt: number | null = null;
        const retriedFlag = isRetryAttemptRef.current ? "&retried=1" : "";
        const resultsPath = `/results/${pending.id}?token=${encodeURIComponent(pending.token)}${retriedFlag}`;
        pollIntervalRef.current = setInterval(async () => {
          if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            router.push(resultsPath);
            return;
          }
          try {
            const res = await fetch(
              `/api/analyze/${pending.id}/status?token=${encodeURIComponent(pending.token)}`
            );
            if (!res.ok) return; // retry next interval
            const { status, layoutCount } = (await res.json()) as { status: string; layoutCount: number };

            if (status === "failed") {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              router.push(resultsPath);
              return;
            }

            if (status === "complete") {
              // All 3 layouts ready — redirect immediately
              if (layoutCount >= 3) {
                clearInterval(pollIntervalRef.current!);
                pollIntervalRef.current = null;
                router.push(resultsPath);
                return;
              }
              // Status is complete but layouts still arriving (background agents).
              // Give them a grace period, then redirect with whatever we have.
              if (!completeSeenAt) completeSeenAt = Date.now();
              if (Date.now() - completeSeenAt > LAYOUT_GRACE_MS) {
                clearInterval(pollIntervalRef.current!);
                pollIntervalRef.current = null;
                router.push(resultsPath);
              }
            }
          } catch {
            // Network still down — retry next interval
          }
        }, POLL_INTERVAL_MS);
        return; // keep isAnalyzing true while polling
      }

      const rawMessage = err instanceof Error ? err.message : "Refresh failed";
      // WebKit "Load failed" = our API connection dropped, not the user's website
      if (rawMessage.toLowerCase().includes("load failed")) {
        setError("Connection interrupted. Please try again.");
      } else if (isUnreachableWebsiteError(rawMessage)) {
        setUrlFieldHint(true);
        setError("");
      } else {
        setUrlFieldHint(false);
        // Don't show raw API error JSON to users
        const isRawApiError = rawMessage.includes('"type":"error"') || rawMessage.includes("overloaded") || rawMessage.includes("rate_limit");
        setError(isRawApiError ? "Our servers are busy. Please try again in a moment." : rawMessage);
      }
    } finally {
      if (!isPolling && !pipelineDonePathRef.current) setIsAnalyzing(false);
    }
  };

  return (
    <main className={cn(
      "min-h-screen flex flex-col items-center p-6 md:p-8 bg-[#f5f0eb]",
      isAnalyzing ? "justify-start pt-8" : "justify-center"
    )}>
      <div className={cn(
        "w-full max-w-xl mx-auto text-center",
        isAnalyzing ? "space-y-4" : "space-y-8"
      )}>
        <>
          <div className={cn(
            "w-full flex flex-col items-center transition-all duration-500",
            isAnalyzing ? "space-y-1" : "space-y-3"
          )}>
            <LogoIcon size={isAnalyzing ? 40 : 64} className="shrink-0 transition-all duration-500" />
            <h1 className={cn(
              "font-bold tracking-tight text-[#2d5a3d] transition-all duration-500",
              isAnalyzing ? "text-xl" : "text-3xl md:text-4xl"
            )}>
              Page Refresh
            </h1>
            <p className={cn(
              "text-muted-foreground max-w-md mx-auto transition-all duration-500",
              isAnalyzing ? "text-sm" : "text-lg"
            )}>
              $50,000 refresh in 5 minutes
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className={cn("space-y-4", isAnalyzing && "space-y-2")}>
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
                className="h-11 px-6 shrink-0 bg-[#2d5a3d] text-white hover:bg-[#1e4a2e] hover:text-white"
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
              <p className="text-sm text-destructive text-center" role="alert">
                {error}
              </p>
            )}
          </form>

          {isAnalyzing && !isPreflightInProgress && (
            <div className={cn("flex flex-col items-center w-full")}>
              <ScanningExperience
                tokens={tokens}
                currentStep={displayStep}
                countdownSeconds={countdown ?? undefined}
              />
            </div>
          )}
        </>
      </div>
    </main>
  );
}
