/**
 * Injects a "Refreshed by Page Refresh" attribution badge into layout HTML.
 * Includes a 1x1 tracking pixel so we can detect when the code is live.
 */

const BADGE_BG = "#f5f0eb"; // beige/taupe
const BADGE_TEXT = "#2d5a3d"; // forest green
const BADGE_HOVER = "#1e4a2e";

function buildBadgeHtml(refreshId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";
  const trackUrl = `${appUrl}/api/t?rid=${encodeURIComponent(refreshId)}`;
  const linkUrl = `${appUrl}?ref=${encodeURIComponent(refreshId)}`;

  return `<!-- Page Refresh Attribution -->
<div id="pr-badge" style="position:fixed;bottom:12px;left:12px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <a href="${linkUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:${BADGE_BG};color:${BADGE_TEXT};border-radius:6px;font-size:11px;font-weight:500;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:opacity 0.2s;" onmouseover="this.style.color='${BADGE_HOVER}'" onmouseout="this.style.color='${BADGE_TEXT}'">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
    Refreshed by Page Refresh
  </a>
</div>
<img src="${trackUrl}" alt="" width="1" height="1" style="position:absolute;left:-9999px;" />`;
}

/**
 * Injects the attribution badge before </body> in the HTML.
 * If no </body> tag is found, appends to the end.
 */
export function injectAttributionBadge(
  html: string,
  refreshId: string,
): string {
  const badge = buildBadgeHtml(refreshId);

  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${badge}</body>`);
  }
  if (/<\/html\s*>/i.test(html)) {
    return html.replace(/<\/html\s*>/i, `${badge}</html>`);
  }
  return html + badge;
}
