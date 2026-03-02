import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  refreshId: z.string().min(1),
  date: z.string().min(1),
  timeSlot: z.enum(["morning", "afternoon", "evening"]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { refreshId, date, timeSlot, notes } = parsed.data;

  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: { id: true, stripePaymentStatus: true, notes: true },
  });

  if (!refresh) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (refresh.stripePaymentStatus !== "paid") {
    return Response.json({ error: "Payment required" }, { status: 403 });
  }

  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      bookingDate: new Date(date),
      bookingTimeSlot: timeSlot,
      bookingConfirmed: true,
      notes:
        [refresh.notes, notes ? `Install notes: ${notes}` : null]
          .filter(Boolean)
          .join("\n") || undefined,
    },
  });

  return Response.json({ success: true });
}
