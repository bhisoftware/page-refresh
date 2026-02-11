/**
 * Prompt construction for scoring and layout generation.
 */

import type { RubricCriteria } from "@/lib/seed-data/scoring-rubric";

export interface ScoringContext {
  industry: string;
  brandAnalysis: string;
  extractedCopy: Record<string, unknown>;
  seoAudit: Record<string, unknown>;
}

export function buildDimensionScoringPrompt(
  dimension: string,
  dimensionLabel: string,
  rubricEntries: Array<{ scoreRange: string; criteria: RubricCriteria }>,
  context: ScoringContext
): string {
  const rubricText = rubricEntries
    .map((e) => {
      const { description, indicators, antipatterns } = e.criteria;
      let s = `- ${e.scoreRange}: ${description}`;
      if (indicators?.length) s += `\n    Indicators: ${indicators.join("; ")}`;
      if (antipatterns?.length) s += `\n    Antipatterns: ${antipatterns.join("; ")}`;
      return s;
    })
    .join("\n\n");

  const copySummary = JSON.stringify(context.extractedCopy, null, 2).slice(0, 1500);

  return `You are evaluating the "${dimensionLabel}" dimension of a website homepage (0-100 scale).

DIMENSION: ${dimensionLabel}

SCORING RUBRIC:
${rubricText}

WEBSITE CONTEXT:
- Industry: ${context.industry}
- Screenshot/Visual analysis: ${context.brandAnalysis.slice(0, 2000)}
- Extracted copy: ${copySummary}

Return valid JSON only, no other text:
{
  "score": <number 0-100>,
  "issues": ["issue 1", "issue 2"],
  "recommendations": ["rec 1", "rec 2"]
}`;
}

export function buildTemplateSelectionPrompt(
  industry: string,
  scoringDetails: Array<{ dimension: string; score: number; issues: string[] }>,
  templateNames: string[],
  extractedCopySummary: string
): string {
  const details = scoringDetails
    .map((d) => `- ${d.dimension}: ${d.score}/100. Issues: ${d.issues.slice(0, 2).join("; ")}`)
    .join("\n");

  return `Given this website analysis, recommend 6 templates from our library that would address the main issues and elevate the site.

Industry: ${industry}

Scoring breakdown:
${details}

Extracted copy summary: ${extractedCopySummary}

Available templates: ${templateNames.join(", ")}

Return valid JSON only:
{
  "templateNames": ["template1", "template2", "template3", "template4", "template5", "template6"],
  "reasoning": "Brief explanation"
}`;
}

/** Phase 2: Recommend 3 full-page layouts; each layout = ordered list of 3–5 section names from the library. */
export function buildCompositionSelectionPrompt(
  industry: string,
  scoringDetails: Array<{ dimension: string; score: number; issues: string[] }>,
  templateNames: string[],
  extractedCopySummary: string
): string {
  const details = scoringDetails
    .map((d) => `- ${d.dimension}: ${d.score}/100. Issues: ${d.issues.slice(0, 2).join("; ")}`)
    .join("\n");

  return `Given this website analysis, recommend 3 full-page homepage layouts. Each layout is a single page composed of 3–5 sections in order (hero → social proof → features → CTA, etc.). Pick section names only from the list below.

Industry: ${industry}

Scoring breakdown:
${details}

Extracted copy summary: ${extractedCopySummary}

Available sections (use these exact names): ${templateNames.join(", ")}

Return valid JSON only:
{
  "compositions": [
    ["section-name-1", "section-name-2", "section-name-3"],
    ["section-name-a", "section-name-b", "section-name-c", "section-name-d"],
    ["section-name-x", "section-name-y", "section-name-z"]
  ],
  "reasoning": "Brief explanation"
}

Each inner array must have 3–5 section names. All names must be from the available sections list.`;
}

export function buildCopyRefreshPrompt(
  industry: string,
  originalCopy: Record<string, unknown>,
  layoutContext: string
): string {
  return `Rewrite this homepage copy for a ${industry} business. Make it: clearer, more compelling, benefit-focused, scannable. Maintain brand voice but eliminate jargon and filler.

Current copy:
${JSON.stringify(originalCopy, null, 2)}

Layout context: ${layoutContext}

Return valid JSON only:
{
  "headline": "Main H1",
  "subheadline": "Hero supporting text",
  "ctaText": "Primary CTA button text",
  "heroSection": "Optional longer hero paragraph",
  "sections": [{"title": "Section H2", "body": "Section copy"}]
}`;
}
