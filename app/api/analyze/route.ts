/**
 * Main analysis endpoint. Accepts URL, runs full pipeline, returns analysis ID.
 * Supports SSE for progress updates.
 */

import { NextRequest } from "next/server";
import { normalizeWebsiteUrl } from "@/lib/utils";
import { runAnalysis } from "@/lib/pipeline/analyze";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  console.log("[analyze] POST received");
  const body = await request.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return Response.json(
      { error: "Missing required field: url" },
      { status: 400 }
    );
  }

  const normalizedUrl = normalizeWebsiteUrl(url);
  console.log("[analyze] received URL:", normalizedUrl);

  try {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const analysisId = await runAnalysis({
              url: normalizedUrl,
              onProgress: (p) => send({ type: "progress", ...p }),
            });
            const { prisma } = await import("@/lib/prisma");
            const row = await prisma.analysis.findUnique({
              where: { id: analysisId },
              select: { viewToken: true },
            });
            const viewToken = row?.viewToken ?? "";
            send({ type: "done", analysisId, viewToken });
          } catch (err) {
            send({
              type: "error",
              message: err instanceof Error ? err.message : "Analysis failed",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const analysisId = await runAnalysis({ url: normalizedUrl });
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { viewToken: true },
    });
    return Response.json({
      analysisId,
      viewToken: row?.viewToken ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
