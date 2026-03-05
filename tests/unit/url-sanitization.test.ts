/**
 * Tests for post-generation image URL sanitization and business name verification.
 */
import { sanitizeImageUrls, verifyBusinessName } from "@/lib/pipeline/html-score-scanner";

describe("sanitizeImageUrls", () => {
  it("passes through allowed URLs", () => {
    const html = `<html><body>
      <img src="https://mybucket.s3.amazonaws.com/logo.png" />
      <img src="https://mybucket.s3.amazonaws.com/hero.jpg" />
    </body></html>`;
    const allowed = new Set([
      "https://mybucket.s3.amazonaws.com/logo.png",
      "https://mybucket.s3.amazonaws.com/hero.jpg",
    ]);
    const result = sanitizeImageUrls(html, allowed);
    expect(result.replacedCount).toBe(0);
    expect(result.replacedUrls).toEqual([]);
  });

  it("replaces hallucinated URLs with placeholder", () => {
    const html = `<html><body>
      <img src="https://example.com/fake-hero.jpg" />
      <img src="https://mybucket.s3.amazonaws.com/real.png" />
    </body></html>`;
    const allowed = new Set(["https://mybucket.s3.amazonaws.com/real.png"]);
    const result = sanitizeImageUrls(html, allowed);
    expect(result.replacedCount).toBe(1);
    expect(result.replacedUrls).toEqual(["https://example.com/fake-hero.jpg"]);
    expect(result.html).toContain("data:image/svg+xml");
    expect(result.html).not.toContain("fake-hero.jpg");
  });

  it("allows data: URIs", () => {
    const html = `<html><body>
      <img src="data:image/png;base64,iVBORw0KGgo=" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(0);
  });

  it("allows well-known stock image domains", () => {
    const html = `<html><body>
      <img src="https://images.unsplash.com/photo-123?w=800" />
      <img src="https://images.pexels.com/photo/456.jpg" />
      <img src="https://picsum.photos/800/600" />
      <img src="https://placehold.co/600x400" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(0);
  });

  it("allows blob API URLs", () => {
    const html = `<html><body>
      <img src="/api/blob/profiles/abc123/logo.png" />
      <img src="https://myapp.com/api/blob/profiles/def456/hero.jpg" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(0);
  });

  it("allows fragment-only and empty src", () => {
    const html = `<html><body>
      <img src="#" />
      <img src="" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(0);
  });

  it("removes srcset when replacing hallucinated src", () => {
    const html = `<html><body>
      <img src="https://fake.com/img.jpg" srcset="https://fake.com/img-2x.jpg 2x" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(1);
    expect(result.html).not.toContain("srcset");
    expect(result.html).not.toContain("fake.com");
  });

  it("handles multiple hallucinated URLs", () => {
    const html = `<html><body>
      <img src="https://fake1.com/a.jpg" />
      <img src="https://fake2.com/b.jpg" />
      <img src="https://fake3.com/c.jpg" />
    </body></html>`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.replacedCount).toBe(3);
    expect(result.replacedUrls).toHaveLength(3);
  });

  it("returns original html (not reparsed) when no replacements needed", () => {
    const html = `<img src="data:image/png;base64,abc" />`;
    const result = sanitizeImageUrls(html, new Set());
    expect(result.html).toBe(html); // exact same reference
  });
});

describe("verifyBusinessName", () => {
  it("returns true when name is in h1", () => {
    const html = `<html><body><h1>Welcome to Acme Corp</h1></body></html>`;
    expect(verifyBusinessName(html, "Acme Corp")).toBe(true);
  });

  it("returns true when name is in nav", () => {
    const html = `<html><body><nav>Acme Corp - Home Services About</nav></body></html>`;
    expect(verifyBusinessName(html, "Acme Corp")).toBe(true);
  });

  it("returns true when name is in title", () => {
    const html = `<html><head><title>Acme Corp - Premium Services</title></head><body></body></html>`;
    expect(verifyBusinessName(html, "Acme Corp")).toBe(true);
  });

  it("returns true when name is in footer", () => {
    const html = `<html><body><footer>© 2024 Acme Corp</footer></body></html>`;
    expect(verifyBusinessName(html, "Acme Corp")).toBe(true);
  });

  it("returns false when name is completely missing", () => {
    const html = `<html><body><h1>Welcome to DieselPro</h1><nav>DieselPro</nav><footer>© DieselPro</footer></body></html>`;
    expect(verifyBusinessName(html, "Revived Diesel")).toBe(false);
  });

  it("is case-insensitive", () => {
    const html = `<html><body><h1>ACME CORP Services</h1></body></html>`;
    expect(verifyBusinessName(html, "Acme Corp")).toBe(true);
  });

  it("returns true for empty/short business name (nothing to verify)", () => {
    const html = `<html><body><h1>Welcome</h1></body></html>`;
    expect(verifyBusinessName(html, "")).toBe(true);
    expect(verifyBusinessName(html, "A")).toBe(true);
  });
});
