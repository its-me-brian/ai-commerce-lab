// Agent Engine
// Orchestrates agent execution, manages tasks, and coordinates with AI Router.
// Uses Supabase as the source of truth for tasks, runs, and agent config.
//
// Flow:
//   agentId → AgentRegistry → Agent
//   agentId → Supabase config → Provider/Model resolution → Router → LLM

import { supabase } from "../../database/supabase";
import { getToolRegistry } from "../../tools/bootstrap";
import { getPermissionChecker } from "../../permissions/checker";
import { getAgentRegistry } from "../../ai/bootstrap";
import type { AgentContext, AgentResult, AgentConfiguration } from "./types";
import type { AIProviderSlug } from "../../ai/types";
import { randomUUID } from "crypto";

export class AgentEngine {
  /**
   * Execute an agent task end-to-end:
   * 1. Resolve agent from Registry (never accept arbitrary agent object)
   * 2. Validate input
   * 3. Load config from Supabase
   * 4. Resolve provider/model slugs from DB IDs
   * 5. Check permissions
   * 6. Create Task
   * 7. Create Run
   * 8. Execute agent via Router
   * 9. Persist result
   * 10. Update Task/Run status
   */
  async executeTask(
    agentId: string,
    input: Record<string, unknown>,
    options?: { taskType?: string }
  ): Promise<{ taskId: string; result: AgentResult }> {
    const taskId = randomUUID();
    const startTime = Date.now();
    const taskType = options?.taskType || "general";

    // 1. Resolve agent from Registry (source of truth)
    const registry = getAgentRegistry();
    const agent = registry.get(agentId);

    if (!agent) {
      throw new Error(`Agent not found in registry: ${agentId}`);
    }

    if (!agent.isEnabled()) {
      throw new Error(`Agent is not enabled: ${agentId}`);
    }

    // 2. Validate input
    const validationErrors = agent.validateInput(input);
    if (validationErrors.length > 0) {
      const errorMsg = `Input validation failed: ${validationErrors.join(", ")}`;
      await this.createAndFailTask(taskId, agentId, taskType, input, errorMsg);
      throw new Error(errorMsg);
    }

    // 3. Create task in Supabase
    const { error: taskError } = await supabase.from("agent_tasks").insert({
      id: taskId,
      agent_id: agentId,
      status: "running",
      task_type: taskType,
      input,
      started_at: new Date().toISOString(),
    });

    if (taskError) {
      throw new Error(`Failed to create task: ${taskError.message}`);
    }

    // 4. Load config from Supabase with proper provider/model resolution
    const config = await this.loadAgentConfig(agentId);

    // 5. Check permissions
    const permissionChecker = getPermissionChecker();
    const toolRegistry = getToolRegistry();
    const availableTools = toolRegistry.list().map((t) => t.id);

    const permissionCheck = await permissionChecker.validateExecution(agentId, {
      tools: availableTools,
      provider: config.primaryProvider,
    });

    if (!permissionCheck.allowed) {
      const errorMsg = `Permission denied: ${permissionCheck.denied.join(", ")}`;
      await this.failTask(taskId, errorMsg);
      throw new Error(errorMsg);
    }

    // 6. Build context
    const context: AgentContext = {
      taskId,
      taskType: taskType as AgentContext["taskType"],
      input,
      configuration: config,
      tools: availableTools,
    };

    try {
      // 7. Execute agent via router
      const result = await agent.execute(context);

      // 8. Persist run with cost calculation
      const inputTokens = result.metadata.inputTokens;
      const outputTokens = result.metadata.outputTokens;
      const totalTokens = inputTokens + outputTokens;
      const cost = this.calculateCost(
        inputTokens, outputTokens,
        config.inputPricePerMillion, config.outputPricePerMillion
      );

      const { error: runError } = await supabase.from("agent_runs").insert({
        task_id: taskId,
        agent_id: agentId,
        provider: result.metadata.providerUsed,
        model: result.metadata.modelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        duration_ms: result.metadata.durationMs,
        cost,
        status: result.success ? "completed" : "failed",
      });

      if (runError) {
        console.error(`[AgentEngine] Failed to persist run: ${runError.message}`);
      }

      // 9. Update task status with cost
      const { error: updateError } = await supabase
        .from("agent_tasks")
        .update({
          status: result.success ? "completed" : "failed",
          output: result.structuredData || null,
          error: result.errors.length > 0 ? result.errors.join(", ") : null,
          total_cost: cost,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (updateError) {
        console.error(`[AgentEngine] Failed to update task: ${updateError.message}`);
      }

      return { taskId, result };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Persist error run
      const { error: runError } = await supabase.from("agent_runs").insert({
        task_id: taskId,
        agent_id: agentId,
        provider: config.primaryProvider,
        model: config.primaryModel,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startTime,
        status: "failed",
        error: errorMsg,
      });

      if (runError) {
        console.error(`[AgentEngine] Failed to persist error run: ${runError.message}`);
      }

      // Fail task
      await this.failTask(taskId, errorMsg);

      throw error;
    }
  }

  /**
   * Load agent configuration from Supabase.
   * Resolves provider/model IDs → slugs via JOIN with ai_providers/ai_models.
   */
  private async loadAgentConfig(agentId: string): Promise<AgentConfiguration> {
    // Load config + resolve provider slug + model pricing in one query
    const { data: configRow, error: configError } = await supabase
      .from("agent_configs")
      .select(`
        *,
        primary_provider:ai_providers!agent_configs_primary_provider_id_fkey(slug),
        primary_model:ai_models!agent_configs_primary_model_id_fkey(model_id, input_price, output_price),
        fallback_provider:ai_providers!agent_configs_fallback_provider_id_fkey(slug),
        fallback_model:ai_models!agent_configs_fallback_model_id_fkey(model_id)
      `)
      .eq("agent_id", agentId)
      .single();

    if (configError || !configRow) {
      throw new Error(`Agent config not found for: ${agentId}`);
    }

    // Resolve provider slug from joined data
    const primaryProviderSlug = (configRow.primary_provider as { slug: string } | null)?.slug;
    if (!primaryProviderSlug) {
      throw new Error(`Primary provider not found for agent: ${agentId}`);
    }

    // Resolve model ID + pricing from joined data
    const primaryModel = configRow.primary_model as { model_id: string; input_price: number; output_price: number } | null;
    const primaryModelId = primaryModel?.model_id;
    if (!primaryModelId) {
      throw new Error(`Primary model not found for agent: ${agentId}`);
    }

    // Resolve fallback if configured
    let fallbackProviderSlug: AIProviderSlug | undefined;
    let fallbackModelId: string | undefined;

    if (configRow.fallback_provider_id && configRow.fallback_model_id) {
      const fp = configRow.fallback_provider as { slug: string } | null;
      const fm = configRow.fallback_model as { model_id: string } | null;
      if (fp?.slug && fm?.model_id) {
        fallbackProviderSlug = fp.slug as AIProviderSlug;
        fallbackModelId = fm.model_id;
      }
    }

    return {
      agentId,
      primaryProvider: primaryProviderSlug as AIProviderSlug,
      primaryModel: primaryModelId,
      fallbackProvider: fallbackProviderSlug,
      fallbackModel: fallbackModelId,
      temperature: configRow.temperature,
      maxTokens: configRow.max_output_tokens,
      inputPricePerMillion: primaryModel?.input_price || 0,
      outputPricePerMillion: primaryModel?.output_price || 0,
    };
  }

  /**
   * Create a task and immediately mark it as failed.
   * Used when pre-execution checks fail.
   */
  private async createAndFailTask(
    taskId: string,
    agentId: string,
    taskType: string,
    input: Record<string, unknown>,
    error: string
  ): Promise<void> {
    await supabase.from("agent_tasks").insert({
      id: taskId,
      agent_id: agentId,
      status: "failed",
      task_type: taskType,
      input,
      error,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  private async failTask(taskId: string, error: string): Promise<void> {
    const { error: updateError } = await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      console.error(`[AgentEngine] Failed to mark task as failed: ${updateError.message}`);
    }
  }

  /**
   * Calculate cost from token usage and model pricing.
   * Prices are per million tokens. Returns 0 if pricing is unavailable.
   */
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePerMillion: number,
    outputPricePerMillion: number
  ): number {
    if (inputPricePerMillion === 0 && outputPricePerMillion === 0) {
      return 0; // Free tier or unknown pricing
    }

    const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;

    // Round to 6 decimal places for currency precision
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }
}
