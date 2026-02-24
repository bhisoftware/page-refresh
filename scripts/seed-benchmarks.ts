/**
 * Seed Benchmark records with placeholder URLs (unscored).
 * Run: npx tsx scripts/seed-benchmarks.ts
 * Admins can then replace URLs or add real ones and run "Score" from the dashboard.
 */
import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/seed-data/industries";

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 24);
}

async function main() {
  let created = 0;
  for (const ind of INDUSTRIES) {
    const base = slug(ind.name);
    for (let i = 1; i <= 3; i++) {
      const url = `https://${base}-example-${i}.com`;
      const exists = await prisma.benchmark.findFirst({ where: { url, industry: ind.name } });
      if (!exists) {
        await prisma.benchmark.create({ data: { url, industry: ind.name } });
        created++;
      }
    }
  }
  console.log(`Seeded ${created} benchmark placeholders (unscored).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
