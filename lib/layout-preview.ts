export interface WrapInDocumentOptions {
  /** Inject viewport meta for desktop-width rendering (e.g. width=1280). */
  desktopViewport?: boolean;
  /** Scale factor (0–1) applied to body so content fits without horizontal scroll. */
  scaleToFit?: number;
}

/**
 * Wraps layout HTML and CSS in a full document for iframe preview.
 * Optionally injects viewport meta and/or scale so content fits in the iframe width.
 */
export function wrapInDocument(
  html: string,
  css: string,
  options?: WrapInDocumentOptions
): string {
  const trimmed = html.trim();
  const hasHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(trimmed);
  if (hasHtml) return html;
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${viewportMeta}${scaleStyle}<style>${css}</style></head><body>${safe}</body></html>`;
}
