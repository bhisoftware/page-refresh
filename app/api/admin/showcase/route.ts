import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.showcaseItem.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      refresh: {
        select: {
          url: true,
          screenshotUrl: true,
          industryDetected: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { refreshId, layoutIndex, siteLabel } = body;

  if (!refreshId || ![1, 2, 3].includes(Number(layoutIndex))) {
    return NextResponse.json(
      { error: "refreshId and layoutIndex (1-3) are required" },
      { status: 400 }
    );
  }

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { screenshotUrl: true, url: true },
  });

  if (!refresh) {
    return NextResponse.json({ error: "Refresh not found" }, { status: 404 });
  }

  const maxSort = await prisma.showcaseItem.aggregate({ _max: { sortOrder: true } });
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

  const item = await prisma.showcaseItem.create({
    data: {
      refreshId,
      layoutIndex: Number(layoutIndex),
      sortOrder: nextSort,
      beforeUrl: refresh.screenshotUrl ?? null,
      siteLabel: siteLabel ?? null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
