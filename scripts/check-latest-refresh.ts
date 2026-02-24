import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.refresh.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      createdAt: true,
      overallScore: true,
      layout1Template: true,
      layout1Html: true,
      layout2Template: true,
      layout2Html: true,
      layout3Template: true,
      layout3Html: true,
      processingTime: true,
    },
  });
  if (!r) {
    console.log("No refreshes found");
    return;
  }
  console.log("Latest refresh:");
  console.log("  ID:", r.id);
  console.log("  URL:", r.url);
  console.log("  Created:", r.createdAt);
  console.log("  Score:", r.overallScore);
  console.log("  Processing time:", r.processingTime, "s");
  console.log("  Layout 1:", r.layout1Template, "|", r.layout1Html?.length ?? 0, "chars");
  console.log("  Layout 2:", r.layout2Template, "|", r.layout2Html?.length ?? 0, "chars");
  console.log("  Layout 3:", r.layout3Template, "|", r.layout3Html?.length ?? 0, "chars");
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
