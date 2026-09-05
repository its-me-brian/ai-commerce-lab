// Pricing Engine
// Comprehensive pricing strategies and cost analysis.
// FASE 24: Goes beyond basic margin calculation — handles pricing strategies, optimization, competitive analysis.

import { z } from "zod";

// --- Zod Schemas ---

export const PricingStrategySchema = z.enum([
  "cost-plus",        // Fixed markup on cost
  "competitive",      // Match/undercut competitors
  "value-based",      // Price based on perceived value
  "penetration",      // Low price to gain market share
  "skimming",         // High price, lower over time
  "dynamic",          // Adjust based on demand/season
]);

export const CostBreakdownSchema = z.object({
  productCost: z.number().min(0),
  shippingCost: z.number().min(0),
  platformFee: z.number().min(0),
  importDuties: z.number().min(0).optional(),
  packagingCost: z.number().min(0).optional(),
  marketingCost: z.number().min(0).optional(),
  total: z.number().min(0),
});

export const PricingInputSchema = z.object({
  /** Product cost from supplier */
  costPrice: z.number().min(0),
  /** Currency code */
  currency: z.string().optional().default("EUR"),
  /** Shipping cost */
  shippingCost: z.number().min(0).optional().default(0),
  /** Platform fee percentage (e.g. 0.15 for 15%) */
  platformFeePercent: z.number().min(0).max(1).optional().default(0.15),
  /** Import duties percentage */
  importDutiesPercent: z.number().min(0).max(1).optional(),
  /** Packaging cost per unit */
  packagingCost: z.number().min(0).optional(),
  /** Marketing cost per unit */
  marketingCost: z.number().min(0).optional(),
  /** Pricing strategy to use */
  strategy: PricingStrategySchema.optional().default("cost-plus"),
  /** Target margin percentage */
  targetMarginPercent: z.number().min(0).max(1).optional(),
  /** Competitor prices for competitive pricing */
  competitorPrices: z.array(z.number().min(0)).optional(),
  /** Current demand level (0-100) for dynamic pricing */
  demandLevel: z.number().min(0).max(100).optional(),
  /** Seasonality factor (1.0 = normal, >1.0 = peak, <1.0 = off-season) */
  seasonalityFactor: z.number().optional().default(1.0),
  /** Minimum acceptable margin */
  minMarginPercent: z.number().min(0).max(1).optional().default(0.15),
});

export const PricingResultSchema = z.object({
  /** Recommended selling price */
  recommendedPrice: z.number(),
  /** Cost breakdown */
  costs: CostBreakdownSchema,
  /** Profit per unit */
  profit: z.number(),
  /** Profit margin percentage */
  marginPercent: z.number(),
  /** Return on investment percentage */
  roiPercent: z.number(),
  /** Break-even units (for fixed cost recovery) */
  breakEvenUnits: z.number(),
  /** Pricing strategy used */
  strategy: PricingStrategySchema,
  /** Whether this price is viable */
  isViable: z.boolean(),
  /** Pricing confidence (0-100) */
  confidence: z.number().min(0).max(100),
  /** Recommendation text */
  recommendation: z.string(),
  /** Alternative price points */
  alternatives: z.array(z.object({
    price: z.number(),
    marginPercent: z.number(),
    profit: z.number(),
    label: z.string(),
  })),
});

export type PricingStrategy = z.infer<typeof PricingStrategySchema>;
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;
export type PricingResult = z.infer<typeof PricingResultSchema>;
/** Validated input (all defaults applied — guaranteed non-optional) */
export type ValidatedPricingInput = z.infer<typeof PricingInputSchema>;

/** Input type — all fields with defaults are optional */
export interface PricingInput {
  costPrice: number;
  currency?: string;
  shippingCost?: number;
  platformFeePercent?: number;
  importDutiesPercent?: number;
  packagingCost?: number;
  marketingCost?: number;
  strategy?: PricingStrategy;
  targetMarginPercent?: number;
  competitorPrices?: number[];
  demandLevel?: number;
  seasonalityFactor?: number;
  minMarginPercent?: number;
}

/**
 * Pricing Engine
 * Calculates optimal pricing based on strategy and cost analysis.
 */
export class PricingEngine {
  /**
   * Calculate pricing based on input parameters and strategy.
   */
  calculate(input: PricingInput): PricingResult {
    const validated = PricingInputSchema.parse(input);

    // 1. Calculate cost breakdown
    const costs = this.calculateCosts(validated);

    // 2. Calculate base price from strategy
    const basePrice = this.calculateBasePrice(validated, costs);

    // 3. Apply adjustments (seasonality, demand)
    const adjustedPrice = this.applyAdjustments(basePrice, validated);

    // 4. Ensure minimum margin
    const finalPrice = this.ensureMinMargin(adjustedPrice, costs, validated.minMarginPercent);

    // 5. Calculate profit metrics
    const profit = finalPrice - costs.total;
    const marginPercent = finalPrice > 0 ? profit / finalPrice : 0;
    const roiPercent = costs.total > 0 ? profit / costs.total : 0;

    // 6. Break-even analysis
    const fixedCostEstimate = 50;
    const breakEvenUnits = profit > 0 ? Math.ceil(fixedCostEstimate / profit) : -1;

    // 7. Viability check
    const isViable = marginPercent >= validated.minMarginPercent && profit > 0;

    // 8. Generate alternatives
    const alternatives = this.generateAlternatives(validated, costs);

    // 9. Calculate confidence
    const confidence = this.calculateConfidence(validated);

    // 10. Generate recommendation
    const recommendation = this.generateRecommendation(
      finalPrice,
      marginPercent,
      profit,
      validated.strategy,
      confidence
    );

    return {
      recommendedPrice: Math.round(finalPrice * 100) / 100,
      costs,
      profit: Math.round(profit * 100) / 100,
      marginPercent: Math.round(marginPercent * 10000) / 100,
      roiPercent: Math.round(roiPercent * 10000) / 100,
      breakEvenUnits,
      strategy: validated.strategy,
      isViable,
      confidence,
      recommendation,
      alternatives,
    };
  }

  /**
   * Calculate full cost breakdown.
   */
  private calculateCosts(input: ValidatedPricingInput): CostBreakdown {
    const platformFee = input.costPrice * input.platformFeePercent;
    const importDuties = input.importDutiesPercent
      ? input.costPrice * input.importDutiesPercent
      : 0;

    const total =
      input.costPrice +
      input.shippingCost +
      platformFee +
      importDuties +
      (input.packagingCost || 0) +
      (input.marketingCost || 0);

    return {
      productCost: input.costPrice,
      shippingCost: input.shippingCost,
      platformFee: Math.round(platformFee * 100) / 100,
      importDuties: importDuties > 0 ? Math.round(importDuties * 100) / 100 : undefined,
      packagingCost: input.packagingCost || undefined,
      marketingCost: input.marketingCost || undefined,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Calculate base price from strategy.
   */
  private calculateBasePrice(input: ValidatedPricingInput, costs: CostBreakdown): number {
    switch (input.strategy) {
      case "cost-plus":
        return this.costPlusPricing(costs, input.targetMarginPercent || 0.30);

      case "competitive":
        return this.competitivePricing(input, costs);

      case "value-based":
        return this.valueBasedPricing(costs, input.targetMarginPercent || 0.50);

      case "penetration":
        return this.penetrationPricing(costs);

      case "skimming":
        return this.skimmingPricing(costs);

      case "dynamic":
        return this.dynamicPricing(costs, input.demandLevel || 50);

      default:
        return this.costPlusPricing(costs, 0.30);
    }
  }

  /**
   * Cost-plus: Add fixed markup to total cost.
   */
  private costPlusPricing(costs: CostBreakdown, targetMargin: number): number {
    return costs.total / (1 - targetMargin);
  }

  /**
   * Competitive: Price based on competitor data.
   */
  private competitivePricing(input: ValidatedPricingInput, costs: CostBreakdown): number {
    if (!input.competitorPrices || input.competitorPrices.length === 0) {
      // Fallback to cost-plus if no competitor data
      return this.costPlusPricing(costs, 0.25);
    }

    // Average competitor price, undercut by 5%
    const avgCompetitor =
      input.competitorPrices.reduce((a, b) => a + b, 0) /
      input.competitorPrices.length;
    const undercutPrice = avgCompetitor * 0.95;

    // Ensure we don't go below cost + minimum margin
    const minPrice = costs.total / (1 - input.minMarginPercent);
    return Math.max(undercutPrice, minPrice);
  }

  /**
   * Value-based: Price based on perceived value (higher markup).
   */
  private valueBasedPricing(costs: CostBreakdown, targetMargin: number): number {
    return costs.total / (1 - targetMargin);
  }

  /**
   * Penetration: Lower price to gain market share.
   */
  private penetrationPricing(costs: CostBreakdown): number {
    // 15% margin (lower than normal)
    return costs.total / (1 - 0.15);
  }

  /**
   * Skimming: Higher price initially.
   */
  private skimmingPricing(costs: CostBreakdown): number {
    // 50% margin (higher than normal)
    return costs.total / (1 - 0.50);
  }

  /**
   * Dynamic: Adjust based on demand level.
   */
  private dynamicPricing(costs: CostBreakdown, demandLevel: number): number {
    // Base 30% margin, adjusted by demand (0-100)
    const baseMargin = 0.30;
    const demandAdjustment = (demandLevel - 50) / 200; // -0.25 to +0.25
    const adjustedMargin = baseMargin + demandAdjustment;
    return costs.total / (1 - Math.max(0.10, Math.min(0.60, adjustedMargin)));
  }

  /**
   * Apply seasonality and demand adjustments.
   */
  private applyAdjustments(price: number, input: ValidatedPricingInput): number {
    let adjusted = price;

    // Seasonality factor
    if (input.seasonalityFactor !== 1.0) {
      adjusted *= input.seasonalityFactor;
    }

    return adjusted;
  }

  /**
   * Ensure minimum margin is maintained.
   */
  private ensureMinMargin(price: number, costs: CostBreakdown, minMargin: number): number {
    const minPrice = costs.total / (1 - minMargin);
    return Math.max(price, minPrice);
  }

  /**
   * Generate alternative price points.
   */
  private generateAlternatives(
    input: ValidatedPricingInput,
    costs: CostBreakdown
  ): PricingResult["alternatives"] {
    const alternatives: PricingResult["alternatives"] = [];

    const margins = [0.20, 0.30, 0.40, 0.50];
    const labels = ["Budget", "Standard", "Premium", "Luxury"];

    for (let i = 0; i < margins.length; i++) {
      const price = costs.total / (1 - margins[i]);
      const profit = price - costs.total;
      alternatives.push({
        price: Math.round(price * 100) / 100,
        marginPercent: Math.round(margins[i] * 10000) / 100,
        profit: Math.round(profit * 100) / 100,
        label: labels[i],
      });
    }

    return alternatives;
  }

  /**
   * Calculate pricing confidence based on data availability.
   */
  private calculateConfidence(input: ValidatedPricingInput): number {
    let confidence = 50; // Base confidence

    // Has competitor prices
    if (input.competitorPrices && input.competitorPrices.length > 0) {
      confidence += 20;
    }

    // Has demand level
    if (input.demandLevel !== undefined) {
      confidence += 10;
    }

    // Has target margin
    if (input.targetMarginPercent !== undefined) {
      confidence += 10;
    }

    // Has import duties info
    if (input.importDutiesPercent !== undefined) {
      confidence += 5;
    }

    // Has packaging cost
    if (input.packagingCost !== undefined) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Generate human-readable recommendation.
   */
  private generateRecommendation(
    price: number,
    marginPercent: number,
    profit: number,
    strategy: PricingStrategy,
    _confidence: number
  ): string {
    const marginStr = (marginPercent * 100).toFixed(1);
    const profitStr = profit.toFixed(2);

    if (marginPercent > 0.40) {
      return `EXCELLENT margin (${marginStr}%). Profit of ${profitStr} per unit. Strong candidate for ${strategy} pricing.`;
    } else if (marginPercent > 0.25) {
      return `GOOD margin (${marginStr}%). Profit of ${profitStr} per unit. Viable with ${strategy} strategy.`;
    } else if (marginPercent > 0.15) {
      return `LOW margin (${marginStr}%). Profit of ${profitStr} per unit. Consider volume sales or cost reduction.`;
    } else {
      return `POOR margin (${marginStr}%). Profit of ${profitStr} per unit. Not recommended at this price point.`;
    }
  }
}

// Singleton
let instance: PricingEngine | null = null;

export function getPricingEngine(): PricingEngine {
  if (!instance) {
    instance = new PricingEngine();
  }
  return instance;
}
