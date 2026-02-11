/**
 * POST /api/export
 * Body: { refreshId, layoutIndex (1-6, optional), platform, token }
 * Returns: ZIP file as binary download (full page = all 6 sections combined).
 * Auth: viewToken (same as results page).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportLayout, type Platform } from "@/lib/exports/platform-exporter";
import { exportSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { refreshId, platform, token } = parsed.data;

    const refresh = await prisma.refresh.findUnique({
      where: { id: refreshId },
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

    if (!refresh || refresh.viewToken !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const htmlKeys = ["layout1Html", "layout2Html", "layout3Html", "layout4Html", "layout5Html", "layout6Html"] as const;
    const cssKeys = ["layout1Css", "layout2Css", "layout3Css", "layout4Css", "layout5Css", "layout6Css"] as const;
    const fullPageParts: string[] = [];
    const fullPageCssParts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const html = (refresh[htmlKeys[i]] ?? "") as string;
      if (!html?.trim()) continue;
      fullPageParts.push(html.trim());
      fullPageCssParts.push(((refresh[cssKeys[i]] ?? "") as string).trim());
    }
    const fullPageHtml = fullPageParts.join("\n");
    const fullPageCss = fullPageCssParts.join("\n\n");

    if (!fullPageHtml) {
      return NextResponse.json(
        { error: "Layout not available for this refresh" },
        { status: 404 }
      );
    }

    const result = await exportLayout(
      platform as Platform,
      fullPageHtml,
      fullPageCss,
      "full-page",
      {
        url: refresh.url,
        industry: refresh.industryDetected ?? "Unknown",
        score: refresh.overallScore ?? 0,
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
