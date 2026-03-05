"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type VisualPhase =
  | "scanning"
  | "industry"
  | "brand"
  | "competitors"
  | "scoring"
  | "designing"
  | "done";

type Severity = "ok" | "warn" | "bad";

interface FindingContent {
  severity: Severity;
  label: string;
  detail: string;
  note?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const PHASE_ORDER: VisualPhase[] = [
  "scanning",
  "industry",
  "brand",
  "competitors",
  "scoring",
  "designing",
];

const PILL_CONFIG = [
  { key: "scanning" as const, label: "Accessing site" },
  { key: "industry" as const, label: "Industry" },
  { key: "brand" as const, label: "Brand" },
  { key: "competitors" as const, label: "Competitors" },
  { key: "scoring" as const, label: "Scoring" },
  { key: "designing" as const, label: "Designing" },
];

/** Analysis findings — one per timed phase, shown after streaming text finishes. */
const ANALYSIS_FINDINGS = [
  { key: "industry", phase: "industry" as VisualPhase, label: "Homepage Analyzed" },
  { key: "brand", phase: "brand" as VisualPhase, label: "Industry Detected" },
  { key: "competitors", phase: "competitors" as VisualPhase, label: "5-Second Clarity Test" },
  { key: "scoring", phase: "scoring" as VisualPhase, label: "Finding Conversion Blockers" },
];

/** Design-phase progress items — staggered 30s apart. */
const DESIGN_FINDINGS = [
  { key: "design:0", delay: 0, label: "Enhancing Design System" },
  { key: "design:1", delay: 30000, label: "Boosting Trust Signals For Your Industry" },
  { key: "design:2", delay: 60000, label: "Rebuilding Page Layouts" },
  { key: "design:3", delay: 90000, label: "Tuning for Google and Local SEO" },
  { key: "design:4", delay: 120000, label: "Making page AI-discoverable" },
];

const SEVERITY_ICON: Record<Severity, string> = {
  ok: "\u2713",
  warn: "!",
  bad: "\u2717",
};

const SEVERITY_BG: Record<Severity, string> = {
  ok: "#dcfce7",
  warn: "#fef3c7",
  bad: "#fee2e2",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  ok: "#15803d",
  warn: "#92400e",
  bad: "#b91c1c",
};

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */

export interface ScanningExperienceProps {
  tokens: Record<string, Record<string, unknown>>;
  currentStep:
    | "started"
    | "analyzing"
    | "scoring"
    | "generating"
    | "done"
    | "retry"
    | "error";
  countdownSeconds?: number;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function getPhaseIndex(phase: VisualPhase): number {
  if (phase === "done") return PHASE_ORDER.length;
  return PHASE_ORDER.indexOf(phase);
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, "0");
    return `About ${mins}:${secs} remaining`;
  }
  return `About ${seconds}s remaining`;
}

function getPhaseContent(
  phase: VisualPhase,
  tokens: Record<string, Record<string, unknown>>
): { eyebrow: string; text: string } {
  const industry = tokens.industry as { name?: string } | undefined;
  const colors = tokens.colors as { palette?: unknown[] } | undefined;
  const fonts = tokens.fonts as { detected?: unknown[] } | undefined;
  const layouts = tokens.layouts as { options?: unknown[] } | undefined;
  const layoutCount = layouts?.options?.length ?? 3;

  switch (phase) {
    case "scanning":
      return {
        eyebrow: "Accessing site",
        text: "Reading your page structure and visual layout\u2026",
      };
    case "industry": {
      const copy = tokens.scanningCopy as { industry_text?: string } | undefined;
      return {
        eyebrow: "Industry identified",
        text: copy?.industry_text
          ?? (industry?.name
            ? `We identified your business as ${industry.name}. Now we're benchmarking your site against the best in this space.`
            : "Identifying your industry and understanding what your customers expect when they visit\u2026"),
      };
    }
    case "brand":
      return {
        eyebrow: "Brand analysis",
        text:
          colors?.palette || fonts?.detected
            ? `Extracting your color palette${colors?.palette ? ` (${colors.palette.length} colors)` : ""}, typography${fonts?.detected ? ` (${fonts.detected.length} fonts)` : ""}, and visual identity to preserve your brand in the redesign.`
            : "Extracting your color palette, typography, and visual identity to preserve your brand in the redesign.",
      };
    case "competitors": {
      const copy = tokens.scanningCopy as { competitor_text?: string } | undefined;
      const industryName = (tokens.industry as { name?: string } | undefined)?.name;
      return {
        eyebrow: "Competitor scan",
        text: copy?.competitor_text
          ?? (industryName
            ? `Comparing your site against top-performing ${industryName.toLowerCase()} businesses to see where you stand\u2026`
            : "Scanning businesses in your area to understand what top-performing sites do differently\u2026"),
      };
    }
    case "scoring": {
      const copy = tokens.scanningCopy as { scoring_text?: string } | undefined;
      const scores = tokens.scores as { bottom?: { name: string; score: number } } | undefined;
      return {
        eyebrow: "Key finding",
        text: copy?.scoring_text
          ?? (scores?.bottom
            ? `Your weakest area is ${scores.bottom.name.toLowerCase()}, scoring ${scores.bottom.score} out of 100. This is where the biggest improvements will be made.`
            : "Evaluating your site against industry standards to identify the areas with the most room for improvement\u2026"),
      };
    }
    case "designing": {
      const copy = tokens.scanningCopy as { designing_text?: string } | undefined;
      return {
        eyebrow: "Generating designs",
        text: copy?.designing_text
          ?? `Creating ${layoutCount} unique redesigns that fix these issues while keeping your brand identity intact.`,
      };
    }
    default:
      return { eyebrow: "", text: "" };
  }
}

/** Resolve an analysis finding key to display content. */
function getAnalysisFindingContent(
  key: string,
  tokens: Record<string, Record<string, unknown>>
): FindingContent {
  switch (key) {
    case "industry":
      return { severity: "ok", label: "Homepage Analyzed", detail: "" };
    case "brand": {
      const d = tokens.industry as { name?: string } | undefined;
      return {
        severity: "ok",
        label: "Industry Detected",
        detail: d?.name ? `\u2014 ${d.name}` : "",
      };
    }
    case "competitors":
      return { severity: "ok", label: "5-Second Clarity Test", detail: "" };
    case "scoring":
      return { severity: "ok", label: "Finding Conversion Blockers", detail: "" };
    default:
      return { severity: "ok", label: "", detail: "" };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Keyframes (injected once via <style>)
   ═══════════════════════════════════════════════════════════════ */

const KEYFRAMES = `
@keyframes sc-pillPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes sc-streamBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes sc-findingIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export function ScanningExperience({
  tokens,
  currentStep,
  countdownSeconds,
  className,
}: ScanningExperienceProps) {
  /* ─── Visual phase ──────────────────────────────────────── */
  const [visualPhase, setVisualPhase] = useState<VisualPhase>("scanning");

  /* ─── Streaming text ────────────────────────────────────── */
  const [streamEyebrow, setStreamEyebrow] = useState("Accessing site");
  const [streamTarget, setStreamTarget] = useState("");
  const [streamRevealed, setStreamRevealed] = useState(0);
  const [cursorActive, setCursorActive] = useState(false);

  /* ─── Findings visibility ───────────────────────────────── */
  const [visibleAnalysisFindings, setVisibleAnalysisFindings] = useState<Set<string>>(new Set());
  const [visibleDesignFindings, setVisibleDesignFindings] = useState<Set<string>>(new Set());

  /* Ref to track previous cursorActive value for edge detection */
  const prevCursorActiveRef = useRef(false);

  /* ─── Phase transitions driven by currentStep ───────────── */
  useEffect(() => {
    if (currentStep === "started" || currentStep === "retry") {
      setVisualPhase("scanning");
      setStreamRevealed(0);
      setCursorActive(false);
      setVisibleAnalysisFindings(new Set());
      setVisibleDesignFindings(new Set());
      prevCursorActiveRef.current = false;
      return;
    }
    if (currentStep === "generating") {
      setVisualPhase("designing");
      return;
    }
    if (currentStep === "done") {
      setVisualPhase("done");
      return;
    }
    if (currentStep === "analyzing") {
      setVisualPhase("industry");
      const t1 = setTimeout(() => setVisualPhase("brand"), 20000);
      const t2 = setTimeout(() => setVisualPhase("competitors"), 40000);
      const t3 = setTimeout(() => setVisualPhase("scoring"), 60000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [currentStep]);

  /* ─── Start streaming text when visual phase changes ────── */
  useEffect(() => {
    if (visualPhase === "done") {
      // Show the last phase text instantly
      const content = getPhaseContent("designing", tokens);
      setStreamEyebrow(content.eyebrow);
      setStreamTarget(content.text);
      setStreamRevealed(content.text.length);
      setCursorActive(false);
      return;
    }
    const content = getPhaseContent(visualPhase, tokens);
    setStreamEyebrow(content.eyebrow);
    setStreamTarget(content.text);
    setStreamRevealed(0);
    setCursorActive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase]); // exclude tokens — don't restart mid-stream

  /* ─── Character-by-character reveal ─────────────────────── */
  useEffect(() => {
    if (!cursorActive) return;
    if (streamRevealed >= streamTarget.length) {
      setCursorActive(false);
      return;
    }
    const timer = setTimeout(
      () => setStreamRevealed((prev) => prev + 1),
      55
    );
    return () => clearTimeout(timer);
  }, [streamRevealed, streamTarget, cursorActive]);

  /* ─── Show analysis finding when streaming text finishes ── */
  useEffect(() => {
    // Detect falling edge: cursorActive went from true → false
    const wasPreviouslyActive = prevCursorActiveRef.current;
    prevCursorActiveRef.current = cursorActive;

    if (cursorActive || !wasPreviouslyActive) return;
    if (visualPhase === "designing" || visualPhase === "done") return;

    const finding = ANALYSIS_FINDINGS.find((f) => f.phase === visualPhase);
    if (!finding) return;

    const timer = setTimeout(() => {
      setVisibleAnalysisFindings((prev) => {
        if (prev.has(finding.key)) return prev;
        return new Set([...prev, finding.key]);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [cursorActive, visualPhase]);

  /* ─── Ensure past-phase findings are visible ────────────── */
  useEffect(() => {
    const currentIdx = getPhaseIndex(visualPhase);
    for (const finding of ANALYSIS_FINDINGS) {
      const findingIdx = getPhaseIndex(finding.phase);
      if (findingIdx < currentIdx) {
        setVisibleAnalysisFindings((prev) => {
          if (prev.has(finding.key)) return prev;
          return new Set([...prev, finding.key]);
        });
      }
    }
  }, [visualPhase]);

  /* ─── Design phase findings — stagger every 30s ─────────── */
  useEffect(() => {
    if (visualPhase !== "designing" && visualPhase !== "done") {
      setVisibleDesignFindings(new Set());
      return;
    }
    if (visualPhase === "done") return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const item of DESIGN_FINDINGS) {
      timers.push(
        setTimeout(() => {
          setVisibleDesignFindings((prev) => new Set([...prev, item.key]));
        }, item.delay)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [visualPhase]);

  /* ─── Derived values ────────────────────────────────────── */
  const currentPhaseIdx = getPhaseIndex(visualPhase);
  const isDone = visualPhase === "done";
  const isError = currentStep === "error";
  const layoutCount =
    (tokens.layouts as { options?: unknown[] } | undefined)?.options
      ?.length ?? 3;

  const isDesigning = visualPhase === "designing";
  const thinkingLabel = isDone
    ? `Analysis complete \u2014 ${layoutCount} designs ready`
    : isDesigning
      ? "Designing 3 refreshed pages\u2026"
      : "Analyzing your web presence\u2026";
  const thinkingSub = isDone
    ? "Results are waiting for you"
    : countdownSeconds != null && countdownSeconds > 0
      ? formatCountdown(countdownSeconds)
      : "Finishing up\u2026";

  // Analysis findings to render
  const analysisFindings = useMemo(() => {
    return ANALYSIS_FINDINGS.filter((f) => visibleAnalysisFindings.has(f.key)).map((f) => ({
      key: f.key,
      content: getAnalysisFindingContent(f.key, tokens),
    }));
  }, [visibleAnalysisFindings, tokens]);

  // Design findings to render
  const designFindings = useMemo(() => {
    return DESIGN_FINDINGS.filter((f) => visibleDesignFindings.has(f.key));
  }, [visibleDesignFindings]);

  /* ─── Error state ───────────────────────────────────────── */
  if (isError) {
    return (
      <div
        className={cn(
          "w-full max-w-[600px] mx-auto text-center py-16",
          className
        )}
        style={{ fontFamily: "'Geist', sans-serif" }}
      >
        <div
          className="w-9 h-9 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: "#b91c1c" }}
        >
          <span className="text-white text-sm font-bold">{"\u2717"}</span>
        </div>
        <p
          className="text-base font-medium mb-2"
          style={{ color: "#1c1917" }}
        >
          Analysis failed
        </p>
        <p className="text-sm mb-6" style={{ color: "#78716c" }}>
          Please go back and try again.
        </p>
        <Link
          href="/"
          className="text-sm underline underline-offset-2"
          style={{ color: "#14532d" }}
        >
          &larr; Back to home
        </Link>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────────────── */
  return (
    <>
      <style>{KEYFRAMES}</style>

      <div
        className={cn("w-full max-w-[600px] mx-auto", className)}
        style={{ fontFamily: "'Geist', sans-serif", color: "#1c1917" }}
      >
        {/* ─── Thinking header ─────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <div
            className="text-sm font-medium"
            style={{ color: "#1c1917" }}
          >
            {thinkingLabel}
          </div>
          <div className="text-xs" style={{ color: "#78716c" }}>
            {thinkingSub}
          </div>
        </div>

        {/* ─── Progress pills ──────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-7 justify-center">
          {PILL_CONFIG.map((pill, i) => {
            const isActive = i === currentPhaseIdx && !isDone;
            const isPast = i < currentPhaseIdx || isDone;
            return (
              <div
                key={pill.key}
                className="inline-flex items-center gap-[5px] rounded-full text-xs font-medium"
                style={{
                  padding: "5px 12px",
                  border: `1px solid ${isPast ? "#14532d" : isActive ? "#86efac" : "#e7e5e0"}`,
                  background: isPast
                    ? "#14532d"
                    : isActive
                      ? "#f0fdf4"
                      : "#ffffff",
                  color: isPast
                    ? "#ffffff"
                    : isActive
                      ? "#166534"
                      : "#78716c",
                  opacity: isPast ? 0.9 : isActive ? 1 : 0.4,
                  transition: "all 0.4s ease",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "currentColor",
                    opacity: isPast ? 1 : 0.5,
                    animation: isActive
                      ? "sc-pillPulse 1s ease-in-out infinite"
                      : "none",
                  }}
                />
                {pill.label}
              </div>
            );
          })}
        </div>

        {/* ─── Insight area ────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fffdf9",
            border: "1px solid #e7e5e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          {/* Eyebrow + streaming text */}
          <div
            className="px-5 py-5 sm:px-8 sm:py-7"
            style={{ borderBottom: "1px solid #e7e5e0" }}
          >
            <div
              className="text-[11px] font-medium uppercase tracking-wider mb-3.5"
              style={{ color: "#78716c", letterSpacing: "1px" }}
            >
              {streamEyebrow}
            </div>
            <div
              className="text-[19px] sm:text-[22px] leading-[1.55] min-h-[100px]"
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 300,
                color: "#1c1917",
              }}
            >
              {streamTarget.slice(0, streamRevealed)}
              <span
                className="inline-block align-middle ml-0.5"
                style={{
                  width: "2px",
                  height: "22px",
                  background: "#14532d",
                  opacity: cursorActive ? 1 : 0,
                  animation: cursorActive
                    ? "sc-streamBlink 0.8s step-end infinite"
                    : "none",
                }}
              />
            </div>
          </div>

          {/* Analysis Findings (visible during analysis phases) */}
          {visualPhase !== "designing" && !isDone && analysisFindings.length > 0 && (
            <div
              className="flex flex-col gap-2.5 px-5 py-4 sm:px-8 sm:py-5"
              style={{ borderBottom: "1px solid #e7e5e0" }}
            >
              {analysisFindings.map(({ key, content }) => (
                <div
                  key={key}
                  className="flex items-start gap-2.5"
                  style={{ animation: "sc-findingIn 0.35s ease forwards" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-px"
                    style={{
                      background: SEVERITY_BG[content.severity],
                      color: SEVERITY_COLOR[content.severity],
                    }}
                  >
                    {SEVERITY_ICON[content.severity]}
                  </div>
                  <div
                    className="text-[13px] leading-normal"
                    style={{ color: "#1c1917" }}
                  >
                    <strong className="font-semibold">{content.label}</strong>
                    {content.detail && <> {content.detail}</>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Design Findings (visible during design phase) */}
          {(isDesigning || isDone) && designFindings.length > 0 && (
            <div
              className="flex flex-col gap-2.5 px-5 py-4 sm:px-8 sm:py-5"
              style={{ borderBottom: "1px solid #e7e5e0" }}
            >
              {designFindings.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-2.5"
                  style={{ animation: "sc-findingIn 0.35s ease forwards" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-px"
                    style={{
                      background: SEVERITY_BG["ok"],
                      color: SEVERITY_COLOR["ok"],
                    }}
                  >
                    {SEVERITY_ICON["ok"]}
                  </div>
                  <div
                    className="text-[13px] leading-normal"
                    style={{ color: "#1c1917" }}
                  >
                    <strong className="font-semibold">{item.label}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
