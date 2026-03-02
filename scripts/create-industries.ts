/**
 * Create or update 20 industries with scoring criteria.
 * Run: npx tsx scripts/create-industries.ts
 */
import { PrismaClient } from "@prisma/client";
import { INDUSTRIES } from "../lib/seed-data/industries";

const prisma = new PrismaClient();

async function main() {
  for (const ind of INDUSTRIES) {
    await prisma.industry.upsert({
      where: { name: ind.name },
      create: {
        name: ind.name,
        description: ind.description,
        scoringCriteria: ind.scoringCriteria as object,
        preferredTemplates: [],
      },
      update: {
        description: ind.description,
        scoringCriteria: ind.scoringCriteria as object,
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
