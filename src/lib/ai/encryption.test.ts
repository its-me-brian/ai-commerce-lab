// Encryption Utility Tests

import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, getKeyHint, generateEncryptionKey } from "./encryption";

// Set up encryption key for tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = generateEncryptionKey();
});

describe("Encryption Utility", () => {
  describe("encrypt/decrypt roundtrip", () => {
    it("should encrypt and decrypt a string", () => {
      const plaintext = "sk-test-api-key-12345";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "same-key";
      const enc1 = encrypt(plaintext);
      const enc2 = encrypt(plaintext);

      // Different IVs mean different ciphertext
      expect(enc1.encrypted).not.toBe(enc2.encrypted);
      expect(enc1.iv).not.toBe(enc2.iv);

      // But both decrypt to the same plaintext
      expect(decrypt(enc1)).toBe(plaintext);
      expect(decrypt(enc2)).toBe(plaintext);
    });

    it("should handle empty string", () => {
      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle long strings", () => {
      const plaintext = "x".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle special characters", () => {
      const plaintext = "key-with-special-chars!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode", () => {
      const plaintext = " clave-con-acentos: ñ, á, é, í, ó, ú";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decrypt with wrong key", () => {
    it("should fail to decrypt with wrong auth tag", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext);

      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: "00000000000000000000000000000000",
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it("should fail to decrypt with wrong IV", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext);

      // Tamper with IV
      const tampered = {
        ...encrypted,
        iv: "000000000000000000000000",
      };

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("getKeyHint", () => {
    it("should return last 4 chars with prefix", () => {
      expect(getKeyHint("sk-abc123def456")).toBe("...f456");
    });

    it("should handle short keys", () => {
      expect(getKeyHint("ab")).toBe("****");
    });

    it("should handle exactly 4 chars", () => {
      expect(getKeyHint("abcd")).toBe("...abcd");
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate a 64-char hex string", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("ENCRYPTION_KEY validation", () => {
    it("should throw if ENCRYPTION_KEY is missing", () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow("Missing ENCRYPTION_KEY");

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it("should throw if ENCRYPTION_KEY is wrong length", () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = "invalid-short-key";

      expect(() => encrypt("test")).toThrow("32 bytes");

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });
});
