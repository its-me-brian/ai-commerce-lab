// Orchestrator v2
// Intelligent routing, delegation, and execution planning.
//
// The Orchestrator is the "brain" at Level 1 of the hierarchy:
//   User → Orchestrator → Agent → Mini-IAs → Tools → Result
//
// Responsibilities:
//   - Parse user intent
//   - Select appropriate agent(s)
//   - Plan execution steps (which mini-IAs to chain)
//   - Delegate to agents
//   - Validate results via critic/validator mini-IAs
//   - Synthesize final response
//   - Handle retries and fallbacks

import { getAgentRegistry } from "./bootstrap";
import { getMiniAIEngine } from "./mini-ai/engine";
import { getMiniAIRegistry } from "./mini-ai/registry";
import { selectModelByComplexity } from "./complexity-router";
import { getApprovalManager } from "./approval-manager";
import { getPlanBuilder } from "./plan-builder";
import { AgentEngine } from "../agents/core/engine";
import type { MiniAIResult, MiniAIChainStep } from "./mini-ai/types";

// ============================================
// TYPES
// ============================================

/**
 * Execution plan step — what to run and in what order.
 */
export interface ExecutionPlanStep {
  /** Step identifier */
  id: string;

  /** What type of step: "agent" | "mini-ai" | "chain" */
  type: "agent" | "mini-ai" | "chain";

  /** Agent ID (if type is "agent") */
  agentId?: string;

  /** Mini-AI ID (if type is "mini-ai" or "chain") */
  miniAIId?: string;

  /** Chain steps (if type is "chain") */
  chainSteps?: MiniAIChainStep[];

  /** Input mapping from previous steps */
  inputMapping?: Record<string, string>;

  /** Complexity tier for model selection */
  complexity?: "trivial" | "simple" | "moderate" | "complex";

  /** Whether this step is required (default: true) */
  required?: boolean;

  /** Human-readable description */
  description?: string;
}

/**
 * Execution plan — the full plan for processing a request.
 */
export interface ExecutionPlan {
  /** Plan identifier */
  id: string;

  /** Original user request */
  request: string;

  /** Identified intent */
  intent: string;

  /** Ordered steps to execute */
  steps: ExecutionPlanStep[];

  /** Estimated total cost */
  estimatedCost: number;

  /** Estimated total duration */
  estimatedDurationMs: number;

  /** Confidence in the plan (0-1) */
  confidence: number;

  /** Workspace ID for multi-tenancy */
  workspaceId?: string;
}

/**
 * Result of executing a plan.
 */
export interface ExecutionResult {
  /** Plan that was executed */
  planId: string;

  /** Whether all steps succeeded */
  success: boolean;

  /** Final synthesized response */
  response: string;

  /** Individual step results */
  stepResults: Array<{
    stepId: string;
    success: boolean;
    output: unknown;
    durationMs: number;
    cost: number;
  }>;

  /** Total execution metadata */
  metadata: {
    totalDurationMs: number;
    totalCost: number;
    totalTokens: number;
    stepsExecuted: number;
    stepsSucceeded: number;
    stepsFailed: number;
    retriedSteps: number;
  };
}

// ============================================
// ORCHESTRATOR
// ============================================

export class OrchestratorV2 {
  private agentEngine = new AgentEngine();

  /**
   * Plan the execution for a user request.
   * Analyzes intent and creates an ordered plan of steps.
   */
  async plan(request: string): Promise<ExecutionPlan> {
    const planId = `plan-${Date.now()}`;

    // LLM-based intent classification with keyword fallback
    const intent = await this.classifyIntent(request);

    // F9: Dynamic plan building with LLM + static fallback
    const planBuilder = getPlanBuilder();
    const dynamicPlan = await planBuilder.buildPlan(request, intent);

    // Build execution plan based on intent (with LLM-generated steps)
    const steps = dynamicPlan.steps;

    // Estimate cost and duration
    const { estimatedCost, estimatedDurationMs } = await this.estimatePlan(steps);

    return {
      id: planId,
      request,
      intent,
      steps,
      estimatedCost,
      estimatedDurationMs,
      confidence: dynamicPlan.source === "llm" ? 0.85 : 0.7,
    };
  }

  /**
   * Execute a plan end-to-end.
   * Runs each step, validates results, and synthesizes response.
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: ExecutionResult["stepResults"] = [];
    let totalCost = 0;
    let totalTokens = 0;
    let retriedSteps = 0;

    // Working memory passed between steps
    const workingMemory: Record<string, unknown> = {
      request: plan.request,
      intent: plan.intent,
    };

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepStart = Date.now();
      let stepSuccess = false;
      let stepOutput: unknown = null;
      let stepCost = 0;
      let lastError: string | null = null;
      const maxRetries = step.required !== false ? 1 : 0;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Map input from previous results or working memory
          const input = this.mapStepInput(step, workingMemory);

          if (step.type === "agent") {
            // Execute agent via AgentEngine
            const { result } = await this.agentEngine.executeTask(
              step.agentId!,
              input as Record<string, unknown>,
              { taskType: plan.intent || "general", workspaceId: plan.workspaceId || "" }
            );

            stepSuccess = result.success;
            stepOutput = result.structuredData || result.output;
            stepCost = (result.metadata.inputTokens + result.metadata.outputTokens) * 0.000001;
            totalTokens += result.metadata.inputTokens + result.metadata.outputTokens;
          } else if (step.type === "mini-ai") {
            // Execute single mini-AI
            const engine = getMiniAIEngine();
            const miniAIResult = await engine.execute(step.miniAIId!, {
              input: input as Record<string, unknown>,
              workingMemory,
            });

            stepSuccess = miniAIResult.success;
            stepOutput = miniAIResult.output;
            stepCost = miniAIResult.metadata.costDollars || 0;
            totalTokens += miniAIResult.metadata.inputTokens + miniAIResult.metadata.outputTokens;
          } else if (step.type === "chain") {
            // Execute mini-AI chain
            const engine = getMiniAIEngine();
            const chainResults = await engine.executeChain(
              step.chainSteps || [],
              input as Record<string, unknown>
            );

            stepSuccess = chainResults.every((r: MiniAIResult) => r.success);
            stepOutput = chainResults.map((r: MiniAIResult) => r.output);
            stepCost = chainResults.reduce((sum: number, r: MiniAIResult) => sum + (r.metadata.costDollars || 0), 0);
            totalTokens += chainResults.reduce(
              (sum: number, r: MiniAIResult) => sum + r.metadata.inputTokens + r.metadata.outputTokens,
              0
            );
          }

          // Success — break retry loop
          lastError = null;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt < maxRetries) {
            retriedSteps++;
            // Wait before retry
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      // Store result in working memory for next steps
      if (stepSuccess) {
        workingMemory[step.id] = stepOutput;

        // F4: Check if step result requires human approval
        const approvalNeeded = this.checkApprovalRequired(step, stepOutput);
        if (approvalNeeded) {
          try {
            const approvalManager = getApprovalManager();
            const approval = await approvalManager.createApproval({
              agent_id: step.agentId || "orchestrator",
              task_id: plan.id,
              action_type: approvalNeeded.actionType,
              action_summary: approvalNeeded.summary,
              action_details: { stepId: step.id, output: stepOutput },
              risk_level: approvalNeeded.riskLevel,
              expires_in_ms: 300000, // 5 minutes
            }, plan.workspaceId || "");

            // Store approval in working memory for downstream steps
            workingMemory[`${step.id}_approval`] = approval;

            // Wait for human decision
            const decision = await approvalManager.waitForApproval(approval.id, plan.workspaceId || "", 300000);
            if (!decision || decision.status !== "approved") {
              stepSuccess = false;
              lastError = `Approval ${decision?.status || "timeout"} for step ${step.id}`;
            }
          } catch (approvalError) {
            // Approval creation/wait failed — log but don't block execution
            const msg = approvalError instanceof Error ? approvalError.message : String(approvalError);
            stepResults.push({
              stepId: `${step.id}-approval`,
              success: false,
              output: { error: `Approval failed: ${msg}` },
              durationMs: Date.now() - stepStart,
              cost: 0,
            });
          }
        }
      }

      totalCost += stepCost;
      stepResults.push({
        stepId: step.id,
        success: stepSuccess,
        output: stepSuccess ? stepOutput : { error: lastError },
        durationMs: Date.now() - stepStart,
        cost: stepCost,
      });
    }

    // Synthesize final response
    const response = this.synthesizeResponse(plan, stepResults, workingMemory);

    const stepsSucceeded = stepResults.filter((r) => r.success).length;
    const stepsFailed = stepResults.filter((r) => !r.success).length;

    return {
      planId: plan.id,
      success: stepsFailed === 0,
      response,
      stepResults,
      metadata: {
        totalDurationMs: Date.now() - startTime,
        totalCost,
        totalTokens,
        stepsExecuted: stepResults.length,
        stepsSucceeded,
        stepsFailed,
        retriedSteps,
      },
    };
  }

  /**
   * High-level: plan + execute in one call.
   */
  async planAndExecute(request: string): Promise<ExecutionResult> {
    const plan = await this.plan(request);
    return this.execute(plan);
  }

  // ============================================
  // INTENT CLASSIFICATION
  // ============================================

  /**
   * Classify user intent using LLM.
   * Falls back to keyword-based if LLM fails or is unavailable.
   */
  private async classifyIntent(request: string): Promise<string> {
    // Try LLM-based classification first
    try {
      return await this.classifyIntentWithLLM(request);
    } catch {
      // Fallback to keyword-based
      return this.classifyIntentKeywords(request);
    }
  }

  /**
   * LLM-based intent classification.
   * Uses a free/cheap model to categorize the request.
   */
  private async classifyIntentWithLLM(request: string): Promise<string> {
    const { getRouter } = await import("./router");
    const router = getRouter();

    const systemPrompt = `You are an intent classifier for an AI-powered ecommerce platform.
Given a user request, classify it into exactly ONE of these categories:

- product_research: Finding, researching, or evaluating products to sell
- supplier_research: Finding or evaluating suppliers/vendors
- pricing: Calculating prices, margins, costs, or profitability
- marketing: Creating marketing content, campaigns, ad copy
- seo: Search engine optimization, keyword research
- analysis: Analyzing data, reviews, or market trends
- general: Anything else

Respond with ONLY the category name, nothing else.`;

    const config = {
      agentId: "orchestrator:intent-classifier",
      primaryProvider: "gemini",
      primaryModel: "gemini-3-flash",
      temperature: 0,
      maxTokens: 50,
    };

    const { result } = await router.generate(config, {
      prompt: request,
      systemPrompt,
      temperature: 0,
      maxOutputTokens: 50,
      responseFormat: "text",
    });

    const intent = result.content.trim().toLowerCase();

    // Validate against known intents
    const validIntents = [
      "product_research", "supplier_research", "pricing",
      "marketing", "seo", "analysis", "general",
    ];

    return validIntents.includes(intent) ? intent : "general";
  }

  /**
   * Keyword-based intent classification (fallback).
   * Used when LLM is unavailable or fails.
   */
  private classifyIntentKeywords(request: string): string {
    const lower = request.toLowerCase();

    if (lower.includes("marketing") || lower.includes("campaign") || lower.includes("ad copy")) {
      return "marketing";
    }
    if (lower.includes("supplier") || lower.includes("vendor")) {
      return "supplier_research";
    }
    if (lower.includes("price") || lower.includes("margin") || lower.includes("cost")) {
      return "pricing";
    }
    if (lower.includes("seo") || lower.includes("keyword")) {
      return "seo";
    }
    if (lower.includes("analyze") || lower.includes("review")) {
      return "analysis";
    }
    if (lower.includes("product") || lower.includes("item") || lower.includes("find")) {
      return "product_research";
    }

    return "general";
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Check if a step's output requires human approval.
   * Returns approval details if needed, null otherwise.
   *
   * Only triggers when the output EXPLICITLY requests approval.
   * Does not auto-trigger based on complexity — that's a policy decision
   * for the agent/mini-AI to make, not the orchestrator.
   */
  private checkApprovalRequired(
    step: ExecutionPlanStep,
    output: unknown
  ): { actionType: import("./approval-manager").ApprovalActionType; summary: string; riskLevel: import("./approval-manager").ApprovalRiskLevel } | null {
    const out = output as Record<string, unknown> | null;
    if (!out || typeof out !== "object") return null;

    // Only trigger when output explicitly requires approval
    if (out.requiresApproval === true) {
      return {
        actionType: (out.approvalActionType as import("./approval-manager").ApprovalActionType) || "custom",
        summary: (out.approvalSummary as string) || `Approval required for step: ${step.id}`,
        riskLevel: (out.approvalRiskLevel as import("./approval-manager").ApprovalRiskLevel) || "medium",
      };
    }

    return null;
  }

  private mapStepInput(
    step: ExecutionPlanStep,
    workingMemory: Record<string, unknown>
  ): Record<string, unknown> {
    if (!step.inputMapping) {
      // No mapping — use the original request as input
      return { text: workingMemory.request, topic: workingMemory.request };
    }

    const input: Record<string, unknown> = {};
    for (const [key, ref] of Object.entries(step.inputMapping)) {
      if (ref.startsWith("input.")) {
        // Reference to original request — try to extract field from request object
        const fieldPath = ref.slice("input.".length);
        const requestObj = workingMemory.request;
        if (fieldPath && typeof requestObj === "object" && requestObj !== null) {
          // Navigate dot-notation path in request object
          let value: unknown = requestObj;
          for (const segment of fieldPath.split(".")) {
            if (typeof value === "object" && value !== null) {
              value = (value as Record<string, unknown>)[segment];
            } else {
              value = undefined;
              break;
            }
          }
          input[key] = value;
        } else {
          // Fallback: use raw request string
          input[key] = requestObj;
        }
      } else if (ref.includes(".")) {
        // Reference to a previous step's output
        const [stepId, ...path] = ref.split(".");
        const stepOutput = workingMemory[stepId];
        if (stepOutput && typeof stepOutput === "object") {
          let value: unknown = stepOutput;
          for (const segment of path) {
            if (segment === "output" && typeof value === "object" && value !== null) {
              value = (value as Record<string, unknown>)[segment] || value;
            } else if (typeof value === "object" && value !== null) {
              value = (value as Record<string, unknown>)[segment];
            }
          }
          input[key] = value;
        }
      } else {
        // Direct reference to working memory
        input[key] = workingMemory[ref];
      }
    }

    return input;
  }

  private async estimatePlan(
    steps: ExecutionPlanStep[]
  ): Promise<{ estimatedCost: number; estimatedDurationMs: number }> {
    let totalCost = 0;
    let totalDuration = 0;

    for (const step of steps) {
      if (step.type === "agent") {
        totalCost += 0.01; // Estimate $0.01 per agent call
        totalDuration += 3000; // Estimate 3s per agent call
      } else if (step.type === "mini-ai") {
        const complexity = step.complexity || "simple";
        const costs = { trivial: 0.0001, simple: 0.001, moderate: 0.01, complex: 0.1 };
        const durations = { trivial: 100, simple: 500, moderate: 2000, complex: 5000 };
        totalCost += costs[complexity] || 0.001;
        totalDuration += durations[complexity] || 500;
      } else if (step.type === "chain") {
        totalCost += 0.005; // Estimate per chain
        totalDuration += 1000;
      }
    }

    return { estimatedCost: totalCost, estimatedDurationMs: totalDuration };
  }

  private synthesizeResponse(
    plan: ExecutionPlan,
    stepResults: ExecutionResult["stepResults"],
    workingMemory: Record<string, unknown>
  ): string {
    // Collect all successful outputs
    const outputs = stepResults
      .filter((r) => r.success)
      .map((r) => {
        if (typeof r.output === "string") return r.output;
        if (typeof r.output === "object" && r.output !== null) {
          return JSON.stringify(r.output, null, 2);
        }
        return String(r.output);
      });

    if (outputs.length === 0) {
      return `Request processed for intent "${plan.intent}" but no results were produced.`;
    }

    return outputs.join("\n\n");
  }
}

/**
 * Singleton instance.
 */
let orchestratorInstance: OrchestratorV2 | null = null;

export function getOrchestratorV2(): OrchestratorV2 {
  if (!orchestratorInstance) {
    orchestratorInstance = new OrchestratorV2();
  }
  return orchestratorInstance;
}

export function resetOrchestratorV2(): void {
  orchestratorInstance = null;
}
