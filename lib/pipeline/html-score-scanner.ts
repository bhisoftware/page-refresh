/**
 * Scans generated HTML for leaked scoring/analysis data.
 * Extracts visible text (strips tags, <style>, <script>) and checks
 * against known patterns. stripLeakedContent() actively removes leaks.
 */

import * as cheerio from "cheerio";

export interface ScanMatch {
  pattern: string;
  text: string;
  confidence: "high" | "medium";
}

export interface ScanResult {
  hasHighConfidenceLeaks: boolean;
  matches: ScanMatch[];
}

/** Strip HTML to visible text only. */
function extractVisibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

const HIGH_CONFIDENCE: Array<{ pattern: RegExp; label: string }> = [
  // Score fractions: "42/100", "65 out of 100"
  { pattern: /\b\d{1,3}\s*\/\s*100\b/g, label: "score-fraction" },
  { pattern: /\bscor(?:e|ed|ing)\s*[:=]?\s*\d{1,3}\b/gi, label: "score-label" },
  { pattern: /\b\d{1,3}\s+out\s+of\s+100\b/gi, label: "score-out-of" },

  // creativeBrief field names as visible text
  { pattern: /\buserScore\b/g, label: "field-userScore" },
  { pattern: /\bindustryAvg\b/g, label: "field-industryAvg" },
  { pattern: /\bcreativeBrief\b/g, label: "field-creativeBrief" },
  { pattern: /\bscoring\s*details?\b/gi, label: "field-scoringDetails" },

  // PageRefresh branding in generated layout
  { pattern: /\bPageRefresh\b/g, label: "branding-PageRefresh" },
  { pattern: /\bpage[-\s]refresh\b/gi, label: "branding-page-refresh" },
  { pattern: /\bpagerefresh\.ai\b/gi, label: "branding-domain" },

  // Dimension name + number combos: "clarity: 42", "trust score 65"
  { pattern: /\b(?:clarity|hierarchy|conversion|visual\s*density)\s*[:=]\s*\d/gi, label: "dimension-with-score" },

  // "industry average" as visible text
  { pattern: /\bindustry\s+average\b/gi, label: "industry-average-text" },

  // "X points below/above" benchmark language
  { pattern: /\d+\s+points?\s+(?:below|above|behind|ahead)\b/gi, label: "benchmark-gap-language" },

  // Dimension + percentage: "clarity 42%", "conversion 65%"
  { pattern: /\b(?:clarity|hierarchy|conversion|visual|trust|content|mobile|performance)\s+\d{1,3}%/gi, label: "dimension-percentage" },
];

const MEDIUM_CONFIDENCE: Array<{ pattern: RegExp; label: string }> = [
  // Bare dimension names unusual in business copy
  { pattern: /\bclarity\b/gi, label: "dimension-clarity" },
  { pattern: /\bhierarchy\b/gi, label: "dimension-hierarchy" },
  { pattern: /\bconversion\b/gi, label: "dimension-conversion" },
  { pattern: /\bvisual\s+density\b/gi, label: "dimension-visual-density" },

  // Analysis terms
  { pattern: /\bbenchmark\b/gi, label: "term-benchmark" },
  { pattern: /\bpercentile\b/gi, label: "term-percentile" },
];

export function scanHtmlForLeakedScores(html: string): ScanResult {
  const visibleText = extractVisibleText(html);
  const matches: ScanMatch[] = [];

  for (const { pattern, label } of HIGH_CONFIDENCE) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(visibleText)) !== null) {
      matches.push({ pattern: label, text: m[0], confidence: "high" });
    }
  }

  for (const { pattern, label } of MEDIUM_CONFIDENCE) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(visibleText)) !== null) {
      matches.push({ pattern: label, text: m[0], confidence: "medium" });
    }
  }

  return {
    hasHighConfidenceLeaks: matches.some((m) => m.confidence === "high"),
    matches,
  };
}

/** Dangerous href patterns that should never appear in generated layouts. */
const DANGEROUS_HREF_RE = /pagerefresh|\/analysis|\/admin|\/results/i;

/** High-confidence visible-text patterns to strip from text nodes. */
const STRIP_PATTERNS: RegExp[] = HIGH_CONFIDENCE.map((h) => {
  // Clone each pattern so we get a fresh regex with the same flags
  return new RegExp(h.pattern.source, h.pattern.flags);
});

/**
 * Strip leaked scoring data and dangerous links from generated HTML.
 * Uses cheerio for DOM-safe manipulation (avoids touching script/style).
 */
export function stripLeakedContent(html: string): string {
  const $ = cheerio.load(html);

  // Rewrite dangerous links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (DANGEROUS_HREF_RE.test(href)) {
      $(el).attr("href", "#");
    }
  });

  // Walk text nodes in body, skip script/style
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (nodes: ReturnType<typeof $>) => {
    nodes.contents().each((_, node) => {
      if (node.type === "text" && "data" in node) {
        let text = node.data as string;
        for (const pat of STRIP_PATTERNS) {
          pat.lastIndex = 0;
          text = text.replace(pat, "");
        }
        (node as { data: string }).data = text;
      } else if (node.type === "tag") {
        const tag = "tagName" in node ? (node.tagName as string)?.toLowerCase() : "";
        if (tag !== "script" && tag !== "style") {
          walk($(node));
        }
      }
    });
  };

  const body = $("body");
  if (body.length) {
    walk(body);
  } else {
    walk($.root());
  }

  return $.html();
}

/**
 * Well-known stock image / CDN domains that agents are allowed to reference.
 * These are external services the prompts tell agents to use as fallbacks.
 */
const ALLOWED_IMAGE_DOMAINS = new Set([
  "images.unsplash.com",
  "source.unsplash.com",
  "images.pexels.com",
  "picsum.photos",
  "placehold.co",
  "placeholder.com",
  "via.placeholder.com",
  "dummyimage.com",
  "loremflickr.com",
]);

/** Transparent 1x1 SVG placeholder for replaced hallucinated images. */
const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

/**
 * Check if a URL is allowed in generated HTML.
 * Allowed: exact match in providedUrls, data: URIs, well-known stock domains,
 * blob API URLs (S3-backed), empty/fragment-only hrefs.
 */
function isAllowedImageUrl(src: string, allowedUrls: Set<string>): boolean {
  if (!src || src === "#" || src.startsWith("about:")) return true;
  if (src.startsWith("data:")) return true;
  if (allowedUrls.has(src)) return true;

  // Check if URL is on an allowed stock image domain
  try {
    const hostname = new URL(src).hostname;
    if (ALLOWED_IMAGE_DOMAINS.has(hostname)) return true;
  } catch {
    // Not a valid URL — treat as disallowed
  }

  // Allow our own blob API URLs (S3-backed assets)
  if (src.includes("/api/blob/")) return true;

  return false;
}

/**
 * Scan generated HTML for <img> elements with hallucinated src URLs.
 * Replaces any src not in the allowed set with a transparent placeholder.
 * Returns the sanitized HTML and count of replaced URLs.
 */
export function sanitizeImageUrls(
  html: string,
  allowedUrls: Set<string>
): { html: string; replacedCount: number; replacedUrls: string[] } {
  const $ = cheerio.load(html);
  const replacedUrls: string[] = [];

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (!isAllowedImageUrl(src, allowedUrls)) {
      replacedUrls.push(src);
      $(el).attr("src", PLACEHOLDER_SVG);
      // Also clear srcset if present — it likely references the same bad domain
      if ($(el).attr("srcset")) {
        $(el).removeAttr("srcset");
      }
    }
  });

  return {
    html: replacedUrls.length > 0 ? $.html() : html,
    replacedCount: replacedUrls.length,
    replacedUrls,
  };
}

/**
 * Verify that the business name appears in key generated HTML elements.
 * Returns true if found in title, nav, h1, or footer — false if missing.
 */
export function verifyBusinessName(html: string, businessName: string): boolean {
  if (!businessName || businessName.length < 2) return true; // nothing to verify
  const $ = cheerio.load(html);
  const searchTargets = [
    $("title").text(),
    $("nav").text(),
    $("h1").first().text(),
    $("footer").text(),
  ].join(" ");

  return searchTargets.toLowerCase().includes(businessName.toLowerCase());
}
