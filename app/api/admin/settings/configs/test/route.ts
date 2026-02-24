import { NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getApiKey } from "@/lib/config/api-keys";

const TEST_RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const MAX_TESTS_PER_MINUTE = 5;

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "admin";
  return "admin";
}

/**
 * POST: Test provider API connection. Body: { provider: string }
 * Response: { success: boolean, error?: string, latency?: number }
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = getClientId(request);
  const now = Date.now();
  const window = TEST_RATE_LIMIT.get(clientId);
  if (window) {
    if (now < window.resetAt) {
      if (window.count >= MAX_TESTS_PER_MINUTE) {
        return Response.json(
          { success: false, error: "Rate limit: max 5 tests per minute" },
          { status: 429 }
        );
      }
      window.count++;
    } else {
      TEST_RATE_LIMIT.set(clientId, { count: 1, resetAt: now + 60_000 });
    }
  } else {
    TEST_RATE_LIMIT.set(clientId, { count: 1, resetAt: now + 60_000 });
  }

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const provider = body.provider?.toLowerCase();
  if (!provider || !["anthropic", "openai", "screenshotone"].includes(provider)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }

  const start = Date.now();
  try {
    if (provider === "anthropic") {
      const apiKey = await getApiKey("anthropic");
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      });
    } else if (provider === "openai") {
      const apiKey = await getApiKey("openai");
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.models.list();
    } else if (provider === "screenshotone") {
      const apiKey = await getApiKey("screenshotone");
      const url = `https://api.screenshotone.com/take?access_key=${encodeURIComponent(apiKey)}&url=https://example.com&viewport_width=1280`;
      const res = await fetch(url);
      if (!res.ok && res.status !== 400) {
        throw new Error(`API returned ${res.status}`);
      }
    }
    const latency = Date.now() - start;
    return Response.json({ success: true, latency });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message });
  }
}
