/**
 * Netlify Blobs storage wrapper.
 * Stores screenshots and assets in Netlify Blobs.
 * Falls back to data URLs for local dev when NETLIFY_BLOBS_TOKEN is not set.
 */

const STORE_NAME = "pagerefresh-assets";

type BlobStoreLike = { set(key: string, data: ArrayBuffer | Blob | string): Promise<unknown> };
let _store: BlobStoreLike | null = null;

async function getStore(): Promise<BlobStoreLike | null> {
  if (_store) return _store;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!token) return null;
  try {
    const { getStore: getNetlifyStore } = await import("@netlify/blobs");
    _store = getNetlifyStore({ name: STORE_NAME, consistency: "strong" }) as unknown as BlobStoreLike;
    return _store;
  } catch {
    return null;
  }
}

/**
 * Upload a Buffer (e.g. PNG screenshot) to Netlify Blobs.
 * Returns a URL that can be used to access the blob.
 * When Netlify Blobs is not available, returns a data URL.
 */
export async function uploadBlob(
  key: string,
  data: Buffer,
  contentType = "image/png"
): Promise<string> {
  const store = await getStore();
  if (store) {
    const u8 = new Uint8Array(data);
    const blob = new Blob([u8], { type: contentType });
    await store.set(key, blob);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pagerefresh.ai";
    return `${baseUrl}/api/blob/${encodeURIComponent(key)}`;
  }
  // Fallback: data URL (for local dev without Netlify)
  const b64 = data.toString("base64");
  return `data:${contentType};base64,${b64}`;
}

/**
 * Upload a string (e.g. JSON) to Netlify Blobs.
 */
export async function uploadBlobString(
  key: string,
  data: string,
  contentType = "application/json"
): Promise<string> {
  const store = await getStore();
  if (store) {
    await store.set(key, data);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pagerefresh.ai";
    return `${baseUrl}/api/blob/${encodeURIComponent(key)}`;
  }
  return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
}

/**
 * Generate a unique blob key for a screenshot (WebP for smaller size).
 */
export function screenshotKey(analysisId: string, url: string): string {
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9-]/gi, "-").slice(0, 50);
  return `screenshots/${analysisId}-${slug}-${Date.now()}.webp`;
}
