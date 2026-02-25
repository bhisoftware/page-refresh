/**
 * Serves blobs by key via signed S3 redirect.
 *
 * Instead of proxying bytes through the serverless function,
 * generates a short-lived pre-signed URL and 302-redirects to S3.
 * The S3 objects already have Cache-Control headers set at upload time,
 * so browsers cache the asset after the first fetch.
 *
 * Falls back to proxying the bytes if signing fails.
 */

import { NextRequest } from "next/server";
import { s3Download, s3GetSignedUrl } from "@/lib/storage/s3";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    // Try signed URL redirect first (avoids proxying bytes through function)
    const signedUrl = await s3GetSignedUrl(decodedKey);
    if (signedUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: signedUrl,
          // Don't cache the redirect itself — signed URLs expire
          "Cache-Control": "private, no-cache",
        },
      });
    }

    // Fallback: proxy bytes (e.g. if presigner unavailable)
    const result = await s3Download(decodedKey);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(result.data, {
      headers: {
        "Content-Type": result.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Blob not found", { status: 404 });
  }
}
