// Store Builder Agent
// Creates product listings, descriptions, and store content.
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
export const StoreContentSchema = z.object({
  product: z.object({
    title: z.string(),
    description: z.string(),
    shortDescription: z.string(),
    price: z.number(),
    compareAtPrice: z.number().optional(),
    currency: z.string(),
    variants: z.array(
      z.object({
        name: z.string(),
        price: z.number(),
        sku: z.string().optional(),
      })
    ).optional(),
  }),
  seo: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    keywords: z.array(z.string()),
    slug: z.string(),
  }),
  marketing: z.object({
    headline: z.string(),
    subheadline: z.string(),
    bulletPoints: z.array(z.string()),
    socialProof: z.string().optional(),
    urgencyElement: z.string().optional(),
  }),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
});

export type StoreContent = z.infer<typeof StoreContentSchema>;

export class StoreBuilderAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "store-builder",
    name: "Store Builder",
    description: "Creates product listings and store content",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "content_generation",
      "seo_optimization",
      "product_listing",
    ],
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.productName || typeof input.productName !== "string") {
      errors.push("Product name is required");
    }
    if (input.price === undefined || typeof input.price !== "number") {
      errors.push("Price is required and must be a number");
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
    let structuredData: StoreContent;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = StoreContentSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: `Generated store content for: ${structuredData.product.title}`,
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
    return `You are an expert ecommerce copywriter and store builder.

Your job is to create compelling product listings that convert visitors into buyers.

For each product, return a JSON object with this exact structure:
{
  "product": {
    "title": "<SEO-optimized product title, max 60 chars>",
    "description": "<rich product description with HTML allowed>",
    "shortDescription": "<1-2 sentence summary>",
    "price": <selling price in EUR>,
    "compareAtPrice": <original/MSRP price for strikethrough, optional>,
    "currency": "EUR",
    "variants": [
      {
        "name": "<variant name, e.g. 'Blue / Large'>",
        "price": <variant price>,
        "sku": "<suggested SKU, optional>"
      }
    ]
  },
  "seo": {
    "metaTitle": "<SEO title, max 60 chars>",
    "metaDescription": "<SEO description, max 160 chars>",
    "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
    "slug": "<URL-friendly slug>"
  },
  "marketing": {
    "headline": "<attention-grabbing headline>",
    "subheadline": "<supporting headline>",
    "bulletPoints": ["<benefit1>", "<benefit2>", "<benefit3>", "<benefit4>"],
    "socialProof": "<e.g. 'Join 1000+ happy customers'>",
    "urgencyElement": "<e.g. 'Limited stock - order now'>"
  },
  "categories": ["<category1>", "<category2>"],
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Writing guidelines:
- Use power words: "transform", "unlock", "discover", "exclusive"
- Focus on benefits, not features
- Create urgency without being pushy
- SEO-optimize for European markets
- Price in EUR with psychological pricing (e.g., €29.99 instead of €30)`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Create store content for this product:`,
      ``,
      `Product Name: ${input.productName}`,
      `Supplier Price: $${input.supplierPrice || "unknown"}`,
      `Selling Price: €${input.price}`,
      `Category: ${input.category || "unknown"}`,
      `Target Market: ${input.targetMarket || "Europe"}`,
    ];

    if (input.features) {
      parts.push(`Key Features: ${input.features}`);
    }

    if (input.brand) {
      parts.push(`Brand: ${input.brand}`);
    }

    if (input.tone) {
      parts.push(`Tone: ${input.tone}`);
    }

    parts.push(``);
    parts.push(`Provide your store content as a JSON object.`);

    return parts.join("\n");
  }
}
