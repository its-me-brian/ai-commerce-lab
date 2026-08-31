// Market Research Agent
// Analyzes market trends, competition, and demand for products/categories.
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
export const MarketResearchSchema = z.object({
  marketSize: z.object({
    estimate: z.string(),
    confidence: z.number().min(0).max(100),
    source: z.string().optional(),
  }),
  trends: z.array(
    z.object({
      name: z.string(),
      direction: z.enum(["growing", "stable", "declining"]),
      strength: z.number().min(0).max(100),
      description: z.string(),
    })
  ),
  competition: z.object({
    level: z.enum(["low", "medium", "high", "saturated"]),
    majorPlayers: z.array(z.string()),
    barriersToEntry: z.array(z.string()),
    differentiationOpportunity: z.string(),
  }),
  demand: z.object({
    score: z.number().min(0).max(100),
    seasonality: z.string(),
    targetDemographics: z.array(z.string()),
    buyingPatterns: z.string(),
  }),
  risks: z.array(
    z.object({
      factor: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string(),
    })
  ),
  recommendation: z.string(),
  summary: z.string(),
});

export type MarketResearch = z.infer<typeof MarketResearchSchema>;

export class MarketResearchAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "market-research",
    name: "Market Research",
    description: "Analyzes market trends, competition, and demand",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: ["market_analysis", "trend_analysis", "competition_analysis"],
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.productOrCategory || typeof input.productOrCategory !== "string") {
      errors.push("Product or category name is required");
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
    let structuredData: MarketResearch;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = MarketResearchSchema.parse(parsed);
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
    return `You are an expert market research analyst specializing in ecommerce and dropshipping markets.

For each market research request, return a JSON object with this exact structure:
{
  "marketSize": {
    "estimate": "<e.g. '$2.5B globally' or '€500M in Europe'>",
    "confidence": <0-100 how confident in this estimate>,
    "source": "<source of estimate if known>"
  },
  "trends": [
    {
      "name": "<trend name>",
      "direction": "growing" | "stable" | "declining",
      "strength": <0-100 how strong the trend is>,
      "description": "<1-2 sentence description>"
    }
  ],
  "competition": {
    "level": "low" | "medium" | "high" | "saturated",
    "majorPlayers": ["<player1>", "<player2>"],
    "barriersToEntry": ["<barrier1>", "<barrier2>"],
    "differentiationOpportunity": "<how to stand out>"
  },
  "demand": {
    "score": <0-100 demand level>,
    "seasonality": "<e.g. 'Year-round', 'Peak Nov-Dec', 'Summer only'>",
    "targetDemographics": ["<demo1>", "<demo2>"],
    "buyingPatterns": "<e.g. 'Impulse buy', 'Research-heavy', 'Repeat purchase'>"
  },
  "risks": [
    {
      "factor": "<risk name>",
      "severity": "low" | "medium" | "high",
      "mitigation": "<how to mitigate>"
    }
  ],
  "recommendation": "<1-2 sentence overall recommendation>",
  "summary": "<3-4 sentence executive summary>"
}

Focus on actionable insights for a dropshipping business targeting European markets. Be specific with numbers where possible.`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Research this market:`,
      ``,
      `Product/Category: ${input.productOrCategory}`,
      `Target Market: ${input.targetMarket || "Europe"}`,
      `Price Range: ${input.priceRange || "not specified"}`,
    ];

    if (input.specificQuestions) {
      parts.push(`Specific Questions: ${input.specificQuestions}`);
    }

    if (input.competitors) {
      parts.push(`Known Competitors: ${input.competitors}`);
    }

    parts.push(``);
    parts.push(`Provide your research as a JSON object.`);

    return parts.join("\n");
  }
}
