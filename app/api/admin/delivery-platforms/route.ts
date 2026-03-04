import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platforms = await prisma.deliveryPlatform.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ platforms });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { key, label, enabled, sectionSplit, readmeTemplate, platformNotes, folderStructure } = body;

  if (!key || !label) {
    return NextResponse.json({ error: "key and label are required" }, { status: 400 });
  }

  // Get max sortOrder for new platform
  const maxSort = await prisma.deliveryPlatform.aggregate({ _max: { sortOrder: true } });
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

  const platform = await prisma.deliveryPlatform.create({
    data: {
      key,
      label,
      enabled: enabled ?? true,
      sectionSplit: sectionSplit ?? false,
      sortOrder: nextSort,
      readmeTemplate: readmeTemplate ?? "",
      platformNotes: platformNotes ?? "",
      folderStructure: folderStructure ?? "{}",
    },
  });

  return NextResponse.json(platform, { status: 201 });
}
