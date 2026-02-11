/**
 * Create or replace the universal scoring rubric (8 dimensions × 5 ranges).
 * Run: npx tsx scripts/create-scoring-rubric.ts
 */
import { PrismaClient } from "@prisma/client";
import { getRubricEntries } from "../lib/seed-data/scoring-rubric";

const prisma = new PrismaClient();

async function main() {
  await prisma.scoringRubric.deleteMany({});
  const entries = getRubricEntries();
  await prisma.scoringRubric.createMany({
    data: entries.map(({ dimension, scoreRange, criteria }) => ({
      dimension,
      scoreRange,
      criteria: criteria as object,
    })),
  });
  console.log(`Created ${entries.length} scoring rubric entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
