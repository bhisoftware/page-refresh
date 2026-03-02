/**
 * Fetch HTML via fetch() with timeout and bot-evasion headers.
 * Falls back to Firecrawl for bot-protected sites (403/401).
 */

import { validateUrlForScreenshot } from "@/lib/scraping/url-validator";
import { BROWSER_HEADERS } from "@/lib/scraping/browser-headers";
import { scrapeWithFirecrawl } from "@/lib/scraping/firecrawl-scrape";

const FETCH_TIMEOUT_MS = 15000;

export interface FetchHtmlResult {
  html: string;
  url: string;
}

/** Check if an error indicates bot-blocking (403/401/Cloudflare). */
function isBotBlocked(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("blocks automated access") ||
    msg.includes("blocked") ||
    msg.includes("captcha") ||
    msg.includes("cloudflare") ||
    msg.includes("access denied") ||
    msg.includes("403") ||
    msg.includes("401")
  );
}

/** Plain fetch with HTTPS→HTTP fallback. Throws on bot-blocking. */
async function fetchHtmlDirect(url: string): Promise<FetchHtmlResult> {
  const urlsToTry = [url];
  if (url.startsWith("https://")) {
    urlsToTry.push(url.replace("https://", "http://"));
  }

  let lastError: Error | null = null;

  for (const tryUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(tryUrl, {
        signal: controller.signal,
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (res.status === 403 || res.status === 401) {
        throw new Error("This website blocks automated access.");
      }
      if (!res.ok) {
        throw new Error(`Could not load page (HTTP ${res.status}).`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        throw new Error("URL did not return HTML.");
      }

      const html = await res.text();
      const finalUrl = res.url ?? tryUrl;
      return { html, url: finalUrl };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        const isConnectFailure =
          err.name === "AbortError" ||
          msg.includes("timeout") ||
          msg.includes("econnrefused") ||
          msg.includes("econnreset") ||
          msg.includes("fetch failed");

        // If HTTPS failed with a connection issue and we have HTTP to try, fall back
        if (isConnectFailure && urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) {
          console.log(`[fetchHtml] HTTPS failed for ${tryUrl}, falling back to HTTP`);
          lastError = err;
          continue;
        }

        if (err.name === "AbortError") {
          throw new Error("Request timed out. The website took too long to respond.");
        }
        if (
          msg.includes("blocked") ||
          msg.includes("captcha") ||
          msg.includes("cloudflare") ||
          msg.includes("access denied") ||
          msg.includes("403")
        ) {
          throw new Error("This website blocks automated access.");
        }
        if (
          msg.includes("enotfound") ||
          msg.includes("getaddrinfo") ||
          msg.includes("dns") ||
          msg.includes("fetch failed") ||
          msg.includes("econnrefused") ||
          msg.includes("econnreset")
        ) {
          throw new Error("Could not reach website. Check the URL and try again.");
        }
        throw err;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Could not reach website. Check the URL and try again.");
}

export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  validateUrlForScreenshot(url);

  try {
    return await fetchHtmlDirect(url);
  } catch (err) {
    // Only try Firecrawl for bot-blocking errors
    if (err instanceof Error && isBotBlocked(err)) {
      const html = await scrapeWithFirecrawl(url);
      if (html) {
        return { html, url };
      }
    }
    throw err;
  }
}
