/**
 * HMAC-signed endpoint that renders a layout's HTML+CSS as a full page.
 * Used by ScreenshotOne to capture "after" screenshots for the showcase marquee.
 *
 * Query params: ?refreshId=<id>&layout=1|2|3&sig=<hmac-hex>
 * Signature: HMAC-SHA256(SHOWCASE_HMAC_SECRET, "<refreshId>:<layoutIndex>")
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function verifyRenderToken(
  refreshId: string,
  layoutIndex: string,
  sig: string
): boolean {
  const secret = process.env.SHOWCASE_HMAC_SECRET;
  if (!secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${refreshId}:${layoutIndex}`)
      .digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refreshId = searchParams.get("refreshId");
  const layout = searchParams.get("layout");
  const sig = searchParams.get("sig");

  if (!refreshId || !layout || !sig || !verifyRenderToken(refreshId, layout, sig)) {
    return new Response("Forbidden", { status: 403 });
  }

  const idx = parseInt(layout, 10);
  if (![1, 2, 3].includes(idx)) {
    return new Response("Bad Request", { status: 400 });
  }

  const htmlKey = `layout${idx}Html` as "layout1Html" | "layout2Html" | "layout3Html";
  const cssKey = `layout${idx}Css` as "layout1Css" | "layout2Css" | "layout3Css";

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: {
      layout1Html: true, layout1Css: true,
      layout2Html: true, layout2Css: true,
      layout3Html: true, layout3Css: true,
    },
  });

  if (!refresh) {
    return new Response("Not Found", { status: 404 });
  }

  const html = refresh[htmlKey];
  const css = refresh[cssKey];

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1440">
  <style>${css}</style>
</head>
<body style="margin:0;padding:0;">${html}</body>
</html>`;

  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
