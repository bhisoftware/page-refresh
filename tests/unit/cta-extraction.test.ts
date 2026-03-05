/**
 * Tests for CTA extraction (string[] with up to 3 CTAs, tel/mailto support).
 */
import { extractAssets } from "@/lib/scraping/asset-extractor";

describe("CTA extraction", () => {
  const baseUrl = "https://example.com";
  const css = "";

  it("extracts multiple CTA buttons as string[]", () => {
    const html = `<html><body>
      <a href="/contact" class="cta">Get a Quote</a>
      <a href="/schedule" class="button">Schedule Now</a>
      <a href="/book">Book Appointment</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(Array.isArray(result.copy.ctaText)).toBe(true);
    expect(result.copy.ctaText!.length).toBeGreaterThanOrEqual(2);
    expect(result.copy.ctaText).toContain("Get a Quote");
    expect(result.copy.ctaText).toContain("Schedule Now");
  });

  it("caps at 3 CTAs", () => {
    const html = `<html><body>
      <a href="/contact" class="cta">CTA One</a>
      <a href="/quote" class="button">CTA Two</a>
      <a href="/book" class="cta">CTA Three</a>
      <a href="/schedule" class="button">CTA Four</a>
      <a href="tel:+15551234567">Call Us</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText!.length).toBeLessThanOrEqual(3);
  });

  it("extracts tel: links", () => {
    const html = `<html><body>
      <a href="tel:+15551234567">Call (555) 123-4567</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText).toBeDefined();
    expect(result.copy.ctaText).toContain("Call (555) 123-4567");
  });

  it("extracts mailto: links", () => {
    const html = `<html><body>
      <a href="mailto:info@example.com">Email Us</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText).toBeDefined();
    expect(result.copy.ctaText).toContain("Email Us");
  });

  it("falls back to href text for tel: when element text is empty", () => {
    const html = `<html><body>
      <a href="tel:+15559876543"></a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText).toBeDefined();
    expect(result.copy.ctaText![0]).toBe("+15559876543");
  });

  it("deduplicates CTAs case-insensitively", () => {
    const html = `<html><body>
      <a href="/contact" class="cta">Get a Quote</a>
      <a href="/contact2" class="button">get a quote</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText!.length).toBe(1);
  });

  it("skips junk CTAs like 'Submit' and 'Search'", () => {
    const html = `<html><body>
      <button class="button">Submit</button>
      <button class="button">Search</button>
      <a href="/contact" class="cta">Get Started</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    // Submit and Search are in the blocklist, should be filtered
    if (result.copy.ctaText) {
      expect(result.copy.ctaText).not.toContain("Submit");
      expect(result.copy.ctaText).not.toContain("Search");
    }
  });

  it("returns undefined ctaText when no CTAs found", () => {
    const html = `<html><body><p>Just some text</p></body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText).toBeUndefined();
  });

  it("mixes button CTAs with contact links", () => {
    const html = `<html><body>
      <a href="/contact" class="cta">Request Quote</a>
      <a href="tel:+15551234567">555-123-4567</a>
      <a href="mailto:hello@biz.com">hello@biz.com</a>
    </body></html>`;
    const result = extractAssets(html, css, baseUrl);
    expect(result.copy.ctaText!.length).toBe(3);
    expect(result.copy.ctaText).toContain("Request Quote");
    expect(result.copy.ctaText).toContain("555-123-4567");
    expect(result.copy.ctaText).toContain("hello@biz.com");
  });
});
