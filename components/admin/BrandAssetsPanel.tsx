import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BrandAssetsPanelProps {
  brandAssets: {
    logo?: string | null;
    heroImage?: string | null;
    favicon?: string | null;
    colors?: Array<{ hex?: string; count?: number }> | unknown;
    fonts?: Array<{ family?: string }> | unknown;
  } | null;
  assets?: Array<{
    assetType: string;
    storageUrl: string | null;
    fileName: string;
    mimeType: string;
  }>;
}

function isColorArray(arr: unknown): arr is Array<{ hex?: string }> {
  return Array.isArray(arr) && arr.every((x) => x && typeof x === "object");
}
function isFontArray(arr: unknown): arr is Array<{ family?: string }> {
  return Array.isArray(arr) && arr.every((x) => x && typeof x === "object");
}

export function BrandAssetsPanel({ brandAssets, assets }: BrandAssetsPanelProps) {
  const colors = brandAssets?.colors && isColorArray(brandAssets.colors) ? brandAssets.colors : [];
  const fonts = brandAssets?.fonts && isFontArray(brandAssets.fonts) ? brandAssets.fonts : [];
  const logoUrl = brandAssets?.logo ?? assets?.find((a) => a.assetType === "logo")?.storageUrl;
  const heroUrl = brandAssets?.heroImage ?? assets?.find((a) => a.assetType === "hero_image")?.storageUrl;
  const faviconUrl = brandAssets?.favicon ?? assets?.find((a) => a.assetType === "favicon")?.storageUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brand Assets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Logo</p>
            <div className="relative h-16 w-48 border rounded overflow-hidden bg-muted">
              <Image
                src={logoUrl}
                alt="Logo"
                fill
                className="object-contain object-left p-1"
                unoptimized
              />
            </div>
          </div>
        )}
        {faviconUrl && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Favicon</p>
            <div className="relative h-8 w-8 border rounded overflow-hidden bg-muted">
              <Image
                src={faviconUrl}
                alt="Favicon"
                fill
                className="object-contain p-0.5"
                unoptimized
              />
            </div>
          </div>
        )}
        {colors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Colors</p>
            <div className="flex flex-wrap gap-2">
              {colors.slice(0, 10).map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5"
                  title={c.hex ?? ""}
                >
                  <div
                    className="h-6 w-6 rounded border border-border shrink-0"
                    style={{ backgroundColor: c.hex ?? "#ccc" }}
                  />
                  <span className="text-xs text-muted-foreground font-mono">
                    {c.hex ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {fonts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Fonts</p>
            <p className="text-sm">{fonts.map((f) => f.family ?? "").filter(Boolean).join(", ") || "—"}</p>
          </div>
        )}
        {heroUrl && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Hero image</p>
            <div className="relative h-32 w-full max-w-md border rounded overflow-hidden bg-muted">
              <Image
                src={heroUrl}
                alt="Hero"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        )}
        {!logoUrl && !faviconUrl && colors.length === 0 && fonts.length === 0 && !heroUrl && (
          <p className="text-sm text-muted-foreground">No brand assets extracted yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
