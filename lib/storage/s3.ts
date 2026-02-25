/**
 * AWS S3 storage for screenshots and brand assets.
 * Bucket: pagerefresh-assets (us-east-2)
 *
 * Used as primary storage when AWS_S3_BUCKET is set.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;

function getClient(): S3Client | null {
  if (_client) return _client;
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!bucket) return null;
  // Credentials resolve automatically via env vars, ~/.aws, or IAM role
  _client = new S3Client({ region });
  return _client;
}

function getBucket(): string {
  return process.env.AWS_S3_BUCKET || "pagerefresh-assets";
}

/**
 * Upload a Buffer to S3. Returns true on success.
 */
export async function s3Upload(
  key: string,
  data: Buffer,
  contentType: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return true;
}

/**
 * Upload a string (e.g. JSON) to S3. Returns true on success.
 */
export async function s3UploadString(
  key: string,
  data: string,
  contentType: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return true;
}

/**
 * Download an object from S3. Returns { data, contentType } or null.
 */
export async function s3Download(
  key: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const resp = await client.send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key })
    );
    if (!resp.Body) return null;
    const bytes = await resp.Body.transformToByteArray();
    return {
      data: bytes.buffer as ArrayBuffer,
      contentType: resp.ContentType || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

/**
 * Generate a pre-signed URL for downloading an object.
 * Default expiry: 1 hour (3600s). Objects are immutable so browsers
 * cache them via Cache-Control; the signed URL just needs to last
 * long enough for the initial fetch.
 */
export async function s3GetSignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Returns true if S3 is configured and available.
 */
export function isS3Configured(): boolean {
  return !!process.env.AWS_S3_BUCKET;
}
