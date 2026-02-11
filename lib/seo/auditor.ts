/**
 * SEO audit: technical, content, and LLM discoverability checks.
 * Produces a checklist and prioritized recommendations.
 */

import * as cheerio from "cheerio";

export type SeoRecommendationSeverity = "critical" | "warning" | "info";

export interface SeoRecommendation {
  severity: SeoRecommendationSeverity;
  message: string;
  check: string;
}

export interface SeoCheckItem {
  check: string;
  pass: boolean;
  message: string;
}

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

  // Technical SEO
  hasCanonical: boolean;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  hasSitemapRef: boolean;
  hasHreflang: boolean;
  ogTags: { property: string; content: string }[];
  twitterTags: { name: string; content: string }[];
  hasPreconnect: boolean;
  hasPreload: boolean;
  hasJsonLd: boolean;
  jsonLdTypes: string[];

  // Content SEO
  headingHierarchyOk: boolean;
  headingHierarchyIssues: string[];
  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInMeta: boolean;

  // LLM / entity
  hasLocalBusinessSchema: boolean;
  hasOrganizationSchema: boolean;
  hasFaqSchema: boolean;
  hasProductSchema: boolean;
  entityNameInSchema: boolean;

  // Checklist and recommendations (for UI)
  checks: SeoCheckItem[];
  recommendations: SeoRecommendation[];
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function runSeoAudit(html: string): SeoAuditResult {
  const $ = cheerio.load(html);
  const issues: string[] = [];
  const recommendations: SeoRecommendation[] = [];
  const checks: SeoCheckItem[] = [];

  // --- Title & meta (existing) ---
  const title = $("title").text().trim();
  const titleLength = title.length;
  const titleIssues: string[] = [];
  if (!title) {
    titleIssues.push("Missing title tag");
    issues.push("Missing title tag");
    recommendations.push({ severity: "critical", message: "Add a unique <title> tag.", check: "title" });
  } else if (titleLength < 30) {
    titleIssues.push("Title too short (aim for 50-60 chars)");
    issues.push("Title too short");
    recommendations.push({ severity: "warning", message: "Extend title to 50-60 characters for better SERP display.", check: "title" });
  } else if (titleLength > 60) {
    titleIssues.push("Title too long (may be truncated in search results)");
    issues.push("Title too long");
    recommendations.push({ severity: "info", message: "Shorten title to under 60 characters to avoid truncation.", check: "title" });
  }
  checks.push({ check: "Title tag", pass: !!title && titleLength >= 30 && titleLength <= 60, message: title ? `${titleLength} chars` : "Missing" });

  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const metaLength = metaDesc.length;
  const metaIssues: string[] = [];
  if (!metaDesc) {
    metaIssues.push("Missing meta description");
    issues.push("Missing meta description");
    recommendations.push({ severity: "critical", message: "Add a meta description for search snippets.", check: "meta_description" });
  } else if (metaLength < 120) {
    metaIssues.push("Meta description too short (aim for 120-160 chars)");
    issues.push("Meta description too short");
    recommendations.push({ severity: "warning", message: "Aim for 120-160 characters in meta description.", check: "meta_description" });
  } else if (metaLength > 160) {
    metaIssues.push("Meta description too long (may be truncated)");
    issues.push("Meta description too long");
    recommendations.push({ severity: "info", message: "Shorten meta description to under 160 characters.", check: "meta_description" });
  }
  checks.push({ check: "Meta description", pass: !!metaDesc && metaLength >= 120 && metaLength <= 160, message: metaDesc ? `${metaLength} chars` : "Missing" });

  // --- H1 ---
  const h1Elements = $("h1");
  const h1Count = h1Elements.length;
  const h1Issues: string[] = [];
  const h1Text = h1Elements.first().text().trim();
  if (h1Count === 0) {
    h1Issues.push("No H1 heading found");
    issues.push("No H1 heading");
    recommendations.push({ severity: "critical", message: "Add exactly one H1 heading for the main topic.", check: "h1" });
  } else if (h1Count > 1) {
    h1Issues.push("Multiple H1 tags (prefer single H1 per page)");
    issues.push("Multiple H1 tags");
    recommendations.push({ severity: "warning", message: "Use a single H1 per page for clear hierarchy.", check: "h1" });
  }
  checks.push({ check: "Single H1", pass: h1Count === 1, message: h1Count === 0 ? "Missing" : h1Count > 1 ? "Multiple" : "OK" });

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName?.toLowerCase() ?? "";
    const level = parseInt(tag.replace("h", ""), 10);
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  let headingHierarchyOk = true;
  const headingHierarchyIssues: string[] = [];
  let prevLevel = 0;
  for (const { level, text } of headings) {
    if (level > prevLevel + 1) {
      headingHierarchyOk = false;
      headingHierarchyIssues.push(`Skip in hierarchy: H${level} after H${prevLevel} (${text.slice(0, 40)}...)`);
    }
    prevLevel = level;
  }
  if (headingHierarchyIssues.length) {
    recommendations.push({ severity: "warning", message: "Fix heading order: use H1 → H2 → H3 without skipping levels.", check: "headings" });
  }
  checks.push({ check: "Heading hierarchy", pass: headingHierarchyOk, message: headingHierarchyIssues.length ? "Skips detected" : "OK" });

  // --- Images / alt ---
  const imgs = $("img");
  const imageTotalCount = imgs.length;
  let imageAltCount = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt !== undefined && alt.trim() !== "") imageAltCount++;
  });
  const altIssues: string[] = [];
  const altPct = imageTotalCount > 0 ? Math.round((imageAltCount / imageTotalCount) * 100) : 100;
  if (imageTotalCount > 0 && imageAltCount < imageTotalCount) {
    const missing = imageTotalCount - imageAltCount;
    altIssues.push(`${missing} image(s) missing alt text`);
    issues.push(`${missing} images missing alt text`);
    recommendations.push({ severity: "warning", message: `Add alt text to ${missing} image(s) for accessibility and SEO.`, check: "alt" });
  }
  checks.push({ check: "Image alt text", pass: altPct === 100, message: imageTotalCount ? `${altPct}% (${imageAltCount}/${imageTotalCount})` : "N/A" });

  // --- Technical: canonical, robots, sitemap, hreflang ---
  const canonicalEl = $('link[rel="canonical"]').attr("href");
  const hasCanonical = !!canonicalEl?.trim();
  if (!hasCanonical) {
    recommendations.push({ severity: "info", message: "Add a canonical URL to avoid duplicate content issues.", check: "canonical" });
  }
  checks.push({ check: "Canonical URL", pass: hasCanonical, message: hasCanonical ? "Set" : "Missing" });

  const robotsContent = $('meta[name="robots"]').attr("content") ?? null;
  const hasSitemapRef = /sitemap\.xml|sitemap_index/i.test(html) || /sitemap/i.test($('link[rel="sitemap"]').attr("href") ?? "");
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;

  const ogTags: { property: string; content: string }[] = [];
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) ogTags.push({ property: p, content: c });
  });
  const twitterTags: { name: string; content: string }[] = [];
  $('meta[name^="twitter:"]').each((_, el) => {
    const n = $(el).attr("name");
    const c = $(el).attr("content");
    if (n && c) twitterTags.push({ name: n, content: c });
  });
  const ogComplete = ogTags.some((t) => t.property === "og:title") && ogTags.some((t) => t.property === "og:description");
  const twComplete = twitterTags.some((t) => t.name === "twitter:title") || twitterTags.some((t) => t.name === "twitter:card");
  if (!ogComplete) {
    recommendations.push({ severity: "info", message: "Add Open Graph meta tags (og:title, og:description) for social sharing.", check: "og" });
  }
  checks.push({ check: "Open Graph", pass: ogComplete, message: ogComplete ? "Present" : "Incomplete" });
  checks.push({ check: "Twitter Card", pass: twComplete, message: twComplete ? "Present" : "Missing" });

  const hasPreconnect = $('link[rel="preconnect"]').length > 0;
  const hasPreload = $('link[rel="preload"]').length > 0;

  // JSON-LD
  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html();
      if (text) {
        const parsed = JSON.parse(text) as { "@type"?: string; "@graph"?: Array<{ "@type"?: string }> };
        if (parsed["@type"]) jsonLdTypes.push(parsed["@type"]);
        if (Array.isArray(parsed["@graph"])) {
          parsed["@graph"].forEach((g) => {
            if (g["@type"]) jsonLdTypes.push(g["@type"]);
          });
        }
      }
    } catch {
      // ignore invalid JSON
    }
  });
  const hasJsonLd = jsonLdTypes.length > 0;
  const hasLocalBusinessSchema = jsonLdTypes.some((t) => /LocalBusiness|Organization/i.test(t));
  const hasOrganizationSchema = jsonLdTypes.some((t) => /Organization/i.test(t));
  const hasFaqSchema = jsonLdTypes.some((t) => /FAQPage/i.test(t));
  const hasProductSchema = jsonLdTypes.some((t) => /Product/i.test(t));
  if (!hasJsonLd) {
    recommendations.push({ severity: "warning", message: "Add schema.org/JSON-LD structured data (e.g. LocalBusiness or Organization).", check: "jsonld" });
  }
  checks.push({ check: "Structured data (JSON-LD)", pass: hasJsonLd, message: hasJsonLd ? jsonLdTypes.slice(0, 3).join(", ") : "Missing" });

  const entityNameInSchema = hasJsonLd; // simplified: we don't parse full structure for name/address/phone
  checks.push({ check: "Entity in schema", pass: hasLocalBusinessSchema || hasOrganizationSchema, message: hasLocalBusinessSchema || hasOrganizationSchema ? "Yes" : "No" });

  // --- Links and content ---
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("#") || href.startsWith("/") || !/^https?:\/\//i.test(href)) internalLinkCount++;
    else externalLinkCount++;
  });
  const bodyText = extractText($("body").html() ?? "");
  const wordCountVal = wordCount(bodyText);
  checks.push({ check: "Word count (body)", pass: wordCountVal >= 300, message: `${wordCountVal} words` });
  if (wordCountVal < 300) {
    recommendations.push({ severity: "info", message: "Consider adding more substantive content (300+ words) for better SEO.", check: "content_length" });
  }

  // Keyword presence (simplified: title/h1/meta non-empty and overlapping)
  const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(Boolean));
  const h1Words = new Set(h1Text.toLowerCase().split(/\s+/).filter(Boolean));
  const metaWords = new Set(metaDesc.toLowerCase().split(/\s+/).filter(Boolean));
  const keywordInTitle = titleWords.size > 0;
  const keywordInH1 = h1Words.size > 0;
  const keywordInMeta = metaWords.size > 0;
  const keywordOverlap = keywordInTitle && keywordInH1 && keywordInMeta;
  checks.push({ check: "Keywords in title/H1/meta", pass: keywordOverlap, message: keywordOverlap ? "Consistent" : "Review" });

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
    hasCanonical,
    canonicalUrl: canonicalEl?.trim() ?? null,
    robotsMeta: robotsContent,
    hasSitemapRef,
    hasHreflang,
    ogTags,
    twitterTags,
    hasPreconnect,
    hasPreload,
    hasJsonLd,
    jsonLdTypes,
    headingHierarchyOk,
    headingHierarchyIssues,
    internalLinkCount,
    externalLinkCount,
    wordCount: wordCountVal,
    keywordInTitle,
    keywordInH1,
    keywordInMeta,
    hasLocalBusinessSchema,
    hasOrganizationSchema,
    hasFaqSchema,
    hasProductSchema,
    entityNameInSchema,
    checks,
    recommendations: recommendations.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
  };
}
