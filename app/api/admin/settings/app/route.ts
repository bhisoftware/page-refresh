import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/**
 * GET: Return all app settings as { [key]: value }.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.appSetting.findMany();
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return Response.json(settings);
}

/**
 * PATCH: Upsert a single app setting { key, value }.
 */
export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== "string" || typeof body.value !== "string") {
    return Response.json({ error: "Invalid body — expected { key, value }" }, { status: 400 });
  }
  const { key, value } = body;
  const row = await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  return Response.json(row);
}
