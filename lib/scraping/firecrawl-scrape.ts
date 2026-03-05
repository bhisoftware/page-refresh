/**
 * Firecrawl fallback for bot-protected sites.
 * Non-fatal: returns null if API key not configured or scrape fails.
 * Only called when plain fetch gets 403/401.
 */

import { Firecrawl } from "@mendable/firecrawl-js";

const FIRECRAWL_TIMEOUT_MS = 30_000;

/**
 * Scrape a URL via Firecrawl and return the raw HTML.
 * Returns null if Firecrawl is not configured or the scrape fails.
 */
export async function scrapeWithFirecrawl(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key?.trim()) return null;

  try {
    const firecrawl = new Firecrawl({ apiKey: key });

    const doc = await Promise.race([
      firecrawl.scrape(url, { formats: ["rawHtml"] }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firecrawl timeout")), FIRECRAWL_TIMEOUT_MS)
      ),
    ]);

    if (doc.rawHtml) {
      console.log(`[firecrawl] successfully scraped ${url} (${doc.rawHtml.length} chars)`);
      return doc.rawHtml;
    }

    console.warn(`[firecrawl] scrape returned no rawHtml for ${url}`);
    return null;
  } catch (err) {
    console.warn(
      `[firecrawl] scrape failed for ${url}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * Scrape a URL via Firecrawl with JS rendering (waitFor) for SPA sites.
 * Returns rendered rawHtml or null on any failure.
 */
export async function scrapeWithFirecrawlRendered(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key?.trim()) return null;

  console.log(`[firecrawl] SPA rendering for ${url}`);

  try {
    const firecrawl = new Firecrawl({ apiKey: key });

    const doc = await Promise.race([
      firecrawl.scrape(url, { formats: ["rawHtml"], waitFor: 3000 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firecrawl timeout")), FIRECRAWL_TIMEOUT_MS)
      ),
    ]);

    if (doc.rawHtml) {
      console.log(`[firecrawl] SPA render succeeded for ${url} (${doc.rawHtml.length} chars)`);
      return doc.rawHtml;
    }

    console.warn(`[firecrawl] SPA render returned no rawHtml for ${url}`);
    return null;
  } catch (err) {
    console.warn(
      `[firecrawl] SPA render failed for ${url}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * Check if Firecrawl is configured (has an API key).
 * Used by preflight to know if 403 sites can be handled.
 */
export function isFirecrawlConfigured(): boolean {
  return !!process.env.FIRECRAWL_API_KEY?.trim();
}
