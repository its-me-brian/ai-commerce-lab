// Encryption Utility
// AES-256-GCM encryption/decryption for API keys.
// Uses Node.js crypto module — server-side only.
// Keys are encrypted at rest and never exposed to the browser.
//
// Key rotation: Set ENCRYPTION_KEY to the new key. Set ENCRYPTION_KEY_PREVIOUS
// to the old key. New encryptions use the new key. Decryption tries the new key
// first, then falls back to the previous key for legacy data.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits for GCM

export interface EncryptedData {
  encrypted: string;   // Hex-encoded ciphertext
  iv: string;          // Hex-encoded initialization vector
  authTag: string;     // Hex-encoded authentication tag
}

/**
 * Get the encryption key from environment.
 * In production, this should be a 32-byte key stored in a secrets manager.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "Missing ENCRYPTION_KEY environment variable. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${key.length} bytes.`
    );
  }

  return key;
}

/**
 * Get the previous encryption key (for rotation).
 * Returns null if not configured.
 */
function getPreviousEncryptionKey(): Buffer | null {
  const keyHex = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!keyHex) return null;

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) return null;

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns encrypted data with IV and auth tag for decryption.
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt an encrypted string using AES-256-GCM.
 * Requires the same IV and auth tag used during encryption.
 * Tries current key first, then falls back to previous key (for rotation).
 */
export function decrypt(encryptedData: EncryptedData): string {
  const iv = Buffer.from(encryptedData.iv, "hex");
  const authTag = Buffer.from(encryptedData.authTag, "hex");
  const encrypted = Buffer.from(encryptedData.encrypted, "hex");

  // Try current key first
  try {
    return decryptWithKey(getEncryptionKey(), iv, authTag, encrypted);
  } catch {
    // If previous key exists, try it (legacy data from before rotation)
    const prevKey = getPreviousEncryptionKey();
    if (prevKey) {
      return decryptWithKey(prevKey, iv, authTag, encrypted);
    }
    throw new Error("Decryption failed with current key and no previous key configured");
  }
}

function decryptWithKey(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  encrypted: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Generate a hint from an API key (last 4 chars).
 * Used for UI identification without exposing the key.
 */
export function getKeyHint(apiKey: string): string {
  if (apiKey.length < 4) return "****";
  return `...${apiKey.slice(-4)}`;
}

/**
 * Generate a new encryption key (for setup purposes).
 * Returns a 64-character hex string (32 bytes).
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
