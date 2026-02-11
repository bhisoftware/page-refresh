/**
 * Create or update 20 industries with scoring criteria.
 * Run: npx tsx scripts/create-industries.ts
 * Requires: Templates to exist (run seed or import-templates first) so preferredTemplates can resolve to IDs.
 */
import { PrismaClient } from "@prisma/client";
import { INDUSTRIES } from "../lib/seed-data/industries";

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.template.findMany({ select: { id: true, name: true } });
  const templateIdsByName: Record<string, string> = Object.fromEntries(
    templates.map((t) => [t.name, t.id])
  );

  for (const ind of INDUSTRIES) {
    const preferredIds = ind.preferredTemplates
      .map((name) => templateIdsByName[name])
      .filter(Boolean);
    await prisma.industry.upsert({
      where: { name: ind.name },
      create: {
        name: ind.name,
        description: ind.description,
        scoringCriteria: ind.scoringCriteria as object,
        preferredTemplates: preferredIds.length ? preferredIds : [],
      },
      update: {
        description: ind.description,
        scoringCriteria: ind.scoringCriteria as object,
        preferredTemplates: preferredIds.length ? preferredIds : [],
      },
    });
  }
  console.log(`Created/updated ${INDUSTRIES.length} industries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
