// Supplier Result Contract Tests

import { describe, it, expect } from "vitest";
import {
  validateSupplierResult,
  createMockSupplierResult,
  getBestSupplier,
  getAverageShippingCost,
  filterByReliability,
  SupplierResultContractSchema,
} from "./supplier-result";
import type { SupplierResult } from "./supplier-result";

describe("SupplierResultContract", () => {
  describe("validateSupplierResult", () => {
    it("should validate a correct supplier result", () => {
      const result = createMockSupplierResult();
      const validation = validateSupplierResult(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.data).toBeDefined();
    });

    it("should reject result without required fields", () => {
      const validation = validateSupplierResult({});

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should reject result with invalid reliability score", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Bad Supplier",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 150, // Invalid: > 100
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [],
            notes: "Invalid score",
            dataSource: "mock",
          },
        ],
      });

      const validation = validateSupplierResult(result);
      expect(validation.valid).toBe(false);
    });

    it("should accept result with empty suppliers array", () => {
      const result = createMockSupplierResult({ suppliers: [] });
      const validation = validateSupplierResult(result);

      expect(validation.valid).toBe(true);
    });

    it("should validate metadata fields", () => {
      const result = createMockSupplierResult({
        metadata: {
          agentsUsed: ["supplier-research"],
          totalInputTokens: 100,
          totalOutputTokens: 50,
          durationMs: 1000,
        },
      });

      const validation = validateSupplierResult(result);
      expect(validation.valid).toBe(true);
    });
  });

  describe("createMockSupplierResult", () => {
    it("should create a valid mock result", () => {
      const result = createMockSupplierResult();

      expect(result.success).toBe(true);
      expect(result.suppliers).toHaveLength(1);
      expect(result.sourceType).toBe("mock");
    });

    it("should allow overrides", () => {
      const result = createMockSupplierResult({
        productName: "Custom Product",
        suppliers: [],
      });

      expect(result.productName).toBe("Custom Product");
      expect(result.suppliers).toHaveLength(0);
    });
  });

  describe("getBestSupplier", () => {
    it("should return undefined for empty suppliers", () => {
      const result = createMockSupplierResult({ suppliers: [] });
      expect(getBestSupplier(result)).toBeUndefined();
    });

    it("should return recommended supplier when specified", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Supplier 1",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 90,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [],
            notes: "Good",
            dataSource: "mock",
          },
          {
            id: "s2",
            name: "Supplier 2",
            location: "China",
            platform: "Alibaba",
            reliabilityScore: 95,
            priceRange: { min: 3, max: 10, currency: "USD" },
            shippingOptions: [],
            notes: "Better but not recommended",
            dataSource: "mock",
          },
        ],
        recommendedSupplierId: "s1",
      });

      const best = getBestSupplier(result);
      expect(best?.id).toBe("s1");
    });

    it("should fallback to highest reliability when no recommendation", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Supplier 1",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 70,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [],
            notes: "OK",
            dataSource: "mock",
          },
          {
            id: "s2",
            name: "Supplier 2",
            location: "China",
            platform: "Alibaba",
            reliabilityScore: 95,
            priceRange: { min: 3, max: 10, currency: "USD" },
            shippingOptions: [],
            notes: "Excellent",
            dataSource: "mock",
          },
        ],
      });

      const best = getBestSupplier(result);
      expect(best?.id).toBe("s2");
    });
  });

  describe("getAverageShippingCost", () => {
    it("should return 0 for empty suppliers", () => {
      const result = createMockSupplierResult({ suppliers: [] });
      expect(getAverageShippingCost(result)).toBe(0);
    });

    it("should calculate average across all shipping options", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Supplier 1",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 80,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [
              { method: "Standard", estimatedDays: 15, cost: 3, currency: "USD" },
              { method: "Express", estimatedDays: 7, cost: 8, currency: "USD" },
            ],
            notes: "Two options",
            dataSource: "mock",
          },
          {
            id: "s2",
            name: "Supplier 2",
            location: "China",
            platform: "Alibaba",
            reliabilityScore: 85,
            priceRange: { min: 3, max: 10, currency: "USD" },
            shippingOptions: [
              { method: "Standard", estimatedDays: 20, cost: 2, currency: "USD" },
            ],
            notes: "One option",
            dataSource: "mock",
          },
        ],
      });

      // (3 + 8 + 2) / 3 = 4.33
      const avg = getAverageShippingCost(result);
      expect(avg).toBeCloseTo(4.33, 1);
    });
  });

  describe("filterByReliability", () => {
    it("should filter suppliers by minimum reliability", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Low Reliability",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 60,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [],
            notes: "Low",
            dataSource: "mock",
          },
          {
            id: "s2",
            name: "High Reliability",
            location: "China",
            platform: "Alibaba",
            reliabilityScore: 90,
            priceRange: { min: 3, max: 10, currency: "USD" },
            shippingOptions: [],
            notes: "High",
            dataSource: "mock",
          },
        ],
      });

      const filtered = filterByReliability(result, 80);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("s2");
    });

    it("should return empty array when no suppliers meet threshold", () => {
      const result = createMockSupplierResult({
        suppliers: [
          {
            id: "s1",
            name: "Low",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 50,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [],
            notes: "Low",
            dataSource: "mock",
          },
        ],
      });

      const filtered = filterByReliability(result, 80);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Zod schema", () => {
    it("should parse valid supplier result", () => {
      const data = createMockSupplierResult();
      const result = SupplierResultContractSchema.parse(data);

      expect(result.success).toBe(true);
      expect(result.suppliers).toBeDefined();
    });

    it("should apply defaults", () => {
      const data = {
        success: true,
        productName: "Test",
        category: "general",
        suppliers: [],
        recommendation: "Test",
        risks: [],
        metadata: {
          agentsUsed: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          durationMs: 0,
        },
      };

      const result = SupplierResultContractSchema.parse(data);
      expect(result.targetMarket).toBe("Europe");
      expect(result.sourceType).toBe("mock");
    });
  });
});
