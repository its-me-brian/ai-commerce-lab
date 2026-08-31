// Calculate Margin Tool
// Deterministic profit margin calculation — no AI needed.
// Input validation via type guards, not `as` casts.

import type { Tool, ToolResult } from "./types";

export class CalculateMarginTool implements Tool {
  readonly id = "calculate_margin";
  readonly name = "Calculate Profit Margin";
  readonly description =
    "Calculates profit margin, ROI, and break-even point for a product given cost and selling price.";
  readonly inputSchema = {
    type: "object",
    properties: {
      costPrice: {
        type: "number",
        description: "Cost price in USD (what you pay the supplier)",
      },
      sellingPrice: {
        type: "number",
        description: "Selling price in USD (what the customer pays)",
      },
      shippingCost: {
        type: "number",
        description: "Shipping cost in USD (default 0)",
        default: 0,
      },
      platformFeePercent: {
        type: "number",
        description: "Platform fee as percentage, e.g. 15 for 15% (default 15)",
        default: 15,
      },
    },
    required: ["costPrice", "sellingPrice"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      profit: { type: "number" },
      marginPercent: { type: "number" },
      roiPercent: { type: "number" },
      breakEvenUnits: { type: "number" },
      isViable: { type: "boolean" },
      recommendation: { type: "string" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    // Runtime validation — no `as` casts
    const costPrice = typeof input.costPrice === "number" ? input.costPrice : NaN;
    const sellingPrice = typeof input.sellingPrice === "number" ? input.sellingPrice : NaN;
    const shippingCost = typeof input.shippingCost === "number" ? input.shippingCost : 0;
    const platformFeePercent = typeof input.platformFeePercent === "number" ? input.platformFeePercent : 15;

    if (isNaN(costPrice) || isNaN(sellingPrice)) {
      return {
        success: false,
        output: null,
        error: "costPrice and sellingPrice must be valid numbers",
      };
    }

    if (costPrice <= 0 || sellingPrice <= 0) {
      return {
        success: false,
        output: null,
        error: "costPrice and sellingPrice must be positive numbers",
      };
    }

    if (shippingCost < 0) {
      return {
        success: false,
        output: null,
        error: "shippingCost must be non-negative",
      };
    }

    if (platformFeePercent < 0 || platformFeePercent > 100) {
      return {
        success: false,
        output: null,
        error: "platformFeePercent must be between 0 and 100",
      };
    }

    const platformFee = sellingPrice * (platformFeePercent / 100);
    const totalCost = costPrice + shippingCost + platformFee;
    const profit = sellingPrice - totalCost;
    const marginPercent = (profit / sellingPrice) * 100;
    const roiPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    // Break-even: how many units to cover a $50 fixed cost estimate
    const fixedCostEstimate = 50;
    const breakEvenUnits =
      profit > 0 ? Math.ceil(fixedCostEstimate / profit) : Infinity;

    // Viability: margin > 20% AND profit > $2
    const isViable = marginPercent > 20 && profit > 2;

    let recommendation: string;
    if (marginPercent > 40) {
      recommendation = "EXCELLENT margin. Strong candidate.";
    } else if (marginPercent > 20) {
      recommendation = "GOOD margin. Viable with volume.";
    } else if (marginPercent > 10) {
      recommendation = "LOW margin. Consider raising price or finding cheaper supplier.";
    } else {
      recommendation = "POOR margin. Not recommended at this price point.";
    }

    return {
      success: true,
      output: {
        profit: Math.round(profit * 100) / 100,
        marginPercent: Math.round(marginPercent * 100) / 100,
        roiPercent: Math.round(roiPercent * 100) / 100,
        breakEvenUnits: breakEvenUnits === Infinity ? -1 : breakEvenUnits,
        isViable,
        recommendation,
      },
    };
  }
}
