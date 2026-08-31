// Provider Test Service Tests

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — must be declared before vi.mock calls
const { mockListWithStatus, mockGetBySlug, mockGetApiKey, mockGetActiveKey, mockGetProvider } = vi.hoisted(() => ({
  mockListWithStatus: vi.fn(),
  mockGetBySlug: vi.fn(),
  mockGetApiKey: vi.fn(),
  mockGetActiveKey: vi.fn(),
  mockGetProvider: vi.fn(),
}));

// Mock bootstrap
vi.mock("./bootstrap", () => ({
  bootstrap: vi.fn().mockResolvedValue(undefined),
  getAgentRegistry: vi.fn().mockReturnValue({
    getAgent: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  }),
}));

// Mock ProviderManager
vi.mock("./provider-manager", () => ({
  getProviderManager: vi.fn().mockReturnValue({
    listWithStatus: mockListWithStatus,
    getBySlug: mockGetBySlug,
    getApiKey: mockGetApiKey,
  }),
}));

// Mock CredentialManager
vi.mock("./credential-manager", () => ({
  getCredentialManager: vi.fn().mockReturnValue({
    getActiveKey: mockGetActiveKey,
  }),
}));

// Mock AIModelRouter
vi.mock("./router", () => ({
  getRouter: vi.fn().mockReturnValue({
    getProvider: mockGetProvider,
  }),
}));

import { getProviderStatuses, testProviderConnection } from "./provider-test";
import type { AIConnectionTestResult } from "./types";

describe("ProviderTestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProviderStatuses", () => {
    it("should return provider statuses with env credential source", async () => {
      mockListWithStatus.mockResolvedValue([
        {
          slug: "gemini",
          name: "Google Gemini",
          enabled: true,
          configured: true,
          api_key_env_var: "GEMINI_API_KEY",
        },
      ]);
      mockGetApiKey.mockReturnValue("test-key-123");
      mockGetProvider.mockReturnValue({ slug: "gemini" });

      const result = await getProviderStatuses();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("gemini");
      expect(result[0].configured).toBe(true);
      expect(result[0].credentialSource).toBe("env");
      expect(result[0].registered).toBe(true);
    });

    it("should return provider statuses with no credential source", async () => {
      mockListWithStatus.mockResolvedValue([
        {
          slug: "anthropic",
          name: "Anthropic Claude",
          enabled: true,
          configured: false,
          api_key_env_var: "ANTHROPIC_API_KEY",
        },
      ]);
      mockGetApiKey.mockReturnValue(null);
      mockGetProvider.mockReturnValue(undefined);

      const result = await getProviderStatuses();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("anthropic");
      expect(result[0].configured).toBe(false);
      expect(result[0].credentialSource).toBe("none");
      expect(result[0].registered).toBe(false);
    });

    it("should return empty array when no providers exist", async () => {
      mockListWithStatus.mockResolvedValue([]);

      const result = await getProviderStatuses();

      expect(result).toHaveLength(0);
    });

    it("should handle multiple providers with mixed statuses", async () => {
      mockListWithStatus.mockResolvedValue([
        {
          slug: "gemini",
          name: "Google Gemini",
          enabled: true,
          configured: true,
          api_key_env_var: "GEMINI_API_KEY",
        },
        {
          slug: "anthropic",
          name: "Anthropic Claude",
          enabled: true,
          configured: false,
          api_key_env_var: "ANTHROPIC_API_KEY",
        },
        {
          slug: "xai",
          name: "xAI Grok",
          enabled: false,
          configured: false,
          api_key_env_var: "XAI_API_KEY",
        },
      ]);
      mockGetApiKey.mockReturnValueOnce("key-1").mockReturnValueOnce(null).mockReturnValueOnce(null);
      mockGetProvider.mockReturnValueOnce({ slug: "gemini" }).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

      const result = await getProviderStatuses();

      expect(result).toHaveLength(3);
      expect(result[0].slug).toBe("gemini");
      expect(result[0].registered).toBe(true);
      expect(result[1].slug).toBe("anthropic");
      expect(result[1].registered).toBe(false);
      expect(result[2].slug).toBe("xai");
      expect(result[2].enabled).toBe(false);
    });
  });

  describe("testProviderConnection", () => {
    it("should return error for unknown provider", async () => {
      mockGetBySlug.mockResolvedValue(null);

      const result = await testProviderConnection({ provider: "unknown" });

      expect(result.success).toBe(false);
      expect(result.provider).toBe("unknown");
      expect(result.error).toContain("Unknown provider");
    });

    it("should return error for disabled provider", async () => {
      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: false,
        api_key_env_var: "GEMINI_API_KEY",
      });

      const result = await testProviderConnection({ provider: "gemini" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });

    it("should test registered provider with env key", async () => {
      const mockTestResult: AIConnectionTestResult = {
        success: true,
        provider: "gemini",
        model: "gemini-2.0-flash",
        latencyMs: 150,
      };

      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: true,
        api_key_env_var: "GEMINI_API_KEY",
      });
      mockGetApiKey.mockReturnValue("env-key-123");
      mockGetProvider.mockReturnValue({
        testConnection: vi.fn().mockResolvedValue(mockTestResult),
      });

      const result = await testProviderConnection({
        provider: "gemini",
        model: "gemini-2.0-flash",
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("gemini");
      expect(result.model).toBe("gemini-2.0-flash");
      expect(result.credentialSource).toBe("env");
    });

    it("should use default model when none specified", async () => {
      const mockTestResult: AIConnectionTestResult = {
        success: true,
        provider: "gemini",
        model: "gemini-2.0-flash",
        latencyMs: 200,
      };

      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: true,
        api_key_env_var: "GEMINI_API_KEY",
      });
      mockGetApiKey.mockReturnValue("env-key");
      mockGetProvider.mockReturnValue({
        testConnection: vi.fn().mockResolvedValue(mockTestResult),
      });

      const result = await testProviderConnection({ provider: "gemini" });

      expect(result.success).toBe(true);
      expect(result.model).toBe("gemini-2.0-flash");
    });

    it("should return error when provider not registered and no DB credential", async () => {
      mockGetBySlug.mockResolvedValue({
        slug: "anthropic",
        enabled: true,
        api_key_env_var: "ANTHROPIC_API_KEY",
        id: "prov-anthropic",
      });
      mockGetApiKey.mockReturnValue(null);
      mockGetProvider.mockReturnValue(undefined);
      mockGetActiveKey.mockResolvedValue(null);

      const result = await testProviderConnection({ provider: "anthropic" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No API key configured");
    });

    it("should handle provider with DB credential but no registered class", async () => {
      mockGetBySlug.mockResolvedValue({
        slug: "anthropic",
        enabled: true,
        api_key_env_var: "ANTHROPIC_API_KEY",
        id: "prov-anthropic",
      });
      mockGetApiKey.mockReturnValue(null);
      mockGetProvider.mockReturnValue(undefined);
      mockGetActiveKey.mockResolvedValue("db-decrypted-key");

      const result = await testProviderConnection({ provider: "anthropic" });

      expect(result.success).toBe(false);
      expect(result.credentialSource).toBe("database");
      expect(result.error).toContain("no implementation class");
    });

    it("should handle connection test failure gracefully", async () => {
      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: true,
        api_key_env_var: "GEMINI_API_KEY",
      });
      mockGetApiKey.mockReturnValue("env-key");
      mockGetProvider.mockReturnValue({
        testConnection: vi.fn().mockRejectedValue(new Error("Network error")),
      });

      const result = await testProviderConnection({
        provider: "gemini",
        model: "gemini-2.0-flash",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should return latency from provider test result", async () => {
      const mockTestResult: AIConnectionTestResult = {
        success: true,
        provider: "gemini",
        model: "gemini-2.0-flash",
        latencyMs: 350,
      };

      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: true,
        api_key_env_var: "GEMINI_API_KEY",
      });
      mockGetApiKey.mockReturnValue("key");
      mockGetProvider.mockReturnValue({
        testConnection: vi.fn().mockResolvedValue(mockTestResult),
      });

      const result = await testProviderConnection({
        provider: "gemini",
        model: "gemini-2.0-flash",
      });

      expect(result.latencyMs).toBe(350);
    });

    it("should propagate provider error from failed connection test", async () => {
      const mockTestResult: AIConnectionTestResult = {
        success: false,
        provider: "gemini",
        model: "gemini-2.0-flash",
        latencyMs: 100,
        error: "Invalid API key",
      };

      mockGetBySlug.mockResolvedValue({
        slug: "gemini",
        enabled: true,
        api_key_env_var: "GEMINI_API_KEY",
      });
      mockGetApiKey.mockReturnValue("bad-key");
      mockGetProvider.mockReturnValue({
        testConnection: vi.fn().mockResolvedValue(mockTestResult),
      });

      const result = await testProviderConnection({
        provider: "gemini",
        model: "gemini-2.0-flash",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });
});
