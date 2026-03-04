/**
 * Injects invisible Page Refresh attribution into layout HTML.
 * Includes an HTML comment and a 1x1 tracking pixel to detect when the code is live.
 */

function buildBadgeHtml(refreshId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";
  const trackUrl = `${appUrl}/api/t?rid=${encodeURIComponent(refreshId)}`;

  return `<!-- Built with Page Refresh — ${appUrl}/?ref=${encodeURIComponent(refreshId)} -->
<img src="${trackUrl}" alt="" width="1" height="1" style="position:absolute;left:-9999px;" />`;
}

/**
 * Injects the attribution before </body> in the HTML.
 * If no </body> tag is found, appends to the end.
 */
export function injectAttributionBadge(
  html: string,
  refreshId: string,
): string {
  const badge = buildBadgeHtml(refreshId);

  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${badge}\n</body>`);
  }
  if (/<\/html\s*>/i.test(html)) {
    return html.replace(/<\/html\s*>/i, `${badge}\n</html>`);
  }
  return html + badge;
}
