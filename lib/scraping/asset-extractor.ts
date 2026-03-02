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

export interface ExtractedColor {
  hex: string;
  count?: number;
}

export type ExtractedColors = ExtractedColor[];

export interface ExtractedFont {
  family: string;
  source?: string;
}

export type ExtractedFonts = ExtractedFont[];

export interface ExtractedImageItem {
  src: string;
  alt?: string;
  role?: string;
}

export type ExtractedImage = ExtractedImageItem[];

export interface ExtractedCopy {
  h1?: string;
  h2?: string[];
  heroText?: string;
  navItems?: string[];
  ctaText?: string;
  bodySamples?: string[];
}

export interface ClassifiedImage {
  src: string;
  alt?: string;
}

export interface ExtractedAssets {
  colors: ExtractedColors;
  fonts: ExtractedFonts;
  images: ExtractedImage;
  copy: ExtractedCopy;
  logo?: string;
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
    const value = match[2].trim();
    const resolved = resolveVarReferences(value, customProps);
    const families = resolved.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
    for (const f of families) {
      const key = f.toLowerCase();
      if (!seen.has(key) && !GENERIC_FONTS.has(key) && f.length > 1) {
        seen.add(key);
        fonts.push({ family: f, source: "custom-property" });
      }
    }
  }

  // Standard font-family declarations
  for (const match of css.matchAll(FONT_FAMILY_PATTERN)) {
    const raw = match[1].trim();
    // Resolve var() references in font-family values
    const resolved = resolveVarReferences(raw, customProps);
    const families = resolved.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
    for (const f of families) {
      const key = f.toLowerCase();
      if (!seen.has(key) && !GENERIC_FONTS.has(key) && f.length > 1) {
        seen.add(key);
        fonts.push({ family: f });
      }
    }
  }

  return fonts.slice(0, 8);
}

const TEAM_PATTERNS = /\b(attorney|lawyer|founder|partner|ceo|director|president|owner|team|staff|headshot|portrait|about[-\s]us|dr\.|esq\.?)\b/i;
const TRUST_PATTERNS = /\b(award|badge|rating|verified|avvo|reviews?|stars?|accreditation|certification|bbb|chamber|association|member|trusted|guarantee|seal)\b/i;
const EVENT_PATTERNS = /\b(ceremony|event|office|conference|seminar|meeting|retreat|workshop|celebration|reception)\b/i;

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
    const imgEl = $(`img[src="${img.src}"], img[src="${urlPath}"]`).first();
    const parentText = imgEl.parent()?.text()?.trim()?.slice(0, 200) ?? "";
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

  const JUNK_URL_PATTERN =
    /thumb(nail)?s?[\-_\/\.]|spacer|pixel|tracking|transparent\.|1x1|blank\.|spinner|loader/i;

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
      images.push({
        src: resolved,
        alt: alt ?? undefined,
      });
    }
  });

  const copy: ExtractedCopy = {};
  const rawH1 = $("h1").first().text().trim();
  const h2s: string[] = [];
  $("h2").each((_, el) => {
    const t = $(el).text().trim();
    if (t && !h2s.includes(t) && !isJunkCopy(t)) h2s.push(t);
  });
  const metaDesc = $('meta[name="description"]').attr("content")?.trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();

  if (rawH1 && !isJunkCopy(rawH1)) {
    copy.h1 = rawH1;
  } else if (h2s.length) {
    copy.h1 = h2s[0];
  } else if (metaDesc && !isJunkCopy(metaDesc)) {
    copy.h1 = metaDesc.slice(0, 120);
  } else if (ogTitle && !isJunkCopy(ogTitle)) {
    copy.h1 = ogTitle;
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

  const ctaCandidates = $('a[href*="contact"], a[href*="quote"], a[href*="book"], a[href*="schedule"], .cta, .button, [class*="cta"], [class*="button"]');
  const ctaText = ctaCandidates.first().text().trim();
  if (ctaText && !isJunkCopy(ctaText)) copy.ctaText = ctaText;

  const bodySamples: string[] = [];
  $("p").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 20 && t.length < 300 && !isJunkCopy(t)) bodySamples.push(t);
  });
  if (bodySamples.length) copy.bodySamples = bodySamples.slice(0, 5);

  // Logo heuristics: first img in header, or img with "logo" in src/alt
  // Prefer SVG variants and srcset high-res versions for crisp logos
  let logo: string | undefined;
  const logoImg = $('header img[alt*="logo"], img[src*="logo"], img[alt*="Logo"]').first();
  if (logoImg.length) {
    // Check for SVG sibling (many sites render both raster and SVG logos)
    const parent = logoImg.parent();
    const svgSource = parent.find('source[srcset$=".svg"], source[type="image/svg+xml"]').first();
    if (svgSource.length) {
      const svgSrc = svgSource.attr("srcset");
      if (svgSrc && !svgSrc.startsWith("data:")) {
        logo = resolveUrl(baseUrl, svgSrc);
      }
    }
    // Check srcset for higher-res logo
    if (!logo) {
      const srcset = logoImg.attr("srcset") || logoImg.attr("data-srcset");
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
          logo = resolveUrl(baseUrl, entries[0].url);
        }
      }
    }
    // Check data-src (lazy-loaded logos)
    if (!logo) {
      const dataSrc = logoImg.attr("data-src") || logoImg.attr("data-lazy-src");
      if (dataSrc && !dataSrc.startsWith("data:")) {
        logo = resolveUrl(baseUrl, dataSrc);
      }
    }
    // Fall back to src
    if (!logo) {
      const src = logoImg.attr("src");
      if (src && !src.startsWith("data:")) logo = resolveUrl(baseUrl, src);
    }
  }
  if (!logo && images.length) {
    logo = images[0].src;
  }

  // Semantic classification of site images (skip logo)
  const siteImages = images.filter((img) => img.src !== logo);
  const classified = classifyImages(siteImages, $, baseUrl);

  return {
    colors,
    fonts,
    images: classified.unclassified,
    copy,
    logo,
    ...(classified.teamPhotos.length > 0 ? { teamPhotos: classified.teamPhotos } : {}),
    ...(classified.trustBadges.length > 0 ? { trustBadges: classified.trustBadges } : {}),
    ...(classified.eventPhotos.length > 0 ? { eventPhotos: classified.eventPhotos } : {}),
  };
}
