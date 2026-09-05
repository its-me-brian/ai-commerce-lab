// Supplier Workflow
// Dedicated workflow for supplier research with chain analysis.
// FASE 21: Product info → Market context → Supplier research → Recommendation.

import { getMultiAgentOrchestrator } from "./multi-agent-orchestrator";
import { bootstrap } from "./bootstrap";

export interface SupplierWorkflowInput {
  productName: string;
  category: string;
  targetMarket?: string;
  maxPrice?: number;
  orderVolume?: string;
  specialRequirements?: string;
  /** Include market context in the analysis */
  includeMarketContext?: boolean;
}

export interface SupplierWorkflowResult {
  success: boolean;
  productName: string;
  suppliers: Array<{
    name: string;
    location: string;
    platform: string;
    reliabilityScore: number;
    priceRange: { min: number; max: number; currency: string };
    shippingOptions: Array<{
      method: string;
      estimatedDays: number;
      cost: number;
    }>;
    moq?: number;
    paymentTerms?: string;
    notes: string;
  }>;
  bestOption: string;
  recommendation: string;
  riskFactors: string[];
  marketContext?: {
    competitionLevel?: string;
    demandScore?: number;
    trends?: Array<{ name: string; direction: string }>;
  };
  estimatedLandedCost?: {
    min: number;
    max: number;
    currency: string;
    breakdown: {
      productCost: { min: number; max: number };
      shippingCost: { min: number; max: number };
      platformFee: number;
    };
  };
  metadata: {
    agentsUsed: string[];
    totalInputTokens: number;
    totalOutputTokens: number;
    durationMs: number;
  };
}

/**
 * Supplier Workflow
 * Orchestrates supplier research with optional market context enrichment.
 *
 * Flow:
 * 1. (Optional) Market Research → get competition/demand context
 * 2. Supplier Research → find and evaluate suppliers
 * 3. Calculate estimated landed costs
 * 4. Return consolidated recommendation
 */
export class SupplierWorkflow {
  /**
   * Execute the supplier research workflow.
   */
  async execute(input: SupplierWorkflowInput): Promise<SupplierWorkflowResult> {
    await bootstrap();

    const startTime = Date.now();
    const orchestrator = getMultiAgentOrchestrator();
    const agentsUsed: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Step 1: Optional market context enrichment
    let marketContext: SupplierWorkflowResult["marketContext"];

    if (input.includeMarketContext) {
      const marketResult = await orchestrator.execute({
        parallel: [
          {
            agentId: "market-research",
            input: {
              productOrCategory: input.category || input.productName,
              targetMarket: input.targetMarket || "Europe",
              priceRange: input.maxPrice ? `$0-$${input.maxPrice}` : undefined,
            },
            taskType: "market-context",
          },
        ],
      });

      agentsUsed.push("market-research");
      totalInputTokens += marketResult.totalInputTokens;
      totalOutputTokens += marketResult.totalOutputTokens;

      if (marketResult.success && marketResult.results.length > 0) {
        const marketData = orchestrator.getStructuredData<{
          competition?: { level: string };
          demand?: { score: number };
          trends?: Array<{ name: string; direction: string }>;
        }>(marketResult, "market-research");

        if (marketData) {
          marketContext = {
            competitionLevel: marketData.competition?.level,
            demandScore: marketData.demand?.score,
            trends: marketData.trends,
          };
        }
      }
    }

    // Step 2: Supplier research
    const supplierResult = await orchestrator.execute({
      parallel: [
        {
          agentId: "supplier-research",
          input: {
            productName: input.productName,
            category: input.category,
            targetMarket: input.targetMarket || "Europe",
            maxPrice: input.maxPrice,
            orderVolume: input.orderVolume || "small (dropshipping)",
            specialRequirements: input.specialRequirements,
          },
          taskType: "supplier-workflow",
        },
      ],
    });

    agentsUsed.push("supplier-research");
    totalInputTokens += supplierResult.totalInputTokens;
    totalOutputTokens += supplierResult.totalOutputTokens;

    if (!supplierResult.success || supplierResult.results.length === 0) {
      return {
        success: false,
        productName: input.productName,
        suppliers: [],
        bestOption: "",
        recommendation: "Supplier research failed",
        riskFactors: ["Unable to complete supplier research"],
        metadata: {
          agentsUsed,
          totalInputTokens,
          totalOutputTokens,
          durationMs: Date.now() - startTime,
        },
      };
    }

    const supplierData = orchestrator.getStructuredData<{
      suppliers: SupplierWorkflowResult["suppliers"];
      recommendation: string;
      bestOption: string;
      riskFactors: string[];
    }>(supplierResult, "supplier-research");

    if (!supplierData) {
      return {
        success: false,
        productName: input.productName,
        suppliers: [],
        bestOption: "",
        recommendation: "No supplier data returned",
        riskFactors: ["Empty supplier response"],
        metadata: {
          agentsUsed,
          totalInputTokens,
          totalOutputTokens,
          durationMs: Date.now() - startTime,
        },
      };
    }

    // Step 3: Calculate estimated landed costs
    const estimatedLandedCost = this.calculateLandedCosts(
      supplierData.suppliers,
      marketContext?.competitionLevel
    );

    return {
      success: true,
      productName: input.productName,
      suppliers: supplierData.suppliers,
      bestOption: supplierData.bestOption,
      recommendation: supplierData.recommendation,
      riskFactors: supplierData.riskFactors,
      marketContext,
      estimatedLandedCost,
      metadata: {
        agentsUsed,
        totalInputTokens,
        totalOutputTokens,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Calculate estimated landed costs from supplier data.
   */
  private calculateLandedCosts(
    suppliers: SupplierWorkflowResult["suppliers"],
 
    _competitionLevel?: string
  ): SupplierWorkflowResult["estimatedLandedCost"] {
    if (suppliers.length === 0) return undefined;

    // Find the best price ranges across suppliers
    let minProductCost = Infinity;
    let maxProductCost = 0;
    let minShippingCost = Infinity;
    let maxShippingCost = 0;

    for (const supplier of suppliers) {
      if (supplier.priceRange.min < minProductCost) {
        minProductCost = supplier.priceRange.min;
      }
      if (supplier.priceRange.max > maxProductCost) {
        maxProductCost = supplier.priceRange.max;
      }

      for (const shipping of supplier.shippingOptions) {
        if (shipping.cost < minShippingCost) {
          minShippingCost = shipping.cost;
        }
        if (shipping.cost > maxShippingCost) {
          maxShippingCost = shipping.cost;
        }
      }
    }

    // Handle edge cases
    if (minProductCost === Infinity) minProductCost = 0;
    if (minShippingCost === Infinity) minShippingCost = 0;

    const platformFeePercent = 0.15; // 15% platform fee
    const minTotal = minProductCost + minShippingCost;
    const maxTotal = maxProductCost + maxShippingCost;

    return {
      min: Math.round(minTotal * 100) / 100,
      max: Math.round(maxTotal * 100) / 100,
      currency: "USD",
      breakdown: {
        productCost: {
          min: Math.round(minProductCost * 100) / 100,
          max: Math.round(maxProductCost * 100) / 100,
        },
        shippingCost: {
          min: Math.round(minShippingCost * 100) / 100,
          max: Math.round(maxShippingCost * 100) / 100,
        },
        platformFee: platformFeePercent,
      },
    };
  }
}

// Singleton
let instance: SupplierWorkflow | null = null;

export function getSupplierWorkflow(): SupplierWorkflow {
  if (!instance) {
    instance = new SupplierWorkflow();
  }
  return instance;
}
