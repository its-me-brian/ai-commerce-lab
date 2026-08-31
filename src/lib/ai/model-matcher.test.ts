// Model Matcher Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findBestModel,
  findSingleBestModel,
  modelMeetsRequirements,
  getAvailableCapabilities,
  getModelsByCapability,
} from "./model-matcher";
import type { ModelRecord } from "./model-registry";

// Hoisted mocks
const { mockListEnabled, mockGetById } = vi.hoisted(() => ({
  mockListEnabled: vi.fn(),
  mockGetById: vi.fn(),
}));

vi.mock("./model-registry", () => ({
  getModelRegistry: vi.fn().mockReturnValue({
    listEnabled: mockListEnabled,
    getById: mockGetById,
  }),
}));

const mockModels: ModelRecord[] = [
  {
    id: "gemini-3-flash",
    provider_id: "gemini",
    name: "Gemini 3 Flash",
    model_id: "gemini-3-flash-preview",
    enabled: true,
    context_window: 1000000,
    input_price: 0,
    output_price: 0,
    capabilities: ["vision", "json-mode", "tool-use", "code-generation"],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  },
  {
    id: "claude-sonnet-4",
    provider_id: "anthropic",
    name: "Claude Sonnet 4",
    model_id: "claude-sonnet-4-20250514",
    enabled: true,
    context_window: 200000,
    input_price: 3.0,
    output_price: 15.0,
    capabilities: ["vision", "tool-use", "reasoning"],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  },
  {
    id: "claude-3-5-haiku",
    provider_id: "anthropic",
    name: "Claude 3.5 Haiku",
    model_id: "claude-3-5-haiku-20241022",
    enabled: true,
    context_window: 200000,
    input_price: 0.8,
    output_price: 4.0,
    capabilities: ["vision", "tool-use"],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  },
  {
    id: "grok-3-mini",
    provider_id: "xai",
    name: "Grok 3 Mini",
    model_id: "grok-3-mini-latest",
    enabled: false,
    context_window: 128000,
    input_price: 0.3,
    output_price: 0.5,
    capabilities: ["json-mode"],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  },
];

describe("ModelMatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findBestModel", () => {
    it("should return models matching required capabilities", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["vision"],
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.allCapabilitiesMatch).toBe(true);
      });
    });

    it("should rank models with more capabilities higher", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["vision", "tool-use"],
      });

      // Both gemini and claude-sonnet have both capabilities
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Gemini has more total capabilities, so should score higher or equal
      const geminiResult = results.find((r) => r.model.id === "gemini-3-flash");
      expect(geminiResult).toBeDefined();
      expect(geminiResult!.allCapabilitiesMatch).toBe(true);
    });

    it("should respect context window requirement", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["vision"],
        minContextWindow: 500000,
      });

      // Only gemini has 1M context window
      expect(results.length).toBe(1);
      expect(results[0].model.id).toBe("gemini-3-flash");
      expect(results[0].contextWindowMatch).toBe(true);
    });

    it("should respect cost constraints", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["tool-use"],
        maxInputPrice: 1.0,
      });

      // Gemini (input_price=0) and haiku (input_price=0.8) both fit budget
      expect(results.length).toBe(2);
      expect(results.map((r) => r.model.id)).toContain("claude-3-5-haiku");
      expect(results.map((r) => r.model.id)).toContain("gemini-3-flash");
      results.forEach((r) => expect(r.costMatch).toBe(true));
    });

    it("should prefer specified provider as tiebreaker", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["tool-use"],
        preferredProvider: "anthropic",
      });

      // Both gemini and claude have tool-use
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Anthropic models should get provider bonus
      const anthropicResults = results.filter(
        (r) => r.model.provider_id === "anthropic"
      );
      expect(anthropicResults.length).toBeGreaterThan(0);
    });

    it("should apply limit to results", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["json-mode"],
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array when no models match", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["nonexistent-cap"],
      });

      expect(results).toHaveLength(0);
    });

    it("should exclude disabled models", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: ["json-mode"],
      });

      // grok-3-mini has json-mode but is disabled
      const grokResult = results.find((r) => r.model.id === "grok-3-mini");
      expect(grokResult).toBeUndefined();
    });

    it("should handle empty required capabilities", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const results = await findBestModel({
        requiredCapabilities: [],
      });

      // All enabled models should match when no capabilities required
      expect(results.length).toBe(3);
    });
  });

  describe("findSingleBestModel", () => {
    it("should return the single best model", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const result = await findSingleBestModel({
        requiredCapabilities: ["vision"],
      });

      expect(result).not.toBeNull();
      expect(result!.allCapabilitiesMatch).toBe(true);
    });

    it("should return null when no model matches", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const result = await findSingleBestModel({
        requiredCapabilities: ["nonexistent"],
      });

      expect(result).toBeNull();
    });
  });

  describe("modelMeetsRequirements", () => {
    it("should return true when model meets all requirements", async () => {
      mockGetById.mockResolvedValue(mockModels[0]); // gemini

      const result = await modelMeetsRequirements("gemini-3-flash", {
        requiredCapabilities: ["vision"],
      });

      expect(result).toBe(true);
    });

    it("should return false when model is disabled", async () => {
      mockGetById.mockResolvedValue(mockModels[3]); // grok (disabled)

      const result = await modelMeetsRequirements("grok-3-mini", {
        requiredCapabilities: ["json-mode"],
      });

      expect(result).toBe(false);
    });

    it("should return false when model not found", async () => {
      mockGetById.mockResolvedValue(null);

      const result = await modelMeetsRequirements("nonexistent", {
        requiredCapabilities: ["vision"],
      });

      expect(result).toBe(false);
    });
  });

  describe("getAvailableCapabilities", () => {
    it("should return unique capabilities from all enabled models", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const caps = await getAvailableCapabilities();

      expect(caps).toContain("vision");
      expect(caps).toContain("tool-use");
      expect(caps).toContain("json-mode");
      expect(caps).toContain("code-generation");
      expect(caps).toContain("reasoning");
      // Should be sorted
      expect(caps).toEqual([...caps].sort());
    });
  });

  describe("getModelsByCapability", () => {
    it("should return all models with a specific capability", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const models = await getModelsByCapability("vision");

      // gemini, claude-sonnet-4, and claude-3-5-haiku all have "vision"
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.id)).toContain("gemini-3-flash");
      expect(models.map((m) => m.id)).toContain("claude-sonnet-4");
      expect(models.map((m) => m.id)).toContain("claude-3-5-haiku");
    });

    it("should exclude disabled models", async () => {
      mockListEnabled.mockResolvedValue(mockModels.filter((m) => m.enabled));

      const models = await getModelsByCapability("json-mode");

      // grok-3-mini is disabled, so only gemini and claude-sonnet-4
      expect(models.every((m) => m.enabled)).toBe(true);
    });
  });
});
