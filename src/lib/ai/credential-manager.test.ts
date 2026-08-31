// Credential Manager Tests

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { CredentialManager } from "./credential-manager";
import { generateEncryptionKey } from "./encryption";
import type { CredentialRecord } from "./credential-manager";

// Set up encryption key for tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = generateEncryptionKey();
});

// Mock Supabase
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

const mockCredential: CredentialRecord = {
  id: "cred-1",
  provider_id: "gemini",
  name: "Production Key",
  encrypted_key: "encrypted-data",
  key_hint: "...1234",
  iv: "iv-data",
  auth_tag: "tag-data",
  environment: "production",
  is_active: true,
  expires_at: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
  created_by: null,
};

describe("CredentialManager", () => {
  let manager: CredentialManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CredentialManager();
  });

  it("should create a credential manager instance", () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(CredentialManager);
  });

  it("should have store method", () => {
    expect(typeof manager.store).toBe("function");
  });

  it("should have retrieve method", () => {
    expect(typeof manager.retrieve).toBe("function");
  });

  it("should have getActiveKey method", () => {
    expect(typeof manager.getActiveKey).toBe("function");
  });

  it("should have listByProvider method", () => {
    expect(typeof manager.listByProvider).toBe("function");
  });

  it("should have listAll method", () => {
    expect(typeof manager.listAll).toBe("function");
  });

  it("should have deactivate method", () => {
    expect(typeof manager.deactivate).toBe("function");
  });

  it("should have delete method", () => {
    expect(typeof manager.delete).toBe("function");
  });

  it("should have hasActiveCredential method", () => {
    expect(typeof manager.hasActiveCredential).toBe("function");
  });

  describe("toSafe", () => {
    it("should strip sensitive fields from credential", () => {
      // Access private method via type assertion
      const safe = (manager as unknown as { toSafe: (r: CredentialRecord) => Record<string, unknown> }).toSafe(mockCredential);

      expect(safe.id).toBe("cred-1");
      expect(safe.provider_id).toBe("gemini");
      expect(safe.name).toBe("Production Key");
      expect(safe.key_hint).toBe("...1234");
      expect(safe.environment).toBe("production");
      expect(safe.is_active).toBe(true);

      // Should NOT contain sensitive fields
      expect(safe.encrypted_key).toBeUndefined();
      expect(safe.iv).toBeUndefined();
      expect(safe.auth_tag).toBeUndefined();
    });
  });
});
