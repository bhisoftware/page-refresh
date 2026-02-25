/**
 * Asset storage wrapper.
 * Uses AWS S3 for screenshots and brand assets.
 * Falls back to data URLs for local dev when S3 is not configured.
 */

import { isS3Configured, s3Upload, s3UploadString } from "./s3";

function blobUrl(key: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pagerefresh.ai";
  return `${baseUrl}/api/blob/${encodeURIComponent(key)}`;
}

/**
 * Upload a Buffer (e.g. PNG screenshot) to storage.
 * Returns a URL that can be used to access the asset.
 */
export async function uploadBlob(
  key: string,
  data: Buffer,
  contentType = "image/png"
): Promise<string> {
  if (isS3Configured()) {
    const ok = await s3Upload(key, data, contentType);
    if (ok) return blobUrl(key);
  }

  // Fallback: data URL (local dev without S3)
  const b64 = data.toString("base64");
  return `data:${contentType};base64,${b64}`;
}

/**
 * Upload a string (e.g. JSON) to storage.
 */
export async function uploadBlobString(
  key: string,
  data: string,
  contentType = "application/json"
): Promise<string> {
  if (isS3Configured()) {
    const ok = await s3UploadString(key, data, contentType);
    if (ok) return blobUrl(key);
  }

  // Fallback: data URL (local dev without S3)
  return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
}

/**
 * Generate a unique blob key for a screenshot (WebP for smaller size).
 */
export function screenshotKey(refreshId: string, url: string): string {
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9-]/gi, "-").slice(0, 50);
  return `screenshots/${refreshId}-${slug}-${Date.now()}.webp`;
}

/**
 * Generate a blob key for a URL profile asset.
 * Pattern: profiles/{profileId}/{assetType}.{ext}
 */
export function profileAssetKey(profileId: string, assetType: string, extension: string): string {
  return `profiles/${profileId}/${assetType}.${extension}`;
}
