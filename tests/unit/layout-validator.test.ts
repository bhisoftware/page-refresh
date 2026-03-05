/**
 * Tests for layout-validator.ts structural quality checks.
 */
import { validateLayoutQuality } from "@/lib/pipeline/layout-validator";

/** Minimal well-formed layout that passes all checks. */
const VALID_LAYOUT = `<html><body>
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <h1>Welcome to Our Business</h1>
  <section>
    <h2>Our Services</h2>
    <p>We provide excellent services to our customers with years of experience in the industry.</p>
    <a href="/contact">Contact Us</a>
  </section>
  <section>
    <h3>Why Choose Us</h3>
    <p>Quality, reliability, and great customer service make us the right choice.</p>
    <img src="https://example.com/photo.jpg" alt="Team photo" />
  </section>
  <footer><p>&copy; 2024 Our Business</p></footer>
</body></html>`;

describe("validateLayoutQuality", () => {
  it("passes for well-formed layout", () => {
    const result = validateLayoutQuality(VALID_LAYOUT);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags NO_CONTENT for nearly empty body", () => {
    const html = `<html><body><p>Hi</p></body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.code === "NO_CONTENT")).toBe(true);
  });

  it("flags MISSING_H1 when no h1 present", () => {
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h2>About Us</h2>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <a href="/contact">Contact Us</a></section>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.issues.some(i => i.code === "MISSING_H1")).toBe(true);
  });

  it("flags MISSING_CTA when no actionable links or buttons", () => {
    const html = `<html><body>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p></section>
      <footer><p>Footer content here</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.issues.some(i => i.code === "MISSING_CTA")).toBe(true);
  });

  it("flags EMPTY_SECTION for sections with minimal text", () => {
    const html = `<html><body>
      <h1>Our Company</h1>
      <section><p>A great company with many years of experience serving our customers well.</p>
      <a href="/contact">Contact Us</a></section>
      <section></section>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.issues.some(i => i.code === "EMPTY_SECTION")).toBe(true);
  });

  it("flags SKIPPED_HEADING for h1 → h3 jump", () => {
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h1>Main Title</h1>
      <section><h3>Subsection</h3>
      <p>Content here with enough text to avoid the no content check and other validation.</p>
      <a href="/contact">Contact Us</a></section>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "SKIPPED_HEADING")).toBe(true);
  });

  it("warns MISSING_NAV when no nav element", () => {
    const html = `<html><body>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <a href="/contact">Contact Us</a></section>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "MISSING_NAV")).toBe(true);
  });

  it("warns MISSING_FOOTER when no footer element", () => {
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <a href="/contact">Contact Us</a></section>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "MISSING_FOOTER")).toBe(true);
  });

  it("warns EXCESSIVE_SECTIONS for 11+ sections", () => {
    const sections = Array.from({ length: 11 }, (_, i) =>
      `<section><p>Section ${i + 1} with enough content to pass checks.</p></section>`
    ).join("\n");
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h1>Our Company</h1>
      ${sections}
      <a href="/contact">Contact Us</a>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "EXCESSIVE_SECTIONS")).toBe(true);
  });

  it("warns NO_IMAGES for zero img elements", () => {
    const result = validateLayoutQuality(VALID_LAYOUT.replace(/<img[^>]*\/?>/, ""));
    expect(result.warnings.some(w => w.code === "NO_IMAGES")).toBe(true);
  });

  it("warns DUPLICATE_IMAGE when same src used 3+ times", () => {
    const img = `<img src="https://example.com/photo.jpg" alt="Photo" />`;
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <a href="/contact">Contact Us</a>
      ${img}${img}${img}</section>
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "DUPLICATE_IMAGE")).toBe(true);
  });

  it("does not flag valid heading hierarchy h1 → h2 → h3", () => {
    const html = `<html><body>
      <nav><a href="/">Home</a></nav>
      <h1>Main</h1>
      <section><h2>Sub</h2><h3>Detail</h3>
      <p>Content here with enough text to satisfy the validation requirements easily.</p>
      <a href="/contact">Contact Us</a></section>
      <img src="https://example.com/img.jpg" alt="Image" />
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.warnings.some(w => w.code === "SKIPPED_HEADING")).toBe(false);
  });

  it("does not flag nav links as missing CTAs", () => {
    // CTA exists outside nav, nav links should be ignored
    const html = `<html><body>
      <nav><a href="/contact">Contact Us</a></nav>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <button>Get Started</button></section>
      <img src="https://example.com/img.jpg" alt="Image" />
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.issues.some(i => i.code === "MISSING_CTA")).toBe(false);
  });

  it("detects CTA only inside nav as missing", () => {
    // Only CTA-like text is inside nav — should still flag MISSING_CTA
    const html = `<html><body>
      <nav><a href="/contact">Contact Us</a><a href="/">Home</a></nav>
      <h1>Our Company</h1>
      <section><p>We are a great company with many years of experience serving our customers well.</p>
      <a href="/about">Company Info</a></section>
      <img src="https://example.com/img.jpg" alt="Image" />
      <footer><p>Footer</p></footer>
    </body></html>`;
    const result = validateLayoutQuality(html);
    expect(result.issues.some(i => i.code === "MISSING_CTA")).toBe(true);
  });
});
