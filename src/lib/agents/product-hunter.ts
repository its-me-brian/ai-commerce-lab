// Product Hunter Agent
// Analyzes product opportunities and returns structured scores
// This agent NEVER knows about specific AI providers — it only uses the router.

import { BaseAgent } from "./core/agent";
import type {
  AgentMetadata,
  AgentContext,
  AgentResult,
} from "./core/types";
import { getRouter } from "../ai/router";
import { z } from "zod";

// Zod schema for structured output validation
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
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

export class ProductHunterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "product-hunter",
    name: "Product Hunter",
    description: "Searches and evaluates ecommerce opportunities",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: ["product_analysis", "trend_analysis", "price_calculation"],
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.name || typeof input.name !== "string") {
      errors.push("Product name is required");
    }
    if (input.supplierPrice === undefined || typeof input.supplierPrice !== "number") {
      errors.push("Supplier price is required and must be a number");
    }
    return errors;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
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
        prompt: this.buildPrompt(input),
        systemPrompt: this.getSystemPrompt(),
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

  private getSystemPrompt(): string {
    return `You are an expert ecommerce product analyst. Your job is to evaluate product opportunities for a dropshipping business targeting European markets.

For each product analysis, return a JSON object with this exact structure:
{
  "score": <0-100 overall score>,
  "estimatedMargin": <profit margin percentage>,
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

Scoring guidelines:
- Score 85-100: Strong opportunity, proceed immediately
- Score 70-84: Good opportunity, worth investigating
- Score 50-69: Marginal, needs more data
- Score below 50: Skip

Consider: demand signals, competition density, margin potential, shipping feasibility to EU, supplier reliability, and market trends.`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
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
