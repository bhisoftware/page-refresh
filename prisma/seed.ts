import { PrismaClient } from "@prisma/client";
import { getRubricEntries } from "../lib/seed-data/scoring-rubric";
import { INDUSTRIES } from "../lib/seed-data/industries";
import { TEMPLATES } from "../lib/seed-data/templates";

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

  // 2. Templates (20)
  const templateIdsByName: Record<string, string> = {};
  for (const t of TEMPLATES) {
    const created = await prisma.template.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        description: t.description,
        category: t.category,
        htmlTemplate: t.htmlTemplate,
        cssTemplate: t.cssTemplate,
        suitableIndustries: t.suitableIndustries,
      },
      update: {
        description: t.description,
        category: t.category,
        htmlTemplate: t.htmlTemplate,
        cssTemplate: t.cssTemplate,
        suitableIndustries: t.suitableIndustries,
      },
    });
    templateIdsByName[t.name] = created.id;
  }
  console.log(`  Created/updated ${TEMPLATES.length} templates.`);

  // 3. Industries (20) - resolve preferredTemplates to template IDs
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
  console.log(`  Created/updated ${INDUSTRIES.length} industries.`);

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
