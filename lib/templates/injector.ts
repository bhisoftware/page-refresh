/**
 * Inject extracted assets (colors, fonts, copy) into template HTML/CSS.
 * All user-extracted text is HTML-escaped to prevent XSS.
 */

import type { ExtractedAssets } from "@/lib/scraping/asset-extractor";

function escapeHtml(s: string): string {
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

const PLACEHOLDERS = {
  headline: "{{headline}}",
  subheadline: "{{subheadline}}",
  ctaText: "{{ctaText}}",
  screenshot: "YOUR_SCREENSHOT_URL",
  logo: "YOUR_LOGO",
} as const;

export function injectAssets(
  html: string,
  css: string,
  assets: ExtractedAssets
): { html: string; css: string } {
  let outHtml = html;
  let outCss = css;

  const headline = escapeHtml(assets.copy.h1 ?? assets.copy.heroText ?? "Your Headline");
  const subheadline = escapeHtml(
    assets.copy.heroText ?? assets.copy.bodySamples?.[0] ?? "Supporting text for your value proposition."
  );
  const ctaText = escapeHtml(assets.copy.ctaText ?? "Get Started");

  outHtml = outHtml
    .replace(new RegExp(PLACEHOLDERS.headline, "g"), headline)
    .replace(new RegExp(PLACEHOLDERS.subheadline, "g"), subheadline)
    .replace(new RegExp(PLACEHOLDERS.ctaText, "g"), ctaText);

  const rawScreenshot = assets.images?.[0]?.src ?? assets.logo ?? "";
  const rawLogo = assets.logo ?? assets.images?.[0]?.src ?? "";
  const screenshotUrl = isValidHttpUrl(rawScreenshot) ? rawScreenshot : "";
  const logoUrl = isValidHttpUrl(rawLogo) ? rawLogo : "";
  const raw1 = assets.images?.[0]?.src ?? "";
  const raw2 = assets.images?.[1]?.src ?? "";
  const raw3 = assets.images?.[2]?.src ?? "";
  const img1Url = isValidHttpUrl(raw1) ? raw1 : screenshotUrl;
  const img2Url = isValidHttpUrl(raw2) ? raw2 : screenshotUrl;
  const img3Url = isValidHttpUrl(raw3) ? raw3 : screenshotUrl;

  outHtml = outHtml
    .replace(/YOUR_SCREENSHOT_URL/g, screenshotUrl)
    .replace(/YOUR_SCREENSHOT_1_URL/g, img1Url)
    .replace(/YOUR_SCREENSHOT_2_URL/g, img2Url)
    .replace(/YOUR_SCREENSHOT_3_URL/g, img3Url)
    .replace(/YOUR_LOGO_1_URL|YOUR_LOGO_2_URL|YOUR_LOGO_3_URL|YOUR_LOGO_4_URL|YOUR_LOGO_5_URL|YOUR_LOGO_6_URL/g, logoUrl);

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
