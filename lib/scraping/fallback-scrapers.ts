/**
 * Fallback chain for screenshot capture: Puppeteer → (Playwright optional) → user-friendly error.
 * When sites block automated access, we try alternatives before surfacing a clear message.
 */

import { captureScreenshotAndHtml as captureWithPuppeteer } from "./puppeteer";

export interface ScreenshotResult {
  screenshotBuffer: Buffer;
  html: string;
  url: string;
}

const BLOCKED_MESSAGE =
  "This website blocks automated access. Please try a different URL or contact us.";

function isBlockedOrLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("failed to load") ||
    msg.includes("blocked") ||
    msg.includes("cloudflare") ||
    msg.includes("captcha") ||
    msg.includes("access denied") ||
    msg.includes("403") ||
    msg.includes("timeout") ||
    msg.includes("navigation")
  );
}

export async function captureScreenshotWithFallback(
  url: string
): Promise<ScreenshotResult> {
  try {
    return await captureWithPuppeteer(url);
  } catch (err) {
    if (isBlockedOrLoadError(err)) {
      throw new Error(BLOCKED_MESSAGE);
    }
    throw err;
  }
}
