/**
 * Tests for image dimension classification (Phase 1B).
 * Verifies the classifyImageCategory logic used in analyze.ts.
 */

import type { SiteImage } from "@/lib/pipeline/agents/types";

// Replicate classification logic from analyze.ts
function classifyImageCategory(
  w: number | undefined,
  h: number | undefined
): SiteImage["category"] {
  if (w == null || h == null) return "unknown";
  if (w < 80 && h < 80) return "icon";
  if (w < 200 || h < 200) return "badge";
  if (w >= 600 && h >= 400) return "photo";
  return "unknown";
}

describe("classifyImageCategory", () => {
  describe("icon classification", () => {
    it("classifies tiny images as icon", () => {
      expect(classifyImageCategory(32, 32)).toBe("icon");
      expect(classifyImageCategory(16, 16)).toBe("icon");
      expect(classifyImageCategory(64, 64)).toBe("icon");
      expect(classifyImageCategory(79, 79)).toBe("icon");
    });

    it("does not classify 80x80 as icon", () => {
      expect(classifyImageCategory(80, 80)).not.toBe("icon");
    });

    it("requires both dimensions under 80", () => {
      // 40x200 — width is under 80 but height is not, so badge (width < 200)
      expect(classifyImageCategory(40, 200)).toBe("badge");
    });
  });

  describe("badge classification", () => {
    it("classifies small-width images as badge", () => {
      expect(classifyImageCategory(150, 50)).toBe("badge");
      expect(classifyImageCategory(180, 60)).toBe("badge");
      expect(classifyImageCategory(100, 100)).toBe("badge");
    });

    it("classifies small-height images as badge", () => {
      expect(classifyImageCategory(400, 100)).toBe("badge");
      expect(classifyImageCategory(300, 150)).toBe("badge");
    });

    it("classifies typical certification seals as badge", () => {
      // ASE badge: ~150x50
      expect(classifyImageCategory(150, 50)).toBe("badge");
      // BBB badge: ~180x70
      expect(classifyImageCategory(180, 70)).toBe("badge");
      // Payment badge: ~120x40
      expect(classifyImageCategory(120, 40)).toBe("badge");
    });
  });

  describe("photo classification", () => {
    it("classifies large images as photo", () => {
      expect(classifyImageCategory(1200, 800)).toBe("photo");
      expect(classifyImageCategory(800, 600)).toBe("photo");
      expect(classifyImageCategory(600, 400)).toBe("photo");
    });

    it("requires both minimum dimensions", () => {
      // Wide but short — badge (height < 200)
      expect(classifyImageCategory(600, 150)).toBe("badge");
      // Tall but narrow — badge (width < 200)
      expect(classifyImageCategory(150, 400)).toBe("badge");
    });

    it("classifies typical hero images as photo", () => {
      expect(classifyImageCategory(1920, 1080)).toBe("photo");
      expect(classifyImageCategory(1280, 720)).toBe("photo");
    });
  });

  describe("unknown classification", () => {
    it("returns unknown when dimensions are missing", () => {
      expect(classifyImageCategory(undefined, undefined)).toBe("unknown");
      expect(classifyImageCategory(undefined, 400)).toBe("unknown");
      expect(classifyImageCategory(600, undefined)).toBe("unknown");
    });

    it("returns unknown for medium images that don't meet photo threshold", () => {
      // 400x300 — both dimensions are ≥200 so not badge, but doesn't meet photo (600x400)
      expect(classifyImageCategory(400, 300)).toBe("unknown");
      expect(classifyImageCategory(500, 350)).toBe("unknown");
      expect(classifyImageCategory(200, 200)).toBe("unknown");
    });
  });

  describe("badge-aware extraction notes", () => {
    function buildBadgeNotes(siteImages: SiteImage[]): string[] {
      const notes: string[] = [];
      if (siteImages.length > 0) {
        const photoCount = siteImages.filter((img) => img.category === "photo").length;
        const badgeCount = siteImages.filter((img) => img.category === "badge").length;
        if (badgeCount > 0 && photoCount === 0) {
          notes.push(
            `Site images are primarily badges/seals (${badgeCount} badges, 0 photos) — display them small (h-12 to h-16) in a horizontal trust strip. Use gradients or solid color backgrounds for hero and feature sections.`
          );
        } else if (badgeCount > 0 && photoCount <= 2) {
          notes.push(
            `Limited photos available (${photoCount} photos, ${badgeCount} badges) — reserve photos for the hero and one feature section. Use badges in a trust strip only.`
          );
        }
      }
      return notes;
    }

    it("warns when all images are badges", () => {
      const images: SiteImage[] = [
        { url: "badge1.jpg", category: "badge", width: 150, height: 50 },
        { url: "badge2.jpg", category: "badge", width: 180, height: 60 },
      ];
      const notes = buildBadgeNotes(images);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toContain("primarily badges/seals");
      expect(notes[0]).toContain("2 badges, 0 photos");
    });

    it("warns when few photos mixed with badges", () => {
      const images: SiteImage[] = [
        { url: "photo1.jpg", category: "photo", width: 800, height: 600 },
        { url: "badge1.jpg", category: "badge", width: 150, height: 50 },
        { url: "badge2.jpg", category: "badge", width: 180, height: 60 },
      ];
      const notes = buildBadgeNotes(images);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toContain("Limited photos available");
      expect(notes[0]).toContain("1 photos, 2 badges");
    });

    it("no note when plenty of photos", () => {
      const images: SiteImage[] = [
        { url: "photo1.jpg", category: "photo", width: 800, height: 600 },
        { url: "photo2.jpg", category: "photo", width: 1200, height: 800 },
        { url: "photo3.jpg", category: "photo", width: 600, height: 400 },
        { url: "badge1.jpg", category: "badge", width: 150, height: 50 },
      ];
      const notes = buildBadgeNotes(images);
      expect(notes).toHaveLength(0);
    });

    it("no note when no badges", () => {
      const images: SiteImage[] = [
        { url: "photo1.jpg", category: "photo", width: 800, height: 600 },
      ];
      const notes = buildBadgeNotes(images);
      expect(notes).toHaveLength(0);
    });

    it("no note when no images", () => {
      const notes = buildBadgeNotes([]);
      expect(notes).toHaveLength(0);
    });
  });
});
