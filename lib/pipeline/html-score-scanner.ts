/**
 * Scans generated HTML for leaked scoring/analysis data.
 * Extracts visible text (strips tags, <style>, <script>) and checks
 * against known patterns. Warn-only — never blocks the pipeline.
 */

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
