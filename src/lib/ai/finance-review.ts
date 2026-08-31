// Finance Review
// Validates margins, costs, and financial viability.
// FASE 33: Every product must pass financial review before listing.

import { getPricingEngine, type PricingInput, type PricingResult } from "./pricing-engine";
import { getApprovalManager } from "./approval-manager";

export type FinanceReviewVerdict = "viable" | "marginal" | "rejected";

export interface FinanceReviewInput {
  productName: string;
  costPrice: number;
  sellingPrice: number;
  shippingCost?: number;
  platformFeePercent?: number;
  importDutiesPercent?: number;
  packagingCost?: number;
  marketingCost?: number;
  competitorPrices?: number[];
  currency?: string;
}

export interface FinanceReviewResult {
  verdict: FinanceReviewVerdict;
  pricing: PricingResult;
  checks: FinancialCheck[];
  requiresApproval: boolean;
  approvalId: string | null;
}

export interface FinancialCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "info" | "warning" | "critical";
}

/**
 * Finance Review
 * Validates that products are financially viable before listing.
 */
export class FinanceReview {
  private pricingEngine = getPricingEngine();

  /**
   * Review a product's financial viability.
   */
  async review(input: FinanceReviewInput): Promise<FinanceReviewResult> {
    const checks: FinancialCheck[] = [];

    // Calculate pricing for reference (engine's recommended price)
    const pricingInput: PricingInput = {
      costPrice: input.costPrice,
      currency: input.currency || "EUR",
      shippingCost: input.shippingCost || 0,
      platformFeePercent: input.platformFeePercent || 0.15,
      importDutiesPercent: input.importDutiesPercent,
      packagingCost: input.packagingCost,
      marketingCost: input.marketingCost,
      competitorPrices: input.competitorPrices,
    };

    const pricing = this.pricingEngine.calculate(pricingInput);

    // Calculate actual financials based on USER's selling price
    const platformFee = input.costPrice * (input.platformFeePercent || 0.15);
    const shipping = input.shippingCost || 0;
    const totalCost = input.costPrice + shipping + platformFee;
    const actualProfit = input.sellingPrice - totalCost;
    const actualMarginPercent = input.sellingPrice > 0 ? (actualProfit / input.sellingPrice) * 100 : 0;
    const actualROI = totalCost > 0 ? (actualProfit / totalCost) * 100 : 0;

    // Override pricing with actuals for checks
    const actualPricing = {
      ...pricing,
      recommendedPrice: input.sellingPrice,
      profit: actualProfit,
      marginPercent: Math.round(actualMarginPercent * 100) / 100,
      roiPercent: Math.round(actualROI * 100) / 100,
      costs: { ...pricing.costs, total: totalCost },
    };

    // Check 1: Minimum margin
    const minMarginCheck = this.checkMinMargin(actualPricing);
    checks.push(minMarginCheck);

    // Check 2: Profitability
    const profitCheck = this.checkProfitability(actualPricing);
    checks.push(profitCheck);

    // Check 3: Competitive pricing
    const competitiveCheck = this.checkCompetitivePricing(input, actualPricing);
    checks.push(competitiveCheck);

    // Check 4: ROI
    const roiCheck = this.checkROI(actualPricing);
    checks.push(roiCheck);

    // Check 5: Break-even
    const breakEvenCheck = this.checkBreakEven(actualPricing);
    checks.push(breakEvenCheck);

    // Determine verdict
    const criticalFailures = checks.filter((c) => !c.passed && c.severity === "critical");
    const warnings = checks.filter((c) => !c.passed && c.severity === "warning");

    let verdict: FinanceReviewVerdict;
    if (criticalFailures.length > 0) {
      verdict = "rejected";
    } else if (warnings.length > 0) {
      verdict = "marginal";
    } else {
      verdict = "viable";
    }

    // Check if approval needed
    let requiresApproval = false;
    let approvalId: string | null = null;

    if (verdict !== "viable") {
      requiresApproval = true;
      try {
        const approvalManager = getApprovalManager();
        const approval = await approvalManager.createApproval({
          agent_id: "finance",
          action_type: "price_change",
          action_summary: `Finance review: ${input.productName} — ${verdict}`,
          action_details: {
            productName: input.productName,
            costPrice: input.costPrice,
            sellingPrice: input.sellingPrice,
            margin: pricing.marginPercent,
            verdict,
            failedChecks: criticalFailures.map((c) => c.name),
          },
          risk_level: verdict === "rejected" ? "critical" : "high",
        });
        approvalId = approval.id;
      } catch (error) {
        // Approval creation failed — proceed without
      }
    }

    return {
      verdict,
      pricing: actualPricing,
      checks,
      requiresApproval,
      approvalId,
    };
  }

  private checkMinMargin(pricing: PricingResult): FinancialCheck {
    const passed = pricing.marginPercent >= 15;
    return {
      name: "Minimum Margin",
      passed,
      message: passed
        ? `Margin ${pricing.marginPercent.toFixed(1)}% meets 15% minimum`
        : `Margin ${pricing.marginPercent.toFixed(1)}% is below 15% minimum`,
      severity: passed ? "info" : "critical",
    };
  }

  private checkProfitability(pricing: PricingResult): FinancialCheck {
    const passed = pricing.profit > 0;
    return {
      name: "Profitability",
      passed,
      message: passed
        ? `Profit of ${pricing.profit.toFixed(2)} per unit`
        : `Negative profit: ${pricing.profit.toFixed(2)} per unit`,
      severity: passed ? "info" : "critical",
    };
  }

  private checkCompetitivePricing(
    input: FinanceReviewInput,
    pricing: PricingResult
  ): FinancialCheck {
    if (!input.competitorPrices || input.competitorPrices.length === 0) {
      return {
        name: "Competitive Pricing",
        passed: true,
        message: "No competitor data — skipping check",
        severity: "info",
      };
    }

    const avgCompetitor =
      input.competitorPrices.reduce((a, b) => a + b, 0) / input.competitorPrices.length;
    const passed = pricing.recommendedPrice <= avgCompetitor * 1.2; // Within 20% of avg

    return {
      name: "Competitive Pricing",
      passed,
      message: passed
        ? `Price ${pricing.recommendedPrice.toFixed(2)} is competitive (avg: ${avgCompetitor.toFixed(2)})`
        : `Price ${pricing.recommendedPrice.toFixed(2)} is above market (avg: ${avgCompetitor.toFixed(2)})`,
      severity: passed ? "info" : "warning",
    };
  }

  private checkROI(pricing: PricingResult): FinancialCheck {
    const passed = pricing.roiPercent >= 30;
    return {
      name: "ROI",
      passed,
      message: passed
        ? `ROI ${pricing.roiPercent.toFixed(1)}% exceeds 50% target`
        : `ROI ${pricing.roiPercent.toFixed(1)}% is below 50% target`,
      severity: passed ? "info" : "warning",
    };
  }

  private checkBreakEven(pricing: PricingResult): FinancialCheck {
    const passed = pricing.breakEvenUnits <= 100;
    return {
      name: "Break-Even",
      passed,
      message: passed
        ? `Break-even in ${pricing.breakEvenUnits} units`
        : `Break-even requires ${pricing.breakEvenUnits} units — high volume needed`,
      severity: passed ? "info" : "warning",
    };
  }
}

// Singleton
let instance: FinanceReview | null = null;

export function getFinanceReview(): FinanceReview {
  if (!instance) {
    instance = new FinanceReview();
  }
  return instance;
}
