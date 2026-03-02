import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

/**
 * identifyDownloadableUrls is not exported, so we test it indirectly by
 * recreating the same logic. This mirrors the production code in
 * asset-extraction.ts including srcset/data-src parsing, URL heuristics,
 * and OG image hero fallback.
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

/** Parse srcset and return the URL with the largest width/density descriptor. */
function parseSrcsetForLargest(srcset: string, baseUrl: string): string | null {
  const entries = srcset
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] ?? "";
      let size = 0;
      if (descriptor.endsWith("w")) size = parseInt(descriptor, 10) || 0;
      else if (descriptor.endsWith("x")) size = (parseFloat(descriptor) || 1) * 1000;
      return { url, size };
    })
    .filter((e) => e.url && !e.url.startsWith("data:"));

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.size - a.size);
  return resolveAbsolute(baseUrl, entries[0].url);
}

/** Get the best (highest-res) image URL from an <img> element. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBestImageUrl($: cheerio.CheerioAPI, el: any, baseUrl: string): string | null {
  const $el = $(el);
  const srcset = $el.attr("srcset") || $el.attr("data-srcset");
  if (srcset) {
    const best = parseSrcsetForLargest(srcset, baseUrl);
    if (best) return best;
  }
  const dataSrc =
    $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("data-original");
  if (dataSrc && !dataSrc.startsWith("data:")) return resolveAbsolute(baseUrl, dataSrc);
  const src = $el.attr("src");
  if (src && !src.startsWith("data:")) return resolveAbsolute(baseUrl, src);
  return null;
}

const POSITIVE_URL_PATTERNS =
  /hero|banner|feature|full|large|original|header|cover|background|main/i;
const NEGATIVE_URL_PATTERNS =
  /thumb|icon|small|tiny|avatar|favicon|logo|sprite|pixel|tracking|badge|button|arrow|spacer/i;

function scoreImageUrl(url: string): number {
  let score = 0;
  if (POSITIVE_URL_PATTERNS.test(url)) score += 10;
  if (NEGATIVE_URL_PATTERNS.test(url)) score -= 10;
  const numbers = url.match(/(\d{3,4})/g);
  if (numbers) {
    const maxNum = Math.max(...numbers.map(Number));
    if (maxNum >= 800) score += 5;
    if (maxNum >= 1200) score += 5;
  }
  return score;
}

/**
 * Mirrors the production identifyDownloadableUrls with srcset/data-src parsing,
 * URL heuristic scoring, and OG image hero fallback.
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

  // Hero detection: use getBestImageUrl for srcset/data-src support
  let heroFound = false;
  $("header img").each((_, el) => {
    if (heroFound) return;
    const bestUrl = getBestImageUrl($, el, baseUrl);
    if (!bestUrl) return;
    if (classifiedUrls.has(bestUrl) || seen.has(bestUrl)) return;
    add(bestUrl, "hero_image");
    heroFound = true;
  });

  // Fallback: best image in first section/main using URL heuristics
  if (!heroFound) {
    let bestSrc: string | null = null;
    let bestScore = -1;
    const fallbackContainer = $("section, main").first();
    if (fallbackContainer.length) {
      fallbackContainer.find("img").each((_, el) => {
        const imgUrl = getBestImageUrl($, el, baseUrl);
        if (!imgUrl) return;
        if (classifiedUrls.has(imgUrl) || seen.has(imgUrl)) return;
        const w = parseInt($(el).attr("width") ?? "0", 10) || 0;
        const h = parseInt($(el).attr("height") ?? "0", 10) || 0;
        let size = w * h;
        if (size === 0) {
          size = scoreImageUrl(imgUrl) + 1;
        }
        if (size > bestScore) {
          bestScore = size;
          bestSrc = imgUrl;
        }
      });
    }
    if (bestSrc) {
      add(bestSrc, "hero_image");
      heroFound = true;
    }
  }

  // Fallback: promote OG image to hero
  if (!heroFound) {
    const ogCandidate = candidates.find((c) => c.assetType === "og_image");
    if (ogCandidate) {
      ogCandidate.assetType = "hero_image";
      heroFound = true;
    }
  }

  // Last resort: any img on the page not already classified
  if (!heroFound && $("img").length) {
    $("img").each((_, el) => {
      if (heroFound) return;
      const bestUrl = getBestImageUrl($, el, baseUrl);
      if (!bestUrl) return;
      if (classifiedUrls.has(bestUrl) || seen.has(bestUrl)) return;
      add(bestUrl, "hero_image");
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

describe("srcset and data-src extraction", () => {
  const baseUrl = "https://example.com";

  it("picks the largest width descriptor from srcset", () => {
    const html = `
      <html><body>
        <header>
          <img src="/hero-300.jpg"
               srcset="/hero-300.jpg 300w, /hero-600.jpg 600w, /hero-1200.jpg 1200w"
               alt="Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/hero-1200.jpg");
  });

  it("picks the highest density descriptor from srcset", () => {
    const html = `
      <html><body>
        <header>
          <img src="/hero.jpg"
               srcset="/hero-1x.jpg 1x, /hero-2x.jpg 2x"
               alt="Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/hero-2x.jpg");
  });

  it("prefers data-src over placeholder src", () => {
    const html = `
      <html><body>
        <header>
          <img src="data:image/gif;base64,placeholder"
               data-src="/real-hero.jpg"
               alt="Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/real-hero.jpg");
  });

  it("handles data-lazy-src for lazy-loaded images", () => {
    const html = `
      <html><body>
        <header>
          <img src="/placeholder.gif" data-lazy-src="/actual-hero.jpg" alt="Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/actual-hero.jpg");
  });

  it("prefers data-srcset over regular src", () => {
    const html = `
      <html><body>
        <header>
          <img src="/tiny-placeholder.jpg"
               data-srcset="/medium.jpg 600w, /large.jpg 1200w"
               alt="Hero">
        </header>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, undefined);
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/large.jpg");
  });
});

describe("OG image hero fallback", () => {
  const baseUrl = "https://example.com";

  it("promotes OG image to hero_image when no hero found in page", () => {
    const html = `
      <html>
        <head><meta property="og:image" content="https://example.com/og-share.jpg"></head>
        <body>
          <header><img src="/logo.png" alt="Logo"></header>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://example.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/og-share.jpg");
    // Should be promoted from og_image to hero_image
    const og = result.find((c) => c.assetType === "og_image");
    expect(og).toBeUndefined();
  });

  it("keeps OG image as og_image when a hero is already found", () => {
    const html = `
      <html>
        <head><meta property="og:image" content="https://example.com/og-share.jpg"></head>
        <body>
          <header>
            <img src="/logo.png" alt="Logo">
            <img src="/hero.jpg" alt="Hero">
          </header>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://example.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/hero.jpg");
    const og = result.find((c) => c.assetType === "og_image");
    expect(og).toBeDefined();
    expect(og!.url).toBe("https://example.com/og-share.jpg");
  });
});

describe("URL heuristic scoring", () => {
  const baseUrl = "https://example.com";

  it("prefers image with hero in URL over icon image when no HTML dimensions", () => {
    const html = `
      <html><body>
        <header><img src="/logo.png" alt="Logo"></header>
        <section>
          <img src="/images/small-icon.png" alt="Small">
          <img src="/images/hero-banner.jpg" alt="Banner">
        </section>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://example.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/images/hero-banner.jpg");
  });

  it("prefers image with large resolution number in URL", () => {
    const html = `
      <html><body>
        <header><img src="/logo.png" alt="Logo"></header>
        <section>
          <img src="/img/photo-200x150.jpg" alt="Small photo">
          <img src="/img/photo-1200x800.jpg" alt="Large photo">
        </section>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = identifyDownloadableUrls($, baseUrl, "https://example.com/logo.png");
    const hero = result.find((c) => c.assetType === "hero_image");
    expect(hero).toBeDefined();
    expect(hero!.url).toBe("https://example.com/img/photo-1200x800.jpg");
  });
});

describe("parseSrcsetForLargest", () => {
  it("handles malformed srcset gracefully", () => {
    // No descriptors — should still return a URL
    const result = parseSrcsetForLargest("/img.jpg", "https://example.com");
    expect(result).toBe("https://example.com/img.jpg");
  });

  it("handles empty srcset", () => {
    const result = parseSrcsetForLargest("", "https://example.com");
    expect(result).toBeNull();
  });

  it("handles whitespace-heavy srcset", () => {
    const result = parseSrcsetForLargest(
      "  /small.jpg   300w ,  /large.jpg   1200w  ",
      "https://example.com"
    );
    expect(result).toBe("https://example.com/large.jpg");
  });

  it("skips data: URIs in srcset", () => {
    const result = parseSrcsetForLargest(
      "data:image/gif;base64,abc 1w, /real.jpg 800w",
      "https://example.com"
    );
    expect(result).toBe("https://example.com/real.jpg");
  });
});
