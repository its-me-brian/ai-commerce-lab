// Finance Review Tests
// FASE 33: Financial viability validation.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinanceReview, type FinanceReviewInput } from "./finance-review";

// Proxy-based Supabase mock
function createMockQuery(returnData: unknown = null) {
  const result = { data: returnData, error: null };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("../database/supabase", () => ({
  supabase: { from: vi.fn(() => createMockQuery()) },
}));

vi.mock("./approval-manager", () => ({
  getApprovalManager: () => ({
    createApproval: vi.fn().mockResolvedValue({ id: "ap-fin-1" }),
  }),
}));

describe("FinanceReview", () => {
  let review: FinanceReview;

  const viableProduct: FinanceReviewInput = {
    productName: "Wireless Mouse",
    costPrice: 12.00,
    sellingPrice: 29.99,
    shippingCost: 3.00,
  };

  const lowMarginProduct: FinanceReviewInput = {
    productName: "Cheap Widget",
    costPrice: 15.00,
    sellingPrice: 22.00, // margin ~21.6%, ROI ~27.5% — passes margin but fails ROI → marginal
  };

  const negativeProfitProduct: FinanceReviewInput = {
    productName: "Loss Leader",
    costPrice: 20.00,
    sellingPrice: 15.00,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    review = new FinanceReview();
  });

  describe("review", () => {
    it("should return viable for good product", async () => {
      const result = await review.review(viableProduct);

      expect(result.verdict).toBe("viable");
      expect(result.requiresApproval).toBe(false);
      expect(result.pricing.marginPercent).toBeGreaterThan(15);
    });

    it("should return rejected for negative profit", async () => {
      const result = await review.review(negativeProfitProduct);

      expect(result.verdict).toBe("rejected");
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalId).toBe("ap-fin-1");
    });

    it("should return marginal for low margin", async () => {
      const result = await review.review(lowMarginProduct);

      expect(result.verdict).toBe("marginal");
      expect(result.requiresApproval).toBe(true);
    });

    it("should run all financial checks", async () => {
      const result = await review.review(viableProduct);

      expect(result.checks.length).toBe(5);
      expect(result.checks.map((c) => c.name)).toContain("Minimum Margin");
      expect(result.checks.map((c) => c.name)).toContain("Profitability");
      expect(result.checks.map((c) => c.name)).toContain("ROI");
    });

    it("should check competitive pricing when data available", async () => {
      const result = await review.review({
        ...viableProduct,
        competitorPrices: [25, 30, 35],
      });

      const compCheck = result.checks.find((c) => c.name === "Competitive Pricing");
      expect(compCheck).toBeDefined();
      expect(compCheck?.message).toContain("competitive");
    });

    it("should skip competitive check without data", async () => {
      const result = await review.review(viableProduct);

      const compCheck = result.checks.find((c) => c.name === "Competitive Pricing");
      expect(compCheck?.message).toContain("skipping");
    });

    it("should calculate correct pricing", async () => {
      const result = await review.review(viableProduct);

      expect(result.pricing.recommendedPrice).toBeGreaterThan(0);
      expect(result.pricing.profit).toBeGreaterThan(0);
      expect(result.pricing.costs.total).toBeGreaterThan(0);
    });

    it("should include severity levels in checks", async () => {
      const result = await review.review(viableProduct);

      for (const check of result.checks) {
        expect(["info", "warning", "critical"]).toContain(check.severity);
      }
    });

    it("should calculate ROI", async () => {
      const result = await review.review(viableProduct);

      expect(result.pricing.roiPercent).toBeGreaterThan(0);
    });

    it("should calculate break-even units", async () => {
      const result = await review.review(viableProduct);

      expect(result.pricing.breakEvenUnits).toBeGreaterThan(0);
    });
  });
});
