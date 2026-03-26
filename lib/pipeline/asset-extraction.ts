/**
 * Extract brand assets from HTML, download files, upload to S3, write UrlAsset rows.
 * Reuses extractAssets and detectTechStack. Non-fatal: on failure returns what was extracted.
 */

import type { UrlProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadBlob, profileAssetKey } from "@/lib/storage/blobs";
import { extractAssets, type ExtractedAssets } from "@/lib/scraping/asset-extractor";
import { detectTechStack, type TechStack } from "@/lib/scraping/tech-detector";
import * as cheerio from "cheerio";
import sharp from "sharp";

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_DOWNLOADS = 5;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StoredAsset {
  assetType: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageUrl: string;
  sourceUrl: string;
}

export interface AssetExtractionResult {
  assets: ExtractedAssets;
  storedAssets: StoredAsset[];
  techStack: TechStack;
  /** Map from original site image URL to S3-backed blob URL */
  siteImageUrlMap: Map<string, string>;
  /** Raw image buffers keyed by source URL. Retained for vision agents (e.g., Logo Agent). */
  downloadedBuffers: Map<string, Buffer>;
  /** Image dimensions extracted via sharp, keyed by source URL. */
  siteImageDimensions: Map<string, { width: number; height: number }>;
}

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

function contentTypeToExt(contentType: string): string {
  const main = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_EXT[main] ?? "bin";
}

/**
 * Parse a srcset attribute and return the URL with the largest width/density descriptor.
 * Handles: "small.jpg 300w, large.jpg 1200w" and "img-1x.jpg 1x, img-2x.jpg 2x"
 */
function parseSrcsetForLargest(srcset: string, baseUrl: string): string | null {
  const entries = srcset
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] ?? "";
      let size = 0;
      if (descriptor.endsWith("w")) {
        size = parseInt(descriptor, 10) || 0;
      } else if (descriptor.endsWith("x")) {
        size = (parseFloat(descriptor) || 1) * 1000; // Normalize: 2x → 2000
      }
      return { url, size };
    })
    .filter((e) => e.url && !e.url.startsWith("data:"));

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.size - a.size);
  return resolveAbsolute(baseUrl, entries[0].url);
}

/**
 * Given an <img> element, find the highest-resolution image URL available.
 * Priority: srcset (largest) > data-srcset > data-src/data-lazy-src > src
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBestImageUrl($: cheerio.CheerioAPI, el: any, baseUrl: string): string | null {
  const $el = $(el);

  // Check srcset / data-srcset for highest-resolution variant
  const srcset = $el.attr("srcset") || $el.attr("data-srcset");
  if (srcset) {
    const best = parseSrcsetForLargest(srcset, baseUrl);
    if (best) return best;
  }

  // Check lazy-load attributes
  const dataSrc =
    $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("data-original");
  if (dataSrc && !dataSrc.startsWith("data:")) {
    return resolveAbsolute(baseUrl, dataSrc);
  }

  // Fall back to src
  const src = $el.attr("src");
  if (src && !src.startsWith("data:")) {
    return resolveAbsolute(baseUrl, src);
  }

  return null;
}

/** Positive URL signals for hero/feature images. */
const POSITIVE_URL_PATTERNS =
  /hero|banner|feature|full|large|original|header|cover|background|main/i;
/** Negative URL signals — likely icons, tracking pixels, or tiny assets. */
const NEGATIVE_URL_PATTERNS =
  /thumb|icon|small|tiny|avatar|favicon|logo|sprite|pixel|tracking|badge|button|arrow|spacer/i;

/**
 * Score an image URL based on path heuristics.
 * Higher score → more likely to be a meaningful content image.
 */
function scoreImageUrl(url: string): number {
  let score = 0;
  if (POSITIVE_URL_PATTERNS.test(url)) score += 10;
  if (NEGATIVE_URL_PATTERNS.test(url)) score -= 10;
  // Prefer URLs with larger numbers (often resolution indicators)
  const numbers = url.match(/(\d{3,4})/g);
  if (numbers) {
    const maxNum = Math.max(...numbers.map(Number));
    if (maxNum >= 800) score += 5;
    if (maxNum >= 1200) score += 5;
  }
  return score;
}

/** URL/alt patterns that indicate an image is an icon, not a content photo. */
const ICON_URL_PATTERN = /\b(icon|ico|glyph|symbol|emoji|badge-icon|ui-icon|arrow|chevron|checkmark)\b/i;
const ICON_ALT_PATTERN = /\b(icon|arrow|chevron|checkmark|check mark|bullet|dot|close|menu|hamburger)\b/i;
const DECORATIVE_URL_PATTERN = /\b(bg|background|pattern|texture|gradient|divider|separator|spacer|decoration|overlay)\b/i;

/**
 * Check if an image element is likely an icon or decorative image (not suitable as hero).
 * Uses URL patterns, alt text, dimensions, and SVG detection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLikelyIconOrDecorative($: cheerio.CheerioAPI, el: any, imgUrl: string): boolean {
  const $el = $(el);
  const alt = ($el.attr("alt") ?? "").toLowerCase();
  const urlLower = imgUrl.toLowerCase();

  // SVG files are almost always icons/illustrations
  if (/\.svg(\?|$)/i.test(urlLower)) return true;

  // URL and alt text pattern checks
  if (ICON_URL_PATTERN.test(urlLower) || DECORATIVE_URL_PATTERN.test(urlLower)) return true;
  if (ICON_ALT_PATTERN.test(alt)) return true;

  // Dimension checks — small images are icons
  const w = parseInt($el.attr("width") ?? "0", 10) || 0;
  const h = parseInt($el.attr("height") ?? "0", 10) || 0;
  if (w > 0 && h > 0) {
    const maxDim = Math.max(w, h);
    if (maxDim <= 128) return true;
  }

  return false;
}

/** Minimum dimension for a hero image candidate (either width or height). */
const MIN_HERO_DIMENSION = 200;

/**
 * Check if an image has sufficient dimensions for hero use.
 * Returns true if dimensions are unknown (no width/height attrs) or above threshold.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasHeroDimensions($: cheerio.CheerioAPI, el: any): boolean {
  const $el = $(el);
  const w = parseInt($el.attr("width") ?? "0", 10) || 0;
  const h = parseInt($el.attr("height") ?? "0", 10) || 0;
  // If no dimensions specified, allow it (we can't tell)
  if (w === 0 && h === 0) return true;
  // At least one dimension must meet minimum
  return w >= MIN_HERO_DIMENSION || h >= MIN_HERO_DIMENSION;
}

/**
 * Identify candidate URLs for logo, favicon, og:image, hero_image from HTML.
 * Returns deduplicated list of { url, assetType }.
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

  // Collect favicon URLs first so we can check if the logo is actually a favicon
  const faviconUrls = new Set<string>();
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      faviconUrls.add(resolveAbsolute(baseUrl, href));
    }
  });

  // Only classify as "logo" if it's a genuine logo, not a favicon
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

  // Build a set of URLs already classified as logo or favicon to skip for hero detection
  const classifiedUrls = new Set<string>();
  for (const c of candidates) {
    if (c.assetType === "logo" || c.assetType === "favicon") {
      classifiedUrls.add(c.url);
    }
  }

  // Hero detection: first try header images that aren't logo/favicon/icon
  // Use getBestImageUrl to prefer srcset/data-src high-res variants
  let heroFound = false;
  $("header img").each((_, el) => {
    if (heroFound) return;
    const bestUrl = getBestImageUrl($, el, baseUrl);
    if (!bestUrl) return;
    if (classifiedUrls.has(bestUrl) || seen.has(bestUrl)) return;
    if (isLikelyIconOrDecorative($, el, bestUrl)) return;
    if (!hasHeroDimensions($, el)) return;
    add(bestUrl, "hero_image");
    heroFound = true;
  });

  // Fallback: if no hero in header, pick the best image in first <section> or <main>
  // Uses HTML dimensions when available, falls back to URL heuristic scoring
  if (!heroFound) {
    let bestSrc: string | null = null;
    let bestScore = -1;
    const fallbackContainer = $("section, main").first();
    if (fallbackContainer.length) {
      fallbackContainer.find("img").each((_, el) => {
        const imgUrl = getBestImageUrl($, el, baseUrl);
        if (!imgUrl) return;
        if (classifiedUrls.has(imgUrl) || seen.has(imgUrl)) return;
        if (isLikelyIconOrDecorative($, el, imgUrl)) return;
        if (!hasHeroDimensions($, el)) return;
        const w = parseInt($(el).attr("width") ?? "0", 10) || 0;
        const h = parseInt($(el).attr("height") ?? "0", 10) || 0;
        let size = w * h;
        if (size === 0) {
          // No HTML dimensions — use URL heuristic scoring
          size = scoreImageUrl(imgUrl) + 1; // +1 so score-0 still beats -1
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

  // Fallback: promote OG image to hero if available (typically 1200x630+)
  if (!heroFound) {
    const ogCandidate = candidates.find((c) => c.assetType === "og_image");
    if (ogCandidate) {
      ogCandidate.assetType = "hero_image";
      heroFound = true;
    }
  }

  // Last resort: any img on the page not already classified (skip icons)
  if (!heroFound && $("img").length) {
    $("img").each((_, el) => {
      if (heroFound) return;
      const bestUrl = getBestImageUrl($, el, baseUrl);
      if (!bestUrl) return;
      if (classifiedUrls.has(bestUrl) || seen.has(bestUrl)) return;
      if (isLikelyIconOrDecorative($, el, bestUrl)) return;
      add(bestUrl, "hero_image");
      heroFound = true;
    });
  }

  return candidates;
}

/**
 * Download one URL with timeout. Returns buffer and content-type or null on failure.
 */
async function downloadOne(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PageRefresh/1.0 (Asset Extraction)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[asset-extraction] Download failed for ${url}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

const SITE_IMAGE_CONCURRENCY = 3;
const MAX_SITE_IMAGES = 8;

/**
 * Download site images to S3 in concurrency-limited batches.
 * Returns a map from original URL to S3-backed blob URL.
 */
async function downloadSiteImages(
  images: Array<{ src: string; alt?: string }>,
  profileId: string,
): Promise<{ urlMap: Map<string, string>; stored: StoredAsset[]; buffers: Map<string, Buffer>; dimensions: Map<string, { width: number; height: number }> }> {
  const urlMap = new Map<string, string>();
  const stored: StoredAsset[] = [];
  const buffers = new Map<string, Buffer>();
  const dimensions = new Map<string, { width: number; height: number }>();

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = images.filter((img) => {
    if (seen.has(img.src)) return false;
    seen.add(img.src);
    return true;
  });
  const toDownload = unique.slice(0, MAX_SITE_IMAGES);

  for (let i = 0; i < toDownload.length; i += SITE_IMAGE_CONCURRENCY) {
    const batch = toDownload.slice(i, i + SITE_IMAGE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (img, batchIdx) => {
        const globalIdx = i + batchIdx;
        const result = await downloadOne(img.src);
        if (!result) return null;
        const { buffer, contentType } = result;
        const ext = contentTypeToExt(contentType);
        if (ext === "bin") return null;
        // Extract dimensions via sharp (non-fatal on corrupt/unsupported formats)
        let imgWidth: number | undefined;
        let imgHeight: number | undefined;
        try {
          const meta = await sharp(buffer).metadata();
          imgWidth = meta.width;
          imgHeight = meta.height;
        } catch { /* skip dimensions for this image */ }
        const assetType = `site-image-${globalIdx}`;
        const storageKey = profileAssetKey(profileId, assetType, ext);
        const storageUrl = await uploadBlob(storageKey, buffer, contentType);
        return {
          originalUrl: img.src,
          buffer,
          storageUrl,
          imgWidth,
          imgHeight,
          storedAsset: {
            assetType,
            fileName: `${assetType}.${ext}`,
            mimeType: contentType.split(";")[0]?.trim() ?? "application/octet-stream",
            fileSize: buffer.length,
            storageKey,
            storageUrl,
            sourceUrl: img.src,
          } satisfies StoredAsset,
        };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        urlMap.set(r.value.originalUrl, r.value.storageUrl);
        stored.push(r.value.storedAsset);
        buffers.set(r.value.originalUrl, r.value.buffer);
        if (r.value.imgWidth && r.value.imgHeight) {
          dimensions.set(r.value.originalUrl, { width: r.value.imgWidth, height: r.value.imgHeight });
        }
      }
    }
  }

  return { urlMap, stored, buffers, dimensions };
}

export async function extractAndPersistAssets(
  urlProfile: UrlProfile,
  html: string,
  css: string,
  baseUrl: string,
  screenshotBuffer?: Buffer | null
): Promise<AssetExtractionResult> {
  const assets = extractAssets(html, css, baseUrl);
  const techStack = detectTechStack(html);
  const storedAssets: StoredAsset[] = [];
  let siteImageUrlMap = new Map<string, string>();
  const downloadedBuffers = new Map<string, Buffer>();
  let siteImageDimensions = new Map<string, { width: number; height: number }>();

  try {
    const $ = cheerio.load(html);
    const candidates = identifyDownloadableUrls($, baseUrl, assets.logo);
    let downloaded = 0;
    for (const { url, assetType } of candidates) {
      if (downloaded >= MAX_DOWNLOADS) break;
      const result = await downloadOne(url);
      if (!result) continue;
      const { buffer, contentType } = result;
      const ext = contentTypeToExt(contentType);
      if (ext === "bin") continue;
      const storageKey = profileAssetKey(urlProfile.id, assetType, ext);
      const storageUrl = await uploadBlob(storageKey, buffer, contentType);
      storedAssets.push({
        assetType,
        fileName: `${assetType}.${ext}`,
        mimeType: contentType.split(";")[0]?.trim() ?? "application/octet-stream",
        fileSize: buffer.length,
        storageKey,
        storageUrl,
        sourceUrl: url,
      });
      downloadedBuffers.set(url, buffer);
      downloaded++;
    }

    // Download site images to S3 for reliable creative agent URLs
    const allSiteImages: Array<{ src: string; alt?: string }> = [
      ...assets.images.map((img) => ({ src: img.src, alt: img.alt })),
      ...(assets.teamPhotos ?? []),
      ...(assets.trustBadges ?? []),
      ...(assets.eventPhotos ?? []),
    ];
    const siteImageResult = await downloadSiteImages(allSiteImages, urlProfile.id);
    storedAssets.push(...siteImageResult.stored);
    siteImageUrlMap = siteImageResult.urlMap;
    siteImageDimensions = siteImageResult.dimensions;
    for (const [url, buf] of siteImageResult.buffers) {
      downloadedBuffers.set(url, buf);
    }

    // Ensure top logo candidates have buffers for Logo Agent vision
    const logoCandidateUrls = (assets.logoCandidates ?? []).slice(0, 5).map((c) => c.url);
    const missingCandidates = logoCandidateUrls.filter((url) => !downloadedBuffers.has(url));
    if (missingCandidates.length > 0) {
      const extraResults = await Promise.allSettled(
        missingCandidates.map((url) => downloadOne(url))
      );
      for (let i = 0; i < extraResults.length; i++) {
        const r = extraResults[i];
        if (r.status === "fulfilled" && r.value) {
          downloadedBuffers.set(missingCandidates[i], r.value.buffer);
        }
      }
    }

    if (screenshotBuffer && screenshotBuffer.length > 0) {
      const screenshotKey = profileAssetKey(urlProfile.id, "screenshot", "webp");
      const screenshotUrl = await uploadBlob(screenshotKey, screenshotBuffer, "image/webp");
      storedAssets.push({
        assetType: "screenshot",
        fileName: "screenshot.webp",
        mimeType: "image/webp",
        fileSize: screenshotBuffer.length,
        storageKey: screenshotKey,
        storageUrl: screenshotUrl,
        sourceUrl: baseUrl,
      });
    }

    if (storedAssets.length > 0) {
      await prisma.urlAsset.createMany({
        data: storedAssets.map((a) => ({
          urlProfileId: urlProfile.id,
          assetType: a.assetType,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          storageKey: a.storageKey,
          storageUrl: a.storageUrl,
          sourceUrl: a.sourceUrl,
        })),
      });

      const logoUrl = storedAssets.find((a) => a.assetType === "logo")?.storageUrl ?? null;
      const heroUrl = storedAssets.find((a) => a.assetType === "hero_image")?.storageUrl ?? null;
      const faviconUrl = storedAssets.find((a) => a.assetType === "favicon")?.storageUrl ?? null;

      await prisma.urlProfile.update({
        where: { id: urlProfile.id },
        data: {
          brandAssets: {
            logo: logoUrl,
            heroImage: heroUrl,
            favicon: faviconUrl,
            colors: assets.colors,
            fonts: assets.fonts,
          } as object,
          extractedCopy: assets.copy as object,
          techStack: techStack as object,
        },
      });
    }
  } catch (err) {
    console.error("[asset-extraction] Failed to persist assets:", err instanceof Error ? err.message : String(err));
  }

  return { assets, storedAssets, techStack, siteImageUrlMap, downloadedBuffers, siteImageDimensions };
}
