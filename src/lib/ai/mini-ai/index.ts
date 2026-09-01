// Mini-AI Module
// Specialized, lightweight AI components for the multi-agent platform.
//
// Mini-IAs are NOT agents. They are:
//   - Simpler: no personality, no hierarchy, no memory
//   - Cheaper: use smaller models or deterministic functions
//   - Faster: focused on single tasks
//   - Composable: can be chained into pipelines
//   - Replaceable: swap implementations without affecting agents
//
// Usage:
//   import { getMiniAIRegistry, type MiniAIDefinition } from "@/lib/ai/mini-ai";
//
//   const registry = getMiniAIRegistry();
//   const researcher = registry.get("product-researcher");

export { MiniAIRegistry, getMiniAIRegistry, resetMiniAIRegistry } from "./registry";
export {
  MiniAIEngine,
  getMiniAIEngine,
  resetMiniAIEngine,
  registerDeterministicImpl,
  registerPromptBuilder,
} from "./engine";
export type { MiniAIDeterministicFn, MiniAIPromptBuilder } from "./engine";
export type {
  MiniAIType,
  MiniAIComplexity,
  MiniAIExecutionMode,
  MiniAIModelRequirements,
  MiniAIDefinition,
  MiniAIInput,
  MiniAIOutput,
  MiniAIExecutionOptions,
  MiniAIResult,
  MiniAIChainStep,
  MiniAIChainContext,
  MiniAIChain,
  MiniAIQueryOptions,
} from "./types";
