import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { encrypt } from "@/lib/config/encryption";

const ALLOWED_PROVIDERS = ["anthropic", "openai", "screenshotone"] as const;

function maskValue(value: string): string {
  if (value.length <= 4) return "••••";
  return value.slice(0, 4) + "..." + value.slice(-4);
}

/**
 * GET: List all configs grouped by provider. Mask encrypted values.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configs = await prisma.apiConfig.findMany({
    orderBy: [{ provider: "asc" }, { configKey: "asc" }, { sortOrder: "asc" }],
  });
  const byProvider: Record<string, Array<{ id: string; configKey: string; value: string; label: string | null; encrypted: boolean; active: boolean; updatedAt: string }>> = {};
  for (const c of configs) {
    let displayValue = c.configValue;
    if (c.encrypted) {
      try {
        const { decrypt } = await import("@/lib/config/encryption");
        displayValue = maskValue(decrypt(c.configValue));
      } catch {
        displayValue = "••••••••";
      }
    } else if (c.configKey === "api_key") {
      displayValue = maskValue(c.configValue);
    }
    if (!byProvider[c.provider]) byProvider[c.provider] = [];
    byProvider[c.provider].push({
      id: c.id,
      configKey: c.configKey,
      value: displayValue,
      label: c.label,
      encrypted: c.encrypted,
      active: c.active,
      updatedAt: c.updatedAt.toISOString(),
    });
  }
  return Response.json({ configs: byProvider });
}

/**
 * POST: Create or update config. Body: { provider, configKey, configValue, label?, encrypted? }
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { provider?: string; configKey?: string; configValue?: string; label?: string; encrypted?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const provider = body.provider?.toLowerCase();
  const configKey = body.configKey?.trim();
  const configValue = typeof body.configValue === "string" ? body.configValue : "";
  const label = body.label?.trim() ?? null;
  const encrypted = Boolean(body.encrypted);

  if (!provider || !ALLOWED_PROVIDERS.includes(provider as (typeof ALLOWED_PROVIDERS)[number])) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!configKey) {
    return Response.json({ error: "configKey required" }, { status: 400 });
  }

  const storedValue = encrypted && configValue ? encrypt(configValue) : configValue;

  const existing = await prisma.apiConfig.findFirst({
    where: { provider, configKey, label: label ?? undefined },
  });

  if (existing) {
    const updated = await prisma.apiConfig.update({
      where: { id: existing.id },
      data: { configValue: storedValue, encrypted, active: true },
    });
    return Response.json(updated);
  }

  const created = await prisma.apiConfig.create({
    data: {
      provider,
      configKey,
      configValue: storedValue,
      encrypted,
      label,
      active: true,
    },
  });
  return Response.json(created);
}
