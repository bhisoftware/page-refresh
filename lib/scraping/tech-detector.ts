/**
 * Detect tech stack from HTML (frameworks, CMS, CSS, analytics).
 * Ported patterns from site-analyzer-tool for pipeline context.
 */

export interface TechStack {
  frameworks: string[];
  cms: string[];
  cssFrameworks: string[];
  analytics: string[];
}

/**
 * Detect whether HTML is an unrendered SPA shell (empty content + framework markers).
 * Uses regex/string checks only — no cheerio — for speed in the fetch path.
 */
export function isSpaShell(html: string): boolean {
  const lower = html.toLowerCase();

  // --- Text content check: require at least one of h1 or substantial paragraph ---
  const hasH1 = (() => {
    const match = lower.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    return match ? match[1].replace(/<[^>]*>/g, "").trim().length > 0 : false;
  })();

  const hasSubstantialP = /<p[^>]*>([\s\S]*?)<\/p>/gi.test(html) &&
    Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).some(
      (m) => m[1].replace(/<[^>]*>/g, "").trim().length > 20
    );

  // If there's meaningful text content (h1 or substantial paragraph), it's not a shell
  if (hasH1 || hasSubstantialP) return false;

  // Note: images alone don't prove real content — SPAs often have placeholder/skeleton
  // images while the JS-rendered content is missing. Only text content (h1/p) is
  // a reliable indicator of a fully rendered page.

  // --- Framework markers: AT LEAST ONE must be true ---
  const hasFrameworkMarker =
    /id\s*=\s*["'](root|app)["']/i.test(html) ||
    lower.includes("_reactrootcontainer") ||
    lower.includes("__react") ||
    /data-v-/i.test(html) ||
    /ng-version/i.test(html) ||
    /type\s*=\s*["']module["'][^>]+\.(jsx|tsx|vue)["']/i.test(html);

  return hasFrameworkMarker;
}

export function detectTechStack(html: string): TechStack {
  const lower = html.toLowerCase();
  const frameworks: string[] = [];
  const cms: string[] = [];
  const cssFrameworks: string[] = [];
  const analytics: string[] = [];

  // React / Next.js
  if (lower.includes("__next_data__") || lower.includes("_next") || lower.includes("/_next/")) {
    frameworks.push("Next.js");
  } else if (lower.includes("_reactrootcontainer") || lower.includes("reactroot")) {
    frameworks.push("React");
  }

  // Vue
  if (lower.includes("data-v-")) {
    frameworks.push("Vue");
  }

  // Angular
  if (lower.includes("ng-version")) {
    frameworks.push("Angular");
  }

  // CMS
  if (lower.includes("wp-content") || lower.includes("wp-includes")) {
    cms.push("WordPress");
  }
  if (lower.includes("cdn.shopify.com")) {
    cms.push("Shopify");
  }
  if (lower.includes("squarespace") || lower.includes("static1.squarespace")) {
    cms.push("Squarespace");
  }
  if (lower.includes("wix.com") || lower.includes("wixstatic")) {
    cms.push("Wix");
  }
  if (lower.includes("webflow")) {
    cms.push("Webflow");
  }

  // CSS frameworks — Tailwind: utility patterns
  if (/\b(flex|grid|px-|py-|mt-|mb-|text-|bg-|rounded-|shadow-|gap-|items-|justify-)\b/.test(html)) {
    cssFrameworks.push("Tailwind");
  }
  if (lower.includes("bootstrap") || (lower.includes("container") && lower.includes("row"))) {
    cssFrameworks.push("Bootstrap");
  }

  // Scripts / analytics
  if (lower.includes("jquery") || lower.includes("jquery.min")) {
    frameworks.push("jQuery");
  }
  if (lower.includes("gsap") || lower.includes("greensock")) {
    frameworks.push("GSAP");
  }
  if (lower.includes("google-analytics.com") || lower.includes("googletagmanager.com/gtag") || lower.includes("ga(")) {
    analytics.push("Google Analytics");
  }
  if (lower.includes("googletagmanager.com") && lower.includes("gtm.js")) {
    analytics.push("Google Tag Manager");
  }
  if (lower.includes("hotjar") || lower.includes("hj(")) {
    analytics.push("Hotjar");
  }

  return {
    frameworks: [...new Set(frameworks)],
    cms: [...new Set(cms)],
    cssFrameworks: [...new Set(cssFrameworks)],
    analytics: [...new Set(analytics)],
  };
}
