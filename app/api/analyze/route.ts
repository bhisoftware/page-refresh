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
  const rate = await analysisRateLimiter.check(ip);
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

          const PIPELINE_TIMEOUT_MS = 280_000; // 4m40s — gives 20s buffer before Vercel maxDuration (300s)
          let capturedRefreshId: string | null = null;
          try {
            const refreshId = await Promise.race([
              runAnalysis({
                url: normalizedUrl,
                onProgress: (p) => send({ type: "progress", ...p }),
                onRefreshCreated: (id) => { capturedRefreshId = id; },
              }),
              new Promise<string>((_, reject) =>
                setTimeout(
                  () => reject(new Error("PIPELINE_TIMEOUT")),
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
            // #region agent log
            fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "app/api/analyze/route.ts:sendDone", message: "SSE sending done", data: { refreshId, hasViewToken: !!viewToken }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
            // #endregion
            console.log("[analyze] pipeline completed, sending done", { refreshId });
            send({ type: "done", refreshId, viewToken });
          } catch (err) {
            clearInterval(keepaliveId);
            const message = err instanceof Error ? err.message : "Refresh failed";
            // #region agent log
            fetch("http://127.0.0.1:7245/ingest/44cb5644-87db-4ef0-a42f-a9477775a16b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0cecf2" }, body: JSON.stringify({ sessionId: "0cecf2", location: "app/api/analyze/route.ts:catch", message: "pipeline catch", data: { message, capturedRefreshId }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
            // #endregion

            // On timeout, redirect to partial results if a refresh record exists
            if (message === "PIPELINE_TIMEOUT" && capturedRefreshId) {
              console.warn("[analyze] pipeline timed out — redirecting to partial results", { capturedRefreshId });
              const { prisma } = await import("@/lib/prisma");
              await prisma.refresh.update({
                where: { id: capturedRefreshId },
                data: {
                  status: "complete",
                  errorStep: "generating",
                  errorMessage: "Pipeline timed out — partial results saved",
                },
              }).catch(() => {});
              const row = await prisma.refresh.findUnique({
                where: { id: capturedRefreshId },
                select: { viewToken: true },
              }).catch(() => null);
              send({ type: "done", refreshId: capturedRefreshId, viewToken: row?.viewToken ?? "" });
            } else {
              console.error("[analyze] pipeline error (SSE):", message);
              if (err instanceof Error && err.stack) console.error(err.stack);
              send({ type: "error", message });
            }
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
