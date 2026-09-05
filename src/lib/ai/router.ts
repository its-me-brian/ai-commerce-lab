// AI Model Router
// Central component that decides which model to use for each execution.
// FASE 10: Supports both legacy RouterConfig and new agent-based routing via agent_model_routes.

import { logger } from "../logging";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
} from "./types";
import type { AIProvider } from "./providers/base";
import { getAgentModelRoutes }from "./agent-model-routes";
import { getModelRegistry, type ModelRecord } from "./model-registry";
import { calculateModelCost } from "./model-pricing";
import { getMetricsCollector, getStructuredLogger, getExecutionTracer } from "./observability";
import { getResponseCache } from "./response-cache";
import { getProviderManager } from "./provider-manager";

// Provider class registry — maps slug to constructor (lazy-loaded from bootstrap)
let _providerClasses: Record<string, new (apiKey: string) => AIProvider> | null = null;
async function getProviderClasses(): Promise<Record<string, new (apiKey: string) => AIProvider>> {
  if (_providerClasses) return _providerClasses;
  try {
    const { GeminiProvider } = await import("./providers/gemini");
    const { ClaudeProvider } = await import("./providers/claude");
    const { GrokProvider } = await import("./providers/grok");
    const { WorkersAIProvider } = await import("./providers/workers-ai");
    const { OpenAICompatibleProvider } = await import("./providers/openai-compatible");
    _providerClasses = {
      gemini: GeminiProvider,
      anthropic: ClaudeProvider,
      xai: GrokProvider,
      "workers-ai": WorkersAIProvider,
      "openai-compatible": OpenAICompatibleProvider as unknown as new (apiKey: string) => AIProvider,
    };
  } catch {
    _providerClasses = {};
  }
  return _providerClasses;
}

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

      // Record telemetry metrics
      const metrics = getMetricsCollector();
      const cost = calculateModelCost(config.primaryModel, result.inputTokens, result.outputTokens);
      metrics.record("router.execution.count", 1, { provider: config.primaryProvider, model: config.primaryModel, status: "success" });
      metrics.record("router.execution.latency_ms", Date.now() - startTime, { provider: config.primaryProvider, model: config.primaryModel });
      metrics.record("router.execution.cost_dollars", cost, { provider: config.primaryProvider, model: config.primaryModel });
      metrics.record("router.execution.tokens", result.inputTokens + result.outputTokens, { provider: config.primaryProvider, model: config.primaryModel, direction: "total" });

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
      logger.warn(
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

      // Record telemetry metrics for fallback
      const metrics = getMetricsCollector();
      const cost = calculateModelCost(config.fallbackModel, result.inputTokens, result.outputTokens);
      metrics.record("router.execution.count", 1, { provider: config.fallbackProvider, model: config.fallbackModel, status: "fallback" });
      metrics.record("router.execution.latency_ms", Date.now() - startTime, { provider: config.fallbackProvider, model: config.fallbackModel });
      metrics.record("router.execution.cost_dollars", cost, { provider: config.fallbackProvider, model: config.fallbackModel });

      return { result, log };
    }
  }

  /**
   * FASE 10: Generate using agent_model_routes.
   * Loads routes from DB, tries each in priority order, falls back on failure.
   * PHASE 7: Checks response cache first — zero token cost on cache hit.
   * PHASE 8: Logs execution and traces spans for observability.
   */
  async generateForAgent(
    agentId: string,
    options: AIGenerateOptions,
    overrides?: { temperature?: number; maxTokens?: number; workspaceId?: string }
  ): Promise<{ result: AIGenerateResult; log: RouterExecutionLog }> {
    const startTime = Date.now();
    const structuredLogger = getStructuredLogger();
    const tracer = getExecutionTracer();

    // Start trace for this request
    const traceId = tracer.startTrace(`router:${agentId}`, {
      agentId,
      hasSystemPrompt: !!options.systemPrompt,
      promptLength: options.prompt?.length ?? 0,
    });

    // PHASE 7: Check response cache first
    const cache = getResponseCache();
    const cachedResult = cache.get(
      options.systemPrompt || "",
      options.prompt || "",
      options.model,
      overrides?.workspaceId
    );

    if (cachedResult) {
      // Cache hit — return immediately with zero token cost
      structuredLogger.log({
        severity: "info",
        component: "router",
        message: `Cache hit for agent ${agentId}`,
        traceId,
        context: { agentId },
      });

      const log: RouterExecutionLog = {
        agentId,
        provider: "cache",
        model: "cached",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        success: true,
        usedFallback: false,
        timestamp: new Date(),
      };

      const metrics = getMetricsCollector();
      metrics.record("router.cache.hit", 1, { agent: agentId });

      tracer.endSpan(traceId, true);
      return { result: cachedResult, log };
    }
    const routesManager = getAgentModelRoutes();
    const modelRegistry = getModelRegistry();

    // Load enabled routes for this agent
    const routes = await routesManager.listEnabledByAgent(agentId, overrides?.workspaceId || "");
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

      // PHASE 5: If provider not registered at startup, try dynamic resolution from workspace credentials
      let resolvedProvider: AIProvider | undefined | null = provider;
      if (!resolvedProvider && overrides?.workspaceId) {
        resolvedProvider = await this.resolveWorkspaceProvider(model.provider_id, overrides.workspaceId);
        if (!resolvedProvider) {
          logger.warn(
            `[AI Router] Provider ${model.provider_id} not registered and no workspace credential found, skipping route ${route.id}`
          );
          continue;
        }
      } else if (!resolvedProvider) {
        logger.warn(
          `[AI Router] Provider ${model.provider_id} not registered, skipping route ${route.id}`
        );
        continue;
      }

      try {
        // Start span for this route attempt
        const spanId = tracer.startSpan(
          traceId,
          traceId,
          `route:${model.provider_id}/${model.model_id}`,
          "system",
          { provider: model.provider_id, model: model.model_id, priority: route.priority }
        );

        const result = await resolvedProvider.generate({
          ...options,
          model: options.model ?? model.model_id,
          temperature: options.temperature ?? overrides?.temperature,
          maxOutputTokens: options.maxOutputTokens ?? overrides?.maxTokens,
        });

        // PHASE 7: Cache the successful response
        cache.set(
          options.systemPrompt || "",
          options.prompt || "",
          result,
          model.model_id,
          overrides?.workspaceId
        );

        const durationMs = Date.now() - startTime;
        const cost = calculateModelCost(model.model_id, result.inputTokens, result.outputTokens);

        structuredLogger.log({
          severity: "info",
          component: "router",
          message: `LLM call succeeded: ${model.provider_id}/${model.model_id}`,
          traceId,
          durationMs,
          success: true,
          context: {
            agentId,
            provider: model.provider_id,
            model: model.model_id,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            cost,
            usedFallback: route.priority > 0,
          },
        });

        tracer.endSpan(spanId, true, undefined);

        const log: RouterExecutionLog = {
          agentId,
          provider: model.provider_id,
          model: model.model_id,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs,
          success: true,
          usedFallback: route.priority > 0,
          timestamp: new Date(),
        };

        this.executionLogs.push(log);

        // Record telemetry metrics for agent routing
        const metrics = getMetricsCollector();
        metrics.record("router.execution.count", 1, { provider: model.provider_id, model: model.model_id, agent: agentId, status: "success" });
        metrics.record("router.execution.latency_ms", durationMs, { provider: model.provider_id, model: model.model_id, agent: agentId });
        metrics.record("router.execution.cost_dollars", cost, { provider: model.provider_id, model: model.model_id, agent: agentId });

        tracer.endSpan(traceId, true);
        return { result, log };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        structuredLogger.log({
          severity: "warn",
          component: "router",
          message: `Route failed: ${model.provider_id}/${model.model_id}`,
          traceId,
          success: false,
          context: {
            agentId,
            provider: model.provider_id,
            model: model.model_id,
            error: lastError.message,
          },
        });

        continue;
      }
    }

    // All routes failed
    const durationMs = Date.now() - startTime;

    structuredLogger.log({
      severity: "error",
      component: "router",
      message: `All routes failed for agent ${agentId}`,
      traceId,
      durationMs,
      success: false,
      context: {
        agentId,
        routeCount: routes.length,
        lastError: lastError?.message,
      },
    });

    tracer.endSpan(traceId, false, lastError?.message);

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

  /**
   * PHASE 5: Dynamically resolve a provider using workspace credentials from DB.
   * Checks env var first, then looks up ai_provider_credentials for the workspace.
   * Returns a provider instance ready to generate, or null if no credential found.
   */
  private async resolveWorkspaceProvider(
    providerId: string,
    workspaceId: string
  ): Promise<AIProvider | null> {
    const providerManager = getProviderManager();
    const providerRecord = await providerManager.getById(providerId);
    if (!providerRecord) return null;

    const { key } = await providerManager.resolveApiKey(providerRecord, workspaceId);
    if (!key) return null;

    // Instantiate the correct provider class
    const classes = await getProviderClasses();
    const ProviderClass = classes[providerRecord.slug];

    if (ProviderClass) {
      logger.info(`[AI Router] Resolved provider ${providerRecord.slug} from workspace credential (env: ${providerRecord.api_key_env_var})`);
      return new ProviderClass(key);
    }

    // Fallback: OpenAI-compatible provider if base_url is set
    if (providerRecord.base_url) {
      try {
        const { OpenAICompatibleProvider } = await import("./providers/openai-compatible");
        logger.info(`[AI Router] Resolved OpenAI-compatible provider ${providerRecord.slug} from workspace credential`);
        return new OpenAICompatibleProvider(
          providerRecord.slug,
          key,
          providerRecord.base_url,
          providerRecord.name,
          (providerRecord.config as Record<string, unknown>)?.defaultModel as string | undefined
        );
      } catch {
        // Import failed
      }
    }

    return null;
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
