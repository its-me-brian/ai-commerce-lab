// AIProvider Interface
// All providers MUST implement this interface.
// Agents NEVER call providers directly — they go through AIModelRouter.

import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

export abstract class AIProvider {
  abstract readonly slug: AIProviderSlug;
  abstract readonly name: string;

  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  abstract generate(options: AIGenerateOptions): Promise<AIGenerateResult>;

  abstract testConnection(model: string): Promise<AIConnectionTestResult>;

  abstract getAvailableModels(): Promise<
    Array<{
      id: string;
      name: string;
      contextWindow: number;
    }>
  >;

  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }
}
