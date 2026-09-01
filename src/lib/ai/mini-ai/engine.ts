// Mini-AI Engine
// Runtime executor for mini-IAs.
//
// Much simpler than AgentEngine:
//   - No Supabase task tracking
//   - No permissions checking
//   - No memory injection
//   - No prompt building from definitions
//
// Just: lookup → validate → execute → return
//
// Supports three execution modes:
//   - deterministic: pure function, no LLM
//   - llm: uses AIModelRouter for generation
//   - hybrid: deterministic + LLM refinement

import { getMiniAIRegistry } from "./registry";
import { selectModelByComplexity } from "../complexity-router";
import { calculateModelCost } from "../model-pricing";
import { z } from "zod";
import type {
  MiniAIDefinition,
  MiniAIInput,
  MiniAIResult,
  MiniAIExecutionOptions,
  MiniAIExecutionMode,
  MiniAIComplexity,
} from "./types";

/**
 * Function signature for deterministic mini-AI implementations.
 * Takes input, returns output. No LLM involved.
 */
export type MiniAIDeterministicFn = (
  input: MiniAIInput,
  context?: { workingMemory?: Record<string, unknown> }
) => Promise<{ output: Record<string, unknown>; confidence?: number; reasoning?: string }>;

/**
 * Function signature for LLM prompt builders.
 * Given definition + input, returns the prompt to send to the LLM.
 */
export type MiniAIPromptBuilder = (
  definition: MiniAIDefinition,
  input: MiniAIInput
) => { systemPrompt: string; userPrompt: string };

/**
 * Registry of deterministic implementations.
 * Maps mini-AI id → implementation function.
 */
const deterministicImplementations: Map<string, MiniAIDeterministicFn> = new Map();

/**
 * Registry of custom prompt builders.
 * Maps mini-AI id → prompt builder function.
 */
const promptBuilders: Map<string, MiniAIPromptBuilder> = new Map();

/**
 * Register a deterministic implementation for a mini-AI.
 */
export function registerDeterministicImpl(
  miniAIId: string,
  fn: MiniAIDeterministicFn
): void {
  deterministicImplementations.set(miniAIId, fn);
}

/**
 * Register a custom prompt builder for a mini-AI.
 */
export function registerPromptBuilder(
  miniAIId: string,
  builder: MiniAIPromptBuilder
): void {
  promptBuilders.set(miniAIId, builder);
}

/**
 * Get the deterministic implementation for a mini-AI.
 */
export function getDeterministicImpl(miniAIId: string): MiniAIDeterministicFn | undefined {
  return deterministicImplementations.get(miniAIId);
}

/**
 * Clear all deterministic implementations (for testing).
 */
export function clearDeterministicImpls(): void {
  deterministicImplementations.clear();
}

/**
 * Clear all prompt builders (for testing).
 */
export function clearPromptBuilders(): void {
  promptBuilders.clear();
}

/**
 * Mini-AI Engine — executes mini-AI definitions.
 */
export class MiniAIEngine {
  /**
   * Execute a mini-AI by id.
   *
   * Flow:
   * 1. Look up definition from registry
   * 2. Validate input
   * 3. Execute based on execution mode
   * 4. Return structured result
   */
  async execute(
    miniAIId: string,
    options: MiniAIExecutionOptions
  ): Promise<MiniAIResult> {
    const startTime = Date.now();

    // 1. Look up definition
    const registry = getMiniAIRegistry();
    const definition = registry.get(miniAIId);

    if (!definition) {
      return this.createErrorResult(
        miniAIId,
        `Mini-AI not found: ${miniAIId}`,
        startTime
      );
    }

    if (!definition.enabled) {
      return this.createErrorResult(
        miniAIId,
        `Mini-AI is disabled: ${miniAIId}`,
        startTime
      );
    }

    // 2. Validate input (basic validation)
    const validationError = this.validateInput(definition, options.input);
    if (validationError) {
      return this.createErrorResult(miniAIId, validationError, startTime);
    }

    // 3. Execute based on mode
    try {
      switch (definition.executionMode) {
        case "deterministic":
          return await this.executeDeterministic(definition, options, startTime);
        case "llm":
          return await this.executeLLM(definition, options, startTime);
        case "hybrid":
          return await this.executeHybrid(definition, options, startTime);
        default:
          return this.createErrorResult(
            miniAIId,
            `Unknown execution mode: ${definition.executionMode}`,
            startTime
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createErrorResult(miniAIId, message, startTime);
    }
  }

  /**
   * Execute a chain of mini-IAs in sequence.
   * Each step's output is mapped to the next step's input.
   * Working memory accumulates across steps for cross-step context.
   */
  async executeChain(
    steps: Array<{ miniAIId: string; inputMapping: Record<string, string> }>,
    initialInput: MiniAIInput,
    options?: { agentId?: string; taskId?: string; workingMemory?: Record<string, unknown> }
  ): Promise<MiniAIResult[]> {
    const results: MiniAIResult[] = [];
    const workingMemory: Record<string, unknown> = options?.workingMemory ?? {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Map input from previous results or initial input
      const mappedInput = this.mapInput(
        step.inputMapping,
        initialInput,
        results
      );

      // Inject working memory into input (if steps reference "memory.*")
      const enrichedInput = this.injectWorkingMemory(mappedInput, workingMemory);

      const result = await this.execute(step.miniAIId, {
        input: enrichedInput,
        agentId: options?.agentId,
        taskId: options?.taskId,
      });

      results.push(result);

      // Accumulate successful output into working memory
      if (result.success && result.output) {
        workingMemory[step.miniAIId] = result.output;
        workingMemory[`step_${i}`] = result.output;
      }

      // Stop chain if step failed
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  // ============================================
  // EXECUTION MODES
  // ============================================

  private async executeDeterministic(
    definition: MiniAIDefinition,
    options: MiniAIExecutionOptions,
    startTime: number
  ): Promise<MiniAIResult> {
    const impl = deterministicImplementations.get(definition.id);

    if (!impl) {
      return this.createErrorResult(
        definition.id,
        `No deterministic implementation registered for: ${definition.id}`,
        startTime
      );
    }

    const execStart = Date.now();
    const { output, confidence, reasoning } = await impl(options.input, {
      workingMemory: options.workingMemory,
    });
    const durationMs = Date.now() - execStart;

    // F10: Validate output against schema
    const outputError = this.validateOutput(definition, output);
    if (outputError) {
      return {
        success: false,
        output,
        errors: [outputError],
        warnings: [],
        metadata: {
          miniAIId: definition.id,
          modelUsed: "deterministic",
          providerUsed: "none",
          executionMode: "deterministic",
          inputTokens: 0,
          outputTokens: 0,
          durationMs,
          costDollars: 0,
          usedFallback: false,
          cached: false,
        },
      };
    }

    return {
      success: true,
      output,
      confidence,
      reasoning,
      errors: [],
      warnings: [],
      metadata: {
        miniAIId: definition.id,
        modelUsed: "deterministic",
        providerUsed: "none",
        executionMode: "deterministic",
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        costDollars: 0,
        usedFallback: false,
        cached: false,
      },
    };
  }

  private async executeLLM(
    definition: MiniAIDefinition,
    options: MiniAIExecutionOptions,
    startTime: number
  ): Promise<MiniAIResult> {
    // Build prompt
    const builder = promptBuilders.get(definition.id);
    let systemPrompt: string;
    let userPrompt: string;

    if (builder) {
      const prompts = builder(definition, options.input);
      systemPrompt = prompts.systemPrompt;
      userPrompt = prompts.userPrompt;
    } else {
      // Default prompt from definition instructions
      systemPrompt = definition.instructions || `You are a ${definition.name}.`;
      userPrompt = JSON.stringify(options.input);
    }

    // Import router dynamically to avoid circular deps
    const { getRouter } = await import("../router");
    const router = getRouter();

    const execStart = Date.now();

    // Select model based on complexity tier (F2: ComplexityRouter integration)
    const complexity: MiniAIComplexity = definition.modelRequirements.complexity || "simple";
    let primaryProvider: string;
    let primaryModel: string;

    if (options.modelOverride) {
      // Explicit override takes precedence — skip complexity routing
      primaryModel = options.modelOverride;
      primaryProvider = options.providerOverride || definition.modelRequirements.preferredProvider || "gemini";
    } else {
      try {
        const modelSelection = await selectModelByComplexity(
          complexity,
          definition.modelRequirements
        );
        primaryModel = modelSelection.match.model.id;
        primaryProvider = modelSelection.match.model.provider_id;
      } catch {
        // Fallback to defaults if complexity routing fails
        primaryModel = "gemini-3-flash";
        primaryProvider = definition.modelRequirements.preferredProvider || "gemini";
      }
    }

    const config = {
      agentId: `mini-ai:${definition.id}`,
      primaryProvider,
      primaryModel,
      temperature: options.temperature ?? definition.defaultTemperature ?? 0.3,
      maxTokens: options.maxOutputTokens ?? definition.maxOutputTokens ?? 4096,
    };

    const { result: aiResult } = await router.generate(config, {
      prompt: userPrompt,
      systemPrompt,
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      responseFormat: definition.modelRequirements.responseFormat || "json",
    });

    const durationMs = Date.now() - execStart;

    // Try to parse structured output
    let output: Record<string, unknown>;
    try {
      output = typeof aiResult.content === "string"
        ? JSON.parse(aiResult.content)
        : { content: aiResult.content };
    } catch {
      output = { content: aiResult.content };
    }

    // F10: Validate output against schema
    const outputError = this.validateOutput(definition, output);
    if (outputError) {
      return {
        success: false,
        output,
        errors: [outputError],
        warnings: [],
        metadata: {
          miniAIId: definition.id,
          modelUsed: aiResult.model,
          providerUsed: aiResult.provider,
          executionMode: "llm",
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          durationMs,
          costDollars: this.calculateCost(
            aiResult.inputTokens,
            aiResult.outputTokens,
            aiResult.provider,
            aiResult.model
          ),
          usedFallback: false,
          cached: aiResult.cached,
        },
      };
    }

    return {
      success: true,
      output,
      errors: [],
      warnings: [],
      metadata: {
        miniAIId: definition.id,
        modelUsed: aiResult.model,
        providerUsed: aiResult.provider,
        executionMode: "llm",
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        durationMs,
        costDollars: this.calculateCost(
          aiResult.inputTokens,
          aiResult.outputTokens,
          aiResult.provider,
          aiResult.model
        ),
        usedFallback: false,
        cached: aiResult.cached,
      },
    };
  }

  private async executeHybrid(
    definition: MiniAIDefinition,
    options: MiniAIExecutionOptions,
    startTime: number
  ): Promise<MiniAIResult> {
    // Step 1: Run deterministic implementation
    const impl = deterministicImplementations.get(definition.id);
    if (!impl) {
      return this.createErrorResult(
        definition.id,
        `No deterministic implementation registered for hybrid mini-AI: ${definition.id}`,
        startTime
      );
    }

    const detStart = Date.now();
    const detResult = await impl(options.input, {
      workingMemory: options.workingMemory,
    });
    const detDuration = Date.now() - detStart;

    // Step 2: Use LLM for refinement if instructions exist
    if (definition.instructions) {
      const refinementInput = {
        ...options.input,
        _deterministicResult: detResult.output,
      };

      const llmResult = await this.executeLLM(
        definition,
        { ...options, input: refinementInput },
        startTime
      );

      // Merge results — LLM output takes precedence
      return {
        ...llmResult,
        output: {
          ...detResult.output,
          ...llmResult.output,
          _deterministicConfidence: detResult.confidence,
        },
        confidence: detResult.confidence,
        reasoning: detResult.reasoning,
        metadata: {
          ...llmResult.metadata,
          executionMode: "hybrid",
          durationMs: detDuration + llmResult.metadata.durationMs,
        },
      };
    }

    // No LLM refinement — just return deterministic result
    return {
      success: true,
      output: detResult.output,
      confidence: detResult.confidence,
      reasoning: detResult.reasoning,
      errors: [],
      warnings: [],
      metadata: {
        miniAIId: definition.id,
        modelUsed: "deterministic",
        providerUsed: "none",
        executionMode: "hybrid",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: detDuration,
        costDollars: 0,
        usedFallback: false,
        cached: false,
      },
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private validateInput(
    definition: MiniAIDefinition,
    input: MiniAIInput
  ): string | null {
    if (!input || typeof input !== "object") {
      return "Input must be a non-null object";
    }

    // Basic check — input must not be empty
    if (Object.keys(input).length === 0) {
      return "Input must not be empty";
    }

    // F10: Zod schema validation if schema is a ZodType
    const schema = definition.inputSchema;
    if (schema && typeof schema === "object" && "parse" in schema) {
      try {
        (schema as z.ZodType).parse(input);
        return null;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
          return `Input validation failed: ${issues}`;
        }
        return `Input validation failed: ${error}`;
      }
    }

    return null;
  }

  /**
   * Validate output against the mini-AI's output schema.
   * Returns null if valid, error message if invalid.
   */
  private validateOutput(
    definition: MiniAIDefinition,
    output: Record<string, unknown>
  ): string | null {
    const schema = definition.outputSchema;
    if (!schema || typeof schema !== "object" || !("parse" in schema)) {
      // No Zod schema — skip validation (legacy plain object)
      return null;
    }

    try {
      (schema as z.ZodType).parse(output);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
        return `Output validation failed: ${issues}`;
      }
      return `Output validation failed: ${error}`;
    }
  }

  private mapInput(
    mapping: Record<string, string>,
    originalInput: MiniAIInput,
    previousResults: MiniAIResult[]
  ): MiniAIInput {
    const mapped: Record<string, unknown> = {};

    for (const [targetKey, sourceRef] of Object.entries(mapping)) {
      // Source ref format: "input.fieldName" or "step[0].output.fieldName"
      if (sourceRef.startsWith("input.")) {
        const field = sourceRef.slice(6);
        mapped[targetKey] = originalInput[field];
      } else if (sourceRef.startsWith("step[")) {
        const match = sourceRef.match(/step\[(\d+)\]\.output\.(.+)/);
        if (match) {
          const stepIndex = parseInt(match[1], 10);
          const field = match[2];
          if (previousResults[stepIndex]) {
            mapped[targetKey] = previousResults[stepIndex].output[field];
          }
        }
      } else {
        // Direct reference to previous result output
        mapped[targetKey] = sourceRef;
      }
    }

    return mapped;
  }

  /**
   * Inject working memory values into input fields that reference "memory.*".
   * For example, input: { context: "memory.classifier.bestCategory" }
   * will be resolved to the actual value from working memory.
   */
  private injectWorkingMemory(
    input: MiniAIInput,
    workingMemory: Record<string, unknown>
  ): MiniAIInput {
    if (!workingMemory || Object.keys(workingMemory).length === 0) {
      return input;
    }

    const enriched: Record<string, unknown> = { ...input };

    for (const [key, value] of Object.entries(enriched)) {
      if (typeof value === "string" && value.startsWith("memory.")) {
        const memKey = value.slice(7); // Remove "memory." prefix
        enriched[key] = workingMemory[memKey];
      }
    }

    return enriched;
  }

  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    _provider: string,
    model: string
  ): number {
    return calculateModelCost(model, inputTokens, outputTokens);
  }

  private createErrorResult(
    miniAIId: string,
    error: string,
    startTime: number
  ): MiniAIResult {
    return {
      success: false,
      output: {},
      errors: [error],
      warnings: [],
      metadata: {
        miniAIId,
        modelUsed: "none",
        providerUsed: "none",
        executionMode: "deterministic",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        costDollars: 0,
        usedFallback: false,
        cached: false,
      },
    };
  }
}

/**
 * Singleton instance.
 */
let engineInstance: MiniAIEngine | null = null;

export function getMiniAIEngine(): MiniAIEngine {
  if (!engineInstance) {
    engineInstance = new MiniAIEngine();
  }
  return engineInstance;
}

export function resetMiniAIEngine(): void {
  engineInstance = null;
}
