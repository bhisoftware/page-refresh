"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
type PipelineStep =
  | "started"
  | "analyzing"
  | "scoring"
  | "generating"
  | "done"
  | "retry"
  | "error";
import { ScanningExperience } from "@/components/ScanningExperience";
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
  const [isReconnecting, setIsReconnecting] = useState(false);

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
        if (preflightData.errorDetail) {
          console.warn("[preflight]", preflightData.errorDetail);
        }
        setError(preflightData.error ?? "We couldn't reach this website. Check the URL and try again.");
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
        setIsReconnecting(true);
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

  const onRetry = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsAnalyzing(false);
    setIsReconnecting(false);
    setBackendStep("started");
    setTokens({});
    setCountdown(null);
    setAnalysisTimerDone(false);
    analysisTimerDoneRef.current = false;
    setInDesignPhase(false);
    setDesignTimerDone(false);
    designTimerDoneRef.current = false;
    setPipelineDone(false);
    pipelineDonePathRef.current = null;
    pendingRefreshRef.current = null;
    setTimeout(() => formRef.current?.requestSubmit(), 100);
  };

  const urlInput = (
    <input
      ref={urlInputRef}
      type="text"
      inputMode="url"
      placeholder="yourwebsite.com"
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
        "w-full bg-[#f8f2f0] border-none rounded-full px-8 py-5 text-lg focus:ring-2 focus:ring-[#9e4323]/20 focus:outline-none transition-all",
        urlFieldHint && "ring-2 ring-amber-500 ring-offset-2 animate-pulse"
      )}
      disabled={isPreflightInProgress || isAnalyzing}
      aria-label="Website URL"
      aria-invalid={urlFieldHint}
    />
  );

  const submitButton = (
    <button
      type="submit"
      className="bg-[#9e4323] text-[#fff7f5] px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-[#9e4323]/30 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      disabled={isPreflightInProgress || isAnalyzing}
    >
      {isPreflightInProgress ? "Checking\u2026" : "Refresh My Page"}
    </button>
  );

  // When analyzing, show full-screen ScanningExperience
  if (isAnalyzing) {
    return (
      <main
        className="min-h-screen bg-[#fdf8f6] text-[#343230] selection:bg-[#ffad93] selection:text-[#702104]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <ScanningExperience
            tokens={tokens}
            currentStep={displayStep}
            countdownSeconds={countdown ?? undefined}
            reconnecting={isReconnecting}
            onRetry={onRetry}
          />
        </div>
        {/* Hidden form for retry auto-submit */}
        <form ref={formRef} onSubmit={handleSubmit} className="hidden">
          {urlInput}
        </form>
      </main>
    );
  }

  return (
    <main
      className="bg-[#fdf8f6] text-[#343230] selection:bg-[#ffad93] selection:text-[#702104]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        .sunset-gradient {
          background: linear-gradient(135deg, #ffad93 0%, #ffd9e2 50%, #e5b0fe 100%);
        }
        .sunset-text {
          background: linear-gradient(135deg, #9e4323 0%, #9f3c60 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl shadow-[0_24px_48px_-12px_rgba(158,67,35,0.08)]" style={{ border: "none" }}>
        <div className="flex justify-center items-center px-6 md:px-12 py-6 max-w-[1440px] mx-auto">
          <div className="text-2xl font-bold tracking-tighter text-orange-900">
            Page Refresh
          </div>
        </div>
      </nav>

      <div className="pt-32">
        {/* Hero Section */}
        <section className="px-6 md:px-12 max-w-[1440px] mx-auto mb-24 md:mb-40 text-left">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[0.9] text-[#343230]">
                Your homepage dese<span style={{ letterSpacing: "0.01em" }}>r</span>ves a{" "}
                <span className="text-[#9e4323] italic">refresh</span>
              </h1>
              <p className="text-xl md:text-2xl text-[#615e5c] font-medium leading-relaxed max-w-xl">
                Get one in under 5 minutes.
              </p>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-grow max-w-md">
                    {urlInput}
                    {urlFieldHint && (
                      <div
                        role="alert"
                        className="absolute left-0 right-0 top-full mt-2 z-10 animate-in fade-in slide-in-from-top-2 duration-300"
                      >
                        <div className="relative flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-lg">
                          <span
                            className="absolute -top-2 left-4 h-0 w-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-amber-50"
                            aria-hidden
                          />
                          <span className="text-sm text-amber-900">
                            We couldn&apos;t reach this website. Check for typos in your URL and try again.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {submitButton}
                </div>
                {error && (
                  <p className="text-sm text-[#ac3434] text-center sm:text-left" role="alert">
                    {error}
                  </p>
                )}
              </form>
              <p className="text-sm font-semibold tracking-widest uppercase text-[#9e4323]/70 whitespace-nowrap text-center sm:text-left italic">
                Paste your URL. Then pick from 3 upgraded designs. It&apos;s that easy.
              </p>
            </div>
            <div className="relative">
              <div className="sunset-gradient absolute inset-0 blur-[100px] opacity-20 -z-10 rounded-full" />
              <div className="bg-white rounded-xl p-4 shadow-2xl border border-white/50">
                <img alt="Bold pop-art website redesign example" className="rounded-lg w-full" src="/hero-example.png" />
              </div>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="relative px-6 md:px-12 py-24 max-w-[1500px] mx-auto mb-24 md:mb-40 overflow-hidden">
          <div className="absolute inset-0 sunset-gradient opacity-10 blur-[120px] -z-10 rounded-3xl" />
          <div className="max-w-[1440px] mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-16 text-center">Three Easy Steps</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-[#f8f2f0] p-8 md:p-12 rounded-lg flex flex-col justify-between hover:bg-[#f2edea] transition-colors duration-500 min-h-[320px] md:min-h-[400px] border-b-4 border-[#9e4323]/20">
                <div>
                  <div className="w-12 h-12 bg-[#9e4323]/10 rounded-full flex items-center justify-center mb-8">
                    <span className="material-symbols-outlined text-[#9e4323]">link</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Step 1: Paste your URL</h3>
                  <p className="text-[#615e5c] leading-relaxed text-base md:text-lg">
                    We scan your homepage and generate a detailed score with specific reasons your site is underperforming
                  </p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="bg-[#f8f2f0] p-8 md:p-12 rounded-lg flex flex-col justify-between hover:bg-[#f2edea] transition-colors duration-500 min-h-[320px] md:min-h-[400px] border-b-4 border-[#ffd9e2]">
                <div>
                  <div className="w-12 h-12 bg-[#9e4323]/10 rounded-full flex items-center justify-center mb-8">
                    <span className="material-symbols-outlined text-[#9e4323]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Step 2: Pick a design</h3>
                  <p className="text-[#615e5c] leading-relaxed text-base md:text-lg">
                    We generate 3 completely redesigned versions of your homepage. All three are massive upgrades. Just pick the one you like.
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="bg-[#f8f2f0] p-8 md:p-12 rounded-lg flex flex-col justify-between hover:bg-[#f2edea] transition-colors duration-500 min-h-[320px] md:min-h-[400px] border-b-4 border-[#e5b0fe]">
                <div>
                  <div className="w-12 h-12 bg-[#9e4323]/10 rounded-full flex items-center justify-center mb-8">
                    <span className="material-symbols-outlined text-[#9e4323]">rocket_launch</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Step 3: We Install It</h3>
                  <p className="text-[#615e5c] leading-relaxed text-base md:text-lg">
                    Pay $249 and we handle the rest. Your new homepage goes live. No coding. No handoffs. No Project Managers.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-16">
            <p className="text-lg md:text-2xl font-semibold tracking-widest uppercase text-[#9e4323]/70">
              We install it for you. No designers. No developers. No back-and-forth.
            </p>
          </div>
        </section>

        {/* Score Section */}
        <section className="bg-white py-24 md:py-32 rounded-xl mx-4 md:mx-12 mb-24 md:mb-40 relative overflow-hidden">
          <div className="absolute inset-0 sunset-gradient opacity-5" />
          <div className="absolute top-0 right-0 w-1/3 h-full sunset-gradient opacity-10 blur-[120px]" />
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-12 md:gap-24 items-center relative z-10">
            <div>
              <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-8">The Score</h2>
              <p className="text-lg md:text-xl text-[#615e5c] leading-relaxed mb-12">
                We analyze your homepage for design quality, conversion metrics, mobile experience, load speed, trust signals, SEO, AI, and LLM discoverability. Then we tell you exactly what&apos;s wrong.
              </p>
              <div className="grid grid-cols-2 gap-4 md:gap-8">
                <div className="p-4 md:p-8 bg-[#f8f2f0]/50 backdrop-blur-sm rounded-lg border border-white/50">
                  <div className="text-3xl md:text-4xl font-black text-[#7d7a78] mb-4">35/100</div>
                  <h4 className="font-bold mb-4 text-sm uppercase tracking-widest opacity-60">Before</h4>
                  <ul className="space-y-3 text-sm font-medium text-[#615e5c]">
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#ac3434]">close</span> Outdated layout</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#ac3434]">close</span> No clear CTA</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#ac3434]">close</span> Slow load speed</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#ac3434]">close</span> Weak trust signals</li>
                  </ul>
                </div>
                <div className="p-4 md:p-8 bg-white/60 backdrop-blur-sm border border-[#9e4323]/20 rounded-lg shadow-sm">
                  <div className="text-3xl md:text-4xl font-black text-[#9e4323] mb-4">95/100</div>
                  <h4 className="font-bold mb-4 text-sm uppercase tracking-widest text-[#9e4323]/60">After Page Refresh</h4>
                  <ul className="space-y-3 text-sm font-medium text-[#343230]">
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#9e4323]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Modern conversion</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#9e4323]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Clear value prop</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#9e4323]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Optimized speed</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-xs text-[#9e4323]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Professional trust</li>
                  </ul>
                </div>
              </div>
            </div>
            {/* Score Ring */}
            <div className="relative flex justify-center">
              <div className="relative group">
                <div className="absolute inset-0 sunset-gradient blur-3xl opacity-30 rounded-full group-hover:opacity-40 transition-opacity" />
                <div className="w-64 h-64 md:w-96 md:h-96 rounded-full sunset-gradient p-1 shadow-2xl relative">
                  <div className="w-full h-full bg-white rounded-full flex flex-col items-center justify-center relative overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[0.85]" viewBox="0 0 384 384">
                      <circle className="text-[#f2edea]" cx="192" cy="192" fill="none" r="170" stroke="currentColor" strokeWidth="20" />
                      <circle cx="192" cy="192" fill="none" r="170" stroke="url(#sunset-gradient-id)" strokeDasharray="1068" strokeDashoffset="53" strokeLinecap="round" strokeWidth="20" />
                      <defs>
                        <linearGradient id="sunset-gradient-id" x1="0%" x2="100%" y1="0%" y2="0%">
                          <stop offset="0%" style={{ stopColor: "#ffad93", stopOpacity: 1 }} />
                          <stop offset="50%" style={{ stopColor: "#ffd9e2", stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: "#e5b0fe", stopOpacity: 1 }} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="text-center relative z-10">
                      <span className="text-6xl md:text-8xl font-black tracking-tighter sunset-text">95</span>
                      <div className="text-[#9e4323] font-bold tracking-widest uppercase text-xs -mt-1">Great Performance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hate Section */}
        <section className="px-4 md:px-12 max-w-[1440px] mx-auto mb-24 md:mb-40">
          <div className="bg-[#343230] text-[#fdf8f6] p-10 md:p-24 rounded-xl flex flex-wrap items-start gap-x-24 gap-y-8 relative overflow-hidden">
            <div className="absolute -bottom-24 -left-24 w-64 h-64 sunset-gradient opacity-10 blur-3xl rounded-full" />
            <div className="flex-1 min-w-[280px] relative z-10">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-8 leading-tight">Everything you hate about website projects, removed.</h2>
            </div>
            <div className="flex-1 min-w-[280px] grid grid-cols-1 gap-6 relative z-10 md:pl-[15%]">
              <div className="flex items-center gap-4 text-xl md:text-2xl font-medium">
                <span className="material-symbols-outlined text-[#ffad93]">cancel</span> No learning curve
              </div>
              <div className="flex items-center gap-4 text-xl md:text-2xl font-medium">
                <span className="material-symbols-outlined text-[#ffad93]">cancel</span> No design tools
              </div>
              <div className="flex items-center gap-4 text-xl md:text-2xl font-medium">
                <span className="material-symbols-outlined text-[#ffad93]">cancel</span> No revision cycles
              </div>
              <div className="flex items-center gap-4 text-xl md:text-2xl font-medium">
                <span className="material-symbols-outlined text-[#ffad93]">cancel</span> No monthly subscriptions
              </div>
            </div>
            <p className="text-[#e7e1df] text-lg md:text-xl leading-relaxed text-center mt-8 md:mt-12 w-full relative z-10">
              Pick a design.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 md:px-12 max-w-[1440px] mx-auto mb-20 text-center">
          <div className="sunset-gradient p-12 md:p-32 rounded-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-6xl font-extrabold tracking-tighter mb-8 text-[#4e1300]">
                Your homepage is the first thing customers see. <br className="hidden md:block" />Make it count.
              </h2>
              <div className="flex flex-col items-center gap-6 pt-8 max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      inputMode="url"
                      placeholder="yourwebsite.com"
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
                      className="w-full bg-white/90 border-none rounded-full px-8 py-5 text-lg focus:ring-2 focus:ring-[#9e4323]/20 focus:outline-none transition-all text-[#343230]"
                      disabled={isPreflightInProgress || isAnalyzing}
                      aria-label="Website URL"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formRef.current?.requestSubmit();
                    }}
                    className="bg-[#9e4323] text-[#fff7f5] px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-[#9e4323]/30 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    disabled={isPreflightInProgress || isAnalyzing}
                  >
                    {isPreflightInProgress ? "Checking\u2026" : "Refresh My Page"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="w-full rounded-t-[2rem] mt-24" style={{ border: "none" }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-16 w-full max-w-[1440px] mx-auto">
          <div className="text-lg font-black text-zinc-900 mb-8 md:mb-0">
            Page Refresh
          </div>
          <div className="flex flex-wrap justify-center gap-8 mb-8 md:mb-0">
            <a className="text-zinc-500 hover:text-orange-500 text-xs uppercase tracking-widest font-semibold hover:translate-x-1 transition-transform duration-200" href="#">Privacy Policy</a>
            <a className="text-zinc-500 hover:text-orange-500 text-xs uppercase tracking-widest font-semibold hover:translate-x-1 transition-transform duration-200" href="#">Terms of Service</a>
            <a className="text-zinc-500 hover:text-orange-500 text-xs uppercase tracking-widest font-semibold hover:translate-x-1 transition-transform duration-200" href="#">Contact Us</a>
          </div>
          <div className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
            &copy; 2025 Page Refresh
          </div>
        </div>
      </footer>
    </main>
  );
}
