// Multi-Agent Orchestrator
// Coordinates execution of multiple agents in sequence or parallel.
// FASE 20: Product Hunter delegates to Market Research, Supplier Research, Opportunity Scoring.

import { AgentEngine } from "../agents/core/engine";
import type { AgentResult } from "../agents/core/types";
import { bootstrap } from "./bootstrap";

export interface AgentTask {
  agentId: string;
  input: Record<string, unknown>;
  taskType?: string;
}

export interface OrchestratedResult {
  agentId: string;
  taskId: string;
  result: AgentResult;
}

export interface OrchestrationPlan {
  /** Tasks that can run in parallel */
  parallel?: AgentTask[];
  /** Tasks that must run sequentially (order matters) */
  sequential?: AgentTask[];
}

export interface OrchestrationResult {
  results: OrchestratedResult[];
  success: boolean;
  errors: string[];
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Multi-Agent Orchestrator
 * Executes a plan of agent tasks, handling dependencies and consolidation.
 */
export class MultiAgentOrchestrator {
  private engine: AgentEngine;

  constructor() {
    this.engine = new AgentEngine();
  }

  /**
   * Execute a full orchestration plan.
   */
  async execute(plan: OrchestrationPlan): Promise<OrchestrationResult> {
    await bootstrap();

    const startTime = Date.now();
    const results: OrchestratedResult[] = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Execute sequential tasks first
    if (plan.sequential) {
      for (const task of plan.sequential) {
        try {
          const { taskId, result } = await this.engine.executeTask(
            task.agentId,
            task.input,
            { taskType: task.taskType || "orchestrated" }
          );

          results.push({ agentId: task.agentId, taskId, result });
          totalInputTokens += result.metadata.inputTokens;
          totalOutputTokens += result.metadata.outputTokens;

          if (!result.success) {
            errors.push(`Agent ${task.agentId} failed: ${result.errors.join(", ")}`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Agent ${task.agentId} error: ${msg}`);
        }
      }
    }

    // Execute parallel tasks
    if (plan.parallel) {
      const parallelPromises = plan.parallel.map(async (task) => {
        try {
          const { taskId, result } = await this.engine.executeTask(
            task.agentId,
            task.input,
            { taskType: task.taskType || "orchestrated" }
          );

          return { agentId: task.agentId, taskId, result, error: null };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            agentId: task.agentId,
            taskId: "",
            result: null as unknown as AgentResult,
            error: msg,
          };
        }
      });

      const parallelResults = await Promise.all(parallelPromises);

      for (const pr of parallelResults) {
        if (pr.error) {
          errors.push(`Agent ${pr.agentId} error: ${pr.error}`);
        } else if (pr.result) {
          results.push({ agentId: pr.agentId, taskId: pr.taskId, result: pr.result });
          totalInputTokens += pr.result.metadata.inputTokens;
          totalOutputTokens += pr.result.metadata.outputTokens;

          if (!pr.result.success) {
            errors.push(`Agent ${pr.agentId} failed: ${pr.result.errors.join(", ")}`);
          }
        }
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors,
      totalDurationMs: Date.now() - startTime,
      totalInputTokens,
      totalOutputTokens,
    };
  }

  /**
   * Execute agents sequentially, passing each result as input to the next.
   * Useful for chain workflows (e.g., search → analyze → score).
   */
  async executeChain(
    tasks: AgentTask[],
    initialInput: Record<string, unknown>
  ): Promise<OrchestrationResult> {
    await bootstrap();

    const startTime = Date.now();
    const results: OrchestratedResult[] = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let currentInput = { ...initialInput };

    for (const task of tasks) {
      // Merge task input with accumulated context
      const mergedInput = { ...currentInput, ...task.input };

      try {
        const { taskId, result } = await this.engine.executeTask(
          task.agentId,
          mergedInput,
          { taskType: task.taskType || "chain" }
        );

        results.push({ agentId: task.agentId, taskId, result });
        totalInputTokens += result.metadata.inputTokens;
        totalOutputTokens += result.metadata.outputTokens;

        if (!result.success) {
          errors.push(`Agent ${task.agentId} failed: ${result.errors.join(", ")}`);
          break; // Stop chain on failure
        }

        // Pass result as context to next agent
        currentInput = {
          ...currentInput,
          [`${task.agentId}Result`]: result.structuredData,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Agent ${task.agentId} error: ${msg}`);
        break; // Stop chain on error
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors,
      totalDurationMs: Date.now() - startTime,
      totalInputTokens,
      totalOutputTokens,
    };
  }

  /**
   * Get results from a specific agent in an orchestration result.
   */
  getAgentResult(
    orchestrationResult: OrchestrationResult,
    agentId: string
  ): OrchestratedResult | undefined {
    return orchestrationResult.results.find((r) => r.agentId === agentId);
  }

  /**
   * Extract structured data from an agent's result.
   */
  getStructuredData<T = unknown>(
    orchestrationResult: OrchestrationResult,
    agentId: string
  ): T | undefined {
    const agentResult = this.getAgentResult(orchestrationResult, agentId);
    if (!agentResult) return undefined;
    return agentResult.result.structuredData as T;
  }
}

// Singleton
let instance: MultiAgentOrchestrator | null = null;

export function getMultiAgentOrchestrator(): MultiAgentOrchestrator {
  if (!instance) {
    instance = new MultiAgentOrchestrator();
  }
  return instance;
}
