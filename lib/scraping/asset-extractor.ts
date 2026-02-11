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

export interface ExtractedAssets {
  colors: ExtractedColors;
  fonts: ExtractedFonts;
  images: ExtractedImage;
  copy: ExtractedCopy;
  logo?: string;
}

const HEX_PATTERN = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}"']+)/g;
const RGB_PATTERN = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function extractColorsFromCss(css: string): ExtractedColors {
  const colorMap = new Map<string, number>();

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

  for (const match of css.matchAll(FONT_FAMILY_PATTERN)) {
    const raw = match[1].trim();
    const families = raw.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
    for (const f of families) {
      const key = f.toLowerCase();
      if (!seen.has(key) && !["inherit", "initial", "unset", "system-ui", "sans-serif", "serif"].includes(key)) {
        seen.add(key);
        fonts.push({ family: f });
      }
    }
  }

  return fonts.slice(0, 8);
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
    const src = $(el).attr("src");
    const alt = $(el).attr("alt");
    if (src && !src.startsWith("data:")) {
      images.push({
        src: resolveUrl(baseUrl, src),
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
  let logo: string | undefined;
  const logoImg = $('header img[alt*="logo"], img[src*="logo"], img[alt*="Logo"]').first();
  if (logoImg.length) {
    const src = logoImg.attr("src");
    if (src && !src.startsWith("data:")) logo = resolveUrl(baseUrl, src);
  }
  if (!logo && images.length) {
    logo = images[0].src;
  }

  return {
    colors,
    fonts,
    images,
    copy,
    logo,
  };
}
