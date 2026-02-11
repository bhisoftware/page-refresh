/**
 * Basic SEO audit: title, meta description, headings, image alt tags.
 */

import * as cheerio from "cheerio";

export interface SeoAuditResult {
  title: string;
  titleLength: number;
  titleIssues: string[];
  metaDescription: string;
  metaLength: number;
  metaIssues: string[];
  h1Count: number;
  h1Issues: string[];
  headings: { level: number; text: string }[];
  imageAltCount: number;
  imageTotalCount: number;
  altIssues: string[];
  issues: string[];
}

export function runSeoAudit(html: string): SeoAuditResult {
  const $ = cheerio.load(html);
  const issues: string[] = [];

  const title = $("title").text().trim();
  const titleLength = title.length;
  const titleIssues: string[] = [];
  if (!title) {
    titleIssues.push("Missing title tag");
    issues.push("Missing title tag");
  } else if (titleLength < 30) {
    titleIssues.push("Title too short (aim for 50-60 chars)");
    issues.push("Title too short");
  } else if (titleLength > 60) {
    titleIssues.push("Title too long (may be truncated in search results)");
    issues.push("Title too long");
  }

  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const metaLength = metaDesc.length;
  const metaIssues: string[] = [];
  if (!metaDesc) {
    metaIssues.push("Missing meta description");
    issues.push("Missing meta description");
  } else if (metaLength < 120) {
    metaIssues.push("Meta description too short (aim for 120-160 chars)");
    issues.push("Meta description too short");
  } else if (metaLength > 160) {
    metaIssues.push("Meta description too long (may be truncated)");
    issues.push("Meta description too long");
  }

  const h1Elements = $("h1");
  const h1Count = h1Elements.length;
  const h1Issues: string[] = [];
  if (h1Count === 0) {
    h1Issues.push("No H1 heading found");
    issues.push("No H1 heading");
  } else if (h1Count > 1) {
    h1Issues.push("Multiple H1 tags (prefer single H1 per page)");
    issues.push("Multiple H1 tags");
  }

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName?.toLowerCase() ?? "";
    const level = parseInt(tag.replace("h", ""), 10);
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  const imgs = $("img");
  const imageTotalCount = imgs.length;
  let imageAltCount = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt !== undefined && alt.trim() !== "") imageAltCount++;
  });

  const altIssues: string[] = [];
  if (imageTotalCount > 0 && imageAltCount < imageTotalCount) {
    const missing = imageTotalCount - imageAltCount;
    altIssues.push(`${missing} image(s) missing alt text`);
    issues.push(`${missing} images missing alt text`);
  }

  return {
    title,
    titleLength,
    titleIssues,
    metaDescription: metaDesc,
    metaLength,
    metaIssues,
    h1Count,
    h1Issues,
    headings,
    imageAltCount,
    imageTotalCount,
    altIssues,
    issues,
  };
}
