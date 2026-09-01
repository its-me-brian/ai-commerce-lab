// Secretary Agent
// Manages supplier communication, follow-ups, and relationship tracking.
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
export const CommunicationSchema = z.object({
  emails: z.array(
    z.object({
      to: z.string(),
      subject: z.string(),
      body: z.string(),
      purpose: z.enum([
        "initial_contact",
        "price_inquiry",
        "sample_request",
        "order_placement",
        "follow_up",
        "complaint",
        "relationship_building",
      ]),
      tone: z.enum(["formal", "friendly", "firm", "urgent"]),
      language: z.enum(["en", "es"]).optional().default("en"),
    })
  ),
  talkingPoints: z.array(z.string()),
  followUpSchedule: z.array(
    z.object({
      action: z.string(),
      deadline: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    })
  ),
  riskFlags: z.array(z.string()),
  relationshipNotes: z.string(),
  summary: z.string(),
  negotiationTips: z.array(z.string()).optional(),
});

export type Communication = z.infer<typeof CommunicationSchema>;

export class SecretaryAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "secretary",
    name: "Secretary Agent",
    description: "Manages supplier communication and relationships",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "communication",
      "relationship_management",
      "follow_up",
    ],
    // Hierarchy: department head, reports to CEO
    parentAgentId: "ceo",
    agentType: "department",
    department: "operations",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.supplierName || typeof input.supplierName !== "string") {
      errors.push("Supplier name is required");
    }
    if (!input.purpose || typeof input.purpose !== "string") {
      errors.push("Communication purpose is required");
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
    let structuredData: Communication;
    try {
      const parsed = typeof result.structuredData === "string"
        ? JSON.parse(result.structuredData as string)
        : result.structuredData || JSON.parse(result.content);
      structuredData = CommunicationSchema.parse(parsed);
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
    return `You are an expert supply chain communication specialist.

Your job is to manage supplier relationships and create professional communications.

LANGUAGE SUPPORT:
- By default, write communications in ENGLISH
- If the user requests Spanish ("en español", "Spanish", "español"), write ALL emails and talking points in Spanish
- For Chinese suppliers, include both English and Spanish versions when requested
- Spanish tone should be warm and professional (tuteo for friendly, usted for formal)

NEGOTIATION STRATEGIES:
- Initial contact: Be concise, show genuine interest, mention specific products
- Price inquiry: Compare with market rates, ask for volume discounts
- Sample request: Offer to pay for samples, show serious intent
- Follow-up: Reference previous conversations, set clear next steps
- Complaint: Stay factual, propose solutions, maintain relationship
- Relationship building: Share success stories, plan long-term cooperation

For each communication request, return a JSON object with this exact structure:
{
  "emails": [
    {
      "to": "<recipient or 'supplier'>",
      "subject": "<email subject>",
      "body": "<professional email body>",
      "purpose": "initial_contact" | "price_inquiry" | "sample_request" | "order_placement" | "follow_up" | "complaint" | "relationship_building",
      "tone": "formal" | "friendly" | "firm" | "urgent",
      "language": "en" | "es"
    }
  ],
  "talkingPoints": ["<key point 1>", "<key point 2>"],
  "followUpSchedule": [
    {
      "action": "<what to do>",
      "deadline": "<when to do it>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "riskFlags": ["<potential issue 1>", "<potential issue 2>"],
  "relationshipNotes": "<notes about supplier relationship>",
  "summary": "<brief summary of communication strategy>",
  "negotiationTips": ["<tip 1>", "<tip 2>"]
}

Communication rules:
- Be professional but not robotic
- Build long-term relationships, not one-time transactions
- Always have a clear CTA in emails
- Document everything for future reference
- Flag potential issues early
- Consider cultural differences in international communication
- For Chinese suppliers: be patient, build guanxi (relationship), avoid aggressive tactics`;
  }

  private buildPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Create communication for this supplier interaction:`,
      ``,
      `Supplier: ${input.supplierName}`,
      `Platform: ${input.platform || "email"}`,
      `Purpose: ${input.purpose}`,
      `Relationship Stage: ${input.relationshipStage || "new"}`,
    ];

    if (input.productName) {
      parts.push(`Product: ${input.productName}`);
    }

    if (input.orderDetails) {
      parts.push(`Order Details: ${input.orderDetails}`);
    }

    if (input.existingRelationship) {
      parts.push(`Existing Notes: ${input.existingRelationship}`);
    }

    if (input.specificRequest) {
      parts.push(`Specific Request: ${input.specificRequest}`);
    }

    parts.push(``);
    parts.push(`Provide your communication as a JSON object.`);

    return parts.join("\n");
  }
}
