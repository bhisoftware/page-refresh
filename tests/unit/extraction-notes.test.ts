/**
 * Tests for extraction notes logic.
 * Tests the note generation conditions in isolation.
 */

describe("Extraction notes generation", () => {
  // Replicate the note generation logic from analyze.ts
  function buildExtractionNotes(brandAssets: {
    logoUrl: string | null;
    heroImageUrl: string | null;
    siteImageUrls: string[];
    colors: string[];
    fonts: string[];
    copy: { testimonials?: string[]; features?: string[] } | undefined;
  }): string[] {
    const notes: string[] = [];
    if (!brandAssets.logoUrl) notes.push("No logo found — use text-based branding");
    if (!brandAssets.heroImageUrl) notes.push("No hero image found — use a gradient or solid color hero background");
    if (brandAssets.siteImageUrls.length === 0) notes.push("No site images extracted — avoid placeholder image URLs");
    if (brandAssets.colors.length === 0) notes.push("No brand colors detected — use neutral, professional palette");
    if (brandAssets.fonts.length === 0) notes.push("No brand fonts detected — use system font stack");
    if (!brandAssets.copy?.testimonials?.length) notes.push("No testimonials found — omit testimonial section");
    if (!brandAssets.copy?.features?.length) notes.push("No feature list found — omit dedicated features section");
    return notes;
  }

  it("returns all notes when everything is missing", () => {
    const notes = buildExtractionNotes({
      logoUrl: null,
      heroImageUrl: null,
      siteImageUrls: [],
      colors: [],
      fonts: [],
      copy: undefined,
    });
    expect(notes).toHaveLength(7);
    expect(notes[0]).toContain("No logo");
    expect(notes[1]).toContain("No hero image");
    expect(notes[2]).toContain("No site images");
    expect(notes[3]).toContain("No brand colors");
    expect(notes[4]).toContain("No brand fonts");
    expect(notes[5]).toContain("No testimonials");
    expect(notes[6]).toContain("No feature list");
  });

  it("returns empty when everything is present", () => {
    const notes = buildExtractionNotes({
      logoUrl: "https://example.com/logo.png",
      heroImageUrl: "https://example.com/hero.jpg",
      siteImageUrls: ["https://example.com/img1.jpg"],
      colors: ["#ff0000"],
      fonts: ["Inter"],
      copy: {
        testimonials: ["Great service!"],
        features: ["Feature one"],
      },
    });
    expect(notes).toHaveLength(0);
  });

  it("returns partial notes for partial missing data", () => {
    const notes = buildExtractionNotes({
      logoUrl: "https://example.com/logo.png",
      heroImageUrl: null, // missing
      siteImageUrls: ["https://example.com/img1.jpg"],
      colors: ["#ff0000"],
      fonts: [], // missing
      copy: {
        testimonials: [],
        features: ["Feature one"],
      },
    });
    expect(notes).toHaveLength(3);
    expect(notes.some((n) => n.includes("No hero image"))).toBe(true);
    expect(notes.some((n) => n.includes("No brand fonts"))).toBe(true);
    expect(notes.some((n) => n.includes("No testimonials"))).toBe(true);
  });

  it("each note contains guidance after the dash", () => {
    const notes = buildExtractionNotes({
      logoUrl: null,
      heroImageUrl: null,
      siteImageUrls: [],
      colors: [],
      fonts: [],
      copy: undefined,
    });
    for (const note of notes) {
      expect(note).toContain(" — ");
      const [, guidance] = note.split(" — ");
      expect(guidance.length).toBeGreaterThan(5);
    }
  });
});
