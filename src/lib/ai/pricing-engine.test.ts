// Pricing Engine Tests

import { describe, it, expect, beforeEach } from "vitest";
import { PricingEngine } from "./pricing-engine";

describe("PricingEngine", () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine();
  });

  it("should create an instance", () => {
    expect(engine).toBeDefined();
    expect(engine).toBeInstanceOf(PricingEngine);
  });

  describe("calculate", () => {
    it("should calculate cost-plus pricing", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        targetMarginPercent: 0.30,
      });

      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(result.profit).toBeGreaterThan(0);
      expect(result.marginPercent).toBeGreaterThan(0);
      expect(result.strategy).toBe("cost-plus");
    });

    it("should calculate competitive pricing", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "competitive",
        competitorPrices: [25, 30, 28],
      });

      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(result.strategy).toBe("competitive");
      // Should undercut average competitor price
      const avgCompetitor = (25 + 30 + 28) / 3;
      expect(result.recommendedPrice).toBeLessThan(avgCompetitor);
    });

    it("should calculate penetration pricing", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "penetration",
      });

      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(result.marginPercent).toBeLessThan(20); // Lower margin for penetration
    });

    it("should calculate skimming pricing", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "skimming",
      });

      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(result.marginPercent).toBeGreaterThan(40); // Higher margin for skimming
    });

    it("should calculate dynamic pricing based on demand", () => {
      const lowDemand = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "dynamic",
        demandLevel: 20,
      });

      const highDemand = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "dynamic",
        demandLevel: 90,
      });

      expect(highDemand.recommendedPrice).toBeGreaterThan(lowDemand.recommendedPrice);
    });

    it("should apply seasonality factor", () => {
      const normal = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        seasonalityFactor: 1.0,
      });

      const peak = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        seasonalityFactor: 1.2,
      });

      expect(peak.recommendedPrice).toBeGreaterThan(normal.recommendedPrice);
    });

    it("should calculate cost breakdown correctly", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
      });

      expect(result.costs.productCost).toBe(10);
      expect(result.costs.shippingCost).toBe(3);
      expect(result.costs.platformFee).toBeCloseTo(1.5, 1);
      expect(result.costs.total).toBeCloseTo(14.5, 1);
    });

    it("should generate alternatives", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
      });

      expect(result.alternatives).toHaveLength(4);
      expect(result.alternatives[0].label).toBe("Budget");
      expect(result.alternatives[3].label).toBe("Luxury");
    });

    it("should calculate break-even units", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        targetMarginPercent: 0.30,
      });

      expect(result.breakEvenUnits).toBeGreaterThan(0);
    });

    it("should determine viability", () => {
      const viable = engine.calculate({
        costPrice: 5,
        shippingCost: 1,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        targetMarginPercent: 0.40,
        minMarginPercent: 0.15,
      });

      expect(viable.isViable).toBe(true);
    });

    it("should calculate confidence based on data", () => {
      const lowConfidence = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
      });

      const highConfidence = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
        competitorPrices: [25, 30],
        demandLevel: 70,
        targetMarginPercent: 0.30,
        importDutiesPercent: 0.05,
        packagingCost: 0.50,
      });

      expect(highConfidence.confidence).toBeGreaterThan(lowConfidence.confidence);
    });

    it("should handle zero shipping cost", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 0,
        platformFeePercent: 0.15,
        strategy: "cost-plus",
      });

      expect(result.costs.shippingCost).toBe(0);
      expect(result.recommendedPrice).toBeGreaterThan(0);
    });

    it("should handle import duties", () => {
      const result = engine.calculate({
        costPrice: 10,
        shippingCost: 3,
        platformFeePercent: 0.15,
        importDutiesPercent: 0.10,
        strategy: "cost-plus",
      });

      expect(result.costs.importDuties).toBeCloseTo(1, 1);
      expect(result.costs.total).toBeGreaterThan(14.5);
    });
  });
});
