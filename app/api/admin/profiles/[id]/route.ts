/**
 * PATCH /api/admin/profiles/[id] - Update editable UrlProfile fields.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const patchSchema = z.object({
  cms: z.string().nullable().optional(),
  cmsLocked: z.boolean().optional(),
  industry: z.string().nullable().optional(),
  industryLocked: z.boolean().optional(),
  customerEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  hostingPlatform: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const profile = await prisma.urlProfile.findUnique({ where: { id } });
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  // Build update data from provided fields only
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const updated = await prisma.urlProfile.update({
    where: { id },
    data,
  });

  return Response.json(updated);
}
