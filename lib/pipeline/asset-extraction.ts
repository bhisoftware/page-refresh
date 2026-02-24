/**
 * Extract brand assets from HTML, download files, upload to Netlify Blobs, write UrlAsset rows.
 * Reuses extractAssets and detectTechStack. Non-fatal: on failure returns what was extracted.
 */

import type { UrlProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadBlob, profileAssetKey } from "@/lib/storage/netlify-blobs";
import { extractAssets, type ExtractedAssets } from "@/lib/scraping/asset-extractor";
import { detectTechStack, type TechStack } from "@/lib/scraping/tech-detector";
import * as cheerio from "cheerio";

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

  if (logoUrl) add(logoUrl, "logo");

  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href, "favicon");
  });

  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) add(content, "og_image");
  });

  const firstImgInSection = $("header img, section img, main img").first();
  if (firstImgInSection.length) {
    const src = firstImgInSection.attr("src");
    if (src && !seen.has(resolveAbsolute(baseUrl, src))) add(src, "hero_image");
  }
  if (!candidates.some((c) => c.assetType === "hero_image") && $("img").length) {
    const firstImg = $("img").first().attr("src");
    if (firstImg) add(firstImg, "hero_image");
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
      downloaded++;
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

  return { assets, storedAssets, techStack };
}
