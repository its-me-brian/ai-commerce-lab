// Opportunity Scoring Agent
// Combines insights from Product Hunter, Supplier Research, and Market Research
// to produce a final opportunity score with GO/NO-GO decision.
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
export const OpportunityScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  decision: z.enum(["GO", "CONDITIONAL_GO", "NO_GO", "NEEDS_MORE_DATA"]),
  breakdown: z.object({
    productScore: z.number().min(0).max(100),
    supplierScore: z.number().min(0).max(100),
    marketScore: z.number().min(0).max(100),
    financialScore: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  actionItems: z.array(
    z.object({
      priority: z.enum(["critical", "high", "medium", "low"]),
      action: z.string(),
      reason: z.string(),
    })
  ),
  estimatedTimeline: z.string(),
  expectedROI: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

export type OpportunityScore = z.infer<typeof OpportunityScoreSchema>;

export class OpportunityScoringAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "opportunity-scoring",
    name: "Opportunity Scoring",
    description:
      "Combines product, supplier, and market data to score opportunities",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "opportunity_scoring",
      "risk_assessment",
      "decision_making",
    ],
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.productAnalysis) {
      errors.push("Product analysis data is required");
    }
    if (!input.supplierResearch) {
      errors.push("Supplier research data is required");
    }
    if (!input.marketResearch) {
      errors.push("Market research data is required");
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
    let structuredData: OpportunityScore;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = OpportunityScoreSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: structuredData.summary,
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
    return `You are an expert opportunity evaluator for ecommerce dropshipping businesses.

Your job is to synthesize data from multiple research agents and produce a final opportunity score.

For each evaluation, return a JSON object with this exact structure:
{
  "overallScore": <0-100 weighted average>,
  "decision": "GO" | "CONDITIONAL_GO" | "NO_GO" | "NEEDS_MORE_DATA",
  "breakdown": {
    "productScore": <0-100 from product analysis>,
    "supplierScore": <0-100 from supplier research>,
    "marketScore": <0-100 from market research>,
    "financialScore": <0-100 margin/profitability assessment>
  },
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "actionItems": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "action": "<what to do>",
      "reason": "<why>"
    }
  ],
  "estimatedTimeline": "<e.g. '2-3 weeks to first sale'>",
  "expectedROI": "<e.g. '150-200% in first quarter'>",
  "riskLevel": "low" | "medium" | "high",
  "summary": "<3-4 sentence executive summary>"
}

Scoring weights:
- Product Score: 30% (demand, competition, uniqueness)
- Supplier Score: 25% (reliability, pricing, shipping)
- Market Score: 25% (trends, size, growth)
- Financial Score: 20% (margins, ROI, break-even)

Decision criteria:
- GO: overallScore >= 75 AND riskLevel != "high"
- CONDITIONAL_GO: overallScore 60-74 OR riskLevel == "high" with mitigation
- NO_GO: overallScore < 50 OR critical weaknesses
- NEEDS_MORE_DATA: insufficient data to make a confident decision

Be decisive. Entrepreneurs need clear direction, not hedging.`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Evaluate this ecommerce opportunity based on the following research:`,
      ``,
      `## Product Analysis`,
      JSON.stringify(input.productAnalysis, null, 2),
      ``,
      `## Supplier Research`,
      JSON.stringify(input.supplierResearch, null, 2),
      ``,
      `## Market Research`,
      JSON.stringify(input.marketResearch, null, 2),
    ];

    if (input.additionalContext) {
      parts.push(``);
      parts.push(`## Additional Context`);
      parts.push(String(input.additionalContext));
    }

    parts.push(``);
    parts.push(`Provide your evaluation as a JSON object.`);

    return parts.join("\n");
  }
}
