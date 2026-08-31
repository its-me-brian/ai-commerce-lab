// Agent Engine
// Orchestrates agent execution, manages tasks, and coordinates with AI Router.

import type { AIModelRouter, RouterConfig } from "../../ai/router";
import type { BaseAgent } from "./agent";
import type {
  AgentContext,
  AgentResult,
  AgentConfiguration,
  TaskRecord,
  RunRecord,
} from "./types";
import { randomUUID } from "crypto";

export class AgentEngine {
  private router: AIModelRouter;
  private tasks: Map<string, TaskRecord> = new Map();
  private runs: Map<string, RunRecord> = new Map();

  constructor(router: AIModelRouter) {
    this.router = router;
  }

  async executeTask(
    agent: BaseAgent,
    input: Record<string, unknown>,
    config: AgentConfiguration
  ): Promise<{ task: TaskRecord; result: AgentResult; run: RunRecord }> {
    const taskId = randomUUID();
    const startTime = Date.now();

    // Create task record
    const task: TaskRecord = {
      id: taskId,
      agentId: agent.metadata.id,
      status: "running",
      taskType: "general",
      input,
      priority: 5,
      createdAt: new Date(),
      startedAt: new Date(),
    };
    this.tasks.set(taskId, task);

    try {
      // Validate input
      const validationErrors = agent.validateInput(input);
      if (validationErrors.length > 0) {
        throw new Error(`Input validation failed: ${validationErrors.join(", ")}`);
      }

      // Build router config from agent config
      const routerConfig: RouterConfig = {
        agentId: config.agentId,
        primaryProvider: config.primaryProvider,
        primaryModel: config.primaryModel,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };

      // Build agent context
      const context: AgentContext = {
        taskId,
        taskType: "general",
        input,
        configuration: config,
        tools: [],
      };

      // Execute agent
      const result = await agent.execute(context);

      // Create run record
      const run: RunRecord = {
        id: randomUUID(),
        taskId,
        agentId: agent.metadata.id,
        provider: result.metadata.providerUsed,
        model: result.metadata.modelUsed,
        inputTokens: result.metadata.inputTokens,
        outputTokens: result.metadata.outputTokens,
        durationMs: result.metadata.durationMs,
        status: "success",
        createdAt: new Date(),
      };
      this.runs.set(run.id, run);

      // Update task
      task.status = "completed";
      task.output = result;
      task.completedAt = new Date();

      return { task, result, run };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Update task as failed
      task.status = "failed";
      task.error = errorMessage;
      task.completedAt = new Date();

      // Create error run record
      const run: RunRecord = {
        id: randomUUID(),
        taskId,
        agentId: agent.metadata.id,
        provider: config.primaryProvider,
        model: config.primaryModel,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        status: "error",
        error: errorMessage,
        createdAt: new Date(),
      };
      this.runs.set(run.id, run);

      // Return error result
      const result: AgentResult = {
        success: false,
        output: "",
        errors: [errorMessage],
        metadata: {
          providerUsed: config.primaryProvider,
          modelUsed: config.primaryModel,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - startTime,
          cached: false,
        },
      };

      return { task, result, run };
    }
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  getAllTasks(): TaskRecord[] {
    return Array.from(this.tasks.values());
  }

  getAllRuns(): RunRecord[] {
    return Array.from(this.runs.values());
  }

  getTasksByAgent(agentId: string): TaskRecord[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.agentId === agentId
    );
  }

  getRunsByAgent(agentId: string): RunRecord[] {
    return Array.from(this.runs.values()).filter(
      (r) => r.agentId === agentId
    );
  }
}
