/**
 * POST /api/admin/test-zip-delivery
 * Body: { refreshId, layoutIndex?, platformKey? }
 *
 * Manually triggers buildAndDeliverLayout for testing.
 * Admin-only. Defaults: layoutIndex=1, platformKey="html".
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildAndDeliverLayout } from "@/lib/zip-builder";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { refreshId, layoutIndex = 1, platformKey = "html" } = body;

  if (!refreshId) {
    return NextResponse.json({ error: "refreshId is required" }, { status: 400 });
  }

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true, paidEmail: true, status: true },
  });

  if (!refresh) {
    return NextResponse.json({ error: "Refresh not found" }, { status: 404 });
  }

  // Run synchronously so we can return the result
  try {
    await buildAndDeliverLayout(refreshId, layoutIndex, platformKey);

    const updated = await prisma.refresh.findUnique({
      where: { id: refreshId },
      select: { zipS3Key: true, zipGeneratedAt: true },
    });

    return NextResponse.json({
      success: true,
      refreshId,
      layoutIndex,
      platformKey,
      emailSentTo: refresh.paidEmail ?? "(no paidEmail set)",
      zip: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[test-zip-delivery]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
