/**
 * Cloud screenshot via ScreenshotOne API.
 * Non-fatal: returns null on failure so pipeline can continue with HTML-structure analysis.
 */

import { validateUrlForScreenshot } from "@/lib/scraping/url-validator";

const API_TIMEOUT_MS = 10000;
const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;

export async function captureScreenshotCloud(url: string): Promise<Buffer | null> {
  const key = process.env.SCREENSHOTONE_API_KEY;
  if (!key?.trim()) return null;

  try {
    validateUrlForScreenshot(url);
  } catch {
    return null;
  }

  const params = new URLSearchParams({
    url,
    viewport_width: String(VIEWPORT_WIDTH),
    viewport_height: String(VIEWPORT_HEIGHT),
    format: "png",
    access_key: key,
  });
  const apiUrl = `https://api.screenshotone.com/take?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "image/png" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
