/**
 * Structural quality validation for generated layout HTML.
 * Cheerio-based, instant, deterministic. Does NOT block persistence — logs issues for diagnostics.
 */

import * as cheerio from "cheerio";

export interface LayoutIssue {
  code: string;
  message: string;
  selector?: string;
}

export interface LayoutValidationResult {
  passed: boolean;
  issues: LayoutIssue[];
  warnings: LayoutIssue[];
}

/** Words that indicate an actionable CTA (not just a nav link). */
const CTA_WORDS = /\b(contact|call|book|schedule|quote|get started|sign up|subscribe|buy|order|request|free|consultation|estimate|appointment|demo|trial|learn more|read more|view|explore|discover|shop|donate|apply|register|download|try)\b/i;

export function validateLayoutQuality(html: string): LayoutValidationResult {
  const $ = cheerio.load(html);
  const issues: LayoutIssue[] = [];
  const warnings: LayoutIssue[] = [];

  // NO_CONTENT: body has minimal visible text
  const bodyEl = $("body").length ? $("body") : $.root().children();
  const bodyText = bodyEl
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (bodyText.length < 100) {
    issues.push({ code: "NO_CONTENT", message: `Layout has only ${bodyText.length} characters of visible text (minimum: 100)` });
  }

  // MISSING_H1
  if ($("h1").length === 0) {
    issues.push({ code: "MISSING_H1", message: "No <h1> heading found" });
  }

  // MISSING_CTA: look for links/buttons with actionable text outside of <nav>
  let hasCta = false;
  $("a, button").each((_, el) => {
    if (hasCta) return;
    const $el = $(el);
    if ($el.closest("nav").length) return;
    const text = $el.text().trim();
    if (CTA_WORDS.test(text)) hasCta = true;
  });
  if (!hasCta) {
    issues.push({ code: "MISSING_CTA", message: "No call-to-action link or button found outside navigation" });
  }

  // EMPTY_SECTION: sections with almost no content
  $("section").each((i, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 10) {
      issues.push({
        code: "EMPTY_SECTION",
        message: `Section ${i + 1} has only ${text.length} characters of text`,
        selector: `section:nth-of-type(${i + 1})`,
      });
    }
  });

  // SKIPPED_HEADING: heading hierarchy jumps
  const headings: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = (el as unknown as { tagName?: string }).tagName?.toLowerCase();
    if (tag) headings.push(parseInt(tag.charAt(1), 10));
  });
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      warnings.push({
        code: "SKIPPED_HEADING",
        message: `Heading hierarchy jumps from h${headings[i - 1]} to h${headings[i]}`,
      });
      break;
    }
  }

  // MISSING_NAV
  if ($("nav").length === 0) {
    warnings.push({ code: "MISSING_NAV", message: "No <nav> element found" });
  }

  // MISSING_FOOTER
  if ($("footer").length === 0) {
    warnings.push({ code: "MISSING_FOOTER", message: "No <footer> element found" });
  }

  // EXCESSIVE_SECTIONS
  const sectionCount = $("section").length;
  if (sectionCount > 10) {
    warnings.push({ code: "EXCESSIVE_SECTIONS", message: `${sectionCount} sections found (expected ≤ 10)` });
  }

  // NO_IMAGES
  if ($("img").length === 0) {
    warnings.push({ code: "NO_IMAGES", message: "No <img> elements in layout" });
  }

  // DUPLICATE_IMAGE: same src used 3+ times
  const srcCounts = new Map<string, number>();
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src && !src.startsWith("data:")) {
      srcCounts.set(src, (srcCounts.get(src) ?? 0) + 1);
    }
  });
  for (const [src, count] of srcCounts) {
    if (count >= 3) {
      warnings.push({
        code: "DUPLICATE_IMAGE",
        message: `Image used ${count} times: ${src.slice(0, 80)}`,
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}
