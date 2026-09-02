// Prompt Pipeline
// §28, §29: Connects MiniAI preprocessing to LLM prompt building.
// Flow: User message → MiniAI (intent/entities) → Context selection → Prompt Builder → LLM

import { getMiniAIEngine } from "./mini-ai/engine";
import { getMiniAIRegistry } from "./mini-ai/registry";

export interface PipelineInput {
  message: string;
  agentId: string;
  workspaceId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface PipelineResult {
  /** The enriched system prompt to send to the LLM */
  systemPrompt: string;
  /** The original user message (unchanged) */
  userMessage: string;
  /** Detected intent from MiniAI classification */
  intent?: string;
  /** Intent confidence score */
  intentConfidence?: number;
  /** Extracted entities from the message */
  entities?: Record<string, unknown>;
  /** Whether MiniAI preprocessing was used */
  miniAiUsed: boolean;
  /** Any warnings from the pipeline */
  warnings: string[];
}

// Intent categories for the classifier
const INTENT_CATEGORIES = [
  "greeting",
  "question",
  "task_request",
  "product_inquiry",
  "marketing_request",
  "financial_query",
  "inventory_check",
  "analysis_request",
  "creative_request",
  "complaint",
  "feedback",
  "general",
];

/**
 * MiniAI preprocessing pipeline.
 * Runs intent classification and entity extraction before LLM call.
 * Uses deterministic mode for speed (no LLM cost for preprocessing).
 */
export async function preprocessMessage(input: PipelineInput): Promise<PipelineResult> {
  const warnings: string[] = [];
  let intent: string | undefined;
  let intentConfidence: number | undefined;
  let miniAiUsed = false;

  const registry = getMiniAIRegistry();

  // Only run MiniAI if classifier is available
  if (registry.has("classifier")) {
    try {
      const engine = getMiniAIEngine();
      const result = await engine.execute("classifier", {
        input: {
          text: input.message,
          categories: INTENT_CATEGORIES,
          context: `Agent: ${input.agentId}`,
        },
      });

      if (result.success) {
        intent = result.output.bestCategory as string;
        intentConfidence = result.confidence;
        miniAiUsed = true;
      }
    } catch {
      warnings.push("MiniAI classification failed, proceeding without preprocessing");
    }
  }

  // Extract entities (simple regex-based for V1, deterministic)
  const entities = extractEntities(input.message);

  return {
    systemPrompt: "", // Built by buildEnrichedPrompt
    userMessage: input.message,
    intent,
    intentConfidence,
    entities,
    miniAiUsed,
    warnings,
  };
}

/**
 * Extract entities from user message using simple patterns.
 * V1: regex-based extraction. V2: use NER MiniAI.
 */
function extractEntities(message: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Product names (quoted or capitalized phrases)
  const productMatch = message.match(/"([^"]+)"/g) || message.match(/'([^']+)'/g);
  if (productMatch) {
    entities.products = productMatch.map((m) => m.replace(/['"]/g, ""));
  }

  // URLs
  const urlMatch = message.match(/https?:\/\/[^\s]+/g);
  if (urlMatch) {
    entities.urls = urlMatch;
  }

  // Email addresses
  const emailMatch = message.match(/\b[\w.-]+@[\w.-]+\.\w+\b/g);
  if (emailMatch) {
    entities.emails = emailMatch;
  }

  // Numbers (potential quantities, prices)
  const numberMatch = message.match(/\b\d+(?:\.\d+)?(?:\s*[%$€£])?\b/g);
  if (numberMatch) {
    entities.numbers = numberMatch;
  }

  // Dates (simple patterns)
  const dateMatch = message.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g);
  if (dateMatch) {
    entities.dates = dateMatch;
  }

  return entities;
}

/**
 * Build an enriched system prompt using MiniAI preprocessing results.
 * Injects intent context and entity awareness into the agent's prompt.
 */
export function buildEnrichedPrompt(
  basePrompt: string,
  pipelineResult: PipelineResult,
): string {
  const parts: string[] = [basePrompt];

  // Inject intent context if detected with high confidence
  if (pipelineResult.intent && pipelineResult.intentConfidence && pipelineResult.intentConfidence > 0.5) {
    parts.push(
      ``,
      `## Message Analysis`,
      `Detected intent: ${pipelineResult.intent} (confidence: ${(pipelineResult.intentConfidence * 100).toFixed(0)}%)`,
    );

    // Add intent-specific instructions
    switch (pipelineResult.intent) {
      case "task_request":
        parts.push(`The user is requesting a task. Break it down into actionable steps.`);
        break;
      case "question":
        parts.push(`The user is asking a question. Provide a clear, direct answer.`);
        break;
      case "complaint":
        parts.push(`The user has a concern. Acknowledge it empathetically and offer solutions.`);
        break;
      case "product_inquiry":
        parts.push(`The user is asking about a product. Provide detailed product information.`);
        break;
      case "marketing_request":
        parts.push(`The user wants marketing help. Focus on strategy and creative suggestions.`);
        break;
      case "financial_query":
        parts.push(`The user has a financial question. Be precise with numbers and data.`);
        break;
    }
  }

  // Inject extracted entities if found
  if (pipelineResult.entities && Object.keys(pipelineResult.entities).length > 0) {
    const entityLines: string[] = [];
    if (pipelineResult.entities.products) {
      entityLines.push(`Products mentioned: ${JSON.stringify(pipelineResult.entities.products)}`);
    }
    if (pipelineResult.entities.urls) {
      entityLines.push(`URLs referenced: ${JSON.stringify(pipelineResult.entities.urls)}`);
    }
    if (pipelineResult.entities.numbers) {
      entityLines.push(`Numbers found: ${JSON.stringify(pipelineResult.entities.numbers)}`);
    }
    if (entityLines.length > 0) {
      parts.push(``, `## Extracted Entities`, ...entityLines);
    }
  }

  return parts.join("\n");
}
