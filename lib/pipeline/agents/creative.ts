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

export interface RunCreativeAgentOptions {
  skills: AgentSkill[];
  slug: CreativeSlug;
  input: CreativeAgentInput;
  refreshId: string;
  onRetry?: (delayMs: number) => void;
}

export async function runCreativeAgent(
  options: RunCreativeAgentOptions
): Promise<CreativeAgentOutput> {
  const { skills, slug, input, refreshId, onRetry } = options;
  const skill = skills.find((s) => s.agentSlug === slug);
  if (!skill) throw new Error(`No active skill found for agent: ${slug}`);

  const apiKey = await getApiKey("anthropic");
  const client = new Anthropic({ apiKey });
  const model = skill.modelOverride ?? "claude-sonnet-4-20250514";
  const maxTokens = skill.maxTokens ?? 32768;
  const temperature = skill.temperature ?? 0.7;

  const STYLE_REMINDERS: Record<CreativeSlug, string> = {
    "creative-modern": `=== GENERATE A MODERN LAYOUT ===
Style: Minimalist, bold typography, full-bleed hero, asymmetric grids, generous whitespace.
Inspiration: Linear, Vercel, Stripe.
Structure: Full-bleed hero → compact value-prop strip → alternating left-right sections → 2-3 col card grid. Target 4-5 clean sections.
Key: Less is more. Typography does the heavy lifting. Dark mode friendly.`,

    "creative-classy": `=== GENERATE A CLASSY LAYOUT ===
Style: Refined, symmetrical, serif+sans-serif pairing, muted palette with gold/navy/charcoal accents.
Inspiration: McKinsey, Rolex, top law firms.
Structure: Centered hero → early social proof/testimonials → 3-col service grid → credentials/trust section → inviting contact. Target 5-6 well-spaced sections.
Key: Hierarchy through typography scale. Trust-first layout. Conservative use of color — elegance through restraint.`,

    "creative-unique": `=== GENERATE A UNIQUE LAYOUT ===
Style: Break conventions. Unexpected color combos, creative CSS effects, personality-driven.
Inspiration: Mailchimp, Notion, Figma.
Structure: Angled/bento hero → surprising first section → non-standard services (accordion/tabs/timeline/masonry) → varied section widths. Target 5-7 sections with AT LEAST 2 unconventional layouts.
Key: Stand out from competitors. Custom visual language. Playful but purposeful. Memorable first impression. Do NOT use a standard grid layout.`,
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
        temperature,
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
    { onRetry }
  );

  if (response.stop_reason === "max_tokens") {
    console.warn(
      `[creative] ${slug} hit max_tokens (${maxTokens}). Output likely truncated. ` +
      `Tokens used: ${response.usage?.output_tokens ?? "unknown"}`
    );
  }

  const text = extractText(response);
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
  if (tagged) return cleanGeneratedHtml(tagged, slug, allowedImageUrls, input.businessName);

  // Fallback: try JSON parsing (backwards compat with older prompts in DB)
  const parsed = safeParseJSON(text);
  if (parsed.success && parsed.data) {
    const data = parsed.data as Record<string, unknown>;
    const html = typeof data.html === "string" ? data.html : "";
    const rationale = typeof data.rationale === "string" ? data.rationale : "";
    if (html.trim()) return cleanGeneratedHtml({ html, rationale }, slug, allowedImageUrls, input.businessName);
  }

  throw new Error(`Creative Agent ${slug} returned unparseable output (no tags, invalid JSON)`);
}
