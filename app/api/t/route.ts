/**
 * GET /api/t?rid={refreshId}
 *
 * Tracking pixel endpoint for the attribution badge.
 * Returns a 1x1 transparent GIF and records that the badge was seen.
 * Rate-limited to one DB update per hour per refreshId.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// In-memory rate limit: refreshId → last update timestamp
const lastUpdate = new Map<string, number>();
const ONE_HOUR = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const rid = request.nextUrl.searchParams.get("rid");

  if (rid) {
    const now = Date.now();
    const last = lastUpdate.get(rid) ?? 0;

    if (now - last > ONE_HOUR) {
      lastUpdate.set(rid, now);

      // Fire-and-forget DB update — don't block the pixel response
      prisma.refresh
        .update({
          where: { id: rid },
          data: {
            badgeLastSeenAt: new Date(),
            badgeHitCount: { increment: 1 },
          },
        })
        .catch(() => {
          // Invalid rid or DB error — silently ignore
        });
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Length": String(PIXEL.length),
    },
  });
}
