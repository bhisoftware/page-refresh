/**
 * Tests for brand config head block generation (Phase 1C).
 * Verifies Google Fonts link and Tailwind config injection.
 */

const SYSTEM_FONTS = new Set([
  "arial", "helvetica", "helvetica neue", "verdana", "georgia", "times new roman",
  "times", "courier new", "courier", "tahoma", "trebuchet ms", "impact",
  "comic sans ms", "palatino linotype", "palatino", "lucida sans unicode",
  "lucida grande", "lucida sans", "lucida console", "book antiqua", "garamond",
  "century gothic", "segoe ui", "system-ui", "-apple-system", "blinkmacsystemfont",
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "inherit", "initial",
  "unset", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
]);

function isSystemFont(fontName: string): boolean {
  return SYSTEM_FONTS.has(fontName.toLowerCase().trim());
}

function extractPrimaryFont(fontStack: string): string | null {
  const names = fontStack.split(",").map((f) => f.trim().replace(/['"]/g, ""));
  for (const name of names) {
    if (name && !isSystemFont(name)) return name;
  }
  return null;
}

interface BrandInput {
  colors: string[];
  fonts: string[];
}

function buildBrandHeadBlock(input: BrandInput): string {
  const { colors, fonts } = input;

  const resolvedFonts = fonts
    .flatMap((f) => f.split(",").map((n) => n.trim().replace(/['"]/g, "")))
    .filter((f) => f && !isSystemFont(f));
  const uniqueFonts = [...new Set(resolvedFonts)];

  const googleFontFamilies = uniqueFonts.slice(0, 3);
  const fontsLink =
    googleFontFamilies.length > 0
      ? `<link href="https://fonts.googleapis.com/css2?${googleFontFamilies.map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700`).join("&")}&display=swap" rel="stylesheet">`
      : "";

  const primary = colors[0] ?? "#1a1a2e";
  const secondary = colors[1] ?? colors[0] ?? "#16213e";
  const accent = colors[2] ?? colors[0] ?? "#0f3460";

  const headingFont = extractPrimaryFont(fonts[0] ?? "") ?? uniqueFonts[0] ?? "Inter";
  const bodyFont = extractPrimaryFont(fonts[1] ?? "") ?? uniqueFonts[0] ?? "Inter";

  return `<!-- BRAND CONFIG: Include this exact block in your <head>, AFTER <meta charset="utf-8"> -->
${fontsLink}
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: { brand: { primary: '${primary}', secondary: '${secondary}', accent: '${accent}' } },
      fontFamily: { heading: ['${headingFont}', 'sans-serif'], body: ['${bodyFont}', 'sans-serif'] }
    }
  }
}
</script>`;
}

describe("isSystemFont", () => {
  it("identifies system fonts", () => {
    expect(isSystemFont("Arial")).toBe(true);
    expect(isSystemFont("helvetica")).toBe(true);
    expect(isSystemFont("sans-serif")).toBe(true);
    expect(isSystemFont("system-ui")).toBe(true);
    expect(isSystemFont("-apple-system")).toBe(true);
    expect(isSystemFont("Georgia")).toBe(true);
  });

  it("identifies non-system fonts", () => {
    expect(isSystemFont("Inter")).toBe(false);
    expect(isSystemFont("Playfair Display")).toBe(false);
    expect(isSystemFont("Roboto")).toBe(false);
    expect(isSystemFont("Space Grotesk")).toBe(false);
    expect(isSystemFont("Lora")).toBe(false);
  });

  it("handles whitespace", () => {
    expect(isSystemFont("  Arial  ")).toBe(true);
    expect(isSystemFont("  Inter  ")).toBe(false);
  });
});

describe("extractPrimaryFont", () => {
  it("extracts first non-system font from a font stack", () => {
    expect(extractPrimaryFont("Playfair Display, Georgia, serif")).toBe("Playfair Display");
    expect(extractPrimaryFont("Inter, Arial, sans-serif")).toBe("Inter");
  });

  it("returns null when all fonts are system fonts", () => {
    expect(extractPrimaryFont("Helvetica Neue, Segoe UI, Arial, sans-serif")).toBe(null);
    expect(extractPrimaryFont("Georgia, serif")).toBe(null);
  });

  it("handles quoted font names", () => {
    expect(extractPrimaryFont("'Playfair Display', Georgia, serif")).toBe("Playfair Display");
    expect(extractPrimaryFont('"Space Grotesk", sans-serif')).toBe("Space Grotesk");
  });

  it("returns null for empty string", () => {
    expect(extractPrimaryFont("")).toBe(null);
  });
});

describe("buildBrandHeadBlock", () => {
  it("generates Google Fonts link for non-system fonts", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: ["Playfair Display", "Inter"],
    });
    expect(result).toContain("fonts.googleapis.com");
    expect(result).toContain("family=Playfair+Display");
    expect(result).toContain("family=Inter");
  });

  it("handles CSS font stacks by splitting on commas", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: ["Helvetica Neue, Segoe UI, Arial, sans-serif"],
    });
    // All are system fonts, so no Google Fonts link
    expect(result).not.toContain("fonts.googleapis.com");
  });

  it("extracts non-system fonts from mixed font stacks", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: ["Playfair Display, Georgia, serif", "Roboto, Arial, sans-serif"],
    });
    expect(result).toContain("family=Playfair+Display");
    expect(result).toContain("family=Roboto");
    // System fonts should not be in Google Fonts link
    expect(result).not.toContain("family=Georgia");
    expect(result).not.toContain("family=Arial");
  });

  it("uses first non-system font for heading/body in Tailwind config", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: ["Playfair Display, Georgia, serif", "Roboto, Arial, sans-serif"],
    });
    expect(result).toContain("heading: ['Playfair Display', 'sans-serif']");
    expect(result).toContain("body: ['Roboto', 'sans-serif']");
  });

  it("falls back to Inter when all fonts are system fonts", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: ["Helvetica Neue, Segoe UI, Arial, sans-serif"],
    });
    expect(result).toContain("heading: ['Inter', 'sans-serif']");
    expect(result).toContain("body: ['Inter', 'sans-serif']");
  });

  it("skips system fonts in Google Fonts link", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: ["Arial", "Georgia", "Inter"],
    });
    expect(result).toContain("family=Inter");
    expect(result).not.toContain("family=Arial");
    expect(result).not.toContain("family=Georgia");
  });

  it("omits Google Fonts link when all fonts are system fonts", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: ["Arial", "Georgia"],
    });
    expect(result).not.toContain("fonts.googleapis.com");
  });

  it("limits to 3 Google Font families", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: ["Inter", "Roboto", "Lora", "Playfair Display", "Space Grotesk"],
    });
    const familyMatches = result.match(/family=/g);
    expect(familyMatches).toHaveLength(3);
  });

  it("uses extracted colors in Tailwind config", () => {
    const result = buildBrandHeadBlock({
      colors: ["#2d5a3d", "#1a3a2d", "#4a8a5d"],
      fonts: [],
    });
    expect(result).toContain("primary: '#2d5a3d'");
    expect(result).toContain("secondary: '#1a3a2d'");
    expect(result).toContain("accent: '#4a8a5d'");
  });

  it("falls back to defaults when no colors provided", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: [],
    });
    expect(result).toContain("primary: '#1a1a2e'");
    expect(result).toContain("secondary: '#16213e'");
    expect(result).toContain("accent: '#0f3460'");
  });

  it("uses first color as fallback for missing secondary/accent", () => {
    const result = buildBrandHeadBlock({
      colors: ["#ff0000"],
      fonts: [],
    });
    expect(result).toContain("primary: '#ff0000'");
    expect(result).toContain("secondary: '#ff0000'");
    expect(result).toContain("accent: '#ff0000'");
  });

  it("falls back to Inter when no fonts provided", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: [],
    });
    expect(result).toContain("heading: ['Inter', 'sans-serif']");
    expect(result).toContain("body: ['Inter', 'sans-serif']");
  });

  it("includes Tailwind CDN script tag", () => {
    const result = buildBrandHeadBlock({ colors: [], fonts: [] });
    expect(result).toContain("cdn.tailwindcss.com/3.4.17");
  });

  it("includes tailwind.config assignment", () => {
    const result = buildBrandHeadBlock({ colors: [], fonts: [] });
    expect(result).toContain("tailwind.config =");
  });

  it("handles fonts with spaces in Google Fonts URL", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: ["Space Grotesk"],
    });
    expect(result).toContain("family=Space+Grotesk");
    expect(result).not.toContain("family=Space Grotesk");
  });

  it("deduplicates fonts across multiple font stacks", () => {
    const result = buildBrandHeadBlock({
      colors: [],
      fonts: ["Roboto, Arial, sans-serif", "Roboto, Georgia, serif"],
    });
    const robotoMatches = result.match(/family=Roboto/g);
    expect(robotoMatches).toHaveLength(1);
  });
});
