/**
 * Inject extracted assets (colors, fonts, copy) into template HTML/CSS.
 * All user-extracted text is HTML-escaped to prevent XSS.
 * Replaces all {{placeholder}} keys from a map derived from assets.copy.
 */

import type { ExtractedAssets } from "@/lib/scraping/asset-extractor";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns true if html still contains unresolved {{...}} placeholders. Use after inject or applyRefreshedCopy. */
export function hasUnresolvedPlaceholders(html: string): boolean {
  return /\{\{[^}]+\}\}/.test(html);
}

/** Phase 2 watch-out: strip any raw {{...}} from final output so we never persist placeholders. Returns cleaned HTML and whether any were stripped. */
export function stripUnresolvedPlaceholders(
  html: string,
  replacement: string = ""
): { html: string; stripped: boolean } {
  const before = html;
  const after = html.replace(/\{\{[^}]+\}\}/g, replacement);
  return { html: after, stripped: before !== after };
}

/** Fallback placeholder text that must not appear in rendered output (testimonial/contact defaults). */
const FALLBACK_PLACEHOLDER_BLOCKLIST = [
  "info@example.com",
  "(555) 123-4567",
  "Customer Name, Title, Company",
  "Customer Name",
  "Title, Company",
];

/** Strip known fallback strings from HTML so they never leak into output (e.g. from copy-refresher). */
export function stripFallbackPlaceholderText(html: string): string {
  let out = html;
  for (const phrase of FALLBACK_PLACEHOLDER_BLOCKLIST) {
    out = out.split(phrase).join("");
  }
  return out;
}

/** Build a map of all known placeholder keys to escaped values from assets.copy (with fallbacks). */
function buildPlaceholderMap(assets: ExtractedAssets): Record<string, string> {
  const c = assets.copy;
  const h1 = c.h1 ?? "Your Headline";
  const hero = c.heroText ?? c.bodySamples?.[0] ?? "Supporting text for your value proposition.";
  const cta = c.ctaText ?? "Get Started";
  const h2s = c.h2 ?? [];
  const bodySamples = c.bodySamples ?? [];
  const nav = c.navItems ?? [];

  const esc = escapeHtml;
  const fallback = (s: string) => esc(s || "—");

  const map: Record<string, string> = {
    headline: esc(h1),
    subheadline: esc(hero),
    body: esc(bodySamples[0] ?? hero),
    ctaText: esc(cta),
    ctaSecondary: esc(cta),
    sectionHeadline: esc(h2s[0] ?? h1),
    sectionSubheadline: esc(hero),
    brandName: esc(h1.slice(0, 30)),
    aboutBadge: esc(`About ${h1.slice(0, 20)}`),
    contact_email: "", // No fake fallback; use extracted data when we have it, else leave empty
    contact_phone: "",
    approachHeadline: esc("Our Approach"),
    approachIntro: esc("Every decision we make comes back to three principles."),
    ctaHeadline: esc(h1),
    ctaSubheadline: esc(hero),
    statsHeadline: esc(h2s[0] ?? "The Difference"),
  };

  for (let i = 1; i <= 5; i++) {
    map[`feature${i}_title`] = fallback(h2s[i - 1] ?? `Feature ${i}`);
    map[`feature${i}_body`] = fallback(bodySamples[i - 1] ?? `Key benefit or description ${i}.`);
  }
  for (let i = 1; i <= 3; i++) {
    map[`benefit${i}`] = fallback(nav[i - 1] ?? bodySamples[i - 1] ?? `Benefit ${i}`);
  }
  for (let i = 1; i <= 4; i++) {
    map[`stat${i}_value`] = fallback(["500+", "15", "98%", "24/7"][i - 1]);
    map[`stat${i}_label`] = fallback(["Happy Clients", "Years Experience", "Satisfaction", "Support"][i - 1]);
    map[`stat${i}_compare`] = fallback("");
  }
  for (let i = 1; i <= 2; i++) {
    map[`testimonial${i}_quote`] = fallback(bodySamples[i - 1] ?? `Testimonial quote ${i}.`);
    map[`testimonial${i}_author`] = ""; // No fake fallback; use extracted data when we have it
    map[`testimonial${i}_role`] = "";
  }
  for (let i = 1; i <= 4; i++) {
    map[`faq${i}_question`] = fallback(`Question ${i}?`);
    map[`faq${i}_answer`] = fallback(`Answer ${i}.`);
  }
  for (let i = 1; i <= 3; i++) {
    map[`pricing${i}_title`] = fallback(["Starter", "Professional", "Enterprise"][i - 1]);
    map[`pricing${i}_amount`] = fallback(["29", "79", "199"][i - 1]);
    map[`pricing${i}_feature1`] = fallback("Feature one");
    map[`pricing${i}_feature2`] = fallback("Feature two");
    map[`pricing${i}_feature3`] = fallback("Feature three");
    map[`pricing${i}_feature4`] = fallback("Feature four");
  }
  for (let i = 1; i <= 4; i++) {
    map[`problem${i}_title`] = fallback(h2s[i - 1] ?? `Point ${i}`);
    map[`problem${i}_body`] = fallback(bodySamples[i - 1] ?? `Description ${i}.`);
    map[`principle${i}_title`] = fallback(`Principle ${i}`);
    map[`principle${i}_body`] = fallback(`Explanation ${i}.`);
    map[`process${i}_title`] = fallback(["Consultation", "Planning", "Execution", "Delivery"][i - 1]);
    map[`process${i}_body`] = fallback(bodySamples[i - 1] ?? `Step ${i} description.`);
  }
  return map;
}

/** Replace all {{key}} in html with values from the map; unknown keys get empty string. */
export function replacePlaceholders(html: string, map: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? "");
}

export function injectAssets(
  html: string,
  css: string,
  assets: ExtractedAssets
): { html: string; css: string } {
  let outHtml = html;
  let outCss = css;

  const placeholderMap = buildPlaceholderMap(assets);
  outHtml = replacePlaceholders(outHtml, placeholderMap);

  const rawScreenshot = assets.images?.[0]?.src ?? assets.logo ?? "";
  const rawLogo = assets.logo ?? assets.images?.[0]?.src ?? "";
  const screenshotUrl = isValidHttpUrl(rawScreenshot) ? rawScreenshot : "";
  const logoUrl = isValidHttpUrl(rawLogo) ? rawLogo : "";
  const raw1 = assets.images?.[0]?.src ?? "";
  const raw2 = assets.images?.[1]?.src ?? "";
  const raw3 = assets.images?.[2]?.src ?? "";
  const raw4 = assets.images?.[3]?.src ?? "";
  const raw5 = assets.images?.[4]?.src ?? "";
  const img1Url = isValidHttpUrl(raw1) ? raw1 : screenshotUrl;
  const img2Url = isValidHttpUrl(raw2) ? raw2 : screenshotUrl;
  const img3Url = isValidHttpUrl(raw3) ? raw3 : screenshotUrl;
  const img4Url = isValidHttpUrl(raw4) ? raw4 : screenshotUrl;
  const img5Url = isValidHttpUrl(raw5) ? raw5 : screenshotUrl;

  outHtml = outHtml
    .replace(/YOUR_SCREENSHOT_URL/g, screenshotUrl)
    .replace(/YOUR_SCREENSHOT_1_URL/g, img1Url)
    .replace(/YOUR_SCREENSHOT_2_URL/g, img2Url)
    .replace(/YOUR_SCREENSHOT_3_URL/g, img3Url)
    .replace(/YOUR_SCREENSHOT_4_URL/g, img4Url)
    .replace(/YOUR_SCREENSHOT_5_URL/g, img5Url)
    .replace(/YOUR_PRODUCT_SCREENSHOT_URL/g, screenshotUrl)
    .replace(/YOUR_IMAGE_URL/g, img1Url)
    .replace(/YOUR_LOGO_1_URL|YOUR_LOGO_2_URL|YOUR_LOGO_3_URL|YOUR_LOGO_4_URL|YOUR_LOGO_5_URL|YOUR_LOGO_6_URL/g, logoUrl)
    .replace(/YOUR_COMPANY_LOGO_1_URL|YOUR_COMPANY_LOGO_2_URL/g, logoUrl);

  const primaryColor = assets.colors?.[0]?.hex ?? "#2563eb";
  const secondaryColor = assets.colors?.[1]?.hex ?? "#1e40af";
  const fontFamily = assets.fonts?.[0]?.family ?? "system-ui, sans-serif";

  outCss = outCss
    .replace(/var\(--primary-color[^)]*\)/g, primaryColor)
    .replace(/var\(--secondary-color[^)]*\)/g, secondaryColor)
    .replace(/var\(--text-color[^)]*\)/g, "#1a1a1a")
    .replace(/var\(--border-color[^)]*\)/g, "#e5e7eb");

  if (outHtml.includes("font-family") || outCss.includes("font-family")) {
    outCss = `:root { --primary-color: ${primaryColor}; --secondary-color: ${secondaryColor}; --font-family: ${fontFamily}; }\n${outCss}`;
  }

  return { html: outHtml, css: outCss };
}
