// Agent Engine
// Orchestrates agent execution, manages tasks, and coordinates with AI Router.
// Uses Supabase as the source of truth for tasks, runs, and agent config.
//
// Flow:
//   agentId → AgentRegistry → Agent
//   agentId → Supabase config → Provider/Model resolution → Router → LLM
//
// FASE 3: Builds system prompt from AgentDefinition via AgentPromptBuilder.
// FASE 18: Injects shared company context into system prompts.
// FASE 27: CEO continuity — includes recent task results for reference resolution.
// FASE 40: Auto-logs agent execution events to app_events.
// FASE 19: Injects agent memory into prompts and auto-stores decisions.

import { logger } from "../../logging";
import { supabase } from "../../database/supabase";
import { getToolRegistry } from "../../tools/bootstrap";
import { getPermissionChecker } from "../../permissions/checker";
import { getAgentRegistry } from "../../ai/bootstrap";
import { getPromptBuilder } from "./prompt-builder";
import { getWorkspaceService } from "../../workspaces/service";
import { getAgentMemoryService } from "../../ai/agent-memory";
import { logEvent } from "../../logging/event-logger";
import { getMiniAIEngine } from "../../ai/mini-ai/engine";
import { getCostBudgetTracker } from "../../ai/cost-budget";
import { withRetry, withTimeout } from "../../ai/retry";
import type { AgentContext, AgentResult, AgentConfiguration } from "./types";
import type { AIProviderSlug } from "../../ai/types";
import type { MiniAIResult } from "../../ai/mini-ai/types";
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
    options?: { taskType?: string; workspaceId?: string }
  ): Promise<{ taskId: string; result: AgentResult }> {
    const taskId = randomUUID();
    const startTime = Date.now();
    const taskType = options?.taskType || "general";
    const workspaceId = options?.workspaceId;
    if (!workspaceId) {
      throw new Error("workspaceId is required for agent execution");
    }

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
      await this.createAndFailTask(taskId, agentId, taskType, input, errorMsg, workspaceId);
      throw new Error(errorMsg);
    }

    // 3. Create task in Supabase
    const { error: taskError } = await supabase.from("agent_tasks").insert({
      id: taskId,
      agent_id: agentId,
      workspace_id: workspaceId,
      status: "running",
      task_type: taskType,
      input,
      started_at: new Date().toISOString(),
    });

    if (taskError) {
      throw new Error(`Failed to create task: ${taskError.message}`);
    }

    // 4. Load config from Supabase with proper provider/model resolution
    const config = await this.loadAgentConfig(agentId, workspaceId);

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
      await this.failTask(taskId, errorMsg, workspaceId);
      throw new Error(errorMsg);
    }

    // 5b. Budget check — pre-flight estimate before execution
    const budgetTracker = await getCostBudgetTracker();
    const estimatedCost = this.estimateExecutionCost(
      config.inputPricePerMillion,
      config.outputPricePerMillion
    );

    const budgetCheck = budgetTracker.checkBudget(agentId, "agent", estimatedCost, workspaceId);
    if (!budgetCheck.allowed) {
      const b = budgetCheck.violatedBudget;
      const errorMsg = `Budget exceeded: ${b.budget.entityType}:${b.budget.entityId} — ` +
        `${b.currentSpending.toFixed(4)}/${b.budget.maxDollars.toFixed(4)} used ` +
        `(${(b.utilizationPercent * 100).toFixed(1)}%)`;
      await this.createAndFailTask(taskId, agentId, taskType, input, errorMsg, workspaceId);
      throw new Error(errorMsg);
    }

    // 6. Build context with system prompt from definition + company context + task history
    const promptBuilder = getPromptBuilder();
    const definition = registry.getDefinition(agentId);
    let systemPrompt: string | undefined;

    if (definition) {
      const promptOutput = promptBuilder.build({
        definition,
        additionalContext: input.personalityOverrides
          ? { personalityOverrides: input.personalityOverrides }
          : undefined,
      });
      systemPrompt = promptOutput.systemPrompt;
    }

    // FASE 18: Inject shared company context into system prompt
    const contextParts: string[] = [];
    if (systemPrompt) contextParts.push(systemPrompt);

    try {
      const workspaceService = getWorkspaceService();
      const companyContext = await workspaceService.buildCompanyContext();
      const companyContextSection = workspaceService.formatContextForPrompt(companyContext);
      if (companyContextSection) contextParts.push(companyContextSection);
    } catch {
      // Workspace may not exist — continue without context
    }

    // FASE 27: CEO continuity — include recent task results for reference resolution
    if (agentId === "ceo" || agentId === "store-builder" || agentId === "marketing") {
      try {
        const { data: recentTasks } = await supabase
          .from("agent_tasks")
          .select("id, task_type, input, output, status")
          .eq("agent_id", agentId)
          .eq("workspace_id", workspaceId)
          .eq("status", "completed")
          .not("output", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentTasks && recentTasks.length > 0) {
          const lines = [`## Recent Task Results (for reference resolution)`];
          for (const task of recentTasks) {
            const taskInput = task.input as Record<string, unknown>;
            const taskOutput = task.output as Record<string, unknown> | null;
            const inputSummary = taskInput?.productName || taskInput?.goal || taskInput?.name || JSON.stringify(taskInput).slice(0, 100);
            const outputSummary = taskOutput ? JSON.stringify(taskOutput).slice(0, 200) : "No output";
            lines.push(`- Task ${String(task.id).slice(0, 8)} (${task.task_type}): ${inputSummary} → ${outputSummary}`);
          }
          contextParts.push(lines.join("\n"));
        }
      } catch {
        // Continue without task history
      }
    }

    // FASE 19: Inject agent memory — facts, preferences, patterns from past executions
    try {
      const memoryService = getAgentMemoryService();
      const memories = await memoryService.getRecent(agentId, workspaceId, 10);
      if (memories.length > 0) {
        const memoryLines = [`## Agent Memory (learned from past executions)`];
        for (const mem of memories) {
          const confidence = Math.round(mem.confidence * 100);
          memoryLines.push(`- [${mem.memory_type}] (${confidence}% confidence): ${mem.content}`);
        }
        contextParts.push(memoryLines.join("\n"));
      }
    } catch {
      // Continue without memory
    }

    systemPrompt = contextParts.length > 0 ? contextParts.join("\n\n") : undefined;

    const context: AgentContext = {
      taskId,
      taskType: taskType as AgentContext["taskType"],
      input,
      configuration: config,
      tools: availableTools,
      systemPrompt,
    };

    try {
      // 7. Execute agent via router with retry + timeout
      const result = await withRetry(
        () => withTimeout(
          () => agent.execute(context),
          120_000, // 2 minute timeout per execution
          `agent:${agentId}`
        ),
        { maxRetries: 2, baseDelayMs: 1000 },
        { agentId, operation: "agent.execute" }
      );

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
        workspace_id: workspaceId,
        provider: result.metadata.providerUsed,
        model: result.metadata.modelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        duration_ms: result.metadata.durationMs,
        cost,
        status: result.success ? "completed" : "failed",
        tools_used: result.metadata.toolsUsed || [],
      });

      if (runError) {
        logger.error(`[AgentEngine] Failed to persist run: ${runError.message}`);
      }

      // 8b. Record cost in budget tracker (post-execution)
      try {
        const alerts = budgetTracker.recordCost({
          entityId: agentId,
          entityType: "agent",
          workspaceId,
          costDollars: cost,
          provider: result.metadata.providerUsed,
          model: result.metadata.modelUsed,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          taskId,
          description: `Agent ${agentId} — ${taskType}`,
        });

        // Log budget alerts
        for (const alert of alerts) {
          await logEvent({
            eventType: "budget_alert",
            agentId,
            severity: alert.level === "exceeded" ? "critical" : alert.level === "critical" ? "error" : "warning",
            message: `Budget ${alert.level}: ${alert.entityType}:${alert.entityId} — ` +
              `${(alert.utilizationPercent * 100).toFixed(1)}% used`,
            metadata: {
              budgetId: alert.budgetId,
              currentSpending: alert.currentSpending,
              budgetLimit: alert.budgetLimit,
            },
          });
        }
      } catch {
        // Non-critical — don't fail execution if budget recording fails
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
        .eq("id", taskId)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        logger.error(`[AgentEngine] Failed to update task: ${updateError.message}`);
      }

      // FASE 40: Auto-log agent execution event
      try {
        await logEvent({
          eventType: "agent_execution",
          agentId: agentId,
          severity: result.success ? "info" : "error",
          message: `Agent ${agentId} ${result.success ? "completed" : "failed"} task ${taskType}`,
          metadata: {
            taskId,
            provider: result.metadata.providerUsed,
            model: result.metadata.modelUsed,
            inputTokens: result.metadata.inputTokens,
            outputTokens: result.metadata.outputTokens,
            durationMs: result.metadata.durationMs,
            cost,
          },
        });
      } catch {
        // Non-critical — don't fail execution if logging fails
      }

      // FASE 19: Auto-store important decisions/facts from agent output
      if (result.success && result.structuredData) {
        try {
          const memoryService = getAgentMemoryService();
          const output = result.structuredData as Record<string, unknown>;

          // Store decision if present
          if (output.decision || output.recommendation) {
            const decision = String(output.decision || output.recommendation);
            const summary = output.summary || output.explanation || JSON.stringify(output).slice(0, 500);
            await memoryService.store({
              agent_id: agentId,
              workspace_id: workspaceId,
              memory_type: "decision",
              content: `Task ${taskType}: ${decision} — ${summary}`,
              source: `task:${taskId}`,
              confidence: 0.8,
              metadata: { taskId, taskType, provider: result.metadata.providerUsed },
            });
          }

          // Store fact if present
          if (output.keyFindings && Array.isArray(output.keyFindings)) {
            for (const finding of output.keyFindings.slice(0, 3)) {
              await memoryService.store({
                agent_id: agentId,
                workspace_id: workspaceId,
                memory_type: "fact",
                content: String(finding),
                source: `task:${taskId}`,
                confidence: 0.7,
                metadata: { taskId, taskType },
              });
            }
          }
        } catch {
          // Non-critical — don't fail execution if memory storage fails
        }
      }

      return { taskId, result };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Persist error run
      const { error: runError } = await supabase.from("agent_runs").insert({
        task_id: taskId,
        agent_id: agentId,
        workspace_id: workspaceId,
        provider: config.primaryProvider,
        model: config.primaryModel,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startTime,
        status: "failed",
        error: errorMsg,
      });

      if (runError) {
        logger.error(`[AgentEngine] Failed to persist error run: ${runError.message}`);
      }

      // Fail task
      await this.failTask(taskId, errorMsg, workspaceId);

      throw error;
    }
  }

  /**
   * Load agent configuration from Supabase.
   * Resolves provider/model IDs → slugs via JOIN with ai_providers/ai_models.
   * V1: Falls back to ws-default config when workspace has none.
   */
  private async loadAgentConfig(agentId: string, workspaceId?: string): Promise<AgentConfiguration> {
    // Load config + resolve provider slug + model pricing in one query
    let { data: configRow, error: configError } = await supabase
      .from("agent_configs")
      .select(`
        *,
        primary_provider:ai_providers!agent_configs_primary_provider_id_fkey(slug),
        primary_model:ai_models!agent_configs_primary_model_id_fkey(model_id, input_price, output_price),
        fallback_provider:ai_providers!agent_configs_fallback_provider_id_fkey(slug),
        fallback_model:ai_models!agent_configs_fallback_model_id_fkey(model_id)
      `)
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId || "ws-default")
      .single();

    // V1 fallback: use ws-default config if workspace has none
    if ((configError || !configRow) && workspaceId && workspaceId !== "ws-default") {
      const { data: fallback } = await supabase
        .from("agent_configs")
        .select(`
          *,
          primary_provider:ai_providers!agent_configs_primary_provider_id_fkey(slug),
          primary_model:ai_models!agent_configs_primary_model_id_fkey(model_id, input_price, output_price),
          fallback_provider:ai_providers!agent_configs_fallback_provider_id_fkey(slug),
          fallback_model:ai_models!agent_configs_fallback_model_id_fkey(model_id)
        `)
        .eq("agent_id", agentId)
        .eq("workspace_id", "ws-default")
        .single();
      configRow = fallback;
      configError = null;
    }

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
    error: string,
    workspaceId?: string
  ): Promise<void> {
    await supabase.from("agent_tasks").insert({
      id: taskId,
      agent_id: agentId,
      workspace_id: workspaceId,
      status: "failed",
      task_type: taskType,
      input,
      error,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  private async failTask(taskId: string, error: string, workspaceId: string): Promise<void> {
    const { error: updateError } = await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      logger.error(`[AgentEngine] Failed to mark task as failed: ${updateError.message}`);
    }
  }

  /**
   * Delegate a sub-task directly to a mini-AI.
   * Lightweight alternative to full workflow execution for quick operations.
   *
   * @param agentId - The agent requesting the delegation (for logging/cost tracking)
   * @param miniAIId - The mini-AI to execute
   * @param input - Input to pass to the mini-AI
   * @returns Mini-AI result with metadata
   */
  async delegateToMiniAI(
    agentId: string,
    miniAIId: string,
    input: Record<string, unknown>
  ): Promise<MiniAIResult> {
    const engine = getMiniAIEngine();
    const result = await engine.execute(miniAIId, { input });

    // Log delegation event for observability
    try {
      await logEvent({
        eventType: "agent_miniai_delegation",
        agentId,
        severity: "info",
        message: `Agent ${agentId} delegated to mini-AI ${miniAIId}`,
        metadata: {
          miniAIId,
          success: result.success,
          executionMode: result.metadata?.executionMode,
          durationMs: result.metadata?.durationMs,
        },
      });
    } catch {
      // Non-critical — don't fail delegation if logging fails
    }

    return result;
  }

  /**
   * Execute a chain of mini-IAs in sequence.
   * Each step's output is passed as input to the next step.
   *
   * @param agentId - The agent requesting the chain execution
   * @param steps - Array of { miniAIId, input } steps
   * @returns Array of mini-AI results
   */
  async delegateChainToMiniAI(
    agentId: string,
    steps: Array<{ miniAIId: string; input: Record<string, unknown> }>
  ): Promise<MiniAIResult[]> {
    const engine = getMiniAIEngine();
    const results: MiniAIResult[] = [];

    let currentInput = steps[0]?.input || {};

    for (const step of steps) {
      const result = await engine.execute(step.miniAIId, { input: currentInput });
      results.push(result);

      // Chain: next step gets this step's output as input
      if (result.success && result.output) {
        currentInput = result.output as Record<string, unknown>;
      }
    }

    // Log chain execution
    try {
      await logEvent({
        eventType: "agent_miniai_chain",
        agentId,
        severity: "info",
        message: `Agent ${agentId} executed mini-AI chain (${steps.length} steps)`,
        metadata: {
          steps: steps.map((s) => s.miniAIId),
          allSucceeded: results.every((r) => r.success),
        },
      });
    } catch {
      // Non-critical
    }

    return results;
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

  /**
   * Estimate the cost of a single execution for budget pre-flight check.
   * Uses a conservative estimate: 2K input tokens + 1K output tokens.
   * This is a rough upper-bound for typical agent executions.
   */
  private estimateExecutionCost(
    inputPricePerMillion: number,
    outputPricePerMillion: number
  ): number {
    const estimatedInputTokens = 2_000;
    const estimatedOutputTokens = 1_000;
    return this.calculateCost(
      estimatedInputTokens, estimatedOutputTokens,
      inputPricePerMillion, outputPricePerMillion
    );
  }
}
