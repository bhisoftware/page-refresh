import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSetting } from "@/lib/config/app-settings";

export async function GET() {
  const enabled = await getAppSetting("showcase_enabled", "false");

  if (enabled !== "true") {
    return NextResponse.json(
      { enabled: false, items: [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  }

  const items = await prisma.showcaseItem.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      beforeUrl: true,
      afterS3Key: true,
      siteLabel: true,
    },
  });

  const result = items
    .filter((item) => item.beforeUrl && item.afterS3Key)
    .map((item) => ({
      id: item.id,
      beforeImageUrl: item.beforeUrl,
      afterImageUrl: `/api/blob/${encodeURIComponent(item.afterS3Key!)}`,
      siteLabel: item.siteLabel ?? null,
    }));

  return NextResponse.json(
    { enabled: true, items: result },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
