"use client";

import { cn } from "@/lib/utils";

const CARD_ORDER = ["structure", "seo", "colors", "fonts", "layouts"] as const;

const CARD_CONFIG: Record<
  (typeof CARD_ORDER)[number],
  { title: string; icon: string }
> = {
  structure: { title: "Reading your current site", icon: "🗺️" },
  seo: { title: "Checking how Google sees you", icon: "🔍" },
  colors: { title: "Pulling your brand colors", icon: "🎨" },
  fonts: { title: "Identifying your fonts", icon: "✏️" },
  layouts: { title: "Designing 3 fresh versions", icon: "⬛" },
};

type Check = { label: string; status: "ok" | "warn" | "bad"; value: string };
type PaletteItem = { hex: string; role: string };
type FontItem = { name: string; role: string; cssFamily: string };
type LayoutOption = { label: string; accentColor: string };

export interface AnalysisLoaderCardsProps {
  tokens: Record<string, Record<string, unknown>>;
  currentStep: "started" | "analyzing" | "scoring" | "generating" | "done" | "retry" | "error";
  countdownSeconds?: number;
  className?: string;
}

function getActiveCardIndex(tokens: Record<string, Record<string, unknown>>): number {
  for (let i = 0; i < CARD_ORDER.length; i++) {
    if (!tokens[CARD_ORDER[i]]) return i;
  }
  return CARD_ORDER.length;
}

export function AnalysisLoaderCards({
  tokens,
  currentStep,
  countdownSeconds,
  className,
}: AnalysisLoaderCardsProps) {
  const activeIndex = getActiveCardIndex(tokens);
  const hasLayouts = Array.isArray((tokens.layouts as { options?: unknown[] })?.options) && (tokens.layouts as { options: unknown[] }).options.length >= 3;
  const progressPct =
    currentStep === "done" || hasLayouts
      ? 100
      : Math.min(95, (Object.keys(tokens).filter((k) => CARD_ORDER.includes(k as (typeof CARD_ORDER)[number])).length / 5) * 80 + (activeIndex < 4 ? 4 : 12));

  return (
    <div className={cn("w-full max-w-[580px] flex flex-col gap-3", className)}>
      {CARD_ORDER.map((key, index) => {
        const data = tokens[key];
        const isDone = !!data;
        const isActive = !isDone && index === activeIndex;
        const config = CARD_CONFIG[key];

        return (
          <div
            key={key}
            className={cn(
              "rounded-xl border-[1.5px] p-[18px] transition-all duration-300",
              isActive && "border-foreground shadow-md opacity-100",
              isDone && "border-[#d4e8d6] bg-[#fafefa] opacity-100",
              !isActive && !isDone && "border-border opacity-50"
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[17px]",
                  isActive && "bg-foreground text-background",
                  isDone && "bg-[#e8f4ea]",
                  !isActive && !isDone && "bg-muted"
                )}
              >
                {config.icon}
              </span>
              <span
                className={cn(
                  "flex-1 text-[15px] font-semibold",
                  isDone || isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {config.title}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  isActive && "bg-foreground text-background",
                  isDone && "bg-[#e8f4ea] text-[#2d7a3a]",
                  !isActive && !isDone && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? "Done ✓" : isActive ? "Working…" : "Up next"}
              </span>
            </div>

            {(isActive || isDone) && (
              <div className="mt-3.5 border-t border-border/80 pt-3.5">
                {key === "structure" && Array.isArray(data?.checks) && (
                  <CheckList checks={data.checks as Check[]} />
                )}
                {key === "seo" && Array.isArray(data?.checks) && (
                  <CheckList checks={data.checks as Check[]} />
                )}
                {key === "colors" && Array.isArray(data?.palette) && (
                  <ColorSwatches palette={data.palette as PaletteItem[]} />
                )}
                {key === "fonts" && Array.isArray(data?.detected) && (
                  <FontList detected={data.detected as FontItem[]} />
                )}
                {key === "layouts" && Array.isArray(data?.options) && (
                  <LayoutThumbs options={data.options as LayoutOption[]} />
                )}
                {!data && (
                  <div className="flex gap-2">
                    <div className="h-4 w-[85%] animate-pulse rounded bg-muted" />
                    <div className="h-4 w-[70%] animate-pulse rounded bg-muted" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-6 flex w-full max-w-[580px] items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="min-w-[52px] text-right text-[13px] tabular-nums text-muted-foreground">
          {countdownSeconds != null && countdownSeconds > 0
            ? `${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, "0")} left`
            : "Done!"}
        </span>
      </div>
    </div>
  );
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((c, i) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              c.status === "ok" && "bg-[#4caf74]",
              c.status === "warn" && "bg-[#f0a030]",
              c.status === "bad" && "bg-[#e05050]"
            )}
          />
          <span className="flex-1 text-[12px] text-foreground/80">{c.label}</span>
          <span className="text-[11px] font-bold text-muted-foreground">{c.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ColorSwatches({ palette }: { palette: PaletteItem[] }) {
  return (
    <div className="flex flex-wrap gap-2 pb-5">
      {palette.map((c, i) => (
        <div
          key={i}
          className="h-8 w-8 shrink-0 rounded-lg border border-black/10 transition-all duration-300"
          style={{ backgroundColor: c.hex }}
          title={`${c.role} · ${c.hex}`}
        />
      ))}
    </div>
  );
}

function FontList({ detected }: { detected: FontItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {detected.map((f, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/50 px-3 py-2"
        >
          <span
            className="text-[22px] font-bold leading-none text-foreground/90"
            style={{ fontFamily: f.cssFamily }}
          >
            Ag
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-foreground">{f.name}</div>
            <div className="text-[11px] text-muted-foreground">{f.role}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LayoutThumbs({ options }: { options: LayoutOption[] }) {
  return (
    <div className="flex gap-2">
      {options.map((opt, i) => (
        <div
          key={i}
          className="relative flex flex-1 flex-col rounded-lg border border-border bg-muted/30 overflow-hidden pt-2 pb-6"
        >
          <div
            className="mx-2 mb-1 h-2.5 rounded-sm opacity-60"
            style={{ backgroundColor: opt.accentColor }}
          />
          <div className="mx-2 mb-1 h-1 rounded-sm bg-muted" />
          <div className="mx-2 mb-2 h-1 w-[65%] rounded-sm bg-muted" />
          <span className="absolute bottom-1.5 left-2 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
            {opt.label}
          </span>
        </div>
      ))}
    </div>
  );
}
