/**
 * Tests for font hierarchy merge logic.
 * Since the merge happens inside analyze.ts (not directly exportable),
 * we test the logic pattern in isolation.
 */

describe("Font hierarchy merge", () => {
  // Replicate the merge logic from analyze.ts
  function mergeFonts(
    screenshotTypography: { headingFont?: string; bodyFont?: string } | undefined,
    cssExtractedFonts: Array<{ family: string; source?: string }>
  ): string[] {
    const screenshotFonts: string[] = [];
    if (screenshotTypography?.headingFont) screenshotFonts.push(screenshotTypography.headingFont);
    if (screenshotTypography?.bodyFont) screenshotFonts.push(screenshotTypography.bodyFont);
    const seenFonts = new Set<string>();
    const mergedFonts: string[] = [];
    for (const font of screenshotFonts) {
      const key = font.toLowerCase();
      if (!seenFonts.has(key)) {
        seenFonts.add(key);
        mergedFonts.push(font);
      }
    }
    for (const f of cssExtractedFonts) {
      const name = "family" in f ? f.family : String(f);
      const key = name.toLowerCase();
      if (!seenFonts.has(key)) {
        seenFonts.add(key);
        mergedFonts.push(name);
      }
    }
    return mergedFonts;
  }

  it("puts screenshot fonts first", () => {
    const result = mergeFonts(
      { headingFont: "Playfair Display", bodyFont: "Open Sans" },
      [{ family: "Roboto", source: "import" }, { family: "Lato" }]
    );
    expect(result[0]).toBe("Playfair Display");
    expect(result[1]).toBe("Open Sans");
    expect(result[2]).toBe("Roboto");
    expect(result[3]).toBe("Lato");
  });

  it("deduplicates case-insensitively", () => {
    const result = mergeFonts(
      { headingFont: "Open Sans", bodyFont: "Roboto" },
      [{ family: "open sans" }, { family: "ROBOTO" }, { family: "Lato" }]
    );
    expect(result).toEqual(["Open Sans", "Roboto", "Lato"]);
    // Screenshot versions win (proper casing)
    expect(result).not.toContain("open sans");
    expect(result).not.toContain("ROBOTO");
  });

  it("handles missing screenshot typography", () => {
    const result = mergeFonts(undefined, [
      { family: "Inter" },
      { family: "Georgia" },
    ]);
    expect(result).toEqual(["Inter", "Georgia"]);
  });

  it("handles partial screenshot typography (only heading)", () => {
    const result = mergeFonts(
      { headingFont: "Montserrat" },
      [{ family: "Arial" }]
    );
    expect(result).toEqual(["Montserrat", "Arial"]);
  });

  it("handles partial screenshot typography (only body)", () => {
    const result = mergeFonts(
      { bodyFont: "Source Sans Pro" },
      [{ family: "Helvetica" }]
    );
    expect(result).toEqual(["Source Sans Pro", "Helvetica"]);
  });

  it("handles empty CSS fonts", () => {
    const result = mergeFonts(
      { headingFont: "Poppins", bodyFont: "Nunito" },
      []
    );
    expect(result).toEqual(["Poppins", "Nunito"]);
  });

  it("handles both empty", () => {
    const result = mergeFonts(undefined, []);
    expect(result).toEqual([]);
  });

  it("deduplicates same heading and body font", () => {
    const result = mergeFonts(
      { headingFont: "Inter", bodyFont: "Inter" },
      [{ family: "Inter" }]
    );
    expect(result).toEqual(["Inter"]);
  });
});
