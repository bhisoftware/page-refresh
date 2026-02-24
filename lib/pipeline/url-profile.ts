/**
 * URL normalization and find-or-create UrlProfile.
 * Cooldown/cache logic is Phase 2 — this module only provides findOrCreateUrlProfile.
 */

import type { UrlProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STRIP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
]);

/**
 * Normalize URL for consistent storage and lookup.
 * Returns hostname + pathname (no protocol, no query). Trailing slash stripped except for root.
 */
export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  const searchParams = url.searchParams;
  const filtered = new URLSearchParams();
  for (const [k, v] of searchParams) {
    if (!STRIP_PARAMS.has(k.toLowerCase())) {
      filtered.set(k, v);
    }
  }
  const query = filtered.toString();
  const path = pathname || "/";
  return query ? `${hostname}${path}?${query}` : `${hostname}${path}`;
}

/**
 * Extract domain (hostname without www) from a URL.
 */
export function extractDomain(rawUrl: string): string {
  const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }
  return hostname;
}

/**
 * Find or create UrlProfile by normalized URL. No cooldown enforcement (Phase 2).
 */
export async function findOrCreateUrlProfile(rawUrl: string): Promise<UrlProfile> {
  const url = normalizeUrl(rawUrl);
  const domain = extractDomain(rawUrl);
  return prisma.urlProfile.upsert({
    where: { url },
    create: { url, domain },
    update: {},
  });
}
