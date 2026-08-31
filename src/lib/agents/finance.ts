// Finance Agent
// Tracks costs, margins, and profitability analysis.
// This agent NEVER knows about specific AI providers — it only uses the router.

import { BaseAgent } from "./core/agent";
import type {
  AgentMetadata,
  AgentContext,
  AgentResult,
} from "./core/types";
import { getRouter } from "../ai/router";
import { getToolRegistry } from "../tools/bootstrap";
import { z } from "zod";

// Zod schema for structured output validation
export const FinanceAnalysisSchema = z.object({
  summary: z.object({
    totalRevenue: z.number(),
    totalCosts: z.number(),
    netProfit: z.number(),
    marginPercent: z.number(),
    roiPercent: z.number(),
  }),
  costBreakdown: z.array(
    z.object({
      category: z.string(),
      amount: z.number(),
      percentOfTotal: z.number(),
      notes: z.string().optional(),
    })
  ),
  productMargins: z.array(
    z.object({
      productName: z.string(),
      sellingPrice: z.number(),
      costPrice: z.number(),
      shippingCost: z.number(),
      platformFee: z.number(),
      profit: z.number(),
      marginPercent: z.number(),
    })
  ),
  projections: z.object({
    monthlyRevenue: z.number(),
    monthlyProfit: z.number(),
    breakEvenUnits: z.number(),
    breakEvenRevenue: z.number(),
  }),
  recommendations: z.array(z.string()),
  alerts: z.array(
    z.object({
      type: z.enum(["warning", "critical", "info"]),
      message: z.string(),
      action: z.string(),
    })
  ),
});

export type FinanceAnalysis = z.infer<typeof FinanceAnalysisSchema>;

export class FinanceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "finance",
    name: "Finance Agent",
    description: "Tracks costs, margins, and profitability",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "financial_analysis",
      "margin_calculation",
      "cost_tracking",
    ],
    // Hierarchy: department head, reports to CEO
    parentAgentId: "ceo",
    agentType: "department",
    department: "finance",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.products || !Array.isArray(input.products)) {
      errors.push("Products array is required");
    }
    return errors;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { input, configuration } = context;

    const router = getRouter();
    const toolRegistry = getToolRegistry();

    // Validate margins with calculate_margin tool for each product
    const products = input.products as Array<{
      name: string;
      sellingPrice: number;
      costPrice: number;
      shippingCost?: number;
    }>;

    const validatedMargins: Array<{
      productName: string;
      sellingPrice: number;
      costPrice: number;
      shippingCost: number;
      platformFee: number;
      profit: number;
      marginPercent: number;
    }> = [];

    for (const product of products) {
      const marginResult = await toolRegistry.execute("calculate_margin", {
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        shippingCost: product.shippingCost || 0,
        platformFeePercent: 15,
      });

      if (marginResult.success) {
        const toolOutput = marginResult.output as {
          profit: number;
          marginPercent: number;
        };
        validatedMargins.push({
          productName: product.name,
          sellingPrice: product.sellingPrice,
          costPrice: product.costPrice,
          shippingCost: product.shippingCost || 0,
          platformFee: product.sellingPrice * 0.15,
          profit: toolOutput.profit,
          marginPercent: toolOutput.marginPercent,
        });
      }
    }

    // Call AI for analysis and recommendations
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
        prompt: this.buildPrompt(input, validatedMargins),
        systemPrompt: this.getSystemPrompt(),
        responseFormat: "json",
      }
    );

    // Parse and validate JSON
    let structuredData: FinanceAnalysis;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = FinanceAnalysisSchema.parse(parsed);

      // Override product margins with tool-validated values
      structuredData.productMargins = validatedMargins;
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: structuredData.recommendations.join(" | "),
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
    return `You are an expert ecommerce financial analyst.

Your job is to analyze costs, margins, and profitability for a dropshipping business.

For each analysis, return a JSON object with this exact structure:
{
  "summary": {
    "totalRevenue": <total revenue>,
    "totalCosts": <total costs>,
    "netProfit": <net profit>,
    "marginPercent": <overall margin %>,
    "roiPercent": <ROI %>
  },
  "costBreakdown": [
    {
      "category": "<cost category>",
      "amount": <amount>,
      "percentOfTotal": <% of total costs>,
      "notes": "<optional notes>"
    }
  ],
  "productMargins": [
    {
      "productName": "<product name>",
      "sellingPrice": <price>,
      "costPrice": <cost>,
      "shippingCost": <shipping>,
      "platformFee": <platform fee>,
      "profit": <profit>,
      "marginPercent": <margin %>
    }
  ],
  "projections": {
    "monthlyRevenue": <projected monthly revenue>,
    "monthlyProfit": <projected monthly profit>,
    "breakEvenUnits": <units to break even>,
    "breakEvenRevenue": <revenue to break even>
  },
  "recommendations": ["<recommendation1>", "<recommendation2>"],
  "alerts": [
    {
      "type": "warning" | "critical" | "info",
      "message": "<alert message>",
      "action": "<recommended action>"
    }
  ]
}

Analysis rules:
- Use validated margin calculations from backend
- Flag products with margin < 20%
- Flag products with profit < €2
- Consider platform fees (15%), shipping, and taxes
- Provide actionable cost-cutting recommendations
- Calculate break-even including €50/month fixed costs`;
  }

  private buildPrompt(
    input: Record<string, unknown>,
    validatedMargins: Array<{
      productName: string;
      sellingPrice: number;
      costPrice: number;
      profit: number;
      marginPercent: number;
    }>
  ): string {
    const parts = [
      `Analyze finances for this ecommerce business:`,
      ``,
      `## Products (with validated margins)`,
      validatedMargins
        .map(
          (m) =>
            `- ${m.productName}: Sell €${m.sellingPrice}, Cost €${m.costPrice}, Profit €${m.profit}, Margin ${m.marginPercent}%`
        )
        .join("\n"),
    ];

    if (input.fixedCosts) {
      parts.push(`\nFixed Costs: €${input.fixedCosts}/month`);
    }

    if (input.monthlyOrders) {
      parts.push(`Monthly Orders: ${input.monthlyOrders}`);
    }

    if (input.adSpend) {
      parts.push(`Ad Spend: €${input.adSpend}/month`);
    }

    parts.push(``);
    parts.push(`Provide your financial analysis as a JSON object.`);

    return parts.join("\n");
  }
}
