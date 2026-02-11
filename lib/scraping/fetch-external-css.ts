/**
 * Fetch external stylesheets from link[rel="stylesheet"].
 * Production sites typically use external CSS for colors/fonts.
 */

import * as cheerio from "cheerio";

function resolveUrl(base: string, href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) {
    try {
      const u = new URL(base);
      return `${u.origin}${href}`;
    } catch {
      return href;
    }
  }
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export async function fetchExternalCss(html: string, baseUrl: string, maxSheets = 3): Promise<string> {
  const $ = cheerio.load(html);
  const hrefs: string[] = [];

  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("data:")) {
      hrefs.push(resolveUrl(baseUrl, href));
    }
  });

  const toFetch = hrefs.slice(0, maxSheets);
  const results = await Promise.allSettled(
    toFetch.map(async (url) => {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; pagerefresh/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .join("\n");
}
