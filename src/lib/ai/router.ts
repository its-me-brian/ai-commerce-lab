// AI Model Router
// Central component that decides which model to use for each execution.
// FASE 10: Supports both legacy RouterConfig and new agent-based routing via agent_model_routes.

import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
} from "./types";
import type { AIProvider } from "./providers/base";
import { getAgentModelRoutes, type AgentModelRoute } from "./agent-model-routes";
import { getModelRegistry, type ModelRecord } from "./model-registry";

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

  /**
   * Legacy generate — uses explicit RouterConfig with primary/fallback.
   * Kept for backward compatibility with existing agents.
   */
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

  /**
   * FASE 10: Generate using agent_model_routes.
   * Loads routes from DB, tries each in priority order, falls back on failure.
   */
  async generateForAgent(
    agentId: string,
    options: AIGenerateOptions,
    overrides?: { temperature?: number; maxTokens?: number }
  ): Promise<{ result: AIGenerateResult; log: RouterExecutionLog }> {
    const startTime = Date.now();
    const routesManager = getAgentModelRoutes();
    const modelRegistry = getModelRegistry();

    // Load enabled routes for this agent
    const routes = await routesManager.listEnabledByAgent(agentId);
    if (routes.length === 0) {
      throw new Error(`No model routes configured for agent: ${agentId}`);
    }

    // Load model records to resolve provider slugs
    const modelRecords = new Map<string, ModelRecord>();
    for (const route of routes) {
      const model = await modelRegistry.getById(route.model_id);
      if (model) {
        modelRecords.set(route.model_id, model);
      }
    }

    // Try each route in priority order
    let lastError: Error | null = null;

    for (const route of routes) {
      const model = modelRecords.get(route.model_id);
      if (!model) continue;

      const provider = this.providers.get(model.provider_id);
      if (!provider) {
        console.warn(
          `[AI Router] Provider ${model.provider_id} not registered, skipping route ${route.id}`
        );
        continue;
      }

      try {
        const result = await provider.generate({
          ...options,
          model: options.model ?? model.model_id,
          temperature: options.temperature ?? overrides?.temperature,
          maxOutputTokens: options.maxOutputTokens ?? overrides?.maxTokens,
        });

        const log: RouterExecutionLog = {
          agentId,
          provider: model.provider_id,
          model: model.model_id,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: Date.now() - startTime,
          success: true,
          usedFallback: route.priority > 0,
          timestamp: new Date(),
        };

        this.executionLogs.push(log);
        return { result, log };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[AI Router] Route ${route.id} (${model.provider_id}/${model.model_id}) failed:`,
          lastError.message
        );
        continue;
      }
    }

    // All routes failed
    const log: RouterExecutionLog = {
      agentId,
      provider: routes.length > 0 ? modelRecords.get(routes[0].model_id)?.provider_id ?? "unknown" : "unknown",
      model: routes.length > 0 ? modelRecords.get(routes[0].model_id)?.model_id ?? "unknown" : "unknown",
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startTime,
      success: false,
      usedFallback: false,
      error: lastError?.message ?? "No routes available",
      timestamp: new Date(),
    };
    this.executionLogs.push(log);
    throw lastError ?? new Error(`No routes available for agent: ${agentId}`);
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
