// AI Model Router
// Central component that decides which model to use for each execution.
// Handles primary/fallback logic and logging.

import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
} from "./types";
import type { AIProvider } from "./providers/base";

export interface RouterConfig {
  agentId: string;
  primaryProvider: AIProviderSlug;
  primaryModel: string;
  fallbackProvider?: AIProviderSlug;
  fallbackModel?: string;
  temperature: number;
  maxTokens: number;
}

export interface RouterExecutionLog {
  agentId: string;
  provider: AIProviderSlug;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
  usedFallback: boolean;
  error?: string;
  timestamp: Date;
}

export class AIModelRouter {
  private providers: Map<AIProviderSlug, AIProvider> = new Map();
  private executionLogs: RouterExecutionLog[] = [];

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.slug, provider);
  }

  getProvider(slug: AIProviderSlug): AIProvider | undefined {
    return this.providers.get(slug);
  }

  async generate(
    config: RouterConfig,
    options: AIGenerateOptions
  ): Promise<{ result: AIGenerateResult; log: RouterExecutionLog }> {
    const startTime = Date.now();

    // Try primary provider first
    try {
      const primaryProvider = this.providers.get(config.primaryProvider);
      if (!primaryProvider) {
        throw new Error(`Provider ${config.primaryProvider} not registered`);
      }

      const result = await primaryProvider.generate({
        ...options,
        model: options.model ?? config.primaryModel,
        temperature: options.temperature ?? config.temperature,
        maxOutputTokens: options.maxOutputTokens ?? config.maxTokens,
      });

      const log: RouterExecutionLog = {
        agentId: config.agentId,
        provider: config.primaryProvider,
        model: config.primaryModel,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - startTime,
        success: true,
        usedFallback: false,
        timestamp: new Date(),
      };

      this.executionLogs.push(log);
      return { result, log };
    } catch (primaryError) {
      // If no fallback configured, throw
      if (!config.fallbackProvider || !config.fallbackModel) {
        const log: RouterExecutionLog = {
          agentId: config.agentId,
          provider: config.primaryProvider,
          model: config.primaryModel,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - startTime,
          success: false,
          usedFallback: false,
          error:
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError),
          timestamp: new Date(),
        };
        this.executionLogs.push(log);
        throw primaryError;
      }

      // Try fallback
      console.warn(
        `[AI Router] Primary provider ${config.primaryProvider} failed, trying fallback ${config.fallbackProvider}`
      );

      const fallbackProvider = this.providers.get(config.fallbackProvider);
      if (!fallbackProvider) {
        throw new Error(
          `Fallback provider ${config.fallbackProvider} not registered`
        );
      }

      const result = await fallbackProvider.generate({
        ...options,
        model: options.model ?? config.fallbackModel,
        temperature: options.temperature ?? config.temperature,
        maxOutputTokens: options.maxOutputTokens ?? config.maxTokens,
      });

      const log: RouterExecutionLog = {
        agentId: config.agentId,
        provider: config.fallbackProvider,
        model: config.fallbackModel,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - startTime,
        success: true,
        usedFallback: true,
        timestamp: new Date(),
      };

      this.executionLogs.push(log);
      return { result, log };
    }
  }

  getExecutionLogs(): RouterExecutionLog[] {
    return [...this.executionLogs];
  }

  getExecutionLogsByAgent(agentId: string): RouterExecutionLog[] {
    return this.executionLogs.filter((log) => log.agentId === agentId);
  }
}

// --- Singleton ---
// Shared router instance. Initialized once per server process.

let _instance: AIModelRouter | null = null;

export function getRouter(): AIModelRouter {
  if (!_instance) {
    _instance = new AIModelRouter();
  }
  return _instance;
}
