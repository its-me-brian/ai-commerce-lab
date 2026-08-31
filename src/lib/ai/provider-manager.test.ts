// Provider Manager Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProviderManager } from "./provider-manager";
import type { ProviderRecord } from "./provider-manager";

// Mock Supabase
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

const mockProvider: ProviderRecord = {
  id: "gemini",
  name: "Google Gemini",
  slug: "gemini",
  description: "Google Gemini — fast, cost-effective",
  api_key_env_var: "GEMINI_API_KEY",
  base_url: "https://generativelanguage.googleapis.com/v1beta",
  capabilities: ["text", "json", "vision"],
  config: { max_tokens: 8192 },
  enabled: true,
  created_at: "2026-08-31T00:00:00Z",
};

describe("ProviderManager", () => {
  let manager: ProviderManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ProviderManager();
  });

  it("should create a provider manager instance", () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(ProviderManager);
  });

  it("should have list method", () => {
    expect(typeof manager.list).toBe("function");
  });

  it("should have listEnabled method", () => {
    expect(typeof manager.listEnabled).toBe("function");
  });

  it("should have getBySlug method", () => {
    expect(typeof manager.getBySlug).toBe("function");
  });

  it("should have getById method", () => {
    expect(typeof manager.getById).toBe("function");
  });

  it("should have create method", () => {
    expect(typeof manager.create).toBe("function");
  });

  it("should have update method", () => {
    expect(typeof manager.update).toBe("function");
  });

  it("should have setEnabled method", () => {
    expect(typeof manager.setEnabled).toBe("function");
  });

  it("should have hasCapability method", () => {
    expect(typeof manager.hasCapability).toBe("function");
  });

  it("should have listByCapability method", () => {
    expect(typeof manager.listByCapability).toBe("function");
  });

  it("should have getApiKey method", () => {
    expect(typeof manager.getApiKey).toBe("function");
  });

  it("should have isConfigured method", () => {
    expect(typeof manager.isConfigured).toBe("function");
  });

  it("should have listWithStatus method", () => {
    expect(typeof manager.listWithStatus).toBe("function");
  });

  describe("getApiKey", () => {
    it("should return API key from environment variable", () => {
      process.env.GEMINI_API_KEY = "test-key-123";
      const key = manager.getApiKey(mockProvider);
      expect(key).toBe("test-key-123");
      delete process.env.GEMINI_API_KEY;
    });

    it("should return null when env var not set", () => {
      delete process.env.GEMINI_API_KEY;
      const key = manager.getApiKey(mockProvider);
      expect(key).toBeNull();
    });

    it("should return null when api_key_env_var is null", () => {
      const provider = { ...mockProvider, api_key_env_var: null };
      const key = manager.getApiKey(provider);
      expect(key).toBeNull();
    });
  });
});
