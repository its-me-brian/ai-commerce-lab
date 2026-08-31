// Marketing Agent
// Generates ad copy, hooks, and marketing campaigns.
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
export const MarketingContentSchema = z.object({
  hooks: z.array(
    z.object({
      text: z.string(),
      platform: z.enum(["facebook", "tiktok", "instagram", "google", "email", "all"]),
      style: z.enum(["curiosity", "urgency", "social_proof", "pain_point", "transformation"]),
    })
  ),
  adCopy: z.object({
    headline: z.string(),
    primaryText: z.string(),
    description: z.string(),
    callToAction: z.string(),
  }),
  emailSequence: z.array(
    z.object({
      subject: z.string(),
      previewText: z.string(),
      body: z.string(),
      purpose: z.enum(["welcome", "nurture", "conversion", "retention", "winback"]),
    })
  ),
  socialPosts: z.array(
    z.object({
      platform: z.enum(["instagram", "tiktok", "facebook", "twitter", "linkedin"]),
      content: z.string(),
      hashtags: z.array(z.string()),
      bestTime: z.string(),
    })
  ),
  campaignStrategy: z.object({
    name: z.string(),
    objective: z.string(),
    budget: z.string(),
    duration: z.string(),
    targetAudience: z.string(),
    kpis: z.array(z.string()),
  }),
});

export type MarketingContent = z.infer<typeof MarketingContentSchema>;

export class MarketingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "marketing",
    name: "Marketing Agent",
    description: "Generates ad copy, hooks, and campaigns",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "content_generation",
      "ad_copy",
      "email_marketing",
      "social_media",
    ],
    // Hierarchy: department head, reports to CEO
    parentAgentId: "ceo",
    agentType: "department",
    department: "marketing",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.productName || typeof input.productName !== "string") {
      errors.push("Product name is required");
    }
    if (!input.targetAudience || typeof input.targetAudience !== "string") {
      errors.push("Target audience is required");
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
    let structuredData: MarketingContent;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = MarketingContentSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    return {
      success: true,
      output: result.content,
      structuredData,
      reasoningSummary: `Generated marketing campaign: ${structuredData.campaignStrategy.name}`,
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
    return `You are an expert direct-response marketer specializing in ecommerce dropshipping.

Your job is to create marketing content that drives traffic and conversions.

For each product, return a JSON object with this exact structure:
{
  "hooks": [
    {
      "text": "<attention-grabbing hook>",
      "platform": "facebook" | "tiktok" | "instagram" | "google" | "email" | "all",
      "style": "curiosity" | "urgency" | "social_proof" | "pain_point" | "transformation"
    }
  ],
  "adCopy": {
    "headline": "<short punchy headline>",
    "primaryText": "<main ad copy, 3-5 sentences>",
    "description": "<additional context>",
    "callToAction": "<CTA button text>"
  },
  "emailSequence": [
    {
      "subject": "<email subject line>",
      "previewText": "<preview text>",
      "body": "<email body with placeholders for name>",
      "purpose": "welcome" | "nurture" | "conversion" | "retention" | "winback"
    }
  ],
  "socialPosts": [
    {
      "platform": "instagram" | "tiktok" | "facebook" | "twitter" | "linkedin",
      "content": "<post content>",
      "hashtags": ["<hashtag1>", "<hashtag2>"],
      "bestTime": "<e.g. '6-8 PM local time'>"
    }
  ],
  "campaignStrategy": {
    "name": "<campaign name>",
    "objective": "<campaign objective>",
    "budget": "<suggested budget>",
    "duration": "<campaign duration>",
    "targetAudience": "<detailed audience description>",
    "kpis": ["<kpi1>", "<kpi2>"]
  }
}

Writing rules:
- Use emotional triggers: FOMO, curiosity, transformation, social proof
- Keep headlines under 10 words
- Use power words: "unlock", "discover", "exclusive", "limited"
- Include specific numbers when possible ("50% off", "10,000+ sold")
- Create urgency without being spammy`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Create marketing content for this product:`,
      ``,
      `Product: ${input.productName}`,
      `Price: €${input.price || "unknown"}`,
      `Target Audience: ${input.targetAudience}`,
      `Platform: ${input.platform || "all"}`,
      `Campaign Goal: ${input.campaignGoal || "sales"}`,
    ];

    if (input.productBenefits) {
      parts.push(`Key Benefits: ${input.productBenefits}`);
    }

    if (input.competitors) {
      parts.push(`Competitors: ${input.competitors}`);
    }

    if (input.budget) {
      parts.push(`Budget: ${input.budget}`);
    }

    if (input.tone) {
      parts.push(`Tone: ${input.tone}`);
    }

    parts.push(``);
    parts.push(`Provide your marketing content as a JSON object.`);

    return parts.join("\n");
  }
}
