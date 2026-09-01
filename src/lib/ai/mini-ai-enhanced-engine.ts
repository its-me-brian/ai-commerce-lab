// Mini-AI Enhanced Agent Engine
// Wraps the existing AgentEngine with mini-AI capabilities.
//
// This is NOT a replacement — it's an enhancement layer:
//   - Pre-processing: classifier/extractor mini-IAs prepare input
//   - Post-processing: critic/validator mini-IAs validate output
//   - Agents can declare which mini-IAs to use
//
// Existing agents continue working unchanged.
// New agents can opt-in to mini-AI enhancement.

import { AgentEngine } from "../agents/core/engine";
import { getMiniAIEngine } from "./mini-ai/engine";
import { getMiniAIRegistry } from "./mini-ai/registry";
import type { MiniAIResult, MiniAIDefinition } from "./mini-ai/types";
import type { AgentResult } from "../agents/core/types";

/**
 * Configuration for mini-AI enhancement of an agent.
 */
export interface MiniAIEnhancementConfig {
  /** Agent ID to enhance */
  agentId: string;

  /** Mini-IAs to run BEFORE the agent (input preparation) */
  preProcessing?: string[];

  /** Mini-IAs to run AFTER the agent (output validation) */
  postProcessing?: string[];

  /** Whether to stop on pre-processing failure */
  stopOnPreFailure?: boolean;

  /** Whether to stop on post-processing failure */
  stopOnPostFailure?: boolean;
}

/**
 * Result of enhanced agent execution.
 */
export interface EnhancedAgentResult {
  /** The original agent result */
  agentResult: AgentResult;

  /** Pre-processing results (from mini-IAs) */
  preProcessingResults: MiniAIResult[];

  /** Post-processing results (from mini-IAs) */
  postProcessingResults: MiniAIResult[];

  /** Whether pre-processing succeeded */
  preProcessingSuccess: boolean;

  /** Whether post-processing succeeded */
  postProcessingSuccess: boolean;

  /** Enhanced input (after pre-processing) */
  enhancedInput?: Record<string, unknown>;

  /** Quality score from critic mini-AI (if used) */
  qualityScore?: number;

  /** Validation result from validator mini-AI (if used) */
  validationResult?: boolean;

  /** Total mini-AI cost */
  miniAICost: number;
}

/**
 * Pre-configured enhancement profiles for common patterns.
 */
export const ENHANCEMENT_PROFILES: Record<string, MiniAIEnhancementConfig> = {
  "full-validation": {
    agentId: "", // Set at runtime
    preProcessing: ["classifier"],
    postProcessing: ["critic", "validator"],
    stopOnPreFailure: true,
    stopOnPostFailure: false,
  },
  "research-only": {
    agentId: "",
    preProcessing: ["researcher"],
    postProcessing: ["summarizer"],
    stopOnPreFailure: false,
    stopOnPostFailure: false,
  },
  "extract-and-validate": {
    agentId: "",
    preProcessing: ["extractor"],
    postProcessing: ["validator"],
    stopOnPreFailure: true,
    stopOnPostFailure: true,
  },
};

/**
 * Mini-AI Enhanced Agent Engine.
 * Wraps AgentEngine with pre/post processing via mini-IAs.
 */
export class MiniAIEnhancedEngine {
  private baseEngine = new AgentEngine();
  private miniAIEngine = getMiniAIEngine();

  /**
   * Execute an agent with mini-AI enhancement.
   *
   * Flow:
   * 1. Run pre-processing mini-IAs on input
   * 2. Execute agent with enhanced input
   * 3. Run post-processing mini-IAs on output
   * 4. Return enhanced result
   */
  async executeEnhanced(
    agentId: string,
    input: Record<string, unknown>,
    config: MiniAIEnhancementConfig
  ): Promise<EnhancedAgentResult> {
    const preProcessingResults: MiniAIResult[] = [];
    const postProcessingResults: MiniAIResult[] = [];
    let enhancedInput = input;
    let miniAICost = 0;

    // ============================================
    // STEP 1: Pre-processing
    // ============================================
    if (config.preProcessing && config.preProcessing.length > 0) {
      for (const miniAIId of config.preProcessing) {
        const registry = getMiniAIRegistry();
        const def = registry.get(miniAIId);

        if (!def || !def.enabled) {
          if (config.stopOnPreFailure) {
            return this.createEnhancedResult(
              { success: false, output: "", errors: [`Pre-processing mini-AI not available: ${miniAIId}`], metadata: {} as AgentResult["metadata"] },
              preProcessingResults,
              postProcessingResults,
              false,
              true,
              input,
              miniAICost
            );
          }
          continue;
        }

        // Build input for the mini-AI based on its type
        const miniAIInput = this.buildPreProcessInput(miniAIId, def, enhancedInput);

        const result = await this.miniAIEngine.execute(miniAIId, {
          input: miniAIInput,
        });

        preProcessingResults.push(result);
        miniAICost += result.metadata.costDollars || 0;

        if (!result.success && config.stopOnPreFailure) {
          return this.createEnhancedResult(
            { success: false, output: "", errors: [`Pre-processing failed: ${miniAIId}`], metadata: {} as AgentResult["metadata"] },
            preProcessingResults,
            postProcessingResults,
            false,
            true,
            enhancedInput,
            miniAICost
          );
        }

        // Merge pre-processing output into enhanced input
        if (result.success) {
          enhancedInput = {
            ...enhancedInput,
            _preProcessed: {
              ...((enhancedInput._preProcessed as Record<string, unknown>) || {}),
              [miniAIId]: result.output,
            },
          };
        }
      }
    }

    // ============================================
    // STEP 2: Execute agent
    // ============================================
    let agentResult: AgentResult;
    try {
      const { result } = await this.baseEngine.executeTask(agentId, enhancedInput);
      agentResult = result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      agentResult = {
        success: false,
        output: "",
        errors: [msg],
        metadata: {
          providerUsed: "none",
          modelUsed: "none",
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          cached: false,
        },
      };
    }

    // ============================================
    // STEP 3: Post-processing
    // ============================================
    if (config.postProcessing && config.postProcessing.length > 0 && agentResult.success) {
      const agentOutput = typeof agentResult.structuredData === "object" && agentResult.structuredData !== null
        ? agentResult.structuredData as Record<string, unknown>
        : { content: agentResult.output };

      for (const miniAIId of config.postProcessing) {
        const registry = getMiniAIRegistry();
        const def = registry.get(miniAIId);

        if (!def || !def.enabled) continue;

        // Build input for the post-processing mini-AI
        const miniAIInput = this.buildPostProcessInput(miniAIId, def, agentOutput);

        const result = await this.miniAIEngine.execute(miniAIId, {
          input: miniAIInput,
        });

        postProcessingResults.push(result);
        miniAICost += result.metadata.costDollars || 0;
      }
    }

    // ============================================
    // STEP 4: Synthesize results
    // ============================================
    const preSuccess = preProcessingResults.length === 0 || preProcessingResults.some((r) => r.success);
    const postSuccess = postProcessingResults.length === 0 || postProcessingResults.every((r) => r.success);

    // Extract quality score from critic results
    const criticResult = postProcessingResults.find((r) => r.metadata.miniAIId === "critic");
    const qualityScore = criticResult?.output?.overallScore as number | undefined;

    // Extract validation result
    const validatorResult = postProcessingResults.find((r) => r.metadata.miniAIId === "validator");
    const validationResult = validatorResult?.output?.valid as boolean | undefined;

    return this.createEnhancedResult(
      agentResult,
      preProcessingResults,
      postProcessingResults,
      preSuccess,
      postSuccess,
      enhancedInput,
      miniAICost,
      qualityScore,
      validationResult
    );
  }

  /**
   * Get available enhancement profiles.
   */
  getProfiles(): Record<string, MiniAIEnhancementConfig> {
    return { ...ENHANCEMENT_PROFILES };
  }

  /**
   * Get available mini-IAs for enhancement.
   */
  getAvailableMiniAIs(): MiniAIDefinition[] {
    return getMiniAIRegistry().listEnabled();
  }

  // ============================================
  // HELPERS
  // ============================================

  private buildPreProcessInput(
    miniAIId: string,
    _def: MiniAIDefinition,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    switch (miniAIId) {
      case "classifier":
        return {
          text: JSON.stringify(input),
          categories: (input.categories as string[]) || ["product", "marketing", "finance", "general"],
        };
      case "extractor":
        return {
          text: JSON.stringify(input),
          fields: (input.fields as string[]) || ["name", "price", "description"],
        };
      case "researcher":
        return {
          topic: (input.topic as string) || (input.query as string) || JSON.stringify(input),
          context: JSON.stringify(input),
        };
      default:
        return input;
    }
  }

  private buildPostProcessInput(
    miniAIId: string,
    _def: MiniAIDefinition,
    agentOutput: Record<string, unknown>
  ): Record<string, unknown> {
    switch (miniAIId) {
      case "critic":
        return {
          response: JSON.stringify(agentOutput),
          criteria: ["clarity", "completeness", "accuracy"],
          threshold: 0.6,
        };
      case "validator":
        return {
          data: agentOutput,
          rules: ["non-empty response"],
        };
      case "summarizer":
        return {
          text: JSON.stringify(agentOutput),
          maxLength: 3,
        };
      default:
        return agentOutput;
    }
  }

  private createEnhancedResult(
    agentResult: AgentResult,
    preProcessingResults: MiniAIResult[],
    postProcessingResults: MiniAIResult[],
    preProcessingSuccess: boolean,
    postProcessingSuccess: boolean,
    enhancedInput: Record<string, unknown>,
    miniAICost: number,
    qualityScore?: number,
    validationResult?: boolean
  ): EnhancedAgentResult {
    return {
      agentResult,
      preProcessingResults,
      postProcessingResults,
      preProcessingSuccess,
      postProcessingSuccess,
      enhancedInput,
      qualityScore,
      validationResult,
      miniAICost,
    };
  }
}
