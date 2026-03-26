import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { discoverCompetitorSites } from "@/lib/exa/discover-competitors";

/**
 * POST: Discover competitor sites via EXA and optionally create benchmarks.
 * Body: { industry: string, count?: number, create?: boolean }
 *
 * If create is false (default), returns discovered URLs for preview.
 * If create is true, creates unscored Benchmark records.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { industry?: string; count?: number; create?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const industry = body.industry?.trim();
  if (!industry) {
    return Response.json({ error: "industry is required" }, { status: 400 });
  }
  const count = Math.min(20, Math.max(1, body.count ?? 10));

  try {
    const discovered = await discoverCompetitorSites(industry, count);

    if (!body.create) {
      return Response.json({ industry, discovered });
    }

    // Create benchmark records for each discovered site
    const created = await Promise.all(
      discovered.map((site) => {
        const domain = new URL(site.url).hostname.replace(/^www\./, "");
        return prisma.benchmark.create({
          data: {
            url: site.url,
            industry,
            domain,
            siteName: site.title,
          },
        });
      })
    );

    return Response.json({
      industry,
      created: created.map((b) => ({ id: b.id, url: b.url, domain: b.domain })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}
