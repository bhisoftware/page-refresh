/**
 * Serves blobs by key from S3.
 * Cache headers for screenshots (immutable by key) to reduce repeat loads.
 */

import { NextRequest } from "next/server";
import { s3Download } from "@/lib/storage/s3";

const CACHE_MAX_AGE = "31536000"; // 1 year; keys are unique per analysis

function contentTypeForKey(decodedKey: string): string {
  if (decodedKey.endsWith(".webp")) return "image/webp";
  if (decodedKey.endsWith(".png")) return "image/png";
  if (decodedKey.endsWith(".jpg") || decodedKey.endsWith(".jpeg")) return "image/jpeg";
  if (decodedKey.endsWith(".svg")) return "image/svg+xml";
  if (decodedKey.endsWith(".ico")) return "image/x-icon";
  if (decodedKey.endsWith(".gif")) return "image/gif";
  if (decodedKey.endsWith(".woff")) return "font/woff";
  if (decodedKey.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    const result = await s3Download(decodedKey);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(result.data, {
      headers: {
        "Content-Type": result.contentType || contentTypeForKey(decodedKey),
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    });
  } catch {
    return new Response("Blob not found", { status: 404 });
  }
}
