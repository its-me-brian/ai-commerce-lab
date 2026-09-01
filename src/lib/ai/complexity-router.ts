// Complexity Model Router
// Selects the optimal model based on task complexity.
//
// Maps complexity tiers to model requirements:
//   trivial  → cheapest model (e.g., gemini-3-flash, free)
//   simple   → small/cheap model (e.g., grok-3-mini, $0.30/$0.50)
//   moderate → mid-tier model (e.g., claude-3-5-haiku, $0.80/$4.00)
//   complex  → strongest model (e.g., claude-sonnet-4, $3.00/$15.00)
//
// This is the "brain" that decides which model powers each mini-AI execution.
// It uses the existing ModelMatcher for capability-based filtering.

import { findBestModel, findSingleBestModel, type ModelMatch } from "./model-matcher";
import type { MiniAIComplexity, MiniAIModelRequirements } from "../ai/mini-ai/types";

/**
 * Complexity tier configuration.
 * Maps each tier to the maximum cost and preferred characteristics.
 */
export interface ComplexityTierConfig {
  /** Maximum total cost per million tokens (input + output combined) */
  maxTotalPricePerMillion: number;

  /** Maximum cost per execution in dollars */
  maxCostPerExecution: number;

  /** Preferred capabilities for this tier */
  preferredCapabilities: string[];

  /** Minimum context window */
  minContextWindow: number;

  /** Human-readable description */
  description: string;
}

/**
 * Default complexity tier configurations.
 * These can be overridden per workspace.
 */
export const DEFAULT_COMPLEXITY_TIERS: Record<MiniAIComplexity, ComplexityTierConfig> = {
  trivial: {
    maxTotalPricePerMillion: 0.5,   // Free or near-free
    maxCostPerExecution: 0.0001,    // < $0.0001
    preferredCapabilities: ["json"],
    minContextWindow: 2000,
    description: "Cheapest model — classification, extraction, simple lookups",
  },
  simple: {
    maxTotalPricePerMillion: 1.0,   // ~$0.30-$0.50/M
    maxCostPerExecution: 0.001,     // < $0.001
    preferredCapabilities: ["json", "text"],
    minContextWindow: 4000,
    description: "Small model — keyword extraction, simple summarization, validation",
  },
  moderate: {
    maxTotalPricePerMillion: 5.0,   // ~$0.80-$4.00/M
    maxCostPerExecution: 0.01,      // < $0.01
    preferredCapabilities: ["json", "text", "vision"],
    minContextWindow: 8000,
    description: "Mid-tier model — research, analysis, content generation",
  },
  complex: {
    maxTotalPricePerMillion: 20.0,  // ~$3.00-$15.00/M
    maxCostPerExecution: 0.1,       // < $0.10
    preferredCapabilities: ["json", "text", "vision", "tool_use"],
    minContextWindow: 16000,
    description: "Strongest model — reasoning, planning, complex decision-making",
  },
};

/**
 * Result of complexity-based model selection.
 */
export interface ComplexityModelResult {
  /** Selected model match */
  match: ModelMatch;

  /** Complexity tier that was used */
  complexity: MiniAIComplexity;

  /** Estimated cost per execution */
  estimatedCostDollars: number;

  /** Reason for selection */
  reasoning: string;

  /** Fallback models available (if primary fails) */
  fallbacks: ModelMatch[];
}

/**
 * Selects the optimal model based on complexity and requirements.
 *
 * Flow:
 * 1. Map complexity → tier config (max cost, capabilities, context)
 * 2. Merge with mini-AI specific requirements
 * 3. Use ModelMatcher to find best fit
 * 4. Find fallbacks in case primary fails
 */
export async function selectModelByComplexity(
  complexity: MiniAIComplexity,
  requirements: MiniAIModelRequirements,
  tierOverrides?: Partial<ComplexityTierConfig>
): Promise<ComplexityModelResult> {
  // 1. Get tier config
  const tier = {
    ...DEFAULT_COMPLEXITY_TIERS[complexity],
    ...tierOverrides,
  };

  // 2. Merge requirements: mini-AI requirements + tier defaults
  const mergedRequirements = {
    requiredCapabilities: [
      ...(tier.preferredCapabilities || []),
      ...(requirements.requiredCapabilities || []),
    ],
    minContextWindow: Math.max(
      tier.minContextWindow,
      requirements.minContextWindow || 0
    ),
    maxInputPrice: tier.maxTotalPricePerMillion / 2, // Split roughly half/half
    maxOutputPrice: tier.maxTotalPricePerMillion / 2,
    preferredProvider: requirements.preferredProvider,
    limit: 5, // Get top 5 for fallbacks
  };

  // 3. Find best model
  const matches = await findBestModel(mergedRequirements);

  if (matches.length === 0) {
    // No model meets requirements — try with relaxed requirements
    const relaxedMatches = await findBestModel({
      ...mergedRequirements,
      requiredCapabilities: requirements.requiredCapabilities || [],
      maxInputPrice: undefined,
      maxOutputPrice: undefined,
    });

    if (relaxedMatches.length === 0) {
      throw new Error(
        `No model available for complexity: ${complexity}. ` +
        `Requirements: ${JSON.stringify(mergedRequirements)}`
      );
    }

    return {
      match: relaxedMatches[0],
      complexity,
      estimatedCostDollars: estimateCost(
        relaxedMatches[0],
        1000, // Estimate 1K input tokens
        500   // Estimate 500 output tokens
      ),
      reasoning: `No model met strict requirements for ${complexity}. Used relaxed matching.`,
      fallbacks: relaxedMatches.slice(1),
    };
  }

  // 4. Estimate cost
  const estimatedCost = estimateCost(matches[0], 1000, 500);

  return {
    match: matches[0],
    complexity,
    estimatedCostDollars: estimatedCost,
    reasoning: `Selected ${matches[0].model.name} for ${complexity} task (score: ${matches[0].score})`,
    fallbacks: matches.slice(1),
  };
}

/**
 * Select the cheapest model that meets requirements.
 * Good for trivial/simple tasks where quality is less critical.
 */
export async function selectCheapestModel(
  requirements: MiniAIModelRequirements
): Promise<ComplexityModelResult> {
  const matches = await findBestModel({
    requiredCapabilities: requirements.requiredCapabilities || [],
    minContextWindow: requirements.minContextWindow,
    preferredProvider: requirements.preferredProvider,
    limit: 10,
  });

  if (matches.length === 0) {
    throw new Error("No model available for cheapest selection");
  }

  // Already sorted by score, but re-sort by cost for cheapest
  matches.sort((a, b) => {
    const costA = a.model.input_price + a.model.output_price;
    const costB = b.model.input_price + b.model.output_price;
    return costA - costB;
  });

  const cheapest = matches[0];

  return {
    match: cheapest,
    complexity: "trivial",
    estimatedCostDollars: estimateCost(cheapest, 1000, 500),
    reasoning: `Selected cheapest model: ${cheapest.model.name} ($${cheapest.model.input_price}/$${cheapest.model.output_price} per M tokens)`,
    fallbacks: matches.slice(1),
  };
}

/**
 * Select the strongest model available.
 * Good for complex reasoning and critical decisions.
 */
export async function selectStrongestModel(
  requirements: MiniAIModelRequirements
): Promise<ComplexityModelResult> {
  const matches = await findBestModel({
    requiredCapabilities: requirements.requiredCapabilities || [],
    minContextWindow: requirements.minContextWindow,
    preferredProvider: requirements.preferredProvider,
    limit: 10,
  });

  if (matches.length === 0) {
    throw new Error("No model available for strongest selection");
  }

  // Sort by cost descending (most expensive = strongest usually)
  matches.sort((a, b) => {
    const costA = a.model.input_price + a.model.output_price;
    const costB = b.model.input_price + b.model.output_price;
    return costB - costA;
  });

  const strongest = matches[0];

  return {
    match: strongest,
    complexity: "complex",
    estimatedCostDollars: estimateCost(strongest, 1000, 500),
    reasoning: `Selected strongest model: ${strongest.model.name} ($${strongest.model.input_price}/$${strongest.model.output_price} per M tokens)`,
    fallbacks: matches.slice(1),
  };
}

/**
 * Estimate cost for a given model and token counts.
 */
function estimateCost(
  match: ModelMatch,
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (inputTokens / 1_000_000) * match.model.input_price +
    (outputTokens / 1_000_000) * match.model.output_price
  );
}

/**
 * Get human-readable description of a complexity tier.
 */
export function getComplexityDescription(complexity: MiniAIComplexity): string {
  return DEFAULT_COMPLEXITY_TIERS[complexity].description;
}
