/**
 * Import templates into the database.
 * - If TEMPLATES_MD_DIR env is set, reads markdown files from that directory and parses HTML/CSS.
 * - Otherwise, seeds the 20 built-in templates from lib/seed-data/templates.ts.
 *
 * Run: npx tsx scripts/import-templates.ts
 * Or:  TEMPLATES_MD_DIR=/path/to/markdown npx tsx scripts/import-templates.ts
 */
import { PrismaClient } from "@prisma/client";
import { TEMPLATES } from "../lib/seed-data/templates";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function parseMarkdownTemplate(filePath: string): {
  name: string;
  description: string;
  category: string;
  html: string;
  css: string;
} | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const name = path.basename(filePath, ".md").replace(/-template$/, "");
  // Simple extraction: first ```html block and first ```css block (or ```)
  const htmlMatch = content.match(/```(?:html)?\s*([\s\S]*?)```/);
  const cssMatch = content.match(/```(?:css)?\s*([\s\S]*?)```/g);
  const html = htmlMatch ? htmlMatch[1].trim() : "";
  const css = cssMatch && cssMatch[1] ? cssMatch[1].replace(/```(?:css)?\s*/, "").trim() : "";
  if (!html) return null;
  const descMatch = content.match(/^#\s+.+[\r\n]+([^\r\n#]+)/m);
  return {
    name: name || path.basename(filePath, ".md"),
    description: descMatch ? descMatch[1].trim() : "Imported template",
    category: "hero",
    html,
    css: css || "/* no css */",
  };
}

async function main() {
  const dir = process.env.TEMPLATES_MD_DIR;
  if (dir && fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    let count = 0;
    for (const file of files) {
      const parsed = parseMarkdownTemplate(path.join(dir, file));
      if (!parsed) continue;
      await prisma.template.upsert({
        where: { name: parsed.name },
        create: {
          name: parsed.name,
          description: parsed.description,
          category: parsed.category,
          htmlTemplate: parsed.html,
          cssTemplate: parsed.css,
          suitableIndustries: [],
        },
        update: {
          description: parsed.description,
          category: parsed.category,
          htmlTemplate: parsed.html,
          cssTemplate: parsed.css,
        },
      });
      count++;
    }
    console.log(`Imported ${count} templates from ${dir}.`);
    return;
  }

  // Built-in seed templates
  for (const t of TEMPLATES) {
    await prisma.template.upsert({
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
  }
  console.log(`Created/updated ${TEMPLATES.length} built-in templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
