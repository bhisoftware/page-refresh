/**
 * Pre-flight check: verify URL is reachable and not bot-blocked before starting analysis.
 * Uses the same GET + Chrome User-Agent as the pipeline's fetchHtml so we see the same
 * 403/block that the analysis would see. Returns { ok: true } or { ok: false, error: string }.
 */

import { NextRequest } from "next/server";
import { normalizeWebsiteUrl } from "@/lib/utils";

const PREFLIGHT_TIMEOUT_MS = 12_000;
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return Response.json({ ok: false, error: "URL is required." }, { status: 400 });
  }
  const url = normalizeWebsiteUrl(raw.startsWith("http") ? raw : `https://${raw}`);
  try {
    new URL(url);
  } catch {
    return Response.json({ ok: false, error: "Please enter a valid URL." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: ACCEPT_HEADER,
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (res.status === 403 || res.status === 401) {
      return Response.json({
        ok: false,
        error: "This website blocks automated access.",
      });
    }
    if (res.status >= 500) {
      return Response.json({
        ok: false,
        error: "This website is temporarily unavailable. Try again later.",
      });
    }
    if (!res.ok) {
      return Response.json({
        ok: false,
        error: `This URL returned an error (${res.status}). We can't analyze it.`,
      });
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return Response.json({
        ok: false,
        error: "This URL did not return HTML. We can only analyze web pages.",
      });
    }
    await res.text();
    return Response.json({ ok: true });
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : "Could not reach URL.";
    if (msg.includes("abort") || msg.includes("timeout")) {
      return Response.json({
        ok: false,
        error: "This URL took too long to respond. Try again or use a simpler page.",
      });
    }
    return Response.json({
      ok: false,
      error: "We couldn't reach this website. Check the URL or try again later.",
    });
  }
}
