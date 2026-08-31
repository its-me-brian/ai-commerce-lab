import { describe, it, expect } from "vitest";
import { CalculateMarginTool } from "./calculate-margin";

describe("CalculateMarginTool", () => {
  const tool = new CalculateMarginTool();

  it("should calculate margin correctly", async () => {
    const result = await tool.execute({
      costPrice: 10,
      sellingPrice: 20,
      shippingCost: 0,
      platformFeePercent: 15,
    });

    expect(result.success).toBe(true);
    const output = result.output as {
      profit: number;
      marginPercent: number;
      roiPercent: number;
      isViable: boolean;
    };

    // Total cost = 10 + 0 + (20 * 0.15) = 13
    // Profit = 20 - 13 = 7
    // Margin = (7 / 20) * 100 = 35%
    expect(output.profit).toBe(7);
    expect(output.marginPercent).toBe(35);
    expect(output.isViable).toBe(true);
  });

  it("should handle shipping cost", async () => {
    const result = await tool.execute({
      costPrice: 10,
      sellingPrice: 20,
      shippingCost: 3,
      platformFeePercent: 15,
    });

    const output = result.output as { profit: number; marginPercent: number };

    // Total cost = 10 + 3 + (20 * 0.15) = 16
    // Profit = 20 - 16 = 4
    // Margin = (4 / 20) * 100 = 20%
    expect(output.profit).toBe(4);
    expect(output.marginPercent).toBe(20);
  });

  it("should reject negative prices", async () => {
    const result = await tool.execute({
      costPrice: -10,
      sellingPrice: 20,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("positive numbers");
  });

  it("should mark low margin as not viable", async () => {
    const result = await tool.execute({
      costPrice: 18,
      sellingPrice: 20,
      shippingCost: 0,
      platformFeePercent: 15,
    });

    const output = result.output as { marginPercent: number; isViable: boolean };

    // Total cost = 18 + 0 + 3 = 21
    // Profit = 20 - 21 = -1 (loss)
    expect(output.marginPercent).toBeLessThan(0);
    expect(output.isViable).toBe(false);
  });

  it("should calculate break-even units", async () => {
    const result = await tool.execute({
      costPrice: 5,
      sellingPrice: 15,
      shippingCost: 0,
      platformFeePercent: 15,
    });

    const output = result.output as { profit: number; breakEvenUnits: number };

    // Profit per unit = 15 - (5 + 2.25) = 7.75
    // Break-even for $50 fixed = ceil(50 / 7.75) = 7
    expect(output.breakEvenUnits).toBe(7);
  });

  it("should provide recommendations based on margin", async () => {
    const highMargin = await tool.execute({
      costPrice: 5,
      sellingPrice: 30,
    });

    const lowMargin = await tool.execute({
      costPrice: 15,
      sellingPrice: 20,
    });

    const highOutput = highMargin.output as { recommendation: string };
    const lowOutput = lowMargin.output as { recommendation: string };

    expect(highOutput.recommendation).toContain("EXCELLENT");
    expect(lowOutput.recommendation).toContain("POOR");
  });
});
