// CEO Agent
// Orchestrates all other agents to achieve high-level goals.
// Plans execution, coordinates agents, synthesizes results.
// This agent NEVER knows about specific AI providers — it only uses the router.

import { BaseAgent } from "./core/agent";
import type {
  AgentMetadata,
  AgentContext,
  AgentResult,
} from "./core/types";
import { getRouter } from "../ai/router";
import { getAgentRegistry } from "../ai/bootstrap";
import { z } from "zod";

// Zod schema for execution plan
export const ExecutionPlanSchema = z.object({
  goal: z.string(),
  strategy: z.string(),
  steps: z.array(
    z.object({
      agentId: z.string(),
      action: z.string(),
      inputTemplate: z.record(z.string(), z.unknown()),
      dependsOn: z.array(z.string()).optional(),
      description: z.string(),
    })
  ),
  expectedOutcome: z.string(),
  estimatedDuration: z.string(),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export class CEOAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "ceo",
    name: "CEO Agent",
    description:
      "Orchestrates all agents to achieve high-level ecommerce goals",
    status: "ready",
    enabled: true,
    version: "0.1.0",
    capabilities: [
      "orchestration",
      "planning",
      "decision_making",
      "agent_coordination",
    ],
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.goal || typeof input.goal !== "string") {
      errors.push("Goal is required");
    }
    return errors;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { input, configuration } = context;

    const router = getRouter();
    const registry = getAgentRegistry();

    // 1. Create execution plan
    const { result: planResult, log: planLog } = await router.generate(
      {
        agentId: configuration.agentId,
        primaryProvider: configuration.primaryProvider,
        primaryModel: configuration.primaryModel,
        fallbackProvider: configuration.fallbackProvider,
        fallbackModel: configuration.fallbackModel,
        temperature: configuration.temperature,
        maxTokens: configuration.maxTokens,
      },
      {
        prompt: this.buildPlanningPrompt(input),
        systemPrompt: this.getPlanningSystemPrompt(),
        responseFormat: "json",
      }
    );

    let plan: ExecutionPlan;
    try {
      const parsed = typeof planResult.structuredData === "string"
        ? JSON.parse(planResult.structuredData as string)
        : planResult.structuredData || JSON.parse(planResult.content);
      plan = ExecutionPlanSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse execution plan: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }

    // 2. Execute each step
    const results: Array<{
      step: string;
      agentId: string;
      success: boolean;
      output?: unknown;
      error?: string;
    }> = [];

    for (const step of plan.steps) {
      const agent = registry.get(step.agentId);
      if (!agent) {
        results.push({
          step: step.description,
          agentId: step.agentId,
          success: false,
          error: `Agent not found: ${step.agentId}`,
        });
        continue;
      }

      // Check dependencies
      const dependenciesMet = (step.dependsOn || []).every((depId) =>
        results.some((r) => r.agentId === depId && r.success)
      );

      if (!dependenciesMet) {
        results.push({
          step: step.description,
          agentId: step.agentId,
          success: false,
          error: "Dependencies not met",
        });
        continue;
      }

      try {
        // Merge input template with original input and previous results
        const mergedInput = {
          ...input,
          ...step.inputTemplate,
          previousResults: results
            .filter((r) => (step.dependsOn || []).includes(r.agentId))
            .map((r) => r.output),
        };

        const taskResult = await agent.execute({
          taskId: `${context.taskId}-${step.agentId}`,
          taskType: "general",
          input: mergedInput,
          configuration: {
            agentId: step.agentId,
            primaryProvider: configuration.primaryProvider,
            primaryModel: configuration.primaryModel,
            fallbackProvider: configuration.fallbackProvider,
            fallbackModel: configuration.fallbackModel,
            temperature: configuration.temperature,
            maxTokens: configuration.maxTokens,
          },
          tools: [],
        });

        results.push({
          step: step.description,
          agentId: step.agentId,
          success: taskResult.success,
          output: taskResult.structuredData,
        });
      } catch (error) {
        results.push({
          step: step.description,
          agentId: step.agentId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. Synthesize final recommendation
    const { result: synthesisResult } = await router.generate(
      {
        agentId: configuration.agentId,
        primaryProvider: configuration.primaryProvider,
        primaryModel: configuration.primaryModel,
        fallbackProvider: configuration.fallbackProvider,
        fallbackModel: configuration.fallbackModel,
        temperature: configuration.temperature,
        maxTokens: configuration.maxTokens,
      },
      {
        prompt: this.buildSynthesisPrompt(String(input.goal), plan, results),
        systemPrompt: this.getSynthesisSystemPrompt(),
        responseFormat: "json",
      }
    );

    let synthesis: Record<string, unknown>;
    try {
      synthesis =
        typeof synthesisResult.structuredData === "string"
          ? JSON.parse(synthesisResult.structuredData as string)
          : synthesisResult.structuredData || JSON.parse(synthesisResult.content);
    } catch {
      synthesis = { summary: synthesisResult.content };
    }

    return {
      success: true,
      output: synthesisResult.content,
      structuredData: {
        plan,
        executionResults: results,
        synthesis,
        completedSteps: results.filter((r) => r.success).length,
        totalSteps: results.length,
      },
      reasoningSummary: plan.strategy,
      errors: results.filter((r) => !r.success).map((r) => r.error || "Failed"),
      metadata: {
        providerUsed: planLog.provider,
        modelUsed: planLog.model,
        inputTokens: planLog.inputTokens + (synthesisResult.cached ? 0 : 0),
        outputTokens: planLog.outputTokens,
        durationMs: 0,
        cached: false,
      },
    };
  }

  private getPlanningSystemPrompt(): string {
    return `You are an expert ecommerce CEO planning agent execution.

Your job is to create an execution plan that achieves a high-level goal by coordinating specialized agents.

Available agents:
- product-hunter: Analyzes products, discovers opportunities, validates margins
- supplier-research: Finds and evaluates suppliers for products
- market-research: Analyzes market trends, competition, demand
- opportunity-scoring: Combines all research to produce GO/NO-GO decision

For each plan, return a JSON object with this exact structure:
{
  "goal": "<the high-level goal>",
  "strategy": "<1-2 sentence strategy overview>",
  "steps": [
    {
      "agentId": "<agent to execute>",
      "action": "<what the agent should do>",
      "inputTemplate": { "<key>": "<value>" },
      "dependsOn": ["<agent IDs that must complete first>"],
      "description": "<human-readable step description>"
    }
  ],
  "expectedOutcome": "<what success looks like>",
  "estimatedDuration": "<e.g. '2-3 minutes'>"
}

Rules:
- Start with market-research or product-hunter (discovery)
- Follow with supplier-research (sourcing)
- End with opportunity-scoring (decision)
- Use dependsOn for sequential dependencies
- Keep steps minimal — don't over-orchestrate
- Each step should be a complete unit of work`;
  }

  private buildPlanningPrompt(input: Record<string, unknown>): string {
    const parts = [
      `Create an execution plan for this goal:`,
      ``,
      `Goal: ${input.goal}`,
    ];

    if (input.constraints) {
      parts.push(`Constraints: ${input.constraints}`);
    }

    if (input.budget) {
      parts.push(`Budget: ${input.budget}`);
    }

    if (input.timeline) {
      parts.push(`Timeline: ${input.timeline}`);
    }

    parts.push(``);
    parts.push(`Provide your plan as a JSON object.`);

    return parts.join("\n");
  }

  private getSynthesisSystemPrompt(): string {
    return `You are an expert synthesizer combining results from multiple ecommerce research agents.

Your job is to analyze execution results and provide a clear, actionable recommendation.

Return a JSON object with:
{
  "recommendation": "GO" | "CONDITIONAL_GO" | "NO_GO",
  "confidence": <0-100>,
  "summary": "<3-4 sentence executive summary>",
  "keyFindings": ["<finding1>", "<finding2>"],
  "risks": ["<risk1>", "<risk2>"],
  "nextActions": ["<action1>", "<action2>"]
}

Be decisive. Provide clear direction based on the data.`;
  }

  private buildSynthesisPrompt(
    goal: string,
    plan: ExecutionPlan,
    results: Array<{
      step: string;
      agentId: string;
      success: boolean;
      output?: unknown;
      error?: string;
    }>
  ): string {
    return [
      `Synthesize results from executing this plan:`,
      ``,
      `Goal: ${goal}`,
      `Strategy: ${plan.strategy}`,
      ``,
      `## Execution Results`,
      results
        .map(
          (r) =>
            `### ${r.agentId} (${r.success ? "SUCCESS" : "FAILED"})\n${
              r.output ? JSON.stringify(r.output, null, 2) : r.error
            }`
        )
        .join("\n\n"),
      ``,
      `Provide your synthesis as a JSON object.`,
    ].join("\n");
  }
}
