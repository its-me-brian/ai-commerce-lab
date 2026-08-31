// Supplier Research Agent
// Researches potential suppliers for a given product.
// Uses AI to evaluate supplier reliability, pricing, and shipping.
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
export const SupplierResearchSchema = z.object({
  suppliers: z.array(
    z.object({
      name: z.string(),
      location: z.string(),
      platform: z.string(),
      reliabilityScore: z.number().min(0).max(100),
      priceRange: z.object({
        min: z.number(),
        max: z.number(),
        currency: z.string(),
      }),
      shippingOptions: z.array(
        z.object({
          method: z.string(),
          estimatedDays: z.number(),
          cost: z.number(),
        })
      ),
      moq: z.number().optional(), // minimum order quantity
      paymentTerms: z.string().optional(),
      notes: z.string(),
    })
  ),
  recommendation: z.string(),
  bestOption: z.string(),
  riskFactors: z.array(z.string()),
});

export type SupplierResearch = z.infer<typeof SupplierResearchSchema>;

export class SupplierResearchAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "supplier-research",
    name: "Supplier Research",
    description: "Researches and evaluates suppliers for product sourcing",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: ["supplier_analysis", "price_comparison", "risk_assessment"],
    // Hierarchy: specialist, reports to Product Hunter
    parentAgentId: "product-hunter",
    agentType: "specialist",
    department: "product",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.productName || typeof input.productName !== "string") {
      errors.push("Product name is required");
    }
    if (!input.category || typeof input.category !== "string") {
      errors.push("Category is required");
    }
    return errors;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { input, configuration } = context;

    const router = getRouter();

    // Call AI via router
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
    let structuredData: SupplierResearch;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = SupplierResearchSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: structuredData.recommendation,
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
    return `You are an expert ecommerce supplier researcher. Your job is to find and evaluate the best suppliers for dropshipping products targeting European markets.

For each supplier research request, return a JSON object with this exact structure:
{
  "suppliers": [
    {
      "name": "<supplier name>",
      "location": "<country/region>",
      "platform": "<AliExpress/Alibaba/1688/Dhgate/Local>",
      "reliabilityScore": <0-100>,
      "priceRange": {
        "min": <minimum price in USD>,
        "max": <maximum price in USD>,
        "currency": "USD"
      },
      "shippingOptions": [
        {
          "method": "<ePacket/Standard/Express>",
          "estimatedDays": <delivery days>,
          "cost": <shipping cost in USD>
        }
      ],
      "moq": <minimum order quantity, optional>,
      "paymentTerms": "<payment terms, optional>",
      "notes": "<brief notes about supplier>"
    }
  ],
  "recommendation": "<overall recommendation in 1-2 sentences>",
  "bestOption": "<name of recommended supplier>",
  "riskFactors": ["<risk1>", "<risk2>"]
}

Evaluation criteria:
- Reliability: track record, reviews, response time
- Price: competitive pricing for dropshipping
- Shipping: available to EU, reasonable delivery time
- MOQ: low or no minimum for dropshipping
- Payment: secure payment options

Consider: AliExpress for small orders, Alibaba for bulk, 1688 for Chinese domestic, local EU suppliers for faster delivery.`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Research suppliers for this product:`,
      ``,
      `Product: ${input.productName}`,
      `Category: ${input.category}`,
      `Target Price Range: $${input.minPrice || "unknown"} - $${input.maxPrice || "unknown"}`,
      `Target Market: ${input.targetMarket || "Europe"}`,
      `Order Volume: ${input.orderVolume || "small (dropshipping)"}`,
    ];

    if (input.specialRequirements) {
      parts.push(`Special Requirements: ${input.specialRequirements}`);
    }

    parts.push(``);
    parts.push(`Provide your research as a JSON object.`);

    return parts.join("\n");
  }
}
