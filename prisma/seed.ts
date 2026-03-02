import { PrismaClient } from "@prisma/client";
import { getRubricEntries } from "../lib/seed-data/scoring-rubric";
import { INDUSTRIES, getIndustryDimensionWeights } from "../lib/seed-data/industries";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Scoring rubric (8 dimensions × 5 ranges = 40 entries)
  await prisma.scoringRubric.deleteMany({});
  const rubricEntries = getRubricEntries();
  await prisma.scoringRubric.createMany({
    data: rubricEntries.map(({ dimension, scoreRange, criteria }) => ({
      dimension,
      scoreRange,
      criteria: criteria as object,
    })),
  });
  console.log(`  Created ${rubricEntries.length} scoring rubric entries.`);

  // 2. Industries (20) - merge dimensionWeights into scoringCriteria
  for (const ind of INDUSTRIES) {
    const scoringCriteriaWithWeights = {
      ...ind.scoringCriteria,
      dimensionWeights: getIndustryDimensionWeights(ind),
    };
    await prisma.industry.upsert({
      where: { name: ind.name },
      create: {
        name: ind.name,
        description: ind.description,
        scoringCriteria: scoringCriteriaWithWeights as object,
        preferredTemplates: [],
      },
      update: {
        description: ind.description,
        scoringCriteria: scoringCriteriaWithWeights as object,
      },
    });
  }
  console.log(`  Created/updated ${INDUSTRIES.length} industries.`);

  // 3. Default app settings
  await prisma.appSetting.upsert({
    where: { key: "analysis_cooldown_days" },
    create: { key: "analysis_cooldown_days", value: "30" },
    update: {},
  });
  console.log("  Seeded default app settings.");

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
