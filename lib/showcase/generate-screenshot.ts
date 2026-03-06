/**
 * Generates "after" screenshots for showcase items.
 * Calls ScreenshotOne on the HMAC-signed /api/render-layout endpoint,
 * compresses to WebP, and uploads to S3.
 */

import crypto from "crypto";
import { compressScreenshotToWebP } from "@/lib/scraping/screenshot-compress";
import { s3Upload } from "@/lib/storage/s3";

export function buildRenderUrl(refreshId: string, layoutIndex: number): string {
  const secret = process.env.SHOWCASE_HMAC_SECRET ?? "";
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${refreshId}:${layoutIndex}`)
    .digest("hex");
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai").replace(/\/$/, "");
  return `${base}/api/render-layout?refreshId=${encodeURIComponent(refreshId)}&layout=${layoutIndex}&sig=${sig}`;
}

export function afterScreenshotKey(showcaseItemId: string): string {
  return `showcase/${showcaseItemId}-after.webp`;
}

async function captureUrl(url: string): Promise<Buffer | null> {
  const key = process.env.SCREENSHOTONE_API_KEY;
  if (!key?.trim()) return null;

  const params = new URLSearchParams({
    url,
    viewport_width: "1440",
    viewport_height: "900",
    format: "png",
    block_ads: "true",
    block_cookie_banners: "true",
    access_key: key,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`https://api.screenshotone.com/take?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "image/png" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Captures a screenshot of a rendered layout and uploads to S3.
 * Returns the S3 key on success, null on failure.
 */
export async function generateAfterScreenshot(
  showcaseItemId: string,
  refreshId: string,
  layoutIndex: number
): Promise<string | null> {
  const renderUrl = buildRenderUrl(refreshId, layoutIndex);
  const pngBuffer = await captureUrl(renderUrl);
  if (!pngBuffer) return null;

  const { buffer: webpBuffer } = await compressScreenshotToWebP(pngBuffer);
  const key = afterScreenshotKey(showcaseItemId);
  const ok = await s3Upload(key, webpBuffer, "image/webp");
  return ok ? key : null;
}
