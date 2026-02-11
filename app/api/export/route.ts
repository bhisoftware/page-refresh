/**
 * POST /api/export
 * Body: { analysisId, layoutIndex (1-6), platform, token }
 * Returns: ZIP file as binary download.
 * Auth: viewToken (same as results page).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportLayout, type Platform } from "@/lib/exports/platform-exporter";

const PLATFORMS: Platform[] = ["html", "wordpress", "squarespace", "wix"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      analysisId,
      layoutIndex,
      platform,
      token,
    }: {
      analysisId?: string;
      layoutIndex?: number;
      platform?: string;
      token?: string;
    } = body;

    if (
      !analysisId ||
      typeof analysisId !== "string" ||
      !token ||
      typeof token !== "string" ||
      token.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing or invalid analysisId or token" },
        { status: 400 }
      );
    }

    const index = typeof layoutIndex === "number" ? layoutIndex : parseInt(String(layoutIndex), 10);
    if (!Number.isInteger(index) || index < 1 || index > 6) {
      return NextResponse.json(
        { error: "layoutIndex must be 1–6" },
        { status: 400 }
      );
    }

    if (!platform || !PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
        { status: 400 }
      );
    }

    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        viewToken: true,
        url: true,
        industryDetected: true,
        overallScore: true,
        layout1Html: true,
        layout1Css: true,
        layout2Html: true,
        layout2Css: true,
        layout3Html: true,
        layout3Css: true,
        layout4Html: true,
        layout4Css: true,
        layout5Html: true,
        layout5Css: true,
        layout6Html: true,
        layout6Css: true,
      },
    });

    if (!analysis || analysis.viewToken !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const layoutKeys = [
      "layout1Html",
      "layout1Css",
      "layout2Html",
      "layout2Css",
      "layout3Html",
      "layout3Css",
      "layout4Html",
      "layout4Css",
      "layout5Html",
      "layout5Css",
      "layout6Html",
      "layout6Css",
    ] as const;
    const i = (index - 1) * 2;
    const htmlKey = layoutKeys[i];
    const cssKey = layoutKeys[i + 1];
    const layoutHtml = (analysis[htmlKey] ?? "") as string;
    const layoutCss = (analysis[cssKey] ?? "") as string;

    if (!layoutHtml?.trim()) {
      return NextResponse.json(
        { error: "Layout not available for this analysis" },
        { status: 404 }
      );
    }

    const result = await exportLayout(
      platform as Platform,
      layoutHtml,
      layoutCss,
      `layout-${index}`,
      {
        url: analysis.url,
        industry: analysis.industryDetected ?? "Unknown",
        score: analysis.overallScore ?? 0,
      }
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (e) {
    console.error("Export error:", e);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
