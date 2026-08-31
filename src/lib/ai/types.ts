// AI Provider Types
// These types define the contract for all AI providers.
// Providers implement these interfaces, agents consume them.

export type AIProviderSlug = "gemini" | "anthropic" | "xai";

export type AITaskType =
  | "product_analysis"
  | "trend_analysis"
  | "price_calculation"
  | "content_generation"
  | "research"
  | "decision"
  | "general";

export interface AIGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
}

export interface AIGenerateResult {
  content: string;
  structuredData?: unknown;
  provider: AIProviderSlug;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  cached: boolean;
}

export interface AIProviderConfig {
  slug: AIProviderSlug;
  apiKey: string;
  enabled: boolean;
}

export interface AIModelConfig {
  provider: AIProviderSlug;
  modelId: string;
  name: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  enabled: boolean;
}

export interface AIConnectionTestResult {
  success: boolean;
  provider: AIProviderSlug;
  model: string;
  latencyMs: number;
  error?: string;
}
