/**
 * Fetch HTML via fetch() with timeout and bot-evasion headers.
 * Replaces Puppeteer for HTML retrieval (~2s instead of 15-20s).
 */

import { validateUrlForScreenshot } from "@/lib/scraping/url-validator";

const FETCH_TIMEOUT_MS = 15000;
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

export interface FetchHtmlResult {
  html: string;
  url: string;
}

export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  validateUrlForScreenshot(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: ACCEPT_HEADER,
      },
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
    const finalUrl = res.url ?? url;
    return { html, url: finalUrl };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. The website took too long to respond.");
      }
      const msg = err.message.toLowerCase();
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
