/**
 * CMS auto-detection from HTML content.
 * Sniffs for known CMS signatures in HTML source, meta tags, and generator hints.
 */

interface CmsSignature {
  name: string;
  patterns: RegExp[];
}

const CMS_SIGNATURES: CmsSignature[] = [
  {
    name: "WordPress",
    patterns: [
      /wp-content\//i,
      /wp-includes\//i,
      /<meta\s+name=["']generator["']\s+content=["']WordPress/i,
      /wp-json/i,
    ],
  },
  {
    name: "Shopify",
    patterns: [
      /cdn\.shopify\.com/i,
      /Shopify\.theme/i,
      /<meta\s+name=["']generator["']\s+content=["']Shopify/i,
    ],
  },
  {
    name: "Wix",
    patterns: [
      /static\.wixstatic\.com/i,
      /<meta\s+name=["']generator["']\s+content=["']Wix/i,
      /wix-code-sdk/i,
    ],
  },
  {
    name: "Squarespace",
    patterns: [
      /static1\.squarespace\.com/i,
      /<meta\s+name=["']generator["']\s+content=["']Squarespace/i,
      /squarespace-cdn/i,
    ],
  },
  {
    name: "Webflow",
    patterns: [
      /assets\.website-files\.com/i,
      /<meta\s+name=["']generator["']\s+content=["']Webflow/i,
      /webflow\.js/i,
    ],
  },
  {
    name: "Drupal",
    patterns: [
      /\/sites\/default\/files/i,
      /<meta\s+name=["']generator["']\s+content=["']Drupal/i,
      /drupal\.js/i,
    ],
  },
  {
    name: "Joomla",
    patterns: [
      /\/media\/jui/i,
      /<meta\s+name=["']generator["']\s+content=["']Joomla/i,
    ],
  },
  {
    name: "Ghost",
    patterns: [
      /<meta\s+name=["']generator["']\s+content=["']Ghost/i,
      /ghost-url/i,
    ],
  },
  {
    name: "HubSpot",
    patterns: [
      /js\.hs-scripts\.com/i,
      /hs-banner\.com/i,
      /<meta\s+name=["']generator["']\s+content=["']HubSpot/i,
    ],
  },
  {
    name: "Framer",
    patterns: [
      /framerusercontent\.com/i,
      /framer-motion/i,
    ],
  },
  {
    name: "GoDaddy",
    patterns: [
      /img1\.wsimg\.com/i,
      /godaddy\.com\/website-builder/i,
    ],
  },
];

/**
 * Detect CMS from HTML source. Returns the CMS name or null if undetectable.
 */
export function detectCms(html: string): string | null {
  for (const sig of CMS_SIGNATURES) {
    if (sig.patterns.some((p) => p.test(html))) {
      return sig.name;
    }
  }
  return null;
}
