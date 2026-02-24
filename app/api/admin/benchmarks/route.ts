import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { benchmarkCreateSchema } from "@/lib/validations";

/**
 * GET: Paginated benchmark list. Query: page, limit, industry.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50)));
  const industry = request.nextUrl.searchParams.get("industry")?.trim() || undefined;
  const skip = (page - 1) * limit;

  const where = industry ? { industry } : {};
  const [items, total] = await Promise.all([
    prisma.benchmark.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { notes: true } } },
    }),
    prisma.benchmark.count({ where }),
  ]);

  return Response.json({ items, total, page, limit });
}

/**
 * POST: Add benchmark URL + industry. Does not trigger scoring.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = benchmarkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { url, industry } = parsed.data;
  const domain = url.replace(/^https?:\/\//, "").split("/")[0] ?? "";

  const created = await prisma.benchmark.create({
    data: { url, industry, domain },
  });
  return Response.json(created);
}
