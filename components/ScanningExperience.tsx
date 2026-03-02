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
  { key: "scanning" as const, label: "Fetching site" },
  { key: "industry" as const, label: "Industry" },
  { key: "brand" as const, label: "Brand" },
  { key: "competitors" as const, label: "Competitors" },
  { key: "scoring" as const, label: "Scoring" },
  { key: "designing" as const, label: "Designing" },
];

/** Fixed finding slots with phase association and stagger delay. */
const FINDING_SLOTS = [
  { key: "industry:0", phase: "industry" as VisualPhase, delay: 800 },
  { key: "brand:0", phase: "brand" as VisualPhase, delay: 800 },
  { key: "brand:1", phase: "brand" as VisualPhase, delay: 1600 },
  { key: "competitors:0", phase: "competitors" as VisualPhase, delay: 800 },
  { key: "scoring:0", phase: "scoring" as VisualPhase, delay: 800 },
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
        eyebrow: "Fetching site",
        text: "Reading your page structure and visual layout\u2026",
      };
    case "industry":
      return {
        eyebrow: "Industry identified",
        text: industry?.name
          ? `We identified your business as ${industry.name}. Your customers come here looking for expertise and a provider they can trust.`
          : "Identifying your industry and understanding what your customers expect when they visit\u2026",
      };
    case "brand":
      return {
        eyebrow: "Brand analysis",
        text:
          colors?.palette || fonts?.detected
            ? `Extracting your color palette${colors?.palette ? ` (${colors.palette.length} colors)` : ""}, typography${fonts?.detected ? ` (${fonts.detected.length} fonts)` : ""}, and visual identity to preserve your brand in the redesign.`
            : "Extracting your color palette, typography, and visual identity to preserve your brand in the redesign.",
      };
    case "competitors":
      return {
        eyebrow: "Competitor scan",
        text: "Scanning businesses in your area to understand what top-performing sites do differently\u2026",
      };
    case "scoring":
      return {
        eyebrow: "Key finding",
        text: "Most visitors decide whether to stay or leave within 5 seconds. Right now, your homepage headline gives them no reason to stay.",
      };
    case "designing":
      return {
        eyebrow: "Generating designs",
        text: `Creating ${layoutCount} unique redesigns that fix these issues while keeping your brand identity intact.`,
      };
    default:
      return { eyebrow: "", text: "" };
  }
}

/** Resolve a finding slot key to content from the latest tokens. */
function getFindingContent(
  slotKey: string,
  tokens: Record<string, Record<string, unknown>>
): FindingContent | null {
  switch (slotKey) {
    case "industry:0": {
      const d = tokens.industry as
        | { name?: string; confidence?: number }
        | undefined;
      if (!d?.name) return null;
      return {
        severity: "ok",
        label: "Industry detected:",
        detail: d.name,
        note: `${Math.round(d.confidence ?? 0)}% confidence`,
      };
    }
    case "brand:0": {
      const d = tokens.structure as
        | { checks?: Array<{ label: string; status: string; value: string }> }
        | undefined;
      const hit = d?.checks?.find(
        (c) => c.status === "warn" || c.status === "bad"
      );
      if (!hit) return null;
      return {
        severity: hit.status as Severity,
        label: hit.label + ":",
        detail: hit.value,
      };
    }
    case "brand:1": {
      const c = tokens.colors as { palette?: unknown[] } | undefined;
      const f = tokens.fonts as { detected?: unknown[] } | undefined;
      if (!c?.palette && !f?.detected) return null;
      return {
        severity: "ok",
        label: "Brand extracted:",
        detail: `${c?.palette?.length ?? 0} colors, ${f?.detected?.length ?? 0} fonts`,
        note: "consistent identity detected",
      };
    }
    case "competitors:0": {
      const d = tokens.scores as
        | { bottom?: { name: string; score: number } }
        | undefined;
      if (!d?.bottom) return null;
      return {
        severity: d.bottom.score < 40 ? "bad" : "warn",
        label: `Weakest area \u2014 ${d.bottom.name}:`,
        detail: `${d.bottom.score}/100`,
        note: "focus area for improvement",
      };
    }
    case "scoring:0": {
      const d = tokens.seo as
        | { checks?: Array<{ label: string; status: string; value: string }> }
        | undefined;
      const hit = d?.checks?.find(
        (c) => c.status === "warn" || c.status === "bad"
      );
      if (!hit) return null;
      return {
        severity: hit.status as Severity,
        label: hit.label + ":",
        detail: hit.value,
      };
    }
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

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
  const [streamEyebrow, setStreamEyebrow] = useState("Fetching site");
  const [streamTarget, setStreamTarget] = useState("");
  const [streamRevealed, setStreamRevealed] = useState(0);
  const [cursorActive, setCursorActive] = useState(false);

  /* ─── Findings visibility (slot keys) ───────────────────── */
  const [visibleSlots, setVisibleSlots] = useState<Set<string>>(new Set());

  /* ─── Score animation ───────────────────────────────────── */
  const [showScoreStrip, setShowScoreStrip] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number>(0);
  const scoreAnimatedRef = useRef(false);

  /* ─── Phase transitions driven by currentStep ───────────── */
  useEffect(() => {
    if (currentStep === "started" || currentStep === "retry") {
      setVisualPhase("scanning");
      return;
    }
    if (currentStep === "scoring") {
      setVisualPhase("scoring");
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
      const t1 = setTimeout(() => setVisualPhase("brand"), 3500);
      const t2 = setTimeout(() => setVisualPhase("competitors"), 7000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
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
      45
    );
    return () => clearTimeout(timer);
  }, [streamRevealed, streamTarget, cursorActive]);

  /* ─── Schedule finding slot visibility on phase change ──── */
  useEffect(() => {
    const currentIdx = getPhaseIndex(visualPhase);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const slot of FINDING_SLOTS) {
      const slotIdx = getPhaseIndex(slot.phase);

      if (slotIdx < currentIdx) {
        // Past phase — show immediately
        setVisibleSlots((prev) => {
          if (prev.has(slot.key)) return prev;
          return new Set([...prev, slot.key]);
        });
      } else if (slotIdx === currentIdx) {
        // Current phase — stagger in
        timers.push(
          setTimeout(() => {
            setVisibleSlots((prev) => new Set([...prev, slot.key]));
          }, slot.delay)
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [visualPhase]);

  /* ─── Score counter animation ───────────────────────────── */
  useEffect(() => {
    if (!tokens.scores) return;
    if (getPhaseIndex(visualPhase) < getPhaseIndex("scoring")) return;
    if (scoreAnimatedRef.current) return;

    scoreAnimatedRef.current = true;
    const target =
      (tokens.scores as { overall?: number }).overall ?? 0;
    const delay = visualPhase === "scoring" ? 1500 : 0;

    const delayTimer = setTimeout(() => {
      setShowScoreStrip(true);
      const duration = 1400;
      const startTime = performance.now();

      function frame(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        setDisplayScore(Math.round(eased * target));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(frame);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase, tokens.scores]);

  /* ─── Derived values ────────────────────────────────────── */
  const currentPhaseIdx = getPhaseIndex(visualPhase);
  const isDone = visualPhase === "done";
  const isError = currentStep === "error";
  const overallScore =
    (tokens.scores as { overall?: number } | undefined)?.overall ?? 0;
  const layoutCount =
    (tokens.layouts as { options?: unknown[] } | undefined)?.options
      ?.length ?? 3;

  const thinkingLabel = isDone
    ? `Analysis complete \u2014 ${layoutCount} designs ready`
    : "Analyzing your website\u2026";
  const thinkingSub = isDone
    ? "Results are waiting for you"
    : countdownSeconds != null && countdownSeconds > 0
      ? `About ${countdownSeconds}s remaining`
      : "This takes about 45 seconds";

  // Collect renderable findings
  const renderableFindings = useMemo(() => {
    return FINDING_SLOTS.map((slot) => ({
      slot,
      content: getFindingContent(slot.key, tokens),
    })).filter(
      (f): f is { slot: typeof FINDING_SLOTS[number]; content: FindingContent } =>
        f.content !== null
    );
  }, [tokens]);

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
        <div className="flex flex-wrap gap-1.5 mb-7">
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

          {/* Findings */}
          {renderableFindings.length > 0 && (
            <div
              className="flex flex-col gap-2.5 px-5 py-4 sm:px-8 sm:py-5"
              style={{ borderBottom: "1px solid #e7e5e0" }}
            >
              {renderableFindings.map(({ slot, content }) => {
                const isVisible = visibleSlots.has(slot.key);
                if (!isVisible) return null;
                return (
                  <div
                    key={slot.key}
                    className="flex items-start gap-2.5"
                    style={{
                      animation: "sc-findingIn 0.35s ease forwards",
                    }}
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
                      <strong className="font-semibold">
                        {content.label}
                      </strong>{" "}
                      {content.detail}
                      {content.note && (
                        <span style={{ color: "#78716c" }}>
                          {" "}
                          &mdash; {content.note}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Score strip */}
          <div
            className="flex items-center gap-5 px-5 py-4 sm:px-8 sm:py-5"
            style={{
              background: "#14532d",
              borderRadius: "0 0 15px 15px",
              opacity: showScoreStrip ? 1 : 0,
              transition: "opacity 0.5s ease",
              pointerEvents: showScoreStrip ? "auto" : "none",
            }}
          >
            <div
              className="leading-none"
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "52px",
                fontWeight: 300,
                color: "#ffffff",
                letterSpacing: "-2px",
              }}
            >
              {displayScore}
            </div>
            <div className="flex-1">
              <div
                className="text-[11px] font-medium uppercase tracking-wider mb-2"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "1px",
                }}
              >
                Overall score
              </div>
              <div
                className="text-sm leading-normal"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Your site scored{" "}
                <strong className="font-semibold text-white">
                  {overallScore}
                </strong>
                /100 &mdash;{" "}
                <strong className="font-semibold text-white">
                  {layoutCount} redesigns are ready
                </strong>{" "}
                that fix these issues.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
