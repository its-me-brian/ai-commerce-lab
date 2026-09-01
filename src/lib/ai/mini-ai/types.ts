// Mini-AI Core Types
// Defines the contract for specialized, lightweight AI components.
//
// A Mini-AI is NOT an Agent. Key differences:
//   AGENT: broad goal, personality, memory, tools, planning capability
//   MINI-AI: specific task, defined input/output, limited context, low cost, fast
//
// Mini-IAs are the "LEGO blocks" of the platform. They are composable,
// replaceable, and can use different models based on complexity.

import { z } from "zod";
import type { AIProviderSlug } from "../types";

// ============================================
// MINI-AI TYPE CATEGORIES
// ============================================

/**
 * Built-in mini-AI types.
 * New types can be added via the registry — this is just the default set.
 */
export type MiniAIType =
  | "researcher"      // Investigates a topic, returns structured findings
  | "classifier"      // Categorizes input into predefined categories
  | "extractor"       // Extracts structured data from unstructured input
  | "summarizer"      // Reduces large input to concise summary
  | "critic"          // Evaluates quality of a response/output
  | "validator"       // Checks format, coherence, rules compliance
  | "ranker"          // Orders results by relevance/score
  | "planner"         // Decomposes complex task into subtasks
  | "transformer"     // Transforms data from one format to another
  | "custom";         // User-defined mini-AI

/**
 * Complexity level — determines which model to use.
 * Simple tasks → cheap/small model
 * Complex tasks → stronger model
 */
export type MiniAIComplexity = "trivial" | "simple" | "moderate" | "complex";

/**
 * Execution mode — how the mini-AI produces output.
 */
export type MiniAIExecutionMode =
  | "llm"             // Uses an LLM to generate output
  | "deterministic"   // Pure function, no LLM needed
  | "hybrid";         // Deterministic + LLM for refinement

// ============================================
// MINI-AI DEFINITION
// ============================================

/**
 * Zod schema for mini-AI input validation.
 * Each mini-AI defines what it accepts.
 */
export const MiniAIInputSchema = z.record(z.string(), z.unknown());
export type MiniAIInput = z.infer<typeof MiniAIInputSchema>;

/**
 * Zod schema for mini-AI output validation.
 * Each mini-AI defines what it produces.
 */
export const MiniAIOutputSchema = z.record(z.string(), z.unknown());
export type MiniAIOutput = z.infer<typeof MiniAIOutputSchema>;

/**
 * Model requirements for a mini-AI.
 * Used by the Model Router to select the appropriate model.
 */
export interface MiniAIModelRequirements {
  /** Required model capabilities (ALL must match) */
  requiredCapabilities?: string[];

  /** Preferred provider (optional — router decides) */
  preferredProvider?: AIProviderSlug;

  /** Minimum context window needed */
  minContextWindow?: number;

  /** Maximum cost per execution (in dollars) */
  maxCostPerExecution?: number;

  /** Preferred complexity level */
  complexity?: MiniAIComplexity;

  /** Response format needed */
  responseFormat?: "text" | "json";
}

/**
 * A Mini-AI Definition describes WHAT a mini-AI does.
 * This is the "blueprint" — not the runtime instance.
 *
 * Similar to AgentDefinition but much simpler:
 *   - No personality
 *   - No hierarchy
 *   - No memory policy
 *   - No skills
 *   - Just: purpose, input, output, model needs, execution mode
 */
export interface MiniAIDefinition {
  /** Unique identifier (e.g., "product-researcher", "seo-critic") */
  id: string;

  /** Human-readable name */
  name: string;

  /** What this mini-AI does (one sentence) */
  description: string;

  /** Category for grouping (e.g., "research", "validation", "content") */
  category: string;

  /** Mini-AI type from built-in types */
  type: MiniAIType;

  /** How this mini-AI executes */
  executionMode: MiniAIExecutionMode;

  /** Instructions/prompt for LLM-based mini-IAs */
  instructions?: string;

  /** Input schema — Zod schema for runtime validation, or plain object (legacy) */
  inputSchema: z.ZodType | Record<string, unknown>;

  /** Output schema — Zod schema for runtime validation, or plain object (legacy) */
  outputSchema: z.ZodType | Record<string, unknown>;

  /** Model requirements for the router */
  modelRequirements: MiniAIModelRequirements;

  /** Default temperature (can be overridden at execution) */
  defaultTemperature?: number;

  /** Max output tokens (can be overridden at execution) */
  maxOutputTokens?: number;

  /** Whether this mini-AI is enabled */
  enabled: boolean;

  /** Version for tracking changes */
  version: string;

  /** Tags for discovery and filtering */
  tags?: string[];

  /** Timeout in ms (default: 30000) */
  timeoutMs?: number;
}

// ============================================
// MINI-AI EXECUTION
// ============================================

/**
 * Options for executing a mini-AI.
 */
export interface MiniAIExecutionOptions {
  /** Input data for the mini-AI */
  input: MiniAIInput;

  /** Override the default model */
  modelOverride?: string;

  /** Override the provider */
  providerOverride?: AIProviderSlug;

  /** Override temperature */
  temperature?: number;

  /** Override max output tokens */
  maxOutputTokens?: number;

  /** Parent task ID for tracking */
  taskId?: string;

  /** Parent agent ID for tracking */
  agentId?: string;

  /** Working memory context (temporal, task-scoped) */
  workingMemory?: Record<string, unknown>;

  /** Timeout override in ms */
  timeoutMs?: number;

  /** Whether to log execution events */
  logExecution?: boolean;
}

/**
 * Result produced by a mini-AI execution.
 */
export interface MiniAIResult {
  /** Whether execution succeeded */
  success: boolean;

  /** The output data (conforms to outputSchema) */
  output: MiniAIOutput;

  /** Confidence score 0-1 (if applicable) */
  confidence?: number;

  /** Human-readable explanation of the result */
  reasoning?: string;

  /** Errors encountered (if any) */
  errors: string[];

  /** Warnings (non-fatal issues) */
  warnings: string[];

  /** Execution metadata */
  metadata: {
    /** Which mini-AI produced this */
    miniAIId: string;

    /** Which model was actually used */
    modelUsed: string;

    /** Which provider was actually used */
    providerUsed: AIProviderSlug;

    /** Execution mode used */
    executionMode: MiniAIExecutionMode;

    /** Input tokens consumed */
    inputTokens: number;

    /** Output tokens produced */
    outputTokens: number;

    /** Total execution time in ms */
    durationMs: number;

    /** Cost in dollars (if LLM-based) */
    costDollars?: number;

    /** Whether a fallback model was used */
    usedFallback: boolean;

    /** Whether the result was cached */
    cached: boolean;
  };
}

// ============================================
// MINI-AI CHAIN (COMPOSITION)
// ============================================

/**
 * A step in a mini-AI chain.
 * Mini-IAs can be composed into sequences.
 */
export interface MiniAIChainStep {
  /** Which mini-AI to execute */
  miniAIId: string;

  /** Input mapping from previous steps or original input */
  inputMapping: Record<string, string>;

  /** Optional condition — skip this step if false */
  condition?: (context: MiniAIChainContext) => boolean;

  /** Whether this step is required (default: true) */
  required?: boolean;
}

/**
 * Context passed through a mini-AI chain.
 */
export interface MiniAIChainContext {
  /** Original input to the chain */
  originalInput: MiniAIInput;

  /** Results from previous steps (step index → result) */
  previousResults: MiniAIResult[];

  /** Current step index */
  currentStep: number;

  /** Shared working memory across the chain */
  workingMemory: Record<string, unknown>;
}

/**
 * A chain of mini-IAs executed in sequence.
 */
export interface MiniAIChain {
  /** Chain identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this chain does */
  description: string;

  /** Ordered list of steps */
  steps: MiniAIChainStep[];

  /** Whether to stop on first failure (default: false) */
  stopOnError?: boolean;

  /** Max total execution time in ms */
  timeoutMs?: number;
}

// ============================================
// MINI-AI REGISTRY TYPES
// ============================================

/**
 * Filter options for querying the registry.
 */
export interface MiniAIQueryOptions {
  type?: MiniAIType;
  category?: string;
  tags?: string[];
  enabled?: boolean;
  complexity?: MiniAIComplexity;
}
