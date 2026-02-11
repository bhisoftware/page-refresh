/**
 * Compose full-page HTML/CSS from an ordered list of section templates.
 * Phase 2 watch-outs:
 * 1. Page scaffolding: CSS reset, section spacing, font loading (--font-family set here; injector adds value from assets).
 * 2. Sections are concatenated with consistent spacing; no scripts in scaffold (iframe sandbox stays allow-same-origin unless we add allow-scripts for interactive templates).
 * 3. Output may still contain {{placeholders}}; pipeline must validate/strip before persisting (see injector.stripUnresolvedPlaceholders).
 */

import type { CachedTemplate } from "@/lib/cache/seed-cache";

/** Minimal reset + page container + section spacing. Font family is applied on body; injector sets :root --font-family from assets. */
const BASE_CSS = `/* Page scaffold: reset, section spacing, font scaffolding */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  font-family: var(--font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  line-height: 1.5;
  color: var(--text-color, #1a1a1a);
}
.page { min-height: 100vh; }
.page-main { display: flex; flex-direction: column; }
.page-section {
  margin: 0;
  padding: 0;
}
.page-section + .page-section { margin-top: 0; }
/* Section spacing: consistent gap between concatenated sections (tune as needed) */
.page-section + .page-section { margin-top: 2rem; }
@media (min-width: 768px) {
  .page-section + .page-section { margin-top: 3rem; }
}
`;

/**
 * Compose one full page from an ordered list of section templates.
 * Returns body-level HTML and full CSS (scaffold + section CSS). Caller should run injectAssets then applyRefreshedCopy; then validate no raw {{...}} remains (stripUnresolvedPlaceholders) before persisting.
 */
export function composePage(sections: CachedTemplate[]): { html: string; css: string } {
  if (sections.length === 0) {
    return {
      html: '<main class="page-main"></main>',
      css: BASE_CSS,
    };
  }

  const sectionsHtml = sections
    .map(
      (s) =>
        `<section class="page-section section-${s.name.replace(/[^a-z0-9-]/gi, "-")}" data-section="${escapeAttr(s.name)}">${s.htmlTemplate}</section>`
    )
    .join("\n");

  const html = `<main class="page-main">\n${sectionsHtml}\n</main>`;

  const sectionsCss = sections
    .map((s) => `\n/* section: ${s.name} */\n${s.cssTemplate}`)
    .join("\n");

  const css = BASE_CSS + sectionsCss;

  return { html, css };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
