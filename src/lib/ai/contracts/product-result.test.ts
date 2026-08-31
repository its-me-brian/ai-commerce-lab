// Product Result Contract Tests

import { describe, it, expect } from "vitest";
import {
  validateProductResult,
  createMockProductResult,
  isProductViable,
  getMarginPercent,
  isFullyVerified,
  getHighRiskCount,
  getCriticalActions,
  ProductResultContractSchema,
} from "./product-result";
import type { ProductResult } from "./product-result";

describe("ProductResultContract", () => {
  describe("validateProductResult", () => {
    it("should validate a correct product result", () => {
      const result = createMockProductResult();
      const validation = validateProductResult(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.data).toBeDefined();
    });

    it("should reject result without required fields", () => {
      const validation = validateProductResult({});

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should reject result with invalid scores", () => {
      const result = createMockProductResult({
        scores: {
          overall: 150, // Invalid: > 100
          demand: 70,
          competition: 65,
          supplier: 80,
          risk: 30,
          profitability: 72,
        },
      });

      const validation = validateProductResult(result);
      expect(validation.valid).toBe(false);
    });

    it("should accept result with empty risks", () => {
      const result = createMockProductResult({ risks: [] });
      const validation = validateProductResult(result);

      expect(validation.valid).toBe(true);
    });

    it("should validate metadata fields", () => {
      const result = createMockProductResult({
        metadata: {
          agentsUsed: ["product-hunter"],
          totalInputTokens: 100,
          totalOutputTokens: 50,
          durationMs: 1000,
        },
      });

      const validation = validateProductResult(result);
      expect(validation.valid).toBe(true);
    });
  });

  describe("createMockProductResult", () => {
    it("should create a valid mock result", () => {
      const result = createMockProductResult();

      expect(result.success).toBe(true);
      expect(result.scores.overall).toBe(75);
      expect(result.sourceType).toBe("mock");
    });

    it("should allow overrides", () => {
      const result = createMockProductResult({
        productName: "Custom Product",
        decision: "REJECT",
      });

      expect(result.productName).toBe("Custom Product");
      expect(result.decision).toBe("REJECT");
    });
  });

  describe("isProductViable", () => {
    it("should return true for APPROVE", () => {
      const result = createMockProductResult({ decision: "APPROVE" });
      expect(isProductViable(result)).toBe(true);
    });

    it("should return true for INVESTIGATE", () => {
      const result = createMockProductResult({ decision: "INVESTIGATE" });
      expect(isProductViable(result)).toBe(true);
    });

    it("should return false for REJECT", () => {
      const result = createMockProductResult({ decision: "REJECT" });
      expect(isProductViable(result)).toBe(false);
    });

    it("should return false for NEEDS_MORE_DATA", () => {
      const result = createMockProductResult({ decision: "NEEDS_MORE_DATA" });
      expect(isProductViable(result)).toBe(false);
    });
  });

  describe("getMarginPercent", () => {
    it("should return margin percentage", () => {
      const result = createMockProductResult({
        pricing: {
          costPrice: 10,
          sellingPrice: 30,
          currency: "EUR",
          profit: 15.5,
          marginPercent: 51.6,
          roiPercent: 154.9,
          marginValidated: true,
        },
      });

      expect(getMarginPercent(result)).toBe(51.6);
    });
  });

  describe("isFullyVerified", () => {
    it("should return true when all data is KNOWN", () => {
      const result = createMockProductResult({
        dataConfidence: {
          supplierPrice: "KNOWN",
          sellingPrice: "KNOWN",
          demand: "KNOWN",
          competition: "KNOWN",
          shippingCost: "KNOWN",
        },
      });

      expect(isFullyVerified(result)).toBe(true);
    });

    it("should return false when any data is ESTIMATED", () => {
      const result = createMockProductResult({
        dataConfidence: {
          supplierPrice: "KNOWN",
          sellingPrice: "ESTIMATED",
          demand: "KNOWN",
          competition: "KNOWN",
          shippingCost: "KNOWN",
        },
      });

      expect(isFullyVerified(result)).toBe(false);
    });

    it("should return false when any data is UNKNOWN", () => {
      const result = createMockProductResult({
        dataConfidence: {
          supplierPrice: "KNOWN",
          sellingPrice: "KNOWN",
          demand: "KNOWN",
          competition: "KNOWN",
          shippingCost: "UNKNOWN",
        },
      });

      expect(isFullyVerified(result)).toBe(false);
    });
  });

  describe("getHighRiskCount", () => {
    it("should count high-severity risks", () => {
      const result = createMockProductResult({
        risks: [
          { factor: "Risk 1", severity: "high", description: "High risk" },
          { factor: "Risk 2", severity: "low", description: "Low risk" },
          { factor: "Risk 3", severity: "high", description: "Another high" },
        ],
      });

      expect(getHighRiskCount(result)).toBe(2);
    });

    it("should return 0 when no high risks", () => {
      const result = createMockProductResult({
        risks: [
          { factor: "Risk 1", severity: "low", description: "Low risk" },
          { factor: "Risk 2", severity: "medium", description: "Medium risk" },
        ],
      });

      expect(getHighRiskCount(result)).toBe(0);
    });
  });

  describe("getCriticalActions", () => {
    it("should return critical action items", () => {
      const result = createMockProductResult({
        actionItems: [
          { priority: "critical", action: "Fix pricing", reason: "Margin too low" },
          { priority: "high", action: "Check supplier", reason: "Reliability" },
          { priority: "critical", action: "Verify stock", reason: "Availability" },
        ],
      });

      const critical = getCriticalActions(result);
      expect(critical).toHaveLength(2);
      expect(critical[0].action).toBe("Fix pricing");
    });

    it("should return empty array when no critical actions", () => {
      const result = createMockProductResult({
        actionItems: [
          { priority: "high", action: "Check supplier", reason: "Reliability" },
        ],
      });

      expect(getCriticalActions(result)).toHaveLength(0);
    });
  });

  describe("Zod schema", () => {
    it("should parse valid product result", () => {
      const data = createMockProductResult();
      const result = ProductResultContractSchema.parse(data);

      expect(result.success).toBe(true);
      expect(result.scores).toBeDefined();
    });

    it("should apply defaults", () => {
      const data = {
        success: true,
        productId: "p1",
        productName: "Test",
        source: "mock",
        scores: {
          overall: 50,
          demand: 50,
          competition: 50,
          supplier: 50,
          risk: 50,
          profitability: 50,
        },
        pricing: {
          costPrice: 10,
          sellingPrice: 20,
          currency: "EUR",
          profit: 5,
          marginPercent: 25,
          roiPercent: 50,
        },
        decision: "INVESTIGATE",
        explanation: "Test",
        dataConfidence: {
          supplierPrice: "KNOWN",
          sellingPrice: "KNOWN",
          demand: "KNOWN",
          competition: "KNOWN",
          shippingCost: "KNOWN",
        },
        risks: [],
        actionItems: [],
        metadata: {
          agentsUsed: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          durationMs: 0,
        },
      };

      const result = ProductResultContractSchema.parse(data);
      expect(result.sourceType).toBe("mock");
    });
  });
});
