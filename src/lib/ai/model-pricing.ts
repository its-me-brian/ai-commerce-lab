// Model Pricing Table
// F8: Real pricing per provider/model — replaces hardcoded estimates.
//
// Prices are per million tokens.
// Sources: official pricing pages (as of 2025-07).
//
// Usage:
//   const cost = calculateModelCost("gemini-3-flash", 1000, 500);
//   // → 0 (free tier)
//
// Adding new models: just add an entry to MODEL_PRICING.

export interface ModelPricing {
  /** Input cost per million tokens */
  inputPerMillion: number;
  /** Output cost per million tokens */
  outputPerMillion: number;
  /** Human-readable label (for logs/debugging) */
  label: string;
}

/**
 * Static pricing table keyed by model_id.
 * Prices are in USD per million tokens.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ============================================
  // GEMINI (Google)
  // ============================================
  "gemini-3-flash": {
    inputPerMillion: 0,     // Free tier
    outputPerMillion: 0,
    label: "Gemini 3 Flash (free tier)",
  },
  "gemini-2.5-pro": {
    inputPerMillion: 1.25,
    outputPerMillion: 10.0,
    label: "Gemini 2.5 Pro",
  },
  "gemini-2.5-flash": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    label: "Gemini 2.5 Flash",
  },
  "gemini-2.0-flash": {
    inputPerMillion: 0.10,
    outputPerMillion: 0.40,
    label: "Gemini 2.0 Flash",
  },

  // ============================================
  // CLAUDE (Anthropic)
  // ============================================
  "claude-3-5-haiku": {
    inputPerMillion: 0.80,
    outputPerMillion: 4.0,
    label: "Claude 3.5 Haiku",
  },
  "claude-sonnet-4": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    label: "Claude Sonnet 4",
  },
  "claude-opus-4": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    label: "Claude Opus 4",
  },
  "claude-3-haiku": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    label: "Claude 3 Haiku",
  },

  // ============================================
  // GROK (xAI)
  // ============================================
  "grok-3-mini": {
    inputPerMillion: 0.30,
    outputPerMillion: 0.50,
    label: "Grok 3 Mini",
  },
  "grok-3": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    label: "Grok 3",
  },

  // ============================================
  // QWEN (Alibaba)
  // ============================================
  "qwen-turbo": {
    inputPerMillion: 0.002,
    outputPerMillion: 0.006,
    label: "Qwen Turbo",
  },
  "qwen-plus": {
    inputPerMillion: 0.004,
    outputPerMillion: 0.012,
    label: "Qwen Plus",
  },
  "qwen-max": {
    inputPerMillion: 0.024,
    outputPerMillion: 0.048,
    label: "Qwen Max",
  },
  "qwen-vl-plus": {
    inputPerMillion: 0.008,
    outputPerMillion: 0.016,
    label: "Qwen VL Plus",
  },
};

/** Default pricing when model is not in the table */
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 0.50,
  outputPerMillion: 2.0,
  label: "Unknown model (default)",
};

/**
 * Look up pricing for a model.
 * Returns the model's pricing or a reasonable default.
 */
export function getModelPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

/**
 * Calculate cost in dollars for a given model and token usage.
 *
 * @param modelId - The model identifier (e.g., "gemini-3-flash")
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in dollars
 */
export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(modelId);
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
