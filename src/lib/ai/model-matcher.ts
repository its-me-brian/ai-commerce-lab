// Model Matcher
// Capability matching logic for selecting the optimal model for a task.
// FASE 8: Given requirements (capabilities, context window, cost), finds the best model.

import { getModelRegistry, type ModelRecord } from "./model-registry";

export interface ModelRequirements {
  /** Capabilities the model MUST have (all required) */
  requiredCapabilities: string[];
  /** Minimum context window needed */
  minContextWindow?: number;
  /** Maximum input price per million tokens */
  maxInputPrice?: number;
  /** Maximum output price per million tokens */
  maxOutputPrice?: number;
  /** Preferred provider slug (tiebreaker, not strict) */
  preferredProvider?: string;
  /** Maximum number of results to return */
  limit?: number;
}

export interface ModelMatch {
  model: ModelRecord;
  /** How many required capabilities match (higher = better) */
  capabilityScore: number;
  /** Whether all required capabilities are present */
  allCapabilitiesMatch: boolean;
  /** Whether context window meets requirement */
  contextWindowMatch: boolean;
  /** Whether cost is within budget */
  costMatch: boolean;
  /** Overall suitability score (0-100) */
  score: number;
}

/**
 * Find the best model(s) for a given set of requirements.
 * Returns models ranked by suitability score.
 */
export async function findBestModel(
  requirements: ModelRequirements
): Promise<ModelMatch[]> {
  const registry = getModelRegistry();
  const models = await registry.listEnabled();

  const matches: ModelMatch[] = [];

  for (const model of models) {
    const match = evaluateModel(model, requirements);
    if (match.score > 0) {
      matches.push(match);
    }
  }

  // Sort by score descending, then by cost ascending
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker: lower cost
    const costA = a.model.input_price + a.model.output_price;
    const costB = b.model.input_price + b.model.output_price;
    return costA - costB;
  });

  // Apply limit
  const limit = requirements.limit ?? 3;
  return matches.slice(0, limit);
}

/**
 * Find a single best model for a task.
 * Returns null if no model meets the requirements.
 */
export async function findSingleBestModel(
  requirements: ModelRequirements
): Promise<ModelMatch | null> {
  const matches = await findBestModel({ ...requirements, limit: 1 });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Check if a specific model meets the requirements.
 */
export async function modelMeetsRequirements(
  modelId: string,
  requirements: ModelRequirements
): Promise<boolean> {
  const registry = getModelRegistry();
  const model = await registry.getById(modelId);
  if (!model || !model.enabled) return false;

  const match = evaluateModel(model, requirements);
  return match.score === 100;
}

/**
 * Get all capabilities available across all enabled models.
 */
export async function getAvailableCapabilities(): Promise<string[]> {
  const registry = getModelRegistry();
  const models = await registry.listEnabled();

  const capabilities = new Set<string>();
  for (const model of models) {
    for (const cap of model.capabilities) {
      capabilities.add(cap);
    }
  }

  return Array.from(capabilities).sort();
}

/**
 * Get all models that support a specific capability.
 */
export async function getModelsByCapability(
  capability: string
): Promise<ModelRecord[]> {
  const registry = getModelRegistry();
  const models = await registry.listEnabled();
  return models.filter((m) => m.capabilities.includes(capability));
}

/**
 * Evaluate a model against requirements and return a match score.
 * Models must meet ALL hard requirements (capabilities, context, cost) to get score > 0.
 * Score is then used to rank among qualifying models.
 */
function evaluateModel(
  model: ModelRecord,
  requirements: ModelRequirements
): ModelMatch {
  const required = requirements.requiredCapabilities;

  // Check capabilities — ALL required must be present
  const matchedCaps = required.filter((cap) =>
    model.capabilities.includes(cap)
  );
  const allCapabilitiesMatch = matchedCaps.length === required.length;
  const capabilityScore =
    required.length > 0 ? matchedCaps.length / required.length : 1;

  // Check context window — must meet minimum
  const contextWindowMatch =
    !requirements.minContextWindow ||
    model.context_window >= requirements.minContextWindow;

  // Check cost — must be within budget
  const inputCostOk =
    !requirements.maxInputPrice ||
    model.input_price <= requirements.maxInputPrice;
  const outputCostOk =
    !requirements.maxOutputPrice ||
    model.output_price <= requirements.maxOutputPrice;
  const costMatch = inputCostOk && outputCostOk;

  // Hard filter: model must meet ALL requirements to be considered
  if (!allCapabilitiesMatch || !contextWindowMatch || !costMatch) {
    return {
      model,
      capabilityScore,
      allCapabilitiesMatch,
      contextWindowMatch,
      costMatch,
      score: 0,
    };
  }

  // Score is only calculated for models that meet all requirements
  // Base score: 100 for meeting all requirements
  let score = 100;

  // Provider preference bonus (adds up to 10 points)
  const providerBonus =
    requirements.preferredProvider &&
    model.provider_id === requirements.preferredProvider
      ? 10
      : 0;
  score = Math.min(100, score + providerBonus);

  return {
    model,
    capabilityScore,
    allCapabilitiesMatch,
    contextWindowMatch,
    costMatch,
    score,
  };
}
