/**
 * Page Refresh wand icon logo.
 * Use throughout the site and in marketing materials.
 * Standalone SVG files for external use: /public/logo-icon.svg, /public/logo-full.svg
 */

import { cn } from "@/lib/utils";

const WAND_PATH =
  "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4";

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
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={WAND_PATH} />
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

/** Raw SVG path data for use in non-React contexts (emails, injected HTML) */
export const WAND_SVG_PATH = WAND_PATH;
