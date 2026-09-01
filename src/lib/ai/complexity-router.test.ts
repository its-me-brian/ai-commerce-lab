// Complexity Model Router Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  selectModelByComplexity,
  selectCheapestModel,
  selectStrongestModel,
  getComplexityDescription,
  DEFAULT_COMPLEXITY_TIERS,
} from "./complexity-router";

// Mock the model-matcher module
vi.mock("./model-matcher", () => ({
  findBestModel: vi.fn(),
  findSingleBestModel: vi.fn(),
}));

import { findBestModel } from "./model-matcher";

const mockFindBestModel = vi.mocked(findBestModel);

function createMockModel(overrides: Record<string, unknown> = {}) {
  return {
    id: "mock-model",
    provider_id: "gemini",
    name: "Mock Model",
    model_id: "mock-v1",
    enabled: true,
    context_window: 128000,
    input_price: 0.5,
    output_price: 1.5,
    capabilities: ["text", "json"],
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    ...overrides,
  };
}

function createMockMatch(score = 100, overrides: Record<string, unknown> = {}) {
  return {
    model: createMockModel(overrides),
    capabilityScore: 1,
    allCapabilitiesMatch: true,
    contextWindowMatch: true,
    costMatch: true,
    score,
  };
}

describe("ComplexityModelRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("selectModelByComplexity", () => {
    it("selects model for trivial complexity", async () => {
      mockFindBestModel.mockResolvedValue([createMockMatch(100)]);

      const result = await selectModelByComplexity("trivial", {});

      expect(result.complexity).toBe("trivial");
      expect(result.match).toBeDefined();
      expect(result.estimatedCostDollars).toBeGreaterThanOrEqual(0);
      expect(result.reasoning).toContain("trivial");
    });

    it("selects model for complex complexity", async () => {
      mockFindBestModel.mockResolvedValue([createMockMatch(100)]);

      const result = await selectModelByComplexity("complex", {});

      expect(result.complexity).toBe("complex");
      expect(result.match).toBeDefined();
    });

    it("merges mini-AI requirements with tier defaults", async () => {
      mockFindBestModel.mockResolvedValue([createMockMatch(100)]);

      await selectModelByComplexity("simple", {
        requiredCapabilities: ["vision"],
        minContextWindow: 8000,
      });

      // Should merge tier capabilities with mini-AI requirements
      const call = mockFindBestModel.mock.calls[0][0];
      expect(call.requiredCapabilities).toContain("vision");
      expect(call.minContextWindow).toBeGreaterThanOrEqual(8000);
    });

    it("falls back to relaxed requirements when strict fails", async () => {
      // First call (strict) returns empty
      mockFindBestModel
        .mockResolvedValueOnce([])
        // Second call (relaxed) returns a match
        .mockResolvedValueOnce([createMockMatch(80)]);

      const result = await selectModelByComplexity("moderate", {
        requiredCapabilities: ["nonexistent-capability"],
      });

      expect(result.match).toBeDefined();
      expect(result.reasoning).toContain("relaxed");
    });

    it("throws when no model available at all", async () => {
      mockFindBestModel.mockResolvedValue([]);

      await expect(
        selectModelByComplexity("complex", {
          requiredCapabilities: ["impossible"],
        })
      ).rejects.toThrow("No model available");
    });

    it("applies tier overrides", async () => {
      mockFindBestModel.mockResolvedValue([createMockMatch(100)]);

      await selectModelByComplexity("simple", {}, {
        maxTotalPricePerMillion: 0.1,
        minContextWindow: 2000,
      });

      const call = mockFindBestModel.mock.calls[0][0];
      expect(call.maxInputPrice).toBeLessThanOrEqual(0.05);
    });
  });

  describe("selectCheapestModel", () => {
    it("selects the cheapest model", async () => {
      mockFindBestModel.mockResolvedValue([
        createMockMatch(100, { input_price: 3.0, output_price: 15.0 }),
        createMockMatch(90, { input_price: 0.5, output_price: 1.5 }),
        createMockMatch(80, { input_price: 0.0, output_price: 0.0 }),
      ]);

      const result = await selectCheapestModel({});

      expect(result.complexity).toBe("trivial");
      expect(result.match.model.input_price).toBe(0.0);
    });
  });

  describe("selectStrongestModel", () => {
    it("selects the strongest (most expensive) model", async () => {
      mockFindBestModel.mockResolvedValue([
        createMockMatch(100, { input_price: 0.0, output_price: 0.0 }),
        createMockMatch(90, { input_price: 3.0, output_price: 15.0 }),
      ]);

      const result = await selectStrongestModel({});

      expect(result.complexity).toBe("complex");
      expect(result.match.model.input_price).toBe(3.0);
    });
  });

  describe("getComplexityDescription", () => {
    it("returns description for each tier", () => {
      expect(getComplexityDescription("trivial")).toContain("Cheapest");
      expect(getComplexityDescription("simple")).toContain("Small");
      expect(getComplexityDescription("moderate")).toContain("Mid-tier");
      expect(getComplexityDescription("complex")).toContain("Strongest");
    });
  });

  describe("tier configs", () => {
    it("has all 4 tiers defined", () => {
      expect(Object.keys(DEFAULT_COMPLEXITY_TIERS)).toHaveLength(4);
      expect(DEFAULT_COMPLEXITY_TIERS.trivial).toBeDefined();
      expect(DEFAULT_COMPLEXITY_TIERS.simple).toBeDefined();
      expect(DEFAULT_COMPLEXITY_TIERS.moderate).toBeDefined();
      expect(DEFAULT_COMPLEXITY_TIERS.complex).toBeDefined();
    });

    it("tiers increase in cost", () => {
      expect(DEFAULT_COMPLEXITY_TIERS.trivial.maxTotalPricePerMillion)
        .toBeLessThan(DEFAULT_COMPLEXITY_TIERS.simple.maxTotalPricePerMillion);
      expect(DEFAULT_COMPLEXITY_TIERS.simple.maxTotalPricePerMillion)
        .toBeLessThan(DEFAULT_COMPLEXITY_TIERS.moderate.maxTotalPricePerMillion);
      expect(DEFAULT_COMPLEXITY_TIERS.moderate.maxTotalPricePerMillion)
        .toBeLessThan(DEFAULT_COMPLEXITY_TIERS.complex.maxTotalPricePerMillion);
    });
  });
});
