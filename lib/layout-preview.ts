/**
 * Wraps layout HTML and CSS in a full document for iframe preview.
 * Optionally injects viewport meta for desktop-width rendering.
 */
export function wrapInDocument(html: string, css: string, options?: { desktopViewport?: boolean }): string {
  const trimmed = html.trim();
  const hasHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(trimmed);
  if (hasHtml) return html;
  const safe = trimmed
    .replace(/<\/body\s*>/gi, "&lt;/body&gt;")
    .replace(/<\/html\s*>/gi, "&lt;/html&gt;");
  const viewportMeta = options?.desktopViewport
    ? '<meta name="viewport" content="width=1280">'
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${viewportMeta}<style>${css}</style></head><body>${safe}</body></html>`;
}
