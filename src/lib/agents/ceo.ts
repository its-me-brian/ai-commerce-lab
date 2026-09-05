// CEO Agent v2
// Orchestrates all other agents to achieve high-level goals.
// Plans execution, coordinates agents, synthesizes results.
// FASE 26: Real orchestration using MultiAgentOrchestrator, PricingEngine, SourceTypeManager.

import { BaseAgent } from "./core/agent";
import type {
  AgentMetadata,
  AgentContext,
  AgentResult,
} from "./core/types";
import { getRouter } from "../ai/router";
import { getAgentRegistry } from "../ai/bootstrap";
import { getMultiAgentOrchestrator } from "../ai/multi-agent-orchestrator";
import { getPricingEngine } from "../ai/pricing-engine";
import { getSourceTypeManager } from "../ai/source-type-manager";
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
    // Hierarchy: top-level executive, no parent
    agentType: "executive",
    department: "executive",
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
 
    const _registry = getAgentRegistry();
    const orchestrator = getMultiAgentOrchestrator();
 
    const _pricingEngine = getPricingEngine();
 
    const _sourceManager = getSourceTypeManager();

    // Check if this is a workflow execution request
    if (input.workflow) {
      return this.executeWorkflow(input, configuration);
    }

    // 1. Create execution plan
 
    const { result: planResult, log: _planLog } = await router.generate(
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

    // 2. Execute each step using orchestrator
    const results: Array<{
      step: string;
      agentId: string;
      success: boolean;
      output?: unknown;
      error?: string;
    }> = [];

    // Group steps by dependency level for parallel execution
    const stepsByLevel = this.groupStepsByLevel(plan.steps);

    for (const level of stepsByLevel) {
      const levelResults = await orchestrator.execute({
        parallel: level.map((step) => ({
          agentId: step.agentId,
          input: {
            ...input,
            ...step.inputTemplate,
          },
          taskType: "ceo-orchestrated",
        })),
      });

      for (let i = 0; i < level.length; i++) {
        const step = level[i];
        const agentResult = levelResults.results[i];

        if (agentResult?.result) {
          results.push({
            step: step.description,
            agentId: step.agentId,
            success: agentResult.result.success,
            output: agentResult.result.structuredData,
            error: agentResult.result.success ? undefined : agentResult.result.errors.join(", "),
          });
        } else {
          results.push({
            step: step.description,
            agentId: step.agentId,
            success: false,
            error: "No result returned",
          });
        }
      }
    }

    // 3. Synthesize final recommendation
    const { result: synthesisResult, log: synthesisLog } = await router.generate(
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
        orchestrationMode: "v2-parallel",
      },
      reasoningSummary: plan.strategy,
      errors: results.filter((r) => !r.success).map((r) => r.error || "Failed"),
      metadata: {
        providerUsed: synthesisLog.provider,
        modelUsed: synthesisLog.model,
        inputTokens: synthesisLog.inputTokens,
        outputTokens: synthesisLog.outputTokens,
        durationMs: 0,
        cached: false,
      },
    };
  }

  /**
   * FASE 26: Execute a predefined workflow using orchestrator.
   */
  private async executeWorkflow(
    input: Record<string, unknown>,
    configuration: AgentContext["configuration"]
  ): Promise<AgentResult> {
    const orchestrator = getMultiAgentOrchestrator();
    const pricingEngine = getPricingEngine();
    const startTime = Date.now();

    const workflow = input.workflow as string;
    const workflowInput = (input.workflowInput as Record<string, unknown>) || {};

    let orchestrationResult;

    switch (workflow) {
      case "product-discovery":
        orchestrationResult = await this.runProductDiscoveryWorkflow(
          orchestrator,
          workflowInput
        );
        break;

      case "supplier-evaluation":
        orchestrationResult = await this.runSupplierEvaluationWorkflow(
          orchestrator,
          pricingEngine,
          workflowInput
        );
        break;

      case "full-pipeline":
        orchestrationResult = await this.runFullPipelineWorkflow(
          orchestrator,
          pricingEngine,
          workflowInput
        );
        break;

      case "product-launch":
        orchestrationResult = await this.runProductLaunchWorkflow(
          orchestrator,
          pricingEngine,
          workflowInput
        );
        break;

      default:
        return {
          success: false,
          output: `Unknown workflow: ${workflow}`,
          structuredData: null,
          reasoningSummary: "",
          errors: [`Unknown workflow: ${workflow}. Available: product-discovery, supplier-evaluation, full-pipeline, product-launch`],
          metadata: {
            providerUsed: configuration.primaryProvider,
            modelUsed: configuration.primaryModel,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: Date.now() - startTime,
            cached: false,
          },
        };
    }

    return {
      success: orchestrationResult.success,
      output: `Workflow '${workflow}' completed. ${orchestrationResult.results.length} agents executed.`,
      structuredData: {
        workflow,
        results: orchestrationResult.results.map((r) => ({
          agentId: r.agentId,
          success: r.result.success,
          output: r.result.structuredData,
        })),
        totalAgents: orchestrationResult.results.length,
        successfulAgents: orchestrationResult.results.filter((r) => r.result.success).length,
      },
      reasoningSummary: `Workflow '${workflow}' orchestration complete.`,
      errors: orchestrationResult.errors,
      metadata: {
        providerUsed: configuration.primaryProvider,
        modelUsed: configuration.primaryModel,
        inputTokens: orchestrationResult.totalInputTokens,
        outputTokens: orchestrationResult.totalOutputTokens,
        durationMs: Date.now() - startTime,
        cached: false,
      },
    };
  }

  /**
   * Product Discovery workflow: Market → Products → Score
   */
  private async runProductDiscoveryWorkflow(
    orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
    input: Record<string, unknown>
  ) {
    return orchestrator.execute({
      sequential: [
        {
          agentId: "market-research",
          input: {
            productOrCategory: input.category || "general",
            targetMarket: input.targetMarket || "Europe",
          },
          taskType: "workflow-market",
        },
        {
          agentId: "product-hunter",
          input: {
            mode: "discover",
            query: input.query || "trending products",
            source: input.source || "ebay",
            limit: input.limit || 5,
          },
          taskType: "workflow-products",
        },
      ],
    });
  }

  /**
   * Supplier Evaluation workflow: Supplier Research → Pricing
   */
  private async runSupplierEvaluationWorkflow(
    orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
    pricingEngine: ReturnType<typeof getPricingEngine>,
    input: Record<string, unknown>
  ) {
    const result = await orchestrator.execute({
      parallel: [
        {
          agentId: "supplier-research",
          input: {
            productName: input.productName,
            category: input.category || "general",
            targetMarket: input.targetMarket || "Europe",
          },
          taskType: "workflow-suppliers",
        },
      ],
    });

    // Add pricing analysis if we have supplier data
    const supplierData = result.results[0]?.result.structuredData;
    if (supplierData && typeof supplierData === "object") {
      const suppliers = (supplierData as { suppliers?: Array<{ priceRange?: { min: number } }> }).suppliers;
      if (suppliers && suppliers.length > 0) {
        const minCost = suppliers[0].priceRange?.min || 10;
        const pricingResult = pricingEngine.calculate({
          costPrice: minCost,
          shippingCost: 3,
          strategy: "cost-plus",
        });

        return {
          ...result,
          results: [
            ...result.results,
            {
              agentId: "pricing-engine",
              taskId: "pricing-analysis",
              result: {
                success: true,
                output: "Pricing analysis complete",
                structuredData: pricingResult,
                reasoningSummary: `Recommended price: ${pricingResult.recommendedPrice}`,
                errors: [],
                metadata: {
                  providerUsed: "deterministic",
                  modelUsed: "pricing-engine",
                  inputTokens: 0,
                  outputTokens: 0,
                  durationMs: 0,
                  cached: false,
                },
              },
            },
          ],
        };
      }
    }

    return result;
  }

  /**
   * Full Pipeline workflow: Market → Products → Suppliers → Score → Pricing
   */
  private async runFullPipelineWorkflow(
    orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
    pricingEngine: ReturnType<typeof getPricingEngine>,
    input: Record<string, unknown>
  ) {
    return orchestrator.execute({
      sequential: [
        {
          agentId: "market-research",
          input: {
            productOrCategory: input.category || "general",
            targetMarket: input.targetMarket || "Europe",
          },
          taskType: "pipeline-market",
        },
        {
          agentId: "product-hunter",
          input: {
            mode: "discover",
            query: input.query || "trending products",
            source: input.source || "ebay",
            limit: input.limit || 3,
          },
          taskType: "pipeline-products",
        },
        {
          agentId: "supplier-research",
          input: {
            productName: input.productName || "discovered product",
            category: input.category || "general",
            targetMarket: input.targetMarket || "Europe",
          },
          taskType: "pipeline-suppliers",
        },
        {
          agentId: "opportunity-scoring",
          input: {
            productAnalysis: input.productAnalysis || {},
            supplierResearch: input.supplierResearch || {},
            marketResearch: input.marketResearch || {},
          },
          taskType: "pipeline-scoring",
        },
      ],
    });
  }

  /**
   * FASE 26+: Product Launch Workflow
   * CEO orchestrates Store + Marketing + Finance for a coordinated product launch.
   * 1. Store Builder creates product listing + SEO
   * 2. Marketing creates campaign + ad copy (parallel with Store)
   * 3. Finance validates margins + profitability
   * 4. CEO synthesizes all results for approval
   */
  private async runProductLaunchWorkflow(
    orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
    _pricingEngine: ReturnType<typeof getPricingEngine>,
    input: Record<string, unknown>
  ) {
    const productName = (input.productName as string) || "Unknown Product";
    const price = (input.price as number) || 0;
    const category = (input.category as string) || "general";
    const targetMarket = (input.targetMarket as string) || "Europe";
    const targetAudience = (input.targetAudience as string) || "online shoppers";
    const supplierPrice = (input.supplierPrice as number) || 0;

    // Phase 1: Store Builder + Marketing in parallel
    const parallelResult = await orchestrator.execute({
      parallel: [
        {
          agentId: "store-builder",
          input: {
            productName,
            price,
            category,
            targetMarket,
            supplierPrice,
            features: input.features,
            brand: input.brand,
          },
          taskType: "launch-store-content",
        },
        {
          agentId: "marketing",
          input: {
            productName,
            price,
            targetAudience,
            category,
            platform: input.platform || "all",
            campaignGoal: "sales",
            productBenefits: input.features,
            budget: input.budget,
          },
          taskType: "launch-marketing",
        },
      ],
    });

    // Phase 2: Finance validates margins
    const financeResult = await orchestrator.execute({
      sequential: [
        {
          agentId: "finance",
          input: {
            productName,
            costPrice: supplierPrice,
            sellingPrice: price,
            shippingCost: input.shippingCost || 5,
            platformFeePercent: input.platformFeePercent || 15,
            monthlyVolume: input.monthlyVolume || 100,
          },
          taskType: "launch-finance-validation",
        },
      ],
    });

    // Combine all results
    const allResults = [
      ...parallelResult.results,
      ...financeResult.results,
    ];

    const storeContent = orchestrator.getStructuredData(parallelResult, "store-builder");
    const marketingContent = orchestrator.getStructuredData(parallelResult, "marketing");
    const financeAnalysis = orchestrator.getStructuredData(financeResult, "finance");

    return {
      success: parallelResult.success && financeResult.success,
      results: allResults,
      errors: [...parallelResult.errors, ...financeResult.errors],
      totalInputTokens: parallelResult.totalInputTokens + financeResult.totalInputTokens,
      totalOutputTokens: parallelResult.totalOutputTokens + financeResult.totalOutputTokens,
      totalDurationMs: parallelResult.totalDurationMs + financeResult.totalDurationMs,
      structuredData: {
        workflow: "product-launch",
        productName,
        storeContent,
        marketingContent,
        financeAnalysis,
        approvalRequired: true,
      },
    };
  }

  /**
   * Group steps by dependency level for parallel execution.
   */
  private groupStepsByLevel(
    steps: ExecutionPlan["steps"]
  ): ExecutionPlan["steps"][] {
    const levels: ExecutionPlan["steps"][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    while (remaining.length > 0) {
      const level = remaining.filter((step) => {
        const deps = step.dependsOn || [];
        return deps.every((dep) => completed.has(dep));
      });

      if (level.length === 0) {
        // Circular dependency or error — break with remaining
        levels.push(remaining);
        break;
      }

      levels.push(level);
      for (const step of level) {
        completed.add(step.agentId);
        const idx = remaining.indexOf(step);
        remaining.splice(idx, 1);
      }
    }

    return levels;
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
