/**
 * AES-256-GCM encryption for API keys stored in the database.
 * Uses Node.js built-in crypto only. Key from API_CONFIG_ENCRYPTION_KEY.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer {
  const envKey = process.env.API_CONFIG_ENCRYPTION_KEY;
  if (!envKey || typeof envKey !== "string" || envKey.length < 32) {
    throw new Error(
      "API_CONFIG_ENCRYPTION_KEY must be set and at least 32 characters (use a 64-char hex string from: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    );
  }
  return createHash("sha256").update(envKey).digest();
}

/**
 * Encrypt plaintext. Output format: iv_hex:authTag_hex:ciphertext_hex
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a string produced by encrypt(). Throws on invalid or tampered data.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format: expected iv:tag:ciphertext");
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  if (iv.length !== IV_LEN || authTag.length !== AUTH_TAG_LEN) {
    throw new Error("Invalid encrypted format: iv or authTag length wrong");
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
