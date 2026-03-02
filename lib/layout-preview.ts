export interface WrapInDocumentOptions {
  /** Inject viewport meta for desktop-width rendering (e.g. width=1280). */
  desktopViewport?: boolean;
  /** Scale factor (0–1) applied to body so content fits without horizontal scroll. */
  scaleToFit?: number;
}

/**
 * Prevents all link navigation and form submissions inside the iframe preview.
 * Injected as the last script so it runs after any framework JS (e.g. Tailwind CDN).
 */
const LINK_DISABLE_SCRIPT = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a)e.preventDefault();},true);document.addEventListener('submit',function(e){e.preventDefault();},true);</script>`;

/**
 * Wraps layout HTML and CSS in a full document for iframe preview.
 * Optionally injects viewport meta and/or scale so content fits in the iframe width.
 * Always injects a script to disable link navigation and form submissions.
 */
export function wrapInDocument(
  html: string,
  css: string,
  options?: WrapInDocumentOptions
): string {
  const trimmed = html.trim();
  const hasHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(trimmed);
  if (hasHtml) {
    // Full document from AI — inject link-disable script before </body> or </html>
    if (/<\/body\s*>/i.test(trimmed)) {
      return trimmed.replace(/<\/body\s*>/i, `${LINK_DISABLE_SCRIPT}</body>`);
    }
    if (/<\/html\s*>/i.test(trimmed)) {
      return trimmed.replace(/<\/html\s*>/i, `${LINK_DISABLE_SCRIPT}</html>`);
    }
    return trimmed + LINK_DISABLE_SCRIPT;
  }
  const safe = trimmed
    .replace(/<\/body\s*>/gi, "&lt;/body&gt;")
    .replace(/<\/html\s*>/gi, "&lt;/html&gt;");
  const viewportMeta = options?.desktopViewport
    ? '<meta name="viewport" content="width=1280">'
    : "";
  const scaleStyle =
    options?.scaleToFit != null && options.scaleToFit > 0 && options.scaleToFit <= 1
      ? `<style>html{zoom:${options.scaleToFit};}</style>`
      : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${viewportMeta}${scaleStyle}<style>${css}</style></head><body>${safe}${LINK_DISABLE_SCRIPT}</body></html>`;
}
