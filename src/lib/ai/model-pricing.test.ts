// Model Pricing Tests
import { describe, it, expect } from "vitest";
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  MODEL_PRICING,
  getModelPricing,
  calculateModelCost,
  type ModelPricing,
} from "./model-pricing";
/* eslint-enable @typescript-eslint/no-unused-vars */

describe("model-pricing", () => {
  describe("MODEL_PRICING table", () => {
    it("contains Gemini models", () => {
      expect(MODEL_PRICING["gemini-3-flash"]).toBeDefined();
      expect(MODEL_PRICING["gemini-2.5-pro"]).toBeDefined();
      expect(MODEL_PRICING["gemini-2.5-flash"]).toBeDefined();
    });

    it("contains Claude models", () => {
      expect(MODEL_PRICING["claude-3-5-haiku"]).toBeDefined();
      expect(MODEL_PRICING["claude-sonnet-4"]).toBeDefined();
      expect(MODEL_PRICING["claude-opus-4"]).toBeDefined();
    });

    it("contains Grok models", () => {
      expect(MODEL_PRICING["grok-3-mini"]).toBeDefined();
      expect(MODEL_PRICING["grok-3"]).toBeDefined();
    });

    it("all entries have required fields", () => {
      for (const [modelId, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputPerMillion, `${modelId} inputPerMillion`).toBeGreaterThanOrEqual(0);
        expect(pricing.outputPerMillion, `${modelId} outputPerMillion`).toBeGreaterThanOrEqual(0);
        expect(pricing.label, `${modelId} label`).toBeTruthy();
      }
    });

    it("gemini-3-flash has zero pricing (free tier)", () => {
      expect(MODEL_PRICING["gemini-3-flash"].inputPerMillion).toBe(0);
      expect(MODEL_PRICING["gemini-3-flash"].outputPerMillion).toBe(0);
    });
  });

  describe("getModelPricing", () => {
    it("returns pricing for known models", () => {
      const pricing = getModelPricing("gemini-3-flash");
      expect(pricing.inputPerMillion).toBe(0);
      expect(pricing.outputPerMillion).toBe(0);
    });

    it("returns default pricing for unknown models", () => {
      const pricing = getModelPricing("unknown-model-xyz");
      expect(pricing.inputPerMillion).toBe(0.50);
      expect(pricing.outputPerMillion).toBe(2.0);
      expect(pricing.label).toContain("Unknown");
    });

    it("returns correct pricing for claude-sonnet-4", () => {
      const pricing = getModelPricing("claude-sonnet-4");
      expect(pricing.inputPerMillion).toBe(3.0);
      expect(pricing.outputPerMillion).toBe(15.0);
    });
  });

  describe("calculateModelCost", () => {
    it("returns 0 for free tier models", () => {
      const cost = calculateModelCost("gemini-3-flash", 10_000, 5_000);
      expect(cost).toBe(0);
    });

    it("calculates cost for paid models", () => {
      // claude-3-5-haiku: $0.80 input, $4.00 output per million
      const cost = calculateModelCost("claude-3-5-haiku", 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(4.80, 2); // 0.80 + 4.00
    });

    it("scales linearly with token count", () => {
      const cost1 = calculateModelCost("claude-3-5-haiku", 100_000, 100_000);
      const cost2 = calculateModelCost("claude-3-5-haiku", 200_000, 200_000);
      expect(cost2).toBeCloseTo(cost1 * 2, 6);
    });

    it("handles zero tokens", () => {
      expect(calculateModelCost("claude-3-5-haiku", 0, 0)).toBe(0);
    });

    it("uses default pricing for unknown models", () => {
      // Default: $0.50 input, $2.00 output per million
      const cost = calculateModelCost("unknown-model", 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(2.50, 2); // 0.50 + 2.00
    });

    it("handles large token counts without precision issues", () => {
      // 10M tokens of gemini-3-flash should still be 0
      const cost = calculateModelCost("gemini-3-flash", 10_000_000, 10_000_000);
      expect(cost).toBe(0);
    });

    it("grok-3-mini pricing is correct", () => {
      // $0.30 input, $0.50 output per million
      const cost = calculateModelCost("grok-3-mini", 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.80, 2); // 0.30 + 0.50
    });

    it("claude-opus-4 is most expensive", () => {
      const opusCost = calculateModelCost("claude-opus-4", 1_000_000, 1_000_000);
      const haikuCost = calculateModelCost("claude-3-5-haiku", 1_000_000, 1_000_000);
      expect(opusCost).toBeGreaterThan(haikuCost);
    });
  });
});
