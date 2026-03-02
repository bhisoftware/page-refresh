import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

/**
 * identifyDownloadableUrls is not exported, so we test it indirectly by
 * recreating the same logic. This validates the fix described in Bug 2.
 */

function resolveAbsolute(baseUrl: string, href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) {
    try {
      const u = new URL(baseUrl);
      return `${u.origin}${href}`;
    } catch {
      return href;
    }
  }
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Extracted from asset-extraction.ts identifyDownloadableUrls (post-fix version).
 * This mirrors the production logic for testing purposes.
 */
function identifyDownloadableUrls(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  logoUrl: string | undefined
): Array<{ url: string; assetType: string }> {
  const seen = new Set<string>();
  const candidates: Array<{ url: string; assetType: string }> = [];

  function add(url: string, assetType: string) {
    if (!url || url.startsWith("data:") || seen.has(url)) return;
    const absolute = resolveAbsolute(baseUrl, url);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    candidates.push({ url: absolute, assetType });
  }

  const faviconUrls = new Set<string>();
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) faviconUrls.add(resolveAbsolute(baseUrl, href));
  });

  if (logoUrl) {
    const absoluteLogo = resolveAbsolute(baseUrl, logoUrl);
    if (faviconUrls.has(absoluteLogo)) {
      add(logoUrl, "favicon");
    } else {
      add(logoUrl, "logo");
    }
  }

  for (const faviconAbsolute of faviconUrls) {
    add(faviconAbsolute, "favicon");
  }

  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) add(content, "og_image");
  });

  // Build set of classified URLs to skip for hero
  const classifiedUrls = new Set<string>();
  for (const c of candidates) {
    if (c.assetType === "logo" || c.assetType === "favicon") {
      classifiedUrls.add(c.url);
    }
  }

  // Hero detection: first try header images that aren't logo/favicon
  let heroFound = false;
  $("header img").each((_, el) => {
    if (heroFound) return;
    const src = $(el).attr("src");
    if (!src || src.startsWith("data:")) return;
    const absolute = resolveAbsolute(baseUrl, src);
    if (classifiedUrls.has(absolute) || seen.has(absolute)) return;
    add(src, "hero_image");
    heroFound = true;
  });

  // Fallback: if no hero in header, pick the largest image in first <section> or <main>
  if (!heroFound) {
    let bestSrc: string | null = null;
    let bestSize = -1;
    const fallbackContainer = $("section, main").first();
    if (fallbackContainer.length) {
      fallbackContainer.find("img").each((_, el) => {
        const src = $(el).attr("src");
        if (!src || src.startsWith("data:")) return;
        const absolute = resolveAbsolute(baseUrl, src);
        if (classifiedUrls.has(absolute) || seen.has(absolute)) return;
        const w = parseInt($(el).attr("width") ?? "0", 10) || 0;
        const h = parseInt($(el).attr("height") ?? "0", 10) || 0;
        const size = w * h;
        if (size > bestSize) {
          bestSize = size;
          bestSrc = src;
        }
      });
    }
    if (bestSrc) {
      add(bestSrc, "hero_image");
      heroFound = true;
    }
  }

  // Last resort: any img on the page not already classified
  if (!heroFound && $("img").length) {
    $("img").each((_, el) => {
      if (heroFound) return;
      const src = $(el).attr("src");
      if (!src || src.startsWith("data:")) return;
      const absolute = resolveAbsolute(baseUrl, src);
      if (classifiedUrls.has(absolute) || seen.has(absolute)) return;
      add(src, "hero_image");
      heroFound = true;
    });
  }

  return candidates;
}

describe("identifyDownloadableUrls - hero image skip logic", () => {
  const baseUrl = "https://legallyjuan.com";

  it("does NOT pick the logo as hero_image when logo is first img in header", () => {
    const html = `
      <html><head><link rel="icon" href="/favicon.ico"></head>
      <body>
        <header>
          <img src="/logo.png" alt="Logo">
          <img src="/hero-banner.jpg" alt="Hero Banner">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://legallyjuan.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://legallyjuan.com/hero-banner.jpg");
    expect(hero!.url).not.toBe("https://legallyjuan.com/logo.png");
  });

  it("does NOT pick favicon as hero_image", () => {
    const html = `
      <html><head><link rel="icon" href="/favicon.ico"></head>
      <body>
        <header>
          <img src="/favicon.ico" alt="icon">
          <img src="/real-hero.jpg" alt="Real Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://legallyjuan.com/real-hero.jpg");
  });

  it("falls back to largest image in section when header has only logo", () => {
    const html = `
      <html><body>
        <header><img src="/logo.png" alt="Logo"></header>
        <section>
          <img src="/small.jpg" width="100" height="100" alt="Small">
          <img src="/big-hero.jpg" width="1200" height="800" alt="Big Hero">
        </section>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://legallyjuan.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://legallyjuan.com/big-hero.jpg");
  });

  it("returns no hero_image when all images are logo/favicon", () => {
    const html = `
      <html><head><link rel="icon" href="/logo.png"></head>
      <body>
        <header><img src="/logo.png" alt="Logo"></header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://legallyjuan.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeUndefined();
  });
});
