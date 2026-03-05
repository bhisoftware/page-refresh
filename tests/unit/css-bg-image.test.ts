/**
 * Tests for CSS background-image extraction from both CSS source and inline styles.
 */
import { extractAssets } from "@/lib/scraping/asset-extractor";

describe("CSS background-image extraction", () => {
  const baseUrl = "https://example.com";

  it("extracts background-image from external CSS", () => {
    const html = `<html><body><div class="hero"></div></body></html>`;
    const css = `.hero { background-image: url('https://example.com/hero-bg.jpg'); }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/hero-bg.jpg");
  });

  it("extracts background shorthand with url()", () => {
    const html = `<html><body><div></div></body></html>`;
    const css = `.banner { background: #000 url("/images/banner.png") no-repeat center; }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/images/banner.png");
  });

  it("extracts background-image from inline styles", () => {
    const html = `<html><body>
      <div style="background-image: url('https://cdn.example.com/bg.jpg');"></div>
    </body></html>`;
    const css = "";
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://cdn.example.com/bg.jpg");
  });

  it("resolves relative background-image URLs", () => {
    const html = `<html><body><section></section></body></html>`;
    const css = `section { background-image: url("/assets/bg.webp"); }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/assets/bg.webp");
  });

  it("skips data: URIs in background-image", () => {
    const html = `<html><body></body></html>`;
    const css = `.icon { background-image: url('data:image/svg+xml;base64,PHN2Zz4='); }`;
    const result = extractAssets(html, css, baseUrl);
    const dataSrcs = result.images.filter((img) => img.src.startsWith("data:"));
    expect(dataSrcs).toHaveLength(0);
  });

  it("deduplicates background-image URLs against img tags", () => {
    const html = `<html><body>
      <img src="https://example.com/shared.jpg" alt="Photo" />
      <div style="background-image: url('https://example.com/shared.jpg');"></div>
    </body></html>`;
    const css = "";
    const result = extractAssets(html, css, baseUrl);
    const matchingImages = result.images.filter((img) => img.src === "https://example.com/shared.jpg");
    expect(matchingImages).toHaveLength(1);
  });

  it("skips junk background-image URLs", () => {
    const html = `<html><body></body></html>`;
    const css = `.tracker { background-image: url('/tracking/pixel.gif'); }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs.some((s) => s.includes("tracking/pixel"))).toBe(false);
  });

  it("extracts multiple background-images from CSS", () => {
    const html = `<html><body></body></html>`;
    const css = `
      .hero { background-image: url('https://example.com/hero.jpg'); }
      .about { background: url('/about-bg.png') center/cover; }
    `;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/hero.jpg");
    expect(srcs).toContain("https://example.com/about-bg.png");
  });

  it("handles unquoted URLs in background-image", () => {
    const html = `<html><body></body></html>`;
    const css = `.hero { background-image: url(https://example.com/hero-noquote.jpg); }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/hero-noquote.jpg");
  });

  it("handles double-quoted URLs in background-image", () => {
    const html = `<html><body></body></html>`;
    const css = `.hero { background-image: url("https://example.com/hero-dq.jpg"); }`;
    const result = extractAssets(html, css, baseUrl);
    const srcs = result.images.map((img) => img.src);
    expect(srcs).toContain("https://example.com/hero-dq.jpg");
  });
});
