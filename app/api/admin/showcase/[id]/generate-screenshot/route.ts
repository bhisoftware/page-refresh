import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateAfterScreenshot } from "@/lib/showcase/generate-screenshot";

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const item = await prisma.showcaseItem.findUnique({ where: { id } });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const afterS3Key = await generateAfterScreenshot(id, item.refreshId, item.layoutIndex);

  if (!afterS3Key) {
    return NextResponse.json(
      { ok: false, error: "Screenshot generation failed" },
      { status: 500 }
    );
  }

  await prisma.showcaseItem.update({
    where: { id },
    data: { afterS3Key, afterGeneratedAt: new Date() },
  });

  const afterUrl = `/api/blob/${encodeURIComponent(afterS3Key)}`;
  return NextResponse.json({ ok: true, afterUrl });
}
