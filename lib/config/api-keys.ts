/**
 * DB-first, env-fallback API key resolution.
 * Providers: anthropic, openai, screenshotone. NOT netlify_blobs.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "./encryption";

const ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  screenshotone: "SCREENSHOTONE_API_KEY",
};

/**
 * Get API key for a provider. DB first (active ApiConfig with configKey "api_key"),
 * then env fallback. Throws if neither is set.
 */
export async function getApiKey(provider: string): Promise<string> {
  const row = await prisma.apiConfig.findFirst({
    where: {
      provider,
      configKey: "api_key",
      active: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (row) {
    const value = row.encrypted ? decrypt(row.configValue) : row.configValue;
    if (value) return value;
  }
  const envVar = ENV_MAP[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!;
  }
  throw new Error(`No API key configured for provider: ${provider}`);
}

/**
 * Get optional provider config (e.g. default_model, max_tokens).
 * DB first, then env, then defaultValue if provided.
 */
export async function getProviderConfig(
  provider: string,
  configKey: string,
  defaultValue?: string
): Promise<string | undefined> {
  const row = await prisma.apiConfig.findFirst({
    where: {
      provider,
      configKey,
      active: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (row) {
    const value = row.encrypted ? decrypt(row.configValue) : row.configValue;
    if (value) return value;
  }
  // No env map for arbitrary config keys; fall back to default
  return defaultValue;
}
