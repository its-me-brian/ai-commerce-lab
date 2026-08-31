// Agent Engine
// Orchestrates agent execution, manages tasks, and coordinates with AI Router.
// Uses Supabase as the source of truth for tasks, runs, and agent config.

import { supabase } from "../../database/supabase";
import { getRouter, type RouterConfig } from "../../ai/router";
import { getToolRegistry } from "../../tools/bootstrap";
import type { BaseAgent } from "./agent";
import type {
  AgentContext,
  AgentResult,
  AgentConfiguration,
} from "./types";
import type { AIProviderSlug } from "../../ai/types";
import { randomUUID } from "crypto";

export class AgentEngine {
  /**
   * Execute an agent task end-to-end:
   * 1. Create task in Supabase
   * 2. Load agent config from Supabase
   * 3. Execute agent via router
   * 4. Save run to Supabase
   * 5. Complete task in Supabase
   */
  async executeTask(
    agent: BaseAgent,
    input: Record<string, unknown>,
    options?: { taskType?: string }
  ): Promise<{ taskId: string; result: AgentResult }> {
    const taskId = randomUUID();
    const startTime = Date.now();
    const taskType = options?.taskType || "general";

    // 1. Create task in Supabase
    await supabase.from("agent_tasks").insert({
      id: taskId,
      agent_id: agent.metadata.id,
      status: "running",
      task_type: taskType,
      input,
      started_at: new Date().toISOString(),
    });

    // 2. Validate input
    const validationErrors = agent.validateInput(input);
    if (validationErrors.length > 0) {
      const errorMsg = `Input validation failed: ${validationErrors.join(", ")}`;
      await this.failTask(taskId, errorMsg);
      throw new Error(errorMsg);
    }

    // 3. Load config from Supabase
    const config = await this.loadAgentConfig(agent.metadata.id);

    // 4. Load tools from registry
    const toolRegistry = getToolRegistry();
    const availableTools = toolRegistry.list().map((t) => t.id);

    // 5. Build context
    const context: AgentContext = {
      taskId,
      taskType: taskType as AgentContext["taskType"],
      input,
      configuration: config,
      tools: availableTools,
    };

    try {
      // 6. Execute agent via router
      const result = await agent.execute(context);

      // 7. Save run to Supabase
      await supabase.from("agent_runs").insert({
        task_id: taskId,
        agent_id: agent.metadata.id,
        provider: result.metadata.providerUsed,
        model: result.metadata.modelUsed,
        input_tokens: result.metadata.inputTokens,
        output_tokens: result.metadata.outputTokens,
        duration_ms: result.metadata.durationMs,
        status: result.success ? "success" : "error",
      });

      // 8. Complete task in Supabase
      await supabase
        .from("agent_tasks")
        .update({
          status: result.success ? "completed" : "failed",
          output: result.structuredData || null,
          error: result.errors.length > 0 ? result.errors.join(", ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      return { taskId, result };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Save error run
      await supabase.from("agent_runs").insert({
        task_id: taskId,
        agent_id: agent.metadata.id,
        provider: config.primaryProvider,
        model: config.primaryModel,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startTime,
        status: "error",
        error: errorMsg,
      });

      // Fail task
      await this.failTask(taskId, errorMsg);

      throw error;
    }
  }

  /**
   * Load agent configuration from Supabase.
   * Resolves provider/model IDs to actual slugs/names.
   */
  private async loadAgentConfig(agentId: string): Promise<AgentConfiguration> {
    const { data: configRow, error: configError } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    if (configError || !configRow) {
      throw new Error(`Agent config not found for: ${agentId}`);
    }

    // Resolve provider/model slugs from IDs
    const { data: primaryModel } = await supabase
      .from("ai_models")
      .select("model_id")
      .eq("id", configRow.primary_model_id)
      .single();

    let fallbackModelSlug: string | undefined;
    if (configRow.fallback_model_id) {
      const { data } = await supabase
        .from("ai_models")
        .select("model_id")
        .eq("id", configRow.fallback_model_id)
        .single();
      fallbackModelSlug = data?.model_id;
    }

    return {
      agentId,
      primaryProvider: configRow.primary_provider_id as AIProviderSlug,
      primaryModel: primaryModel?.model_id || "gemini-3-flash-preview",
      fallbackProvider: configRow.fallback_provider_id
        ? (configRow.fallback_provider_id as AIProviderSlug)
        : undefined,
      fallbackModel: fallbackModelSlug,
      temperature: configRow.temperature,
      maxTokens: configRow.max_output_tokens,
    };
  }

  private async failTask(taskId: string, error: string): Promise<void> {
    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}
