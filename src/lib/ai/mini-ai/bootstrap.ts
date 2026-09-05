// Mini-AI Bootstrap
// Registers all built-in mini-IAs with the registry.
// Call once at application startup.
//
// Pattern: same as src/lib/tools/bootstrap.ts and src/lib/ai/bootstrap.ts

import { logger } from "../../logging";
import { getMiniAIRegistry } from "./registry";
import {
  registerDeterministicImpl,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  registerPromptBuilder,
} from "./engine";

// Import definitions
import { researcherDefinition } from "./implementations/researcher";
import { classifierDefinition } from "./implementations/classifier";
import { extractorDefinition } from "./implementations/extractor";
import { summarizerDefinition } from "./implementations/summarizer";
import { criticDefinition } from "./implementations/critic";
import { validatorDefinition } from "./implementations/validator";

// Import deterministic implementations
import { researcherDeterministic } from "./implementations/researcher";
import { classifierDeterministic } from "./implementations/classifier";
import { extractorDeterministic } from "./implementations/extractor";
import { summarizerDeterministic } from "./implementations/summarizer";
import { criticDeterministic } from "./implementations/critic";
import { validatorDeterministic } from "./implementations/validator";

/**
 * Built-in mini-AI definitions.
 */
export const builtinMiniAIDs = [
  researcherDefinition,
  classifierDefinition,
  extractorDefinition,
  summarizerDefinition,
  criticDefinition,
  validatorDefinition,
];

/**
 * Bootstrap all built-in mini-IAs.
 * Registers definitions + deterministic implementations.
 *
 * Call once at application startup (e.g., from src/lib/ai/bootstrap.ts).
 */
export function bootstrapMiniAIs(): void {
  const registry = getMiniAIRegistry();

  // Register definitions
  registry.registerAll(builtinMiniAIDs);

  // Register deterministic implementations
  registerDeterministicImpl("researcher", researcherDeterministic);
  registerDeterministicImpl("classifier", classifierDeterministic);
  registerDeterministicImpl("extractor", extractorDeterministic);
  registerDeterministicImpl("summarizer", summarizerDeterministic);
  registerDeterministicImpl("critic", criticDeterministic);
  registerDeterministicImpl("validator", validatorDeterministic);

  logger.info(`[MiniAI Bootstrap] Registered ${builtinMiniAIDs.length} built-in mini-IAs`);
}

/**
 * Re-export definitions for direct access.
 */
export {
  researcherDefinition,
  classifierDefinition,
  extractorDefinition,
  summarizerDefinition,
  criticDefinition,
  validatorDefinition,
};
