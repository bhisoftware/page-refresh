/**
 * Creative Agent runner (Modern / Classy / Unique). Parameterized by slug.
 * Uses AgentSkill from DB. Returns { html, rationale }.
 */

import type { AgentSkill } from "@prisma/client";
import { getApiKey } from "@/lib/config/api-keys";
import Anthropic from "@anthropic-ai/sdk";
import { createPromptLog } from "@/lib/ai/prompt-log";
import { withRetry } from "@/lib/ai/retry";
import { safeParseJSON } from "@/lib/ai/json-repair";
import type { CreativeAgentInput, CreativeAgentOutput } from "./types";
import { scanHtmlForLeakedScores, stripLeakedContent, sanitizeImageUrls, verifyBusinessName } from "@/lib/pipeline/html-score-scanner";
import { validateLayoutQuality } from "@/lib/pipeline/layout-validator";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

/**
 * Extract HTML and rationale from XML-style tagged output.
 * Primary parsing path — avoids JSON escaping issues entirely.
 */
function extractFromTags(text: string): CreativeAgentOutput | null {
  const htmlMatch = text.match(/<layout_html>([\s\S]*?)<\/layout_html>/);
  if (!htmlMatch) return null;
  const html = htmlMatch[1].trim();
  if (!html) return null;

  const rationaleMatch = text.match(/<rationale>([\s\S]*?)<\/rationale>/);
  const rationale = rationaleMatch ? rationaleMatch[1].trim() : "";

  return { html, rationale };
}

const CREATIVE_SLUGS = ["creative-modern", "creative-classy", "creative-unique"] as const;
export type CreativeSlug = (typeof CREATIVE_SLUGS)[number];

export function isCreativeSlug(slug: string): slug is CreativeSlug {
  return CREATIVE_SLUGS.includes(slug as CreativeSlug);
}

/** Warn about and strip leaked scoring data, dangerous links, and hallucinated image URLs. */
function cleanGeneratedHtml(
  result: CreativeAgentOutput,
  slug: string,
  allowedImageUrls?: Set<string>,
  businessName?: string
): CreativeAgentOutput {
  const scan = scanHtmlForLeakedScores(result.html);
  if (scan.matches.length > 0) {
    const high = scan.matches.filter((m) => m.confidence === "high");
    const med = scan.matches.filter((m) => m.confidence === "medium");
    const details = high.map((m) => `${m.pattern}: "${m.text}"`).join(", ");
    console.warn(
      `[creative] ${slug} score leak scan: ${high.length} high, ${med.length} medium.` +
      (details ? ` High: ${details}` : "")
    );
  }
  // Always strip dangerous links and leaked text, even when no score patterns
  // were detected — the AI may embed result URLs without visible score data.
  result.html = stripLeakedContent(result.html);

  // Sanitize hallucinated image URLs
  if (allowedImageUrls) {
    const { html, replacedCount, replacedUrls } = sanitizeImageUrls(result.html, allowedImageUrls);
    if (replacedCount > 0) {
      console.warn(
        `[creative] ${slug} replaced ${replacedCount} hallucinated image URL(s): ${replacedUrls.slice(0, 3).join(", ")}${replacedCount > 3 ? "..." : ""}`
      );
    }
    result.html = html;
  }

  // Verify business name appears in key elements
  if (businessName && !verifyBusinessName(result.html, businessName)) {
    console.warn(`[creative] ${slug} output missing business name "${businessName}" in title/nav/h1/footer`);
  }

  return result;
}

/** Build a set of all image URLs the agent was given and is allowed to use. */
function buildAllowedImageUrls(input: CreativeAgentInput): Set<string> {
  const urls = new Set<string>();
  const { brandAssets } = input;
  if (brandAssets.logoUrl) urls.add(brandAssets.logoUrl);
  if (brandAssets.heroImageUrl) urls.add(brandAssets.heroImageUrl);
  for (const img of brandAssets.additionalImageUrls) urls.add(img.url);
  for (const src of brandAssets.siteImageUrls) urls.add(src);
  for (const p of brandAssets.teamPhotos ?? []) urls.add(p.src);
  for (const b of brandAssets.trustBadges ?? []) urls.add(b.src);
  for (const e of brandAssets.eventPhotos ?? []) urls.add(e.src);
  return urls;
}

/** Check for critically unbalanced HTML from truncation (unclosed major tags). */
function hasUnbalancedHtml(html: string): boolean {
  const openDivs = (html.match(/<div[\s>]/gi) || []).length;
  const closeDivs = (html.match(/<\/div>/gi) || []).length;
  const openSections = (html.match(/<section[\s>]/gi) || []).length;
  const closeSections = (html.match(/<\/section>/gi) || []).length;
  // Allow small imbalance (nested partials), flag gross truncation
  return (openDivs - closeDivs) > 5 || (openSections - closeSections) > 3;
}

/** Run structural validation and attach results (does not block persistence). */
function attachValidation(result: CreativeAgentOutput, slug: string): CreativeAgentOutput {
  // Check for truncated/unbalanced HTML before standard validation
  if (hasUnbalancedHtml(result.html)) {
    console.error(`[creative] ${slug} has critically unbalanced HTML (likely truncated). Clearing output.`);
    return { html: "", rationale: result.rationale ?? "Layout generation was truncated and could not be used.", validation: { passed: false, issues: [{ code: "TRUNCATED_HTML", message: "Output was truncated mid-tag" }], warnings: [] } };
  }

  const validation = validateLayoutQuality(result.html);
  if (validation.issues.length > 0) {
    console.warn(
      `[creative] ${slug} validation: ${validation.issues.length} issue(s): ` +
      validation.issues.map(i => i.code).join(", ")
    );
  }
  if (validation.warnings.length > 0) {
    console.log(
      `[creative] ${slug} validation: ${validation.warnings.length} warning(s): ` +
      validation.warnings.map(w => w.code).join(", ")
    );
  }
  return { ...result, validation };
}

export interface RunCreativeAgentOptions {
  skills: AgentSkill[];
  slug: CreativeSlug;
  input: CreativeAgentInput;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
  rateLimitFlag?: { until: number };
  agentIndex?: number;
}

export async function runCreativeAgent(
  options: RunCreativeAgentOptions
): Promise<CreativeAgentOutput> {
  const { skills, slug, input, refreshId, onRetry, rateLimitFlag } = options;
  const skill = skills.find((s) => s.agentSlug === slug);
  if (!skill) throw new Error(`No active skill found for agent: ${slug}`);

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 32768;
  // Extended thinking requires omitting temperature (defaults to 1.0).
  // DB temperature values (0.4/0.5/0.7) retained for potential future use.
  const _temperature = skill.temperature ?? 0.7;

  const STYLE_REMINDERS: Record<CreativeSlug, string> = {
    "creative-modern": `=== GENERATE A MODERN LAYOUT ===
- Hero: full-bleed, min-h-screen, centered content. Primary CTA must be a pill: rounded-full (not rounded-lg).
- Nav: transparent sticky, minimal — logo left, 3-4 links right. Do NOT put phone numbers in the nav bar.
- Sections: asymmetric grid. Alternate [40% text | 60% image] and [60% image | 40% text] using grid-cols-5 or equivalent split. Do NOT use centered single-column editorial blocks.
- Cards: 3-column card grid only. Use rounded-xl, NO borders, subtle shadow-sm. Accent with emoji or dot bullets — no heavy borders.
- Typography: ONE sans-serif font only. No serif anywhere. Headlines: font-bold + tracking-tight.
- Color: grayscale everywhere EXCEPT CTAs and one accent per section. Restraint is mandatory.
- Dividers: whitespace only — no horizontal lines, no background color changes between sections.
- Footer: minimal single row, subtle border-t. No multi-column footer.
- Target 4-5 clean sections. Less is more.`,

    "creative-classy": `=== GENERATE A CLASSY LAYOUT ===
- Hero: split layout — text left (~55%), image right (~45%). NOT full-viewport; max height ~80vh (e.g. min-h-[80vh] or similar).
- Headlines: SERIF font required (Playfair Display, Cormorant, or Lora). Use font-medium for headlines, NOT font-bold. Non-negotiable.
- CTA: bordered button — border-2 rounded-lg. Do NOT use rounded-full pills.
- Nav: solid background (white or cream #faf8f5), NOT transparent. Include phone number on the right. Subtle border-b.
- Sections: centered editorial column — max-w-3xl or max-w-4xl mx-auto. Alternate white and cream (e.g. bg-white then bg-[#faf8f5]) between sections.
- Services: 2-COLUMN grid only (not 3). Generous depth per item. Separate items with thin horizontal rules (border-b).
- Testimonials: 2-column grid, boxed cards, italic serif for quotes, small-caps for attribution.
- Trust strip: horizontal band with grayscale logos.
- About: give real estate — tell the brand story.
- Footer: multi-column (address, phone, hours), warm dark bg (bg-gray-800), generous py-16.
- Body: larger body text (text-lg), small-caps for labels. Serif headlines + sans-serif body.
- Target 5-6 well-spaced sections.`,

    "creative-unique": `=== GENERATE A UNIQUE LAYOUT ===
- Hero: choose ONE unconventional option per generation: (A) Giant typography (text-8xl or larger), no image, brand color text, subtle texture bg — OR (B) Collage: overlapping images with slight rotation, text on blurred panel, asymmetric — OR (C) Full-screen bold color block: saturated brand color bg, huge white text, no image — OR (D) Minimal title card: just headline + rule + CTA, compact.
- Nav: NOT standard — use accent-color background, OR hamburger/drawer/side nav with all links accessible. All nav links must be present; zero navigation links is not acceptable. Do not copy Modern or Classy nav.
- Pattern-breakers (include AT LEAST 2): full-bleed bold color section; OR dark section mid-page (bg-gray-900); OR overlapping elements (-mt-12 with z-index); OR dramatic height variance between sections.
- Services: NOT a uniform card grid. Use numbered full-width blocks (01, 02, 03 in text-8xl opacity-10), OR bento grid, OR timeline. No standard 3-col card grid.
- Typography: display font with personality (Space Grotesk, Syne, Unbounded). font-black headlines + font-light body. Include oversized decorative text somewhere.
- Color: use the FULL brand palette. At least one saturated bg section and one dark section.
- Footer: match personality — NOT a safe gray multi-column footer like Classy.
- Self-check: "Is this immediately distinguishable from a standard card-grid layout?" If not, change the services or hero.
- Target 5-7 sections with at least 2 unconventional layouts.`,
  };

  const userContent = `${STYLE_REMINDERS[slug]}\n\nHere is the site data:\n\n${JSON.stringify(input, null, 2)}`;

  const startMs = Date.now();
  // Use streaming to avoid "Streaming is required for operations that may take
  // longer than 10 minutes" errors with high max_tokens values.
  const response = await withRetry(
    async () => {
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        thinking: { type: "enabled", budget_tokens: 12000 },
        system: [
          {
            type: "text" as const,
            text: skill.systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: userContent }],
      });
      return stream.finalMessage();
    },
    { onRetry, rateLimitFlag, agentIndex: options.agentIndex }
  );

  if (response.stop_reason === "max_tokens") {
    console.warn(
      `[creative] ${slug} hit max_tokens (${maxTokens}). Output likely truncated. ` +
      `Tokens used: ${response.usage?.output_tokens ?? "unknown"}`
    );
  }

  let text = extractText(response);

  // If truncated, attempt to close the layout_html tag so parsing succeeds
  if (response.stop_reason === "max_tokens" && text.includes("<layout_html>") && !text.includes("</layout_html>")) {
    text += "\n</layout_html>";
    console.warn(`[creative] ${slug} auto-closed truncated <layout_html> tag`);
  }
  const stepName = slug.replace(/-/g, "_") as "creative_modern" | "creative_classy" | "creative_unique";
  await createPromptLog({
    refreshId,
    step: stepName,
    provider: "claude",
    model: response.model,
    promptText: skill.systemPrompt + "\n---\n" + userContent.slice(0, 10000),
    responseText: text.slice(0, 2000),
    tokensUsed: response.usage?.input_tokens && response.usage?.output_tokens ? response.usage.input_tokens + response.usage.output_tokens : undefined,
    responseTimeMs: Date.now() - startMs,
  });

  const allowedImageUrls = buildAllowedImageUrls(input);

  // Primary path: extract from XML-style tags (avoids JSON escaping issues)
  const tagged = extractFromTags(text);
  if (tagged) {
    const cleaned = cleanGeneratedHtml(tagged, slug, allowedImageUrls, input.businessName);
    return attachValidation(cleaned, slug);
  }

  // Fallback: try JSON parsing (backwards compat with older prompts in DB)
  const parsed = safeParseJSON(text);
  if (parsed.success && parsed.data) {
    const data = parsed.data as Record<string, unknown>;
    const html = typeof data.html === "string" ? data.html : "";
    const rationale = typeof data.rationale === "string" ? data.rationale : "";
    if (html.trim()) {
      const cleaned = cleanGeneratedHtml({ html, rationale }, slug, allowedImageUrls, input.businessName);
      return attachValidation(cleaned, slug);
    }
  }

  throw new Error(`Creative Agent ${slug} returned unparseable output (no tags, invalid JSON)`);
}
