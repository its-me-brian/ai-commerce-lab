// Dynamic Plan Builder
// F9: Uses LLM to generate execution plans based on request context.
//
// Architecture:
//   1. Collect available agents and mini-IAs from registries
//   2. Build LLM prompt with request + available resources
//   3. Parse LLM's JSON response into ExecutionPlanStep[]
//   4. Validate steps reference real agents/mini-IAs
//   5. Fallback to static plan if LLM fails
//
// The LLM sees WHAT is available and decides HOW to compose it.
// This replaces the hardcoded switch statement in OrchestratorV2.

import type { ExecutionPlanStep } from "./orchestrator-v2";

// Lazy imports — avoid triggering Supabase env var checks at module load
async function loadAgentRegistry() {
  const { getAgentRegistry } = await import("./bootstrap");
  return getAgentRegistry();
}

async function loadMiniAIRegistry() {
  const { getMiniAIRegistry } = await import("./mini-ai/registry");
  return getMiniAIRegistry();
}

// ============================================
// TYPES
// ============================================

export interface DynamicPlanResult {
  steps: ExecutionPlanStep[];
  reasoning: string;
  source: "llm" | "fallback";
}

// ============================================
// STATIC FALLBACK PLANS (intent → steps)
// ============================================

const STATIC_PLANS: Record<string, ExecutionPlanStep[]> = {
  product_research: [
    { id: "research", type: "mini-ai", miniAIId: "researcher", complexity: "moderate", description: "Research the product/topic" },
    { id: "classify", type: "mini-ai", miniAIId: "classifier", complexity: "simple", inputMapping: { text: "research.output.summary" }, description: "Classify the findings" },
    { id: "validate", type: "mini-ai", miniAIId: "validator", complexity: "simple", inputMapping: { data: "classify.output" }, description: "Validate the classification" },
  ],
  marketing: [
    { id: "marketing-agent", type: "agent", agentId: "marketing", complexity: "complex", description: "Generate marketing content" },
    { id: "critic", type: "mini-ai", miniAIId: "critic", complexity: "simple", inputMapping: { response: "marketing-agent.output" }, description: "Evaluate content quality" },
  ],
  pricing: [
    { id: "finance-agent", type: "agent", agentId: "finance", complexity: "moderate", description: "Calculate pricing and margins" },
  ],
  supplier_research: [
    { id: "supplier-agent", type: "agent", agentId: "supplier-research", complexity: "moderate", description: "Research suppliers" },
  ],
  analysis: [
    { id: "analyze", type: "mini-ai", miniAIId: "researcher", complexity: "moderate", description: "Analyze the input" },
    { id: "summarize", type: "mini-ai", miniAIId: "summarizer", complexity: "simple", inputMapping: { text: "analyze.output.summary" }, description: "Summarize analysis" },
  ],
  general: [
    { id: "ceo-agent", type: "agent", agentId: "ceo", complexity: "complex", description: "Handle general request" },
  ],
};

// ============================================
// PLAN BUILDER
// ============================================

export class PlanBuilder {
  /**
   * Build an execution plan using LLM with fallback to static plans.
   *
   * @param request - The user's original request
   * @param intent - Classified intent (product_research, marketing, etc.)
   * @param overrides - Optional LLM overrides (for testing)
   */
  async buildPlan(
    request: string,
    intent: string,
    overrides?: {
      llmCall?: (prompt: string, systemPrompt: string) => Promise<string>;
    }
  ): Promise<DynamicPlanResult> {
    // 1. Try LLM-based plan generation
    try {
      const llmCall = overrides?.llmCall ?? this.defaultLLMCall;
      const result = await this.buildPlanWithLLM(request, intent, llmCall);
      return { ...result, source: "llm" };
    } catch (error) {
      // 2. Fallback to static plan
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[PlanBuilder] LLM plan generation failed, using static fallback: ${reason}`);

      return {
        steps: STATIC_PLANS[intent] ?? STATIC_PLANS.general,
        reasoning: `Static fallback for intent "${intent}": ${reason}`,
        source: "fallback",
      };
    }
  }

  /**
   * LLM-based plan generation.
   * Sends request + available resources to LLM, parses JSON response.
   */
  private async buildPlanWithLLM(
    request: string,
    intent: string,
    llmCall: (prompt: string, systemPrompt: string) => Promise<string>
  ): Promise<{ steps: ExecutionPlanStep[]; reasoning: string }> {
    // 1. Collect available resources
    const availableAgents = await this.getAvailableAgents();
    const availableMiniAIs = await this.getAvailableMiniAIs();

    // 2. Build prompt
    const systemPrompt = this.buildSystemPrompt(availableAgents, availableMiniAIs);
    const userPrompt = `Intent: ${intent}\n\nUser request: ${request}`;

    // 3. Call LLM
    const response = await llmCall(userPrompt, systemPrompt);

    // 4. Parse JSON response
    const parsed = this.parsePlanResponse(response);

    // 5. Validate steps
    const validatedSteps = this.validateSteps(parsed.steps, availableAgents, availableMiniAIs);

    return {
      steps: validatedSteps,
      reasoning: parsed.reasoning,
    };
  }

  /**
   * Default LLM call using the router.
   */
  private async defaultLLMCall(prompt: string, systemPrompt: string): Promise<string> {
    const { getRouter } = await import("./router");
    const router = getRouter();

    const config = {
      agentId: "orchestrator:plan-builder",
      primaryProvider: "gemini",
      primaryModel: "gemini-3-flash",
      temperature: 0,
      maxTokens: 1000,
    };

    const { result } = await router.generate(config, {
      prompt,
      systemPrompt,
      temperature: 0,
      maxOutputTokens: 1000,
      responseFormat: "json",
    });

    return result.content;
  }

  /**
   * Build the system prompt with available agents and mini-IAs.
   */
  private buildSystemPrompt(
    agents: Array<{ id: string; role: string; capabilities: string[] }>,
    miniAIs: Array<{ id: string; type: string; description: string; complexity: string }>
  ): string {
    const agentList = agents
      .map((a) => `  - "${a.id}" (role: ${a.role}, capabilities: ${a.capabilities.join(", ")})`)
      .join("\n");

    const miniAIList = miniAIs
      .map((m) => `  - "${m.id}" (type: ${m.type}, complexity: ${m.complexity}): ${m.description}`)
      .join("\n");

    return `You are an execution plan builder for an AI-powered ecommerce platform.

Given a user request and classified intent, create an ordered execution plan.

AVAILABLE AGENTS:
${agentList}

AVAILABLE MINI-ATTACKS:
${miniAIList}

RULES:
1. Only use agents and mini-AIs from the lists above
2. Steps execute in order — each step can reference previous step outputs
3. Use "agent" type for full agents, "mini-ai" type for specialized components
4. Set "complexity" for each step: "trivial", "simple", "moderate", or "complex"
5. For inputMapping, use "stepId.output.field" to reference previous outputs
6. Keep plans minimal — don't add unnecessary steps

Respond with a JSON object:
{
  "steps": [
    {
      "id": "step-1",
      "type": "agent" | "mini-ai",
      "agentId": "agent-id (if type=agent)",
      "miniAIId": "mini-ai-id (if type=mini-ai)",
      "complexity": "simple|moderate|complex",
      "inputMapping": { "key": "step-id.output.field" },
      "description": "What this step does"
    }
  ],
  "reasoning": "Brief explanation of why this plan"
}

IMPORTANT: Respond with ONLY the JSON object, nothing else.`;
  }

  /**
   * Parse the LLM's JSON response into steps + reasoning.
   */
  private parsePlanResponse(response: string): { steps: ExecutionPlanStep[]; reasoning: string } {
    // Try to extract JSON from the response (might be wrapped in markdown)
    let jsonStr = response.trim();

    // Remove markdown code block if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error("LLM response missing 'steps' array");
    }

    return {
      steps: parsed.steps,
      reasoning: parsed.reasoning || "LLM-generated plan",
    };
  }

  /**
   * Validate that steps reference real agents/mini-IAs.
   * Removes invalid steps and logs warnings.
   */
  private validateSteps(
    steps: ExecutionPlanStep[],
    availableAgents: Array<{ id: string }>,
    availableMiniAIs: Array<{ id: string }>
  ): ExecutionPlanStep[] {
    const agentIds = new Set(availableAgents.map((a) => a.id));
    const miniAIIds = new Set(availableMiniAIs.map((m) => m.id));

    const validSteps: ExecutionPlanStep[] = [];

    for (const step of steps) {
      if (step.type === "agent" && step.agentId && !agentIds.has(step.agentId)) {
        console.warn(`[PlanBuilder] Step "${step.id}" references unknown agent "${step.agentId}" — skipping`);
        continue;
      }
      if (step.type === "mini-ai" && step.miniAIId && !miniAIIds.has(step.miniAIId)) {
        console.warn(`[PlanBuilder] Step "${step.id}" references unknown mini-AI "${step.miniAIId}" — skipping`);
        continue;
      }
      validSteps.push(step);
    }

    if (validSteps.length === 0) {
      throw new Error("All LLM-generated steps were invalid");
    }

    return validSteps;
  }

  // ============================================
  // RESOURCE DISCOVERY
  // ============================================

  /**
   * Get available agents from the registry.
   */
  private async getAvailableAgents(): Promise<Array<{ id: string; role: string; capabilities: string[] }>> {
    try {
      const registry = await loadAgentRegistry();
      const definitions = registry.listDefinitions?.() ?? [];
      return definitions.map((def: Record<string, unknown>) => ({
        id: def.id as string,
        role: (def.role as string) || (def.description as string) || "general",
        capabilities: (def.capabilities as string[]) || [],
      }));
    } catch {
      // Registry not bootstrapped — return minimal list
      return [
        { id: "ceo", role: "general task handler", capabilities: ["general"] },
        { id: "marketing", role: "marketing content", capabilities: ["marketing", "content"] },
        { id: "finance", role: "financial analysis", capabilities: ["pricing", "finance"] },
        { id: "supplier-research", role: "supplier research", capabilities: ["suppliers"] },
      ];
    }
  }

  /**
   * Get available mini-IAs from the registry.
   */
  private async getAvailableMiniAIs(): Promise<Array<{ id: string; type: string; description: string; complexity: string }>> {
    try {
      const registry = await loadMiniAIRegistry();
      return registry.listEnabled().map((def) => ({
        id: def.id,
        type: def.type,
        description: def.description,
        complexity: def.modelRequirements?.complexity || "simple",
      }));
    } catch {
      // Registry not available — return minimal list
      return [
        { id: "researcher", type: "researcher", description: "Research a topic", complexity: "moderate" },
        { id: "classifier", type: "classifier", description: "Classify input", complexity: "simple" },
        { id: "summarizer", type: "summarizer", description: "Summarize text", complexity: "simple" },
        { id: "validator", type: "validator", description: "Validate data", complexity: "simple" },
        { id: "critic", type: "critic", description: "Evaluate quality", complexity: "simple" },
      ];
    }
  }
}

// ============================================
// SINGLETON
// ============================================

let instance: PlanBuilder | null = null;

export function getPlanBuilder(): PlanBuilder {
  if (!instance) {
    instance = new PlanBuilder();
  }
  return instance;
}

export function resetPlanBuilder(): void {
  instance = null;
}
