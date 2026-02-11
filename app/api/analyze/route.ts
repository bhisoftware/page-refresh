/**
 * Main analysis endpoint. Accepts URL, runs full pipeline, returns analysis ID.
 * Supports SSE for progress updates. Rate limited (5 req/min per IP).
 */

import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/pipeline/analyze";
import { analysisRateLimiter } from "@/lib/rate-limiter";
import { analyzeSchema } from "@/lib/validations";

export const maxDuration = 120;

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
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const refreshId = await runAnalysis({
              url: normalizedUrl,
              onProgress: (p) => send({ type: "progress", ...p }),
            });
            const { prisma } = await import("@/lib/prisma");
            const row = await prisma.refresh.findUnique({
              where: { id: refreshId },
              select: { viewToken: true },
            });
            const viewToken = row?.viewToken ?? "";
            send({ type: "done", refreshId, viewToken });
          } catch (err) {
            send({
              type: "error",
              message: err instanceof Error ? err.message : "Refresh failed",
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
    return Response.json({ error: message }, { status: 500 });
  }
}
