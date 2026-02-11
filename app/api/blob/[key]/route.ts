/**
 * Serves blobs by key. Used when Netlify Blobs returns our app URL.
 * For local dev with data URLs, this is not used.
 * Cache headers for screenshots (immutable by key) to reduce repeat loads.
 */

import { NextRequest } from "next/server";

const CACHE_MAX_AGE = "31536000"; // 1 year; keys are unique per analysis

function contentTypeForKey(decodedKey: string): string {
  if (decodedKey.endsWith(".webp")) return "image/webp";
  if (decodedKey.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "pagerefresh-assets", consistency: "strong" });
    const data = await store.get(decodedKey, { type: "arrayBuffer" });
    if (!data) {
      return new Response("Not found", { status: 404 });
    }
    const headers: Record<string, string> = {
      "Content-Type": contentTypeForKey(decodedKey),
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
    };
    return new Response(data, { headers });
  } catch {
    return new Response("Blob not found", { status: 404 });
  }
}
