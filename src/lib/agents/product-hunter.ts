// Product Hunter Agent
// Two modes:
//   1. ANALYZE: User provides a product → agent evaluates it
//   2. DISCOVER: Agent searches for products → delegates to specialist agents
// This agent NEVER knows about specific AI providers — it only uses the router.
// FASE 20: Discover mode now uses multi-agent orchestration.

import { BaseAgent } from "./core/agent";
import type {
  AgentMetadata,
  AgentContext,
  AgentResult,
} from "./core/types";
import { getRouter } from "../ai/router";
import { getToolRegistry } from "../tools/bootstrap";
import { getMultiAgentOrchestrator } from "../ai/multi-agent-orchestrator";
import type { RawProduct } from "../tools/search-products";
import { z } from "zod";

// Zod schema for structured output validation
export const DataConfidence = z.enum(["KNOWN", "ESTIMATED", "UNKNOWN"]);

export const ProductAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  estimatedMargin: z.number(),
  recommendedPrice: z.number(),
  demandScore: z.number().min(0).max(100),
  competitionScore: z.number().min(0).max(100),
  supplierScore: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  recommendation: z.enum(["INVESTIGATE", "APPROVE", "REJECT", "NEEDS_MORE_DATA"]),
  explanation: z.string(),
  category: z.string().optional(),
  targetMarket: z.array(z.string()).optional(),
  // Data confidence classification
  dataConfidence: z.object({
    supplierPrice: DataConfidence,
    sellingPrice: DataConfidence,
    demand: DataConfidence,
    competition: DataConfidence,
    shippingCost: DataConfidence,
  }).optional(),
  // Backend validation fields (added by tool calling)
  marginValidated: z.boolean().optional(),
  toolMarginPercent: z.number().optional(),
  marginDiscrepancy: z.number().optional(),
  profit: z.number().optional(),
  roiPercent: z.number().optional(),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

export class ProductHunterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "product-hunter",
    name: "Product Hunter",
    description: "Searches and evaluates ecommerce opportunities",
    status: "ready",
    enabled: true,
    version: "0.2.0",
    capabilities: [
      "product_analysis",
      "product_discovery",
      "trend_analysis",
      "price_calculation",
    ],
    // Hierarchy: department head, reports to CEO
    parentAgentId: "ceo",
    agentType: "department",
    department: "product",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const mode = (input.mode as string) || "analyze";

    if (mode === "discover") {
      // Discover mode: need a search query
      if (!input.query || typeof input.query !== "string") {
        errors.push("Search query is required for discover mode");
      }
    } else {
      // Analyze mode: need product name and supplier price
      if (!input.name || typeof input.name !== "string") {
        errors.push("Product name is required");
      }
      if (input.supplierPrice === undefined || typeof input.supplierPrice !== "number") {
        errors.push("Supplier price is required and must be a number");
      }
    }

    return errors;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
 
    const { input, configuration: _configuration } = context;
    const mode = (input.mode as string) || "analyze";

    if (mode === "discover") {
      return this.executeDiscover(context);
    }
    return this.executeAnalyze(context);
  }

  /**
   * FASE 20: DISCOVER MODE — Multi-agent discovery workflow.
   * 1. Search for products (tool)
   * 2. Delegate to MarketResearch, SupplierResearch in parallel
   * 3. Delegate to OpportunityScoring with all data
   * 4. Consolidate results
   */
  private async executeDiscover(context: AgentContext): Promise<AgentResult> {
    const { input, configuration } = context;
    const toolRegistry = getToolRegistry();
    const orchestrator = getMultiAgentOrchestrator();
    const startTime = Date.now();

    // 1. Search for products
    const searchResult = await toolRegistry.execute("search_products", {
      query: input.query,
      source: input.source || "ebay",
      limit: input.limit || 5,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    });

    if (!searchResult.success) {
      throw new Error(`Product search failed: ${searchResult.error}`);
    }

    const { products } = searchResult.output as {
      products: RawProduct[];
      totalCount: number;
      source: string;
    };

    if (products.length === 0) {
      return {
        success: true,
        output: "No products found for the given search criteria.",
        structuredData: { opportunities: [], totalFound: 0 },
        reasoningSummary: "No products matched the search criteria.",
        errors: [],
        metadata: {
          providerUsed: configuration.primaryProvider,
          modelUsed: configuration.primaryModel,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - startTime,
          cached: false,
        },
      };
    }

    // 2. For each product, run multi-agent analysis
    const opportunities: Array<{
      product: RawProduct;
      marketAnalysis: unknown;
      supplierAnalysis: unknown;
      opportunityScore: unknown;
    }> = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const product of products) {
      try {
        // Run Market Research + Supplier Research in parallel
        const parallelPlan = {
          parallel: [
            {
              agentId: "market-research",
              input: {
                productOrCategory: product.category || product.name,
                targetMarket: "Europe",
                priceRange: `${product.currency} ${product.price}`,
              },
              taskType: "market-analysis",
            },
            {
              agentId: "supplier-research",
              input: {
                productName: product.name,
                category: product.category || "general",
                targetMarket: "Europe",
                orderVolume: "small (dropshipping)",
              },
              taskType: "supplier-analysis",
            },
          ],
        };

        const parallelResult = await orchestrator.execute(parallelPlan);
        totalInputTokens += parallelResult.totalInputTokens;
        totalOutputTokens += parallelResult.totalOutputTokens;

        if (!parallelResult.success) {
          errors.push(`Parallel analysis failed for ${product.name}: ${parallelResult.errors.join(", ")}`);
          continue;
        }

        // Extract results from parallel execution
        const marketData = orchestrator.getStructuredData(
          parallelResult,
          "market-research"
        );
        const supplierData = orchestrator.getStructuredData(
          parallelResult,
          "supplier-research"
        );

        // Run Opportunity Scoring with combined data
        const scoringResult = await orchestrator.executeChain(
          [
            {
              agentId: "opportunity-scoring",
              input: {
                productAnalysis: {
                  name: product.name,
                  price: product.price,
                  currency: product.currency,
                  category: product.category,
                  score: 50, // Will be refined by AI
                },
                supplierResearch: supplierData || {},
                marketResearch: marketData || {},
              },
              taskType: "opportunity-scoring",
            },
          ],
          {}
        );

        totalInputTokens += scoringResult.totalInputTokens;
        totalOutputTokens += scoringResult.totalOutputTokens;

        const opportunityData = orchestrator.getStructuredData(
          scoringResult,
          "opportunity-scoring"
        );

        opportunities.push({
          product,
          marketAnalysis: marketData,
          supplierAnalysis: supplierData,
          opportunityScore: opportunityData,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to analyze ${product.name}: ${msg}`);
        continue;
      }
    }

    // 3. Sort by opportunity score (descending)
    opportunities.sort((a, b) => {
      const scoreA = (a.opportunityScore as { overallScore?: number })?.overallScore || 0;
      const scoreB = (b.opportunityScore as { overallScore?: number })?.overallScore || 0;
      return scoreB - scoreA;
    });

    return {
      success: true,
      output: `Discovered ${opportunities.length} products from ${products.length} search results using multi-agent analysis.`,
      structuredData: {
        opportunities: opportunities.map((o) => ({
          name: o.product.name,
          price: o.product.price,
          currency: o.product.currency,
          source: o.product.source,
          sourceId: o.product.externalId,
          imageUrl: o.product.imageUrl,
          url: o.product.url,
          category: o.product.category,
          rating: o.product.rating,
          reviewCount: o.product.reviewCount,
          // Opportunity scoring data
          overallScore: (o.opportunityScore as { overallScore?: number })?.overallScore,
          decision: (o.opportunityScore as { decision?: string })?.decision,
          breakdown: (o.opportunityScore as { breakdown?: unknown })?.breakdown,
          strengths: (o.opportunityScore as { strengths?: string[] })?.strengths,
          weaknesses: (o.opportunityScore as { weaknesses?: string[] })?.weaknesses,
          riskLevel: (o.opportunityScore as { riskLevel?: string })?.riskLevel,
          summary: (o.opportunityScore as { summary?: string })?.summary,
          // Market analysis
          marketTrends: (o.marketAnalysis as { trends?: unknown[] })?.trends,
          competitionLevel: (o.marketAnalysis as { competition?: { level?: string } })?.competition?.level,
          demandScore: (o.marketAnalysis as { demand?: { score?: number } })?.demand?.score,
          // Supplier analysis
          suppliers: (o.supplierAnalysis as { suppliers?: unknown[] })?.suppliers,
          bestSupplier: (o.supplierAnalysis as { bestOption?: string })?.bestOption,
          // Data confidence
          dataConfidence: {
            supplierPrice: o.product.price > 0 ? "KNOWN" : "UNKNOWN",
            sellingPrice: "ESTIMATED",
            demand: "KNOWN", // From market research
            competition: "KNOWN", // From market research
            shippingCost: "KNOWN", // From supplier research
          },
        })),
        totalFound: products.length,
        analyzedCount: opportunities.length,
        skippedCount: products.length - opportunities.length,
        query: input.query,
        source: searchResult.output ? (searchResult.output as { source: string }).source : "unknown",
        orchestrationMode: "multi-agent",
      },
      reasoningSummary: `Analyzed ${products.length} products using multi-agent orchestration (Market Research + Supplier Research + Opportunity Scoring).`,
      errors,
      metadata: {
        providerUsed: configuration.primaryProvider,
        modelUsed: configuration.primaryModel,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs: Date.now() - startTime,
        cached: false,
      },
    };
  }

  /**
   * ANALYZE MODE: User provides a product → agent evaluates it.
   */
  private async executeAnalyze(context: AgentContext): Promise<AgentResult> {
    const { input, configuration } = context;

    const router = getRouter();

    // Call AI via router (primary + fallback handled automatically)
    const { result, log } = await router.generate(
      {
        agentId: configuration.agentId,
        primaryProvider: configuration.primaryProvider,
        primaryModel: configuration.primaryModel,
        fallbackProvider: configuration.fallbackProvider,
        fallbackModel: configuration.fallbackModel,
        temperature: configuration.temperature,
        maxTokens: configuration.maxTokens,
      },
      {
        prompt: this.buildAnalyzePrompt(input),
        systemPrompt: this.getAnalyzeSystemPrompt(),
        responseFormat: "json",
      }
    );

    // Parse and validate JSON
    let structuredData: ProductAnalysis;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = ProductAnalysisSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    // BACKEND VALIDATION: Use calculate_margin tool to verify AI's margin estimate
    const toolRegistry = getToolRegistry();
    const costPrice = input.supplierPrice as number;
    const shippingCost = (input.shippingCost as number) || 0;

    if (costPrice > 0 && structuredData.recommendedPrice > 0) {
      const marginResult = await toolRegistry.execute("calculate_margin", {
        costPrice,
        sellingPrice: structuredData.recommendedPrice,
        shippingCost,
        platformFeePercent: 15,
      });

      if (marginResult.success) {
        const toolOutput = marginResult.output as {
          profit: number;
          marginPercent: number;
          roiPercent: number;
          isViable: boolean;
        };

        const toolMargin = toolOutput.marginPercent;
        const aiMargin = structuredData.estimatedMargin;
        const discrepancy = Math.abs(toolMargin - aiMargin);

        structuredData.marginValidated = true;
        structuredData.toolMarginPercent = toolMargin;
        structuredData.marginDiscrepancy = Math.round(discrepancy * 100) / 100;
        structuredData.profit = toolOutput.profit;
        structuredData.roiPercent = toolOutput.roiPercent;

        if (discrepancy > 15) {
          structuredData.estimatedMargin = toolMargin;
        }
      }
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: structuredData.explanation,
      errors: [],
      metadata: {
        providerUsed: log.provider,
        modelUsed: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        durationMs: log.durationMs,
        cached: result.cached,
      },
    };
  }

  // --- ANALYZE MODE PROMPTS ---

  private getAnalyzeSystemPrompt(): string {
    return `You are an expert ecommerce product analyst. Your job is to evaluate product opportunities for a dropshipping business targeting European markets.

IMPORTANT: The backend will independently validate your margin calculations using a deterministic tool. Be accurate with numbers — discrepancies over 15% will be flagged and overridden.

For each product analysis, return a JSON object with this exact structure:
{
  "score": <0-100 overall score>,
  "estimatedMargin": <profit margin percentage — must match (sellingPrice - totalCost) / sellingPrice * 100>,
  "recommendedPrice": <suggested selling price in EUR>,
  "demandScore": <0-100 demand level>,
  "competitionScore": <0-100 competition level (higher = less competition)>,
  "supplierScore": <0-100 supplier quality>,
  "riskScore": <0-100 risk level (lower = less risk)>,
  "recommendation": "INVESTIGATE" | "APPROVE" | "REJECT" | "NEEDS_MORE_DATA",
  "explanation": "<brief analysis in English>",
  "category": "<product category>",
  "targetMarket": ["<country1>", "<country2>"]
}

Margin calculation formula:
- Total Cost = supplierPrice + shippingCost + (sellingPrice * 0.15)
- Profit = sellingPrice - totalCost
- Margin = (profit / sellingPrice) * 100

Scoring guidelines:
- Score 85-100: Strong opportunity, proceed immediately
- Score 70-84: Good opportunity, worth investigating
- Score 50-69: Marginal, needs more data
- Score below 50: Skip

Consider: demand signals, competition density, margin potential, shipping feasibility to EU, supplier reliability, and market trends.`;
  }

  private buildAnalyzePrompt(input: Record<string, unknown>): string {
    const parts = [
      `Analyze this product opportunity:`,
      ``,
      `Product: ${input.name}`,
      `Supplier Price: €${input.supplierPrice}`,
      `Shipping Cost: €${input.shippingCost || "unknown"}`,
      `Estimated Sale Price: €${input.estimatedSalePrice || "unknown"}`,
    ];

    if (input.competitorPrices) {
      parts.push(
        `Competitor Prices: ${JSON.stringify(input.competitorPrices)}`
      );
    }

    if (input.category) {
      parts.push(`Category: ${input.category}`);
    }

    if (input.notes) {
      parts.push(`Additional Notes: ${input.notes}`);
    }

    parts.push(``);
    parts.push(`Provide your analysis as a JSON object.`);

    return parts.join("\n");
  }
}
