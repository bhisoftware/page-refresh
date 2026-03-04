/**
 * ZIP Delivery Pipeline.
 *
 * After purchase, builds a platform-specific ZIP, uploads to S3,
 * and sends the delivery email with a download link.
 *
 * Called fire-and-forget from the Stripe webhook handler.
 */

import archiver from "archiver";
import { Writable } from "stream";
import { prisma } from "@/lib/prisma";
import { s3Upload, s3GetSignedUrl } from "@/lib/storage/s3";
import { sendLayoutDelivery } from "@/lib/email";
import { injectAttributionBadge } from "@/lib/layout-badge";

/* ---------- types ---------- */

interface DeliveryContext {
  refreshId: string;
  layoutIndex: number;       // 1-3
  platformKey: string;       // "html", "squarespace", etc.
}

interface PlatformConfig {
  key: string;
  label: string;
  sectionSplit: boolean;
  readmeTemplate: string;
  platformNotes: string;
  folderStructure: string;
}

/* ---------- helpers ---------- */

function bufferFromStream(archive: archiver.Archiver): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const collector = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf-8"));
      cb();
    },
  });
  archive.pipe(collector);
  return new Promise((resolve, reject) => {
    collector.on("finish", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
}

/** Extract S3 asset URLs referenced in HTML/CSS. */
function extractReferencedAssetUrls(html: string, css: string): string[] {
  const urls = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";

  // Match src="...", href="...", url(...) patterns
  const patterns = [
    /src=["']([^"']+)["']/gi,
    /url\(["']?([^"')]+)["']?\)/gi,
    /srcset=["']([^"']+)["']/gi,
    /data-src=["']([^"']+)["']/gi,
  ];

  const combined = html + "\n" + css;
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(combined)) !== null) {
      const value = match[1];
      // Handle srcset (multiple URLs separated by commas)
      const candidates = value.includes(",")
        ? value.split(",").map((s) => s.trim().split(/\s+/)[0])
        : [value];
      for (const url of candidates) {
        // Only include our own asset URLs (S3 blobs served via /api/blob/)
        if (url.includes("/api/blob/") || url.includes("pagerefresh-assets")) {
          urls.add(url);
        }
      }
    }
  }

  return [...urls];
}

/** Download asset bytes from a URL. Returns null on failure. */
async function fetchAssetBytes(url: string): Promise<{ data: Buffer; filename: string } | null> {
  try {
    // Resolve root-relative URLs (e.g. /api/blob/...) to absolute for server-side fetch
    let fetchUrl = url;
    if (url.startsWith("/")) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";
      fetchUrl = `${appUrl}${url}`;
    }
    const res = await fetch(fetchUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Extract filename from URL
    const urlPath = new URL(url.startsWith("http") ? url : `https://placeholder.com${url}`).pathname;
    const filename = decodeURIComponent(urlPath.split("/").pop() || "asset");
    return { data: bytes, filename };
  } catch {
    return null;
  }
}

/** Build a full standalone HTML document with embedded CSS. */
function buildFullDocument(html: string, css: string, assetMap: Map<string, string>): string {
  let processed = html;
  let processedCss = css;

  // Rewrite asset URLs to local paths
  for (const [originalUrl, localPath] of assetMap) {
    processed = processed.replaceAll(originalUrl, localPath);
    processedCss = processedCss.replaceAll(originalUrl, localPath);
  }

  const trimmed = processed.trim();
  const isFullDoc = trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html");

  if (isFullDoc) {
    return trimmed.replace(/<\/head\s*>/i, `<style>\n${processedCss}\n</style>\n</head>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Layout – pagerefresh.ai</title>
  <style>
${processedCss}
  </style>
</head>
<body>
${processed}
</body>
</html>`;
}

/** Split HTML into per-<section> chunks for Squarespace. */
function splitIntoSections(html: string): Array<{ id: string; html: string }> {
  const sectionRegex = /<section\b[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/section>/gi;
  const sections: Array<{ id: string; html: string }> = [];
  let match;
  let index = 1;

  while ((match = sectionRegex.exec(html)) !== null) {
    const id = match[1] || `section-${index}`;
    sections.push({ id, html: match[0] });
    index++;
  }

  if (sections.length === 0) {
    console.warn("[zip-delivery] No <section> tags found for section splitting");
    return [{ id: "full-layout", html }];
  }

  return sections;
}

/** Replace README template variables. */
function renderReadme(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

/* ---------- main pipeline ---------- */

export async function buildAndDeliverLayout(
  refreshId: string,
  layoutIndex: number,
  platformKey: string,
): Promise<void> {
  const prefix = `[zip-delivery ${refreshId}]`;

  // 1. Fetch refresh data (select all 3 layout fields; pick the paid one below)
  const refresh = await prisma.refresh.findUnique({
    where: { id: refreshId },
    select: {
      url: true,
      industryDetected: true,
      viewToken: true,
      paidEmail: true,
      extractedColors: true,
      layout1Html: true, layout1Css: true, layout1Template: true,
      layout2Html: true, layout2Css: true, layout2Template: true,
      layout3Html: true, layout3Css: true, layout3Template: true,
      urlProfile: {
        select: { customerFirstName: true, domain: true },
      },
    },
  });

  if (!refresh) {
    console.error(`${prefix} Refresh not found`);
    return;
  }

  const layoutHtml =
    layoutIndex === 1 ? refresh.layout1Html :
    layoutIndex === 2 ? refresh.layout2Html : refresh.layout3Html;
  const layoutCss =
    layoutIndex === 1 ? refresh.layout1Css :
    layoutIndex === 2 ? refresh.layout2Css : refresh.layout3Css;
  const templateName = (
    layoutIndex === 1 ? refresh.layout1Template :
    layoutIndex === 2 ? refresh.layout2Template : refresh.layout3Template
  ) || "layout";

  if (!layoutHtml) {
    console.error(`${prefix} No HTML for layout ${layoutIndex}`);
    return;
  }

  // 2. Fetch platform config from DB
  const platform = await prisma.deliveryPlatform.findUnique({
    where: { key: platformKey },
  });

  if (!platform) {
    console.error(`${prefix} Platform "${platformKey}" not found, falling back to html`);
  }

  const config: PlatformConfig = platform ?? {
    key: "html",
    label: "Generic HTML",
    sectionSplit: false,
    readmeTemplate: "# Your Refreshed Layout\n\nGenerated by pagerefresh.ai",
    platformNotes: "",
    folderStructure: "{}",
  };

  // 3. Extract and download referenced assets
  const assetUrls = extractReferencedAssetUrls(layoutHtml, layoutCss);
  const assetMap = new Map<string, string>(); // original URL → local path
  const assetBuffers: Array<{ path: string; data: Buffer }> = [];

  console.log(`${prefix} Downloading ${assetUrls.length} referenced assets`);

  await Promise.all(
    assetUrls.map(async (url) => {
      const result = await fetchAssetBytes(url);
      if (result) {
        const localPath = `assets/${result.filename}`;
        assetMap.set(url, localPath);
        assetBuffers.push({ path: localPath, data: result.data });
      }
    }),
  );

  // 4. Inject attribution badge
  const badgedHtml = injectAttributionBadge(layoutHtml, refreshId);

  // 5. Build ZIP
  const archive = archiver("zip", { zlib: { level: 9 } });
  const bufferPromise = bufferFromStream(archive);

  const businessName = refresh.urlProfile?.domain
    ?? new URL(refresh.url).hostname.replace(/^www\./, "");
  const safeName = businessName.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const folderPrefix = `${safeName}-layout/`;

  // Extract primary color from extracted colors
  const colors = refresh.extractedColors as Array<{ hex?: string }> | null;
  const primaryColor = colors?.[0]?.hex ?? "#000000";

  // README variables
  const readmeVars: Record<string, string> = {
    businessName,
    templateName,
    primaryColor,
    detectedCMS: "",
    targetPlatform: config.label,
    siteUrl: refresh.url,
    downloadUrl: "(see email)",
  };

  const readme = renderReadme(config.readmeTemplate, readmeVars);
  archive.append(Buffer.from(readme, "utf-8"), { name: `${folderPrefix}README.txt` });

  // Add assets
  for (const asset of assetBuffers) {
    archive.append(asset.data, { name: `${folderPrefix}${asset.path}` });
  }

  // Platform-specific files
  if (config.sectionSplit) {
    // Squarespace-style: split into sections + CSS injection file
    const sections = splitIntoSections(badgedHtml);
    for (let i = 0; i < sections.length; i++) {
      const num = String(i + 1).padStart(2, "0");
      let sectionHtml = sections[i].html;
      // Rewrite asset URLs
      for (const [originalUrl, localPath] of assetMap) {
        sectionHtml = sectionHtml.replaceAll(originalUrl, `../${localPath}`);
      }
      archive.append(Buffer.from(sectionHtml, "utf-8"), {
        name: `${folderPrefix}sections/${num}-${sections[i].id}.html`,
      });
    }

    let processedCss = layoutCss;
    for (const [originalUrl, localPath] of assetMap) {
      processedCss = processedCss.replaceAll(originalUrl, localPath);
    }
    archive.append(Buffer.from(processedCss, "utf-8"), {
      name: `${folderPrefix}css-injection.css`,
    });

    // Full preview for reference
    const previewDoc = buildFullDocument(badgedHtml, layoutCss, assetMap);
    archive.append(Buffer.from(previewDoc, "utf-8"), {
      name: `${folderPrefix}full-preview.html`,
    });
  } else if (config.key === "wordpress") {
    // WordPress: page-template.php + additional-css.css
    let processedHtml = badgedHtml;
    let processedCss = layoutCss;
    for (const [originalUrl, localPath] of assetMap) {
      processedHtml = processedHtml.replaceAll(originalUrl, localPath);
      processedCss = processedCss.replaceAll(originalUrl, localPath);
    }

    const pageTemplate = `<?php
/**
 * Template Name: PageRefresh Layout
 * Generated by pagerefresh.ai
 */
get_header();
?>
${processedHtml}
<?php
get_footer();
`;
    archive.append(Buffer.from(pageTemplate, "utf-8"), {
      name: `${folderPrefix}page-template.php`,
    });
    archive.append(Buffer.from(processedCss, "utf-8"), {
      name: `${folderPrefix}additional-css.css`,
    });
  } else if (config.key === "wix") {
    // Wix: embed-version.html + velo/page-code.js
    const embedDoc = buildFullDocument(badgedHtml, layoutCss, assetMap);
    archive.append(Buffer.from(embedDoc, "utf-8"), {
      name: `${folderPrefix}embed-version.html`,
    });

    const veloJs = `// Wix Velo page code — pagerefresh.ai
// Paste this into the Page Code panel if using Wix Dev Mode
$w.onReady(function () {
  // Layout is rendered via the HTML embed widget.
  // This file is for reference if you want to add interactivity.
});
`;
    archive.append(Buffer.from(veloJs, "utf-8"), {
      name: `${folderPrefix}velo/page-code.js`,
    });

    // Full preview
    archive.append(Buffer.from(embedDoc, "utf-8"), {
      name: `${folderPrefix}full-preview.html`,
    });
  } else if (config.key === "webflow") {
    // Webflow: index.html + styles.css
    let processedHtml = badgedHtml;
    let processedCss = layoutCss;
    for (const [originalUrl, localPath] of assetMap) {
      processedHtml = processedHtml.replaceAll(originalUrl, localPath);
      processedCss = processedCss.replaceAll(originalUrl, localPath);
    }

    const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName} – pagerefresh.ai</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${processedHtml}
</body>
</html>`;
    archive.append(Buffer.from(fullDoc, "utf-8"), {
      name: `${folderPrefix}index.html`,
    });
    archive.append(Buffer.from(processedCss, "utf-8"), {
      name: `${folderPrefix}styles.css`,
    });
  } else {
    // Generic HTML: index.html + styles.css (same as webflow but with brand colors file)
    let processedHtml = badgedHtml;
    let processedCss = layoutCss;
    for (const [originalUrl, localPath] of assetMap) {
      processedHtml = processedHtml.replaceAll(originalUrl, localPath);
      processedCss = processedCss.replaceAll(originalUrl, localPath);
    }

    const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName} – pagerefresh.ai</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${processedHtml}
</body>
</html>`;
    archive.append(Buffer.from(fullDoc, "utf-8"), {
      name: `${folderPrefix}index.html`,
    });
    archive.append(Buffer.from(processedCss, "utf-8"), {
      name: `${folderPrefix}styles.css`,
    });

    // Brand colors reference
    const colorsArray = (refresh.extractedColors as Array<{ hex?: string; name?: string }>) || [];
    if (colorsArray.length > 0) {
      const colorsCss = `:root {\n${colorsArray
        .map((c, i) => `  --brand-color-${i + 1}: ${c.hex ?? "#000"};${c.name ? ` /* ${c.name} */` : ""}`)
        .join("\n")}\n}\n`;
      archive.append(Buffer.from(colorsCss, "utf-8"), {
        name: `${folderPrefix}assets/brand/colors.css`,
      });
    }
  }

  await archive.finalize();
  const zipBuffer = await bufferPromise;

  // 6. Upload to S3
  const s3Key = `zips/${refreshId}/layout-${layoutIndex}-${config.key}.zip`;
  console.log(`${prefix} Uploading ZIP to S3: ${s3Key} (${zipBuffer.length} bytes)`);

  const uploaded = await s3Upload(s3Key, zipBuffer, "application/zip");
  if (!uploaded) {
    console.error(`${prefix} S3 upload failed`);
    return;
  }

  // 7. Generate signed URL (7 days — S3v4 max; re-generate on demand for longer access)
  const expiresIn = 60 * 60 * 24 * 7; // 7 days (S3v4 signature max)
  const downloadFilename = `${safeName}-page-refresh-layout-${layoutIndex}.zip`;
  const downloadUrl = await s3GetSignedUrl(s3Key, expiresIn, downloadFilename);
  if (!downloadUrl) {
    console.error(`${prefix} Failed to generate signed URL`);
    return;
  }

  // 8. Update refresh record
  await prisma.refresh.update({
    where: { id: refreshId },
    data: {
      zipS3Key: s3Key,
      zipGeneratedAt: new Date(),
    },
  });

  // 9. Send delivery email
  if (refresh.paidEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";
    const refreshUrl = `${appUrl}/refreshed-layout?refreshId=${refreshId}`;

    await sendLayoutDelivery({
      to: refresh.paidEmail,
      businessName,
      templateName,
      platform: config.label,
      downloadUrl,
      refreshUrl,
    });

    console.log(`${prefix} Delivery email sent to ${refresh.paidEmail}`);
  }

  console.log(`${prefix} ZIP delivery complete`);
}
