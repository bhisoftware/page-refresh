/**
 * Extract colors, fonts, images, and copy from HTML and CSS.
 * Filters out junk UI strings and prioritizes h1 > h2 > meta > og:title for headline.
 */

import * as cheerio from "cheerio";

/**
 * Junk / UI strings to exclude from extracted copy (lowercased for matching).
 * Includes: accessibility skip links, cart/UI state text, and template placeholders.
 */
const COPY_BLOCKLIST = new Set([
  // Accessibility
  "skip to content",
  "skip to main content",
  "skip to main",
  "skip navigation",
  "skip to navigation",
  // Cart / UI state
  "close",
  "menu",
  "loading",
  "item added to your cart",
  "added to your cart",
  "added to wishlist",
  "view cart",
  "add to cart",
  "buy now",
  // Generic UI
  "submit",
  "search",
  "cart",
  "login",
  "sign in",
  "sign out",
  "logout",
  "register",
  "subscribe",
  "read more",
  "learn more",
  "click here",
  "cookie",
  "accept",
  "accept all",
  "decline",
  "got it",
  "dismiss",
  "notification",
  "notifications",
  "share",
  "tweet",
  "follow",
  "next",
  "previous",
  "back",
  "home",
  "more",
  "less",
  "show more",
  "show less",
  "expand",
  "collapse",
  "open menu",
  "close menu",
  "toggle",
  "search...",
  "enter your email",
  "your email",
  "no thanks",
  "maybe later",
  // Template placeholders (so we don't treat them as real copy)
  "your headline",
  "your main headline goes here",
  "supporting text",
  "customer name",
  "customer name, title, company",
  "author name",
  "title, company name",
]);

/** Max word count for a string to be considered a short UI label (exclude from body/hero if blocklisted). */
const SHORT_LABEL_MAX_WORDS = 4;

function isBlocklistedOrShortUi(text: string): boolean {
  if (!text || typeof text !== "string") return true;
  const t = text.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (COPY_BLOCKLIST.has(lower)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= SHORT_LABEL_MAX_WORDS && (lower.length < 25 || /^(close|menu|login|cart|search|submit|back|next|prev|ok|cancel|yes|no)$/i.test(lower))) return true;
  return false;
}

/** Matches template-placeholder style strings like "Name, Title, Company". */
const TEMPLATE_PLACEHOLDER_PATTERN = /^(author\s+)?name\s*,\s*title\s*,?\s*company(\s+name)?$/i;

function isJunkCopy(text: string): boolean {
  if (!text || typeof text !== "string") return true;
  const t = text.trim();
  if (t.length < 2) return true;
  if (isBlocklistedOrShortUi(t)) return true;
  if (TEMPLATE_PLACEHOLDER_PATTERN.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[^\w]{1,3}$/.test(t)) return true;
  return false;
}

const MAX_TESTIMONIALS = 3;
const TESTIMONIAL_SELECTORS = [
  "blockquote",
  '[class*="testimonial"]',
  '[class*="review"]',
  '[class*="quote"]',
  '[class*="customer"]',
].join(", ");

function extractTestimonials($: cheerio.CheerioAPI): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  $(TESTIMONIAL_SELECTORS).each((_, el) => {
    if (results.length >= MAX_TESTIMONIALS) return;
    const $el = $(el);
    if ($el.closest('nav, footer, [class*="cookie"], [class*="popup"], [class*="modal"]').length) return;
    // Skip containers that have child elements matching our selectors (extract leaves, not parents)
    if ($el.find(TESTIMONIAL_SELECTORS).length > 0) return;
    const text = $el.text().trim().replace(/\s+/g, " ");
    if (text.length < 20 || text.length > 500) return;
    if (isJunkCopy(text)) return;
    if (seen.has(text)) return;
    seen.add(text);
    results.push(text);
  });

  return results;
}

const MAX_FEATURES = 8;
const SECTION_KEYWORDS = /feature|service|benefit|offering|capability|what[\s-]we[\s-]do|our[\s-]services|why[\s-]choose|specialt/i;

function extractFeatures($: cheerio.CheerioAPI): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // Tier 1: <li> inside sections with feature/service-related class or heading
  $('section, [class*="feature"], [class*="service"], [class*="benefit"], [class*="offering"]').each((_, sectionEl) => {
    const $section = $(sectionEl);
    if ($section.closest("nav, header, footer").length) return;
    const sectionClass = $section.attr("class") ?? "";
    const sectionHeading = $section.find("h2, h3").first().text().trim();
    if (!SECTION_KEYWORDS.test(sectionClass) && !SECTION_KEYWORDS.test(sectionHeading)) return;

    $section.find("li").each((_, liEl) => {
      if (results.length >= MAX_FEATURES) return;
      const text = $(liEl).text().trim().replace(/\s+/g, " ");
      if (text.length < 3 || text.length > 120) return;
      // Use blocklist only — short service names like "Oil Changes" are valid features
      if (COPY_BLOCKLIST.has(text.toLowerCase())) return;
      if (seen.has(text)) return;
      seen.add(text);
      results.push(text);
    });
  });

  // Tier 2: fallback — <li> in main content area (not nav/header/footer)
  if (results.length === 0) {
    $("main li, [role='main'] li, .content li, article li").each((_, liEl) => {
      if (results.length >= MAX_FEATURES) return;
      const $li = $(liEl);
      if ($li.closest('nav, header, footer, [class*="cookie"], [class*="sidebar"]').length) return;
      const text = $li.text().trim().replace(/\s+/g, " ");
      if (text.length < 3 || text.length > 120) return;
      if (COPY_BLOCKLIST.has(text.toLowerCase())) return;
      if (seen.has(text)) return;
      seen.add(text);
      results.push(text);
    });
  }

  return results;
}

/**
 * Extract a phone number from the page. Checks tel: links first,
 * then scans visible text in key sections.
 */
function extractPhoneNumber($: cheerio.CheerioAPI): string | undefined {
  // Priority 1: tel: link href
  const telLink = $('a[href^="tel:"]').first();
  if (telLink.length) {
    const href = telLink.attr('href') ?? '';
    const cleaned = href.replace('tel:', '').replace(/\s/g, '');
    if (/^\+?\d[\d\-().]{8,}$/.test(cleaned)) {
      const visibleText = telLink.text().trim();
      if (/\d{3}.*\d{3}.*\d{4}/.test(visibleText)) return visibleText;
      return cleaned;
    }
  }

  // Priority 2: Regex scan of key sections
  const US_PHONE = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/;
  const searchSelectors = ['header', 'footer', '[class*="contact"]', '[class*="phone"]', '[class*="hero"]', '.topbar', '[class*="top-bar"]'];

  for (const selector of searchSelectors) {
    const el = $(selector);
    if (!el.length) continue;
    const text = el.text().replace(/\s+/g, ' ');
    const match = text.match(US_PHONE);
    if (match) return match[0].trim();
  }

  // Priority 3: Scan all body text (less precise, more coverage)
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const match = bodyText.match(US_PHONE);
  if (match) return match[0].trim();

  return undefined;
}

/**
 * Extract aggregate rating (Google Reviews, Yelp, etc.) from structured data or page text.
 */
function extractRatingData($: cheerio.CheerioAPI): ExtractedCopy['rating'] | undefined {
  // Method 1: Schema.org JSON-LD (most reliable)
  const ldJsonScripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < ldJsonScripts.length; i++) {
    try {
      const raw = $(ldJsonScripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw);

      const findRating = (obj: Record<string, unknown>): { ratingValue: string; reviewCount?: string; ratingCount?: string } | null => {
        if (obj.aggregateRating) return obj.aggregateRating as { ratingValue: string; reviewCount?: string; ratingCount?: string };
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            if (item?.aggregateRating) return item.aggregateRating;
          }
        }
        return null;
      };

      const agg = findRating(data);
      if (agg?.ratingValue && (agg?.reviewCount || agg?.ratingCount)) {
        const score = parseFloat(String(agg.ratingValue));
        const count = parseInt(String(agg.reviewCount || agg.ratingCount), 10);
        if (score > 0 && score <= 5 && count > 0) {
          return { score, count, source: 'schema.org' };
        }
      }
    } catch { /* invalid JSON, skip */ }
  }

  // Method 2: Meta tags
  const ratingMeta = $('meta[itemprop="ratingValue"]').attr('content');
  const countMeta = $('meta[itemprop="reviewCount"], meta[itemprop="ratingCount"]').attr('content');
  if (ratingMeta && countMeta) {
    const score = parseFloat(ratingMeta);
    const count = parseInt(countMeta, 10);
    if (score > 0 && score <= 5 && count > 0) {
      return { score, count, source: 'microdata' };
    }
  }

  // Method 3: Text patterns in known review containers
  const reviewContainers = $('[class*="review"], [class*="rating"], [class*="google"], [class*="testimonial"], [data-rating]');
  const ratingRegex = /(\d+\.?\d*)\s*(?:\/\s*5|out\s+of\s+5|stars?)\s*(?:[\s(|,\u2013-]+)?\s*(\d+)\s*(?:reviews?|ratings?)/i;
  const ratingRegex2 = /(\d+)\s*(?:reviews?|ratings?)\s*[|,\u2013-]\s*(\d+\.?\d*)\s*(?:\/\s*5|stars?)/i;

  for (let i = 0; i < reviewContainers.length; i++) {
    const text = $(reviewContainers[i]).text().replace(/\s+/g, ' ');
    let match = text.match(ratingRegex);
    if (match) {
      const score = parseFloat(match[1]);
      const count = parseInt(match[2], 10);
      if (score > 0 && score <= 5 && count > 0) return { score, count, source: 'page-text' };
    }
    match = text.match(ratingRegex2);
    if (match) {
      const count = parseInt(match[1], 10);
      const score = parseFloat(match[2]);
      if (score > 0 && score <= 5 && count > 0) return { score, count, source: 'page-text' };
    }
  }

  return undefined;
}

export interface ExtractedColor {
  hex: string;
  count?: number;
}

export type ExtractedColors = ExtractedColor[];

export interface ExtractedFont {
  family: string;
  source?: string;
  /** Semantic role detected from CSS context: "heading", "body", or undefined if unknown */
  role?: "heading" | "body";
}

export type ExtractedFonts = ExtractedFont[];

export interface ExtractedImageItem {
  src: string;
  alt?: string;
  role?: string;
  imageType?: 'photo' | 'icon' | 'illustration' | 'decorative' | 'unknown';
  dimensions?: { width: number; height: number };
}

export type ExtractedImage = ExtractedImageItem[];

export interface ExtractedCopy {
  h1?: string;
  h2?: string[];
  heroText?: string;
  navItems?: string[];
  ctaText?: string[];
  bodySamples?: string[];
  businessName?: string;
  titleTag?: string;
  testimonials?: string[];
  features?: string[];
  phoneNumber?: string;
  rating?: { score: number; count: number; source: string };
}

export interface ClassifiedImage {
  src: string;
  alt?: string;
}

export interface LogoCandidate {
  url: string;
  score: number;
  alt: string;
  position: "header" | "nav" | "footer" | "body";
  isSvg: boolean;
  isExternal: boolean;
}

export interface ExtractedAssets {
  colors: ExtractedColors;
  fonts: ExtractedFonts;
  images: ExtractedImage;
  copy: ExtractedCopy;
  logo?: string;
  logoCandidates?: LogoCandidate[];
  teamPhotos?: ClassifiedImage[];
  trustBadges?: ClassifiedImage[];
  eventPhotos?: ClassifiedImage[];
}

const HEX_PATTERN = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}"']+)/g;
const RGB_PATTERN = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
const HSL_PATTERN = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/g;
const CSS_VAR_DECL_PATTERN = /--([\w-]+)\s*:\s*([^;}]+)/g;
const FONT_IMPORT_PATTERN = /@import\s+url\(\s*['"]?([^'")\s]+fonts[^'")\s]*)['"]?\s*\)/gi;
const FONT_LINK_PATTERN = /fonts\.googleapis\.com\/css[^'"\s)]+/gi;
const SQUARESPACE_FONT_VAR_PATTERN = /--([\w-]*font-family[\w-]*)\s*:\s*([^;}]+)/gi;

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)));
  };
  return rgbToHex(f(0), f(8), f(4));
}

/**
 * Parse CSS custom property declarations into a lookup map.
 * Handles lines like: --primary-color: #2d5016; or --black-hsl: 0, 0%, 0%;
 */
export function parseCssCustomProperties(css: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const match of css.matchAll(CSS_VAR_DECL_PATTERN)) {
    props.set(`--${match[1]}`, match[2].trim());
  }
  return props;
}

/**
 * Resolve var(--name) references by looking up declared values.
 * Handles var(--name, fallback) syntax.
 */
export function resolveVarReferences(value: string, customProps: Map<string, string>): string {
  return value.replace(/var\(\s*(--([\w-]+))\s*(?:,\s*([^)]+))?\s*\)/g, (_match, fullName, _name, fallback) => {
    const resolved = customProps.get(fullName);
    if (resolved) {
      // Recursively resolve in case the value itself contains var()
      return resolveVarReferences(resolved, customProps);
    }
    return fallback?.trim() ?? value;
  });
}

function extractColorsFromCss(css: string): ExtractedColors {
  const colorMap = new Map<string, number>();
  const customProps = parseCssCustomProperties(css);

  // Resolve custom properties that contain color values
  for (const [, value] of customProps) {
    const resolved = resolveVarReferences(value, customProps);
    // Check if resolved value is a color
    const hexMatch = resolved.match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/);
    if (hexMatch) {
      const hex = hexMatch[1].length === 3
        ? "#" + hexMatch[1].split("").map((c) => c + c).join("")
        : "#" + hexMatch[1];
      colorMap.set(hex.toLowerCase(), (colorMap.get(hex.toLowerCase()) ?? 0) + 1);
    }
    const rgbMatch = resolved.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      const hex = rgbToHex(parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)).toLowerCase();
      colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1);
    }
    const hslMatch = resolved.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (hslMatch) {
      const hex = hslToHex(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3])).toLowerCase();
      colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1);
    }
  }

  for (const match of css.matchAll(HEX_PATTERN)) {
    const hex = match[1].length === 3
      ? "#" + match[1].split("").map((c) => c + c).join("")
      : "#" + match[1];
    colorMap.set(hex.toLowerCase(), (colorMap.get(hex.toLowerCase()) ?? 0) + 1);
  }

  for (const match of css.matchAll(RGB_PATTERN)) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const hex = rgbToHex(r, g, b).toLowerCase();
    colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1);
  }

  for (const match of css.matchAll(HSL_PATTERN)) {
    const h = parseFloat(match[1]);
    const s = parseFloat(match[2]);
    const l = parseFloat(match[3]);
    const hex = hslToHex(h, s, l).toLowerCase();
    colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1);
  }

  // Filter grays and near-whites, sort by frequency, take top 10
  const filtered = [...colorMap.entries()]
    .filter(([hex]) => {
      const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
      if (!m) return true;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      const gray = (r + g + b) / 3;
      return gray < 250 && gray > 5;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return filtered.map(([hex, count]) => ({ hex, count }));
}

function extractFontsFromCss(css: string): ExtractedFonts {
  const seen = new Set<string>();
  const fonts: ExtractedFonts = [];
  const GENERIC_FONTS = new Set(["inherit", "initial", "unset", "system-ui", "sans-serif", "serif", "monospace", "cursive", "fantasy", "ui-sans-serif", "ui-serif", "ui-monospace"]);
  const customProps = parseCssCustomProperties(css);

  // Extract fonts from @import URLs (e.g., Google Fonts)
  for (const match of css.matchAll(FONT_IMPORT_PATTERN)) {
    const url = match[1];
    const familyMatch = url.match(/family=([^&:]+)/);
    if (familyMatch) {
      const families = decodeURIComponent(familyMatch[1]).split("|");
      for (const f of families) {
        const name = f.replace(/\+/g, " ").trim();
        const key = name.toLowerCase();
        if (!seen.has(key) && !GENERIC_FONTS.has(key)) {
          seen.add(key);
          fonts.push({ family: name, source: "import" });
        }
      }
    }
  }

  // Extract fonts from Google Fonts link URLs in CSS comments or content
  for (const match of css.matchAll(FONT_LINK_PATTERN)) {
    const familyMatch = match[0].match(/family=([^&:]+)/);
    if (familyMatch) {
      const families = decodeURIComponent(familyMatch[1]).split("|");
      for (const f of families) {
        const name = f.replace(/\+/g, " ").trim();
        const key = name.toLowerCase();
        if (!seen.has(key) && !GENERIC_FONTS.has(key)) {
          seen.add(key);
          fonts.push({ family: name, source: "link" });
        }
      }
    }
  }

  // Extract fonts from Squarespace-style custom properties (--heading-font-font-family, --body-font-font-family)
  for (const match of css.matchAll(SQUARESPACE_FONT_VAR_PATTERN)) {
    const varName = match[1].toLowerCase();
    const value = match[2].trim();
    const resolved = resolveVarReferences(value, customProps);
    const families = resolved.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
    // Detect role from variable name (e.g., --heading-font-font-family, --body-font-font-family)
    const role: ExtractedFont["role"] = varName.includes("heading") ? "heading" : varName.includes("body") ? "body" : undefined;
    for (const f of families) {
      const key = f.toLowerCase();
      if (!seen.has(key) && !GENERIC_FONTS.has(key) && f.length > 1) {
        seen.add(key);
        fonts.push({ family: f, source: "custom-property", role });
      }
    }
  }

  // Standard font-family declarations — detect role from CSS selector context
  const HEADING_SELECTOR = /(?:^|[},\s])\s*(h[1-6](?:\s|,|{|$))/i;
  const BODY_SELECTOR = /(?:^|[},\s])\s*(?:body|\.?(?:text|paragraph|content|prose)(?:\s|,|{|$)|p(?:\s|,|{|$))/i;
  for (const match of css.matchAll(FONT_FAMILY_PATTERN)) {
    const raw = match[1].trim();
    // Resolve var() references in font-family values
    const resolved = resolveVarReferences(raw, customProps);
    const families = resolved.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
    // Look backward from match position to find the CSS selector
    const precedingCss = css.slice(Math.max(0, (match.index ?? 0) - 200), match.index ?? 0);
    const lastBraceIdx = precedingCss.lastIndexOf("{");
    const selectorBlock = lastBraceIdx >= 0 ? precedingCss.slice(0, lastBraceIdx) : "";
    const selectorTail = selectorBlock.slice(selectorBlock.lastIndexOf("}") + 1).trim();
    const role: ExtractedFont["role"] = HEADING_SELECTOR.test(selectorTail) ? "heading" : BODY_SELECTOR.test(selectorTail) ? "body" : undefined;
    for (const f of families) {
      const key = f.toLowerCase();
      if (!seen.has(key) && !GENERIC_FONTS.has(key) && f.length > 1) {
        seen.add(key);
        fonts.push({ family: f, role });
      }
    }
  }

  return fonts.slice(0, 8);
}

/**
 * Classify an image as photo, icon, illustration, or decorative based on
 * URL patterns, dimensions, alt text, and DOM context.
 */
function classifyImageType(
  src: string,
  alt: string,
  dimensions?: { width: number; height: number }
): ExtractedImageItem['imageType'] {
  const srcLower = src.toLowerCase();
  const altLower = (alt ?? '').toLowerCase();

  // SVG files are almost always icons/illustrations, never photographs
  if (/\.svg(\?|$)/i.test(srcLower)) return 'icon';

  // URL path heuristics for icons
  if (/\b(icon|ico|glyph|symbol|emoji|badge-icon|ui-icon)\b/i.test(srcLower)) return 'icon';

  // URL path heuristics for decorative
  if (/\b(bg|background|pattern|texture|gradient|divider|separator|spacer|decoration|overlay)\b/i.test(srcLower)) return 'decorative';

  // URL path heuristics for illustrations
  if (/\b(illustration|drawing|vector|graphic|clipart|cartoon)\b/i.test(srcLower)) return 'illustration';

  // Alt text heuristics for icons
  if (/\b(icon|arrow|chevron|checkmark|check mark|bullet|dot|close|menu|hamburger)\b/i.test(altLower)) return 'icon';

  // Dimension-based classification
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const maxDim = Math.max(dimensions.width, dimensions.height);
    const minDim = Math.min(dimensions.width, dimensions.height);
    const ratio = maxDim / minDim;

    // Square-ish and small = icon (service icons are typically 80-128px square)
    if (ratio < 1.5 && maxDim <= 128) return 'icon';
    // Very small regardless of ratio
    if (maxDim <= 64) return 'icon';
  }

  return 'unknown'; // Assumed to be a photo/content image
}

/** Well-known third-party brands that should never be selected as the site's own logo. */
const THIRD_PARTY_BRAND_PATTERN =
  /\b(google|facebook|meta|yelp|youtube|twitter|instagram|linkedin|pinterest|tiktok|amazon|apple|microsoft|yahoo|tripadvisor|trustpilot|angies?\s*list|homeadvisor|thumbtack|nextdoor|carfax|autotrader|stripe|paypal|visa|mastercard|amex|discover|square|venmo|shopify|wordpress|wix|squarespace|godaddy|cloudflare|mailchimp|hubspot|salesforce|quickbooks|intuit|bbb|better\s*business)\b/i;

const TEAM_PATTERNS = /\b(attorney|lawyer|founder|partner|ceo|director|president|owner|team|staff|headshot|portrait|about[-\s]us|dr\.|esq\.?)\b/i;
const TRUST_PATTERNS = /\b(award|badge|rating|verified|avvo|reviews?|stars?|accreditation|certification|bbb|chamber|association|member|trusted|guarantee|seal)\b/i;
const EVENT_PATTERNS = /\b(ceremony|event|office|conference|seminar|meeting|retreat|workshop|celebration|reception)\b/i;
const SECTION_CONTEXT_PATTERN = /\b(partner|sponsor|member|certif|accredit|as\s+seen|trusted\s+by|featured\s+in|our\s+clients|affiliat|recogni|award)\b/i;
const JUNK_URL_PATTERN =
  /thumb(nail)?s?[\-_\/\.]|spacer|pixel|tracking|transparent\.|1x1|blank\.|spinner|loader/i;

/**
 * Classify images into semantic roles based on alt text, surrounding context, and URL path.
 */
export function classifyImages(
  images: ExtractedImageItem[],
  $: cheerio.CheerioAPI,
  baseUrl: string
): { teamPhotos: ClassifiedImage[]; trustBadges: ClassifiedImage[]; eventPhotos: ClassifiedImage[]; unclassified: ExtractedImageItem[] } {
  const teamPhotos: ClassifiedImage[] = [];
  const trustBadges: ClassifiedImage[] = [];
  const eventPhotos: ClassifiedImage[] = [];
  const unclassified: ExtractedImageItem[] = [];

  for (const img of images) {
    // Build a text signal from alt, URL path, and surrounding element text
    const alt = img.alt ?? "";
    const urlPath = img.src.replace(/https?:\/\/[^/]+/, "");
    // Find the img in DOM and get parent text for extra context
    let parentText = "";
    try {
      const imgEl = $(`img[src="${img.src}"], img[src="${urlPath}"]`).first();
      parentText = imgEl.parent()?.text()?.trim()?.slice(0, 200) ?? "";
    } catch {
      // URLs with CSS-special chars (\, [, ]) break attribute selectors — skip DOM lookup
    }
    const signal = [alt, urlPath, parentText].join(" ");

    if (TEAM_PATTERNS.test(signal)) {
      teamPhotos.push({ src: img.src, alt: alt || undefined });
    } else if (TRUST_PATTERNS.test(signal)) {
      trustBadges.push({ src: img.src, alt: alt || undefined });
    } else if (EVENT_PATTERNS.test(signal)) {
      eventPhotos.push({ src: img.src, alt: alt || undefined });
    } else {
      unclassified.push(img);
    }
  }

  return { teamPhotos, trustBadges, eventPhotos, unclassified };
}

/**
 * Resolve the best logo URL from a DOM element, preferring SVG and high-res variants.
 */
function resolveLogoUrl(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imgEl: cheerio.Cheerio<any>,
  baseUrl: string
): string | undefined {
  // Prefer SVG sibling (many sites render both raster and SVG logos)
  const parent = imgEl.parent();
  const svgSource = parent.find('source[srcset$=".svg"], source[type="image/svg+xml"]').first();
  if (svgSource.length) {
    const svgSrc = svgSource.attr("srcset");
    if (svgSrc && !svgSrc.startsWith("data:")) return resolveUrl(baseUrl, svgSrc);
  }
  // Prefer srcset high-res variant
  const srcset = imgEl.attr("srcset") || imgEl.attr("data-srcset");
  if (srcset) {
    const entries = srcset
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        const url = parts[0];
        const desc = parts[1] ?? "";
        let size = 0;
        if (desc.endsWith("w")) size = parseInt(desc, 10) || 0;
        else if (desc.endsWith("x")) size = (parseFloat(desc) || 1) * 1000;
        return { url, size };
      })
      .filter((e) => e.url && !e.url.startsWith("data:"));
    if (entries.length) {
      entries.sort((a, b) => b.size - a.size);
      return resolveUrl(baseUrl, entries[0].url);
    }
  }
  // Lazy-loaded
  const dataSrc = imgEl.attr("data-src") || imgEl.attr("data-lazy-src");
  if (dataSrc && !dataSrc.startsWith("data:")) return resolveUrl(baseUrl, dataSrc);
  // Standard src
  const src = imgEl.attr("src");
  if (src && !src.startsWith("data:")) return resolveUrl(baseUrl, src);
  return undefined;
}

/**
 * Score all <img> elements on the page and return ranked logo candidates.
 * Signals: DOM position (header/nav), keywords, homepage link, business name match,
 * SVG format, and negative penalties for trust badges, team photos, section context.
 */
export function scoreLogoCandidatesRanked(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  businessName: string | undefined
): LogoCandidate[] {
  const allCandidates: LogoCandidate[] = [];

  const siteHost = (() => {
    try { return new URL(baseUrl).hostname; } catch { return ""; }
  })();
  const bizLower = businessName?.toLowerCase();

  $("img").each((_, el) => {
    const imgEl = $(el);
    const rawSrc = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("data-original") || imgEl.attr("src");
    if (!rawSrc || rawSrc.startsWith("data:")) return;
    const resolved = resolveUrl(baseUrl, rawSrc);
    if (JUNK_URL_PATTERN.test(resolved)) return;

    // Skip very tiny images (tracking pixels, micro-icons)
    const w = parseInt(imgEl.attr("width") ?? "0", 10);
    const h = parseInt(imgEl.attr("height") ?? "0", 10);
    if ((w > 0 && w < 20) || (h > 0 && h < 20)) return;

    const alt = (imgEl.attr("alt") ?? "").toLowerCase();
    const urlPath = resolved.replace(/https?:\/\/[^/]+/, "").toLowerCase();
    let score = 0;

    // === Positive signals ===
    if (imgEl.closest("header").length) score += 30;
    else if (imgEl.closest("nav").length) score += 20;

    const parentLink = imgEl.closest("a");
    if (parentLink.length) {
      const href = parentLink.attr("href") ?? "";
      if (href === "/" || href === baseUrl || href === baseUrl + "/") score += 15;
    }

    if (/logo|brand/.test(alt) || /logo|brand/.test(urlPath)) score += 15;
    if (bizLower && bizLower.length > 2 && alt.includes(bizLower)) score += 10;
    if (/\.svg(\?|$)/i.test(resolved)) score += 5;

    // === Negative signals ===
    const parentText = imgEl.parent()?.text()?.trim()?.slice(0, 200)?.toLowerCase() ?? "";
    const signal = [alt, urlPath, parentText].join(" ");

    if (TRUST_PATTERNS.test(signal)) score -= 40;
    if (TEAM_PATTERNS.test(signal)) score -= 30;
    if (EVENT_PATTERNS.test(signal)) score -= 15;

    // Third-party brand images should never be selected as the business logo
    if (THIRD_PARTY_BRAND_PATTERN.test(signal)) score -= 40;

    // Images inside carousels/sliders are usually partner/client logos
    if (imgEl.closest(".swiper, .slick-slider, .owl-carousel, [class*='carousel'], [class*='slider']").length) {
      score -= 15;
    }

    // Section context: walk up to find nearest heading indicating partner/badge section
    let container = imgEl.parent();
    for (let i = 0; i < 5 && container.length && !container.is("body, html"); i++) {
      const heading = container.children("h2, h3, h4").first().text()?.trim();
      if (heading && SECTION_CONTEXT_PATTERN.test(heading)) {
        score -= 20;
        break;
      }
      container = container.parent();
    }

    // Parent/grandparent text for partner/trust context
    const gpText = imgEl.parent()?.parent()?.text()?.trim()?.slice(0, 300)?.toLowerCase() ?? "";
    if (SECTION_CONTEXT_PATTERN.test(parentText) || SECTION_CONTEXT_PATTERN.test(gpText)) {
      score -= 15;
    }

    // External domain (third-party images are rarely the site's own logo)
    let candidateIsExternal = false;
    try {
      const imgHost = new URL(resolved).hostname;
      if (siteHost && imgHost !== siteHost && !imgHost.endsWith(`.${siteHost}`) && !siteHost.endsWith(`.${imgHost}`)) {
        score -= 15;
        candidateIsExternal = true;
      }
    } catch { /* invalid URL, skip penalty */ }

    // Footer (without also being in header) is a weak logo position
    if (imgEl.closest("footer").length && !imgEl.closest("header").length) score -= 10;

    const position: LogoCandidate["position"] = imgEl.closest("header").length ? "header"
      : imgEl.closest("nav").length ? "nav"
      : imgEl.closest("footer").length ? "footer" : "body";

    allCandidates.push({
      url: resolveLogoUrl($, imgEl, baseUrl) ?? resolved,
      score,
      alt: (imgEl.attr("alt") ?? "").slice(0, 200),
      position,
      isSvg: /\.svg(\?|$)/i.test(resolved),
      isExternal: candidateIsExternal,
    });
  });

  return allCandidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) {
    try {
      const u = new URL(base);
      return `${u.origin}${href}`;
    } catch {
      return href;
    }
  }
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export function extractAssets(html: string, css: string, baseUrl: string): ExtractedAssets {
  const $ = cheerio.load(html);

  const colors = extractColorsFromCss(css);
  const fonts = extractFontsFromCss(css);

  const images: ExtractedImage = [];
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");

    // Prefer high-res variants: srcset > data-src > src
    const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
    let bestSrc: string | undefined;
    if (srcset) {
      const entries = srcset
        .split(",")
        .map((entry) => {
          const parts = entry.trim().split(/\s+/);
          const url = parts[0];
          const descriptor = parts[1] ?? "";
          let size = 0;
          if (descriptor.endsWith("w")) size = parseInt(descriptor, 10) || 0;
          else if (descriptor.endsWith("x")) size = (parseFloat(descriptor) || 1) * 1000;
          return { url, size };
        })
        .filter((e) => e.url && !e.url.startsWith("data:"));
      if (entries.length) {
        entries.sort((a, b) => b.size - a.size);
        bestSrc = entries[0].url;
      }
    }
    if (!bestSrc) {
      bestSrc =
        $(el).attr("data-src") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-original") ||
        $(el).attr("src") ||
        undefined;
    }

    if (bestSrc && !bestSrc.startsWith("data:")) {
      const resolved = resolveUrl(baseUrl, bestSrc);
      // Skip likely non-content images (tracking pixels, spacers, tiny icons)
      if (JUNK_URL_PATTERN.test(resolved)) return;
      const w = parseInt($(el).attr("width") ?? "0", 10);
      const h = parseInt($(el).attr("height") ?? "0", 10);
      if ((w > 0 && w < 50) || (h > 0 && h < 50)) return;
      const dims = (w > 0 || h > 0) ? { width: w, height: h } : undefined;
      const imgItem: ExtractedImageItem = {
        src: resolved,
        alt: alt ?? undefined,
        dimensions: dims,
      };
      imgItem.imageType = classifyImageType(resolved, alt ?? '', dims);
      images.push(imgItem);
    }
  });

  // Extract background-image URLs from CSS and inline styles
  const bgImagePattern = /background(?:-image)?\s*:\s*[^;]*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  const bgImageSeen = new Set(images.map((img) => img.src));

  // From CSS source
  for (const match of css.matchAll(bgImagePattern)) {
    const raw = match[1];
    if (!raw || raw.startsWith("data:") || /\\/.test(raw)) continue;
    const resolved = resolveUrl(baseUrl, raw);
    if (JUNK_URL_PATTERN.test(resolved) || bgImageSeen.has(resolved)) continue;
    bgImageSeen.add(resolved);
    images.push({ src: resolved, alt: undefined, imageType: 'decorative' });
  }

  // From inline style attributes in HTML
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    for (const match of style.matchAll(bgImagePattern)) {
      const raw = match[1];
      if (!raw || raw.startsWith("data:") || /\\/.test(raw)) continue;
      const resolved = resolveUrl(baseUrl, raw);
      if (JUNK_URL_PATTERN.test(resolved) || bgImageSeen.has(resolved)) continue;
      bgImageSeen.add(resolved);
      images.push({ src: resolved, alt: undefined, imageType: 'decorative' });
    }
  });

  const copy: ExtractedCopy = {};
  const rawH1 = $("h1").first().text().trim();
  const h2s: string[] = [];
  $("h2").each((_, el) => {
    const t = $(el).text().trim();
    if (t && !h2s.includes(t) && !isJunkCopy(t)) h2s.push(t);
  });

  if (rawH1 && !isJunkCopy(rawH1)) {
    copy.h1 = rawH1;
  } else if (h2s.length) {
    copy.h1 = h2s[0];
  }
  // Do NOT fall back to meta description or og:title as h1 — they're metadata,
  // not headlines. Missing h1 is handled by SPARSE DATA guidance in creative agents.

  // Extract title tag and business name
  const titleTag = $("title").first().text().trim();
  if (titleTag) copy.titleTag = titleTag;

  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (ogSiteName && !isJunkCopy(ogSiteName)) {
    copy.businessName = ogSiteName;
  } else if (titleTag) {
    // Clean title tag: strip suffixes like " | Home", " - Welcome", " – About Us"
    const cleaned = titleTag
      .replace(/\s*[|–—-]\s*(home|welcome|about\s*us|contact|main|official\s*site|official\s*website).*$/i, "")
      .trim();
    if (cleaned && !isJunkCopy(cleaned)) {
      copy.businessName = cleaned;
    }
  }

  if (h2s.length) copy.h2 = h2s.slice(0, 5);

  const heroSection = $("header").first().length
    ? $("header").first()
    : $("main").first().length
      ? $("main").first()
      : $("body").children().first();
  const heroText = heroSection.find("p").first().text().trim();
  if (heroText && !isJunkCopy(heroText)) copy.heroText = heroText;

  const navItems: string[] = [];
  $("nav a").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 50 && !isJunkCopy(t)) navItems.push(t);
  });
  if (navItems.length) copy.navItems = navItems.slice(0, 8);

  const ctaTexts: string[] = [];
  const ctaSeen = new Set<string>();
  const MAX_CTAS = 3;

  // Button/CTA elements
  $('a[href*="contact"], a[href*="quote"], a[href*="book"], a[href*="schedule"], .cta, .button, [class*="cta"], [class*="button"]').each((_, el) => {
    if (ctaTexts.length >= MAX_CTAS) return;
    const t = $(el).text().trim();
    // Use blocklist only — CTAs are naturally short (e.g., "Schedule Now", "Get a Quote")
    if (!t || t.length > 60 || COPY_BLOCKLIST.has(t.toLowerCase()) || ctaSeen.has(t.toLowerCase())) return;
    ctaSeen.add(t.toLowerCase());
    ctaTexts.push(t);
  });

  // Phone links
  $('a[href^="tel:"]').each((_, el) => {
    if (ctaTexts.length >= MAX_CTAS) return;
    const text = $(el).text().trim() || $(el).attr("href")?.replace("tel:", "") || "";
    if (!text || ctaSeen.has(text.toLowerCase())) return;
    ctaSeen.add(text.toLowerCase());
    ctaTexts.push(text);
  });

  // Email links
  $('a[href^="mailto:"]').each((_, el) => {
    if (ctaTexts.length >= MAX_CTAS) return;
    const text = $(el).text().trim() || $(el).attr("href")?.replace("mailto:", "") || "";
    if (!text || ctaSeen.has(text.toLowerCase())) return;
    ctaSeen.add(text.toLowerCase());
    ctaTexts.push(text);
  });

  if (ctaTexts.length) copy.ctaText = ctaTexts;

  const bodySamples: string[] = [];
  $("p").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 20 && t.length < 300 && !isJunkCopy(t)) bodySamples.push(t);
  });
  if (bodySamples.length) copy.bodySamples = bodySamples.slice(0, 5);

  // Testimonials
  const testimonials = extractTestimonials($);
  if (testimonials.length) copy.testimonials = testimonials;

  // Features / services
  const features = extractFeatures($);
  if (features.length) copy.features = features;

  // Phone number
  const phoneNumber = extractPhoneNumber($);
  if (phoneNumber) copy.phoneNumber = phoneNumber;

  // Aggregate rating (Google Reviews, Yelp, etc.)
  const rating = extractRatingData($);
  if (rating) copy.rating = rating;

  // Logo detection: score all <img> candidates by position, keywords, and negative signals
  const logoCandidates = scoreLogoCandidatesRanked($, baseUrl, copy.businessName);
  const logo = logoCandidates[0]?.url;

  // Semantic classification of site images (skip logo)
  const siteImages = images.filter((img) => img.src !== logo);
  const classified = classifyImages(siteImages, $, baseUrl);

  return {
    colors,
    fonts,
    images: classified.unclassified,
    copy,
    logo,
    ...(logoCandidates.length > 0 ? { logoCandidates } : {}),
    ...(classified.teamPhotos.length > 0 ? { teamPhotos: classified.teamPhotos } : {}),
    ...(classified.trustBadges.length > 0 ? { trustBadges: classified.trustBadges } : {}),
    ...(classified.eventPhotos.length > 0 ? { eventPhotos: classified.eventPhotos } : {}),
  };
}
