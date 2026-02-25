/**
 * Main analysis endpoint. Accepts URL, runs full pipeline, returns analysis ID.
 * Supports SSE for progress updates. Rate limited (5 req/min per IP).
 */

import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/pipeline/analyze";
import { analysisRateLimiter } from "@/lib/rate-limiter";
import { analyzeSchema } from "@/lib/validations";

export const maxDuration = 300;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(request: NextRequest) {
  console.log("[analyze] POST received");
  const ip = getClientIp(request);
  const rate = analysisRateLimiter.check(ip);
  if (!rate.allowed) {
    const retryAfterSec = Math.ceil((rate.retryAfterMs ?? 60_000) / 1000);
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Too many requests. Please try again later." })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        status: 429,
        headers: {
          "Content-Type": "text/event-stream",
          "Retry-After": String(retryAfterSec),
          "Cache-Control": "no-cache",
        },
      });
    }
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { url: normalizedUrl } = parsed.data;
  console.log("[analyze] received URL:", normalizedUrl);

  try {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      const KEEPALIVE_INTERVAL_MS = 25_000; // Vercel closes stream after ~60s idle
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (data: object) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch (e) {
              console.warn("[analyze] SSE send failed (stream likely closed):", e);
            }
          };

          const keepaliveId = setInterval(() => send({ type: "keepalive" }), KEEPALIVE_INTERVAL_MS);

          const PIPELINE_TIMEOUT_MS = 240_000; // 4 min so we send error before Vercel maxDuration (300s)
          try {
            const refreshId = await Promise.race([
              runAnalysis({
                url: normalizedUrl,
                onProgress: (p) => send({ type: "progress", ...p }),
              }),
              new Promise<string>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Analysis timed out. Please try again.")),
                  PIPELINE_TIMEOUT_MS
                )
              ),
            ]);
            clearInterval(keepaliveId);
            const { prisma } = await import("@/lib/prisma");
            const row = await prisma.refresh.findUnique({
              where: { id: refreshId },
              select: { viewToken: true },
            });
            const viewToken = row?.viewToken ?? "";
            console.log("[analyze] pipeline completed, sending done", { refreshId });
            send({ type: "done", refreshId, viewToken });
          } catch (err) {
            clearInterval(keepaliveId);
            const message = err instanceof Error ? err.message : "Refresh failed";
            console.error("[analyze] pipeline error (SSE):", message);
            if (err instanceof Error && err.stack) console.error(err.stack);
            send({ type: "error", message });
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

    const refreshId = await runAnalysis({ url: normalizedUrl });
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.refresh.findUnique({
      where: { id: refreshId },
      select: { viewToken: true },
    });
    return Response.json({
      refreshId,
      viewToken: row?.viewToken ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    console.error("[analyze] 500 error:", message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return Response.json({ error: message }, { status: 500 });
  }
}
