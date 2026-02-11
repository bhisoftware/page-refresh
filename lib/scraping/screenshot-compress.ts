/**
 * Optimize screenshot for storage and serving: WebP compression and reasonable dimensions.
 * Target: full analysis < 90s; smaller blobs and faster loads on results page.
 */

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 800;
const WEBP_QUALITY = 85;

export async function compressScreenshotToWebP(pngBuffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const sharp = (await import("sharp")).default;
  const pipeline = sharp(pngBuffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY });
  const buffer = await pipeline.toBuffer();
  return { buffer, contentType: "image/webp" };
}
