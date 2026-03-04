/**
 * Page Refresh wand icon logo.
 * Custom magic wand with gold sparkles, dust trail, and glowing tip.
 * Standalone SVG files for external use: /public/logo-icon.svg, /public/logo-full.svg
 */

import { cn } from "@/lib/utils";

const FILTER_ID = "pr-wand-glow";

/** Just the wand icon */
export function LogoIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <defs>
        <filter
          id={FILTER_ID}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Wand body — base (dark green) */}
      <line x1="14" y1="9" x2="10.5" y2="15.5" stroke="#1a3d28" strokeWidth="1.1" />
      <line x1="14" y1="9" x2="10.5" y2="15.5" stroke="#2d5a3d" strokeWidth="0.8" />
      {/* Wand body — mid (light green) */}
      <line x1="15.8" y1="5.5" x2="14" y2="9" stroke="#1a3d28" strokeWidth="1.1" />
      <line x1="15.8" y1="5.5" x2="14" y2="9" stroke="#7faa8e" strokeWidth="0.8" />
      {/* Wand body — tip (warm white + glow) */}
      <line x1="17.2" y1="2.5" x2="15.8" y2="5.5" stroke="#1a3d28" strokeWidth="1.1" />
      <line x1="17.2" y1="2.5" x2="15.8" y2="5.5" stroke="#fff8e7" strokeWidth="0.8" filter={`url(#${FILTER_ID})`} />
      {/* Dust trail arc */}
      <path d="M15 6c-2.5-0.3-5 0.3-7 2s-3.5 3.5-4 5" fill="none" stroke="#7faa8e" strokeWidth="0.7" strokeDasharray="1.5 2.5" opacity="0.5" />
      {/* Dust particles */}
      <circle cx="12" cy="6.5" r="0.4" fill="#c9942e" opacity="0.9" />
      <circle cx="9.5" cy="8.5" r="0.3" fill="#d4a84b" opacity="0.7" />
      <circle cx="7" cy="10.5" r="0.35" fill="#c9942e" opacity="0.5" />
      <circle cx="5.5" cy="12.5" r="0.25" fill="#d4a84b" opacity="0.4" />
      <circle cx="10.5" cy="7" r="0.25" fill="#c9942e" opacity="0.6" />
      {/* Sparkles */}
      <path d="M20 2.5l0.7 2 2 0.7-2 0.7-0.7 2-0.7-2-2-0.7 2-0.7z" fill="#c9942e" stroke="none" filter={`url(#${FILTER_ID})`} />
      <path d="M20.5 6.5l0.4 1.2 1.2 0.4-1.2 0.4-0.4 1.2-0.4-1.2-1.2-0.4 1.2-0.4z" fill="#d4a84b" stroke="none" />
      <path d="M16 1l0.25 0.75 0.75 0.25-0.75 0.25-0.25 0.75-0.25-0.75-0.75-0.25 0.75-0.25z" fill="#c9942e" stroke="none" />
    </svg>
  );
}

/** Wand icon + "Page Refresh" text */
export function Logo({
  iconSize = 24,
  className,
}: {
  iconSize?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoIcon size={iconSize} />
      <span>Page Refresh</span>
    </span>
  );
}

/**
 * Raw SVG inner content for non-React contexts (emails, injected HTML).
 * Requires a wrapping <svg viewBox="0 0 24 24" ...> and a unique filter ID.
 */
export function wandSvgInner(filterId = "glow"): string {
  return `<defs><filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><line x1="14" y1="9" x2="10.5" y2="15.5" stroke="#1a3d28" stroke-width="1.1"/><line x1="14" y1="9" x2="10.5" y2="15.5" stroke="#2d5a3d" stroke-width="0.8"/><line x1="15.8" y1="5.5" x2="14" y2="9" stroke="#1a3d28" stroke-width="1.1"/><line x1="15.8" y1="5.5" x2="14" y2="9" stroke="#7faa8e" stroke-width="0.8"/><line x1="17.2" y1="2.5" x2="15.8" y2="5.5" stroke="#1a3d28" stroke-width="1.1"/><line x1="17.2" y1="2.5" x2="15.8" y2="5.5" stroke="#fff8e7" stroke-width="0.8" filter="url(#${filterId})"/><path d="M15 6c-2.5-0.3-5 0.3-7 2s-3.5 3.5-4 5" fill="none" stroke="#7faa8e" stroke-width="0.7" stroke-dasharray="1.5 2.5" opacity="0.5"/><circle cx="12" cy="6.5" r="0.4" fill="#c9942e" opacity="0.9"/><circle cx="9.5" cy="8.5" r="0.3" fill="#d4a84b" opacity="0.7"/><circle cx="7" cy="10.5" r="0.35" fill="#c9942e" opacity="0.5"/><circle cx="5.5" cy="12.5" r="0.25" fill="#d4a84b" opacity="0.4"/><circle cx="10.5" cy="7" r="0.25" fill="#c9942e" opacity="0.6"/><path d="M20 2.5l0.7 2 2 0.7-2 0.7-0.7 2-0.7-2-2-0.7 2-0.7z" fill="#c9942e" stroke="none" filter="url(#${filterId})"/><path d="M20.5 6.5l0.4 1.2 1.2 0.4-1.2 0.4-0.4 1.2-0.4-1.2-1.2-0.4 1.2-0.4z" fill="#d4a84b" stroke="none"/><path d="M16 1l0.25 0.75 0.75 0.25-0.75 0.25-0.25 0.75-0.25-0.75-0.75-0.25 0.75-0.25z" fill="#c9942e" stroke="none"/>`;
}
