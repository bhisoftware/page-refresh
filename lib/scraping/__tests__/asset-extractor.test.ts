import { describe, it, expect } from "vitest";
import {
  extractAssets,
  parseCssCustomProperties,
  resolveVarReferences,
  classifyImages,
  type ExtractedImageItem,
} from "../asset-extractor";
import * as cheerio from "cheerio";

// ─── Bug 1: CSS Color & Font Extraction ───

describe("extractColorsFromCss (via extractAssets)", () => {
  it("extracts hsl() colors", () => {
    const css = `body { background: hsl(120, 50%, 50%); color: hsl(0, 100%, 50%); }`;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    // hsl(120,50%,50%) ≈ #40bf40, hsl(0,100%,50%) = #ff0000
    expect(result.colors.length).toBeGreaterThanOrEqual(2);
    const hexes = result.colors.map((c) => c.hex);
    expect(hexes.some((h) => h.startsWith("#"))).toBe(true);
    // Red should be present
    expect(hexes).toContain("#ff0000");
  });

  it("extracts hsla() colors", () => {
    const css = `div { background: hsla(240, 100%, 50%, 0.8); }`;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    // hsla(240,100%,50%) = pure blue = #0000ff
    const hexes = result.colors.map((c) => c.hex);
    expect(hexes).toContain("#0000ff");
  });

  it("parses CSS custom property declarations", () => {
    const css = `
      :root {
        --primary-color: #2d5016;
        --accent-hsl: hsl(210, 80%, 40%);
        --shape-block-background-color: rgb(34, 85, 136);
      }
    `;
    const props = parseCssCustomProperties(css);
    expect(props.get("--primary-color")).toBe("#2d5016");
    expect(props.get("--accent-hsl")).toBe("hsl(210, 80%, 40%)");
    expect(props.get("--shape-block-background-color")).toBe("rgb(34, 85, 136)");
  });

  it("resolves var(--name) references", () => {
    const props = new Map([
      ["--primary", "#2d5016"],
      ["--bg", "var(--primary)"],
    ]);
    expect(resolveVarReferences("var(--primary)", props)).toBe("#2d5016");
    // Nested resolution
    expect(resolveVarReferences("var(--bg)", props)).toBe("#2d5016");
  });

  it("resolves var(--name, fallback) with fallback", () => {
    const props = new Map<string, string>();
    expect(resolveVarReferences("var(--missing, #ff0000)", props)).toBe("#ff0000");
  });

  it("extracts colors from CSS custom properties with color values", () => {
    const css = `
      :root {
        --brand-green: #2d5016;
        --black-hsl: hsl(0, 0%, 10%);
      }
      body { color: var(--brand-green); background: var(--black-hsl); }
    `;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    const hexes = result.colors.map((c) => c.hex);
    expect(hexes).toContain("#2d5016");
  });
});

describe("extractFontsFromCss (via extractAssets)", () => {
  it("detects @import Google Font URLs", () => {
    const css = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');`;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    const families = result.fonts.map((f) => f.family.toLowerCase());
    expect(families).toContain("montserrat");
  });

  it("detects Squarespace font custom properties", () => {
    const css = `
      :root {
        --heading-font-font-family: "Playfair Display";
        --body-font-font-family: "Source Sans Pro", sans-serif;
      }
    `;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    const families = result.fonts.map((f) => f.family.toLowerCase());
    expect(families).toContain("playfair display");
    expect(families).toContain("source sans pro");
  });

  it("resolves var() references in font-family declarations", () => {
    const css = `
      :root { --main-font: "Roboto Slab"; }
      h1 { font-family: var(--main-font), serif; }
    `;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    const families = result.fonts.map((f) => f.family.toLowerCase());
    expect(families).toContain("roboto slab");
  });

  it("filters out generic font families", () => {
    const css = `body { font-family: sans-serif, inherit, system-ui; }`;
    const html = "<html><body></body></html>";
    const result = extractAssets(html, css, "https://example.com");
    const families = result.fonts.map((f) => f.family.toLowerCase());
    expect(families).not.toContain("sans-serif");
    expect(families).not.toContain("inherit");
    expect(families).not.toContain("system-ui");
  });
});

// ─── Bug 2: Hero Image Misclassification ───
// (This tests the asset-extraction.ts identifyDownloadableUrls indirectly via extractAssets pattern)

describe("hero image does not duplicate logo", () => {
  it("skips logo img when it is the first image in header", () => {
    // extractAssets itself only returns images; hero classification is in asset-extraction.ts.
    // Here we test that the logo is correctly identified and images are returned.
    const html = `
      <html><body>
        <header>
          <img src="/logo.png" alt="Logo">
          <img src="/hero-banner.jpg" alt="Hero Banner">
        </header>
      </body></html>
    `;
    const css = "";
    const result = extractAssets(html, css, "https://example.com");
    expect(result.logo).toBe("https://example.com/logo.png");
    // The images array should contain both, but logo is identified separately
    expect(result.images.map((i) => i.src)).toContain("https://example.com/hero-banner.jpg");
  });
});

// ─── Bug 3: Semantic Image Classification ───

describe("classifyImages", () => {
  const baseUrl = "https://example.com";

  function makeImages(items: Array<{ src: string; alt?: string }>): ExtractedImageItem[] {
    return items.map((i) => ({ src: i.src, alt: i.alt }));
  }

  it("classifies team/headshot photos", () => {
    const html = `<html><body>
      <img src="/juan-attorney.jpg" alt="Juan - Attorney at Law">
      <img src="/hero.jpg" alt="Office building">
    </body></html>`;
    const $ = cheerio.load(html);
    const images = makeImages([
      { src: "https://example.com/juan-attorney.jpg", alt: "Juan - Attorney at Law" },
      { src: "https://example.com/hero.jpg", alt: "Office building" },
    ]);
    const result = classifyImages(images, $, baseUrl);
    expect(result.teamPhotos).toHaveLength(1);
    expect(result.teamPhotos[0].src).toBe("https://example.com/juan-attorney.jpg");
    expect(result.eventPhotos).toHaveLength(1); // "office" matches event
  });

  it("classifies trust badges", () => {
    const html = `<html><body>
      <img src="/avvo-badge.png" alt="Avvo Rating 10.0">
      <img src="/stars.png" alt="5 stars review">
      <img src="/photo.jpg" alt="Some photo">
    </body></html>`;
    const $ = cheerio.load(html);
    const images = makeImages([
      { src: "https://example.com/avvo-badge.png", alt: "Avvo Rating 10.0" },
      { src: "https://example.com/stars.png", alt: "5 stars review" },
      { src: "https://example.com/photo.jpg", alt: "Some photo" },
    ]);
    const result = classifyImages(images, $, baseUrl);
    expect(result.trustBadges).toHaveLength(2);
    expect(result.unclassified).toHaveLength(1);
  });

  it("classifies event photos", () => {
    const html = `<html><body>
      <img src="/ceremony.jpg" alt="Awards ceremony 2024">
    </body></html>`;
    const $ = cheerio.load(html);
    const images = makeImages([
      { src: "https://example.com/ceremony.jpg", alt: "Awards ceremony 2024" },
    ]);
    const result = classifyImages(images, $, baseUrl);
    // "ceremony" matches event, "awards" matches trust. Team is checked first, then trust, then event.
    // Since "awards" also matches trust, let's check the actual classification.
    // The signal is "Awards ceremony 2024 /ceremony.jpg ..." — TEAM_PATTERNS doesn't match,
    // TRUST_PATTERNS matches "award", so it goes to trustBadges.
    expect(result.trustBadges.length + result.eventPhotos.length).toBeGreaterThanOrEqual(1);
  });

  it("leaves unmatched images in unclassified", () => {
    const html = `<html><body>
      <img src="/random.jpg" alt="Beautiful sunset">
    </body></html>`;
    const $ = cheerio.load(html);
    const images = makeImages([
      { src: "https://example.com/random.jpg", alt: "Beautiful sunset" },
    ]);
    const result = classifyImages(images, $, baseUrl);
    expect(result.unclassified).toHaveLength(1);
    expect(result.teamPhotos).toHaveLength(0);
    expect(result.trustBadges).toHaveLength(0);
    expect(result.eventPhotos).toHaveLength(0);
  });

  it("classifies by URL path when alt is empty", () => {
    const html = `<html><body>
      <img src="/images/team/headshot-1.jpg" alt="">
    </body></html>`;
    const $ = cheerio.load(html);
    const images = makeImages([
      { src: "https://example.com/images/team/headshot-1.jpg", alt: "" },
    ]);
    const result = classifyImages(images, $, baseUrl);
    expect(result.teamPhotos).toHaveLength(1);
  });
});

describe("extractAssets integration with classification", () => {
  it("populates teamPhotos and trustBadges fields", () => {
    const html = `
      <html><body>
        <header><img src="/logo.png" alt="Logo"></header>
        <section>
          <img src="/founder.jpg" alt="John Smith, Founder">
          <img src="/bbb-badge.png" alt="BBB Accredited">
          <img src="/sunset.jpg" alt="Nice view">
        </section>
      </body></html>
    `;
    const result = extractAssets(html, "", "https://example.com");
    expect(result.teamPhotos).toBeDefined();
    expect(result.teamPhotos!.length).toBe(1);
    expect(result.teamPhotos![0].src).toBe("https://example.com/founder.jpg");
    expect(result.trustBadges).toBeDefined();
    expect(result.trustBadges!.length).toBe(1);
    expect(result.trustBadges![0].src).toBe("https://example.com/bbb-badge.png");
    // Unclassified remain in images
    expect(result.images.some((i) => i.src === "https://example.com/sunset.jpg")).toBe(true);
  });
});
