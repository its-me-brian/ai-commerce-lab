// Agent Definitions barrel
export { productHunterDefinition } from "./product-hunter";
export { supplierResearchDefinition } from "./supplier-research";
export { marketResearchDefinition } from "./market-research";
export { opportunityScoringDefinition } from "./opportunity-scoring";
export { storeBuilderDefinition } from "./store-builder";
export { marketingDefinition } from "./marketing";
export { secretaryDefinition } from "./secretary";
export { financeDefinition } from "./finance";
export { ceoDefinition } from "./ceo";

import type { AgentDefinition } from "../core/types-agent-definition";
import { productHunterDefinition } from "./product-hunter";
import { supplierResearchDefinition } from "./supplier-research";
import { marketResearchDefinition } from "./market-research";
import { opportunityScoringDefinition } from "./opportunity-scoring";
import { storeBuilderDefinition } from "./store-builder";
import { marketingDefinition } from "./marketing";
import { secretaryDefinition } from "./secretary";
import { financeDefinition } from "./finance";
import { ceoDefinition } from "./ceo";

/**
 * All agent definitions, indexed by slug.
 * Single source of truth for hardcoded definitions.
 */
export const agentDefinitions: Record<string, AgentDefinition> = {
  "ceo": ceoDefinition,
  "product-hunter": productHunterDefinition,
  "supplier-research": supplierResearchDefinition,
  "market-research": marketResearchDefinition,
  "opportunity-scoring": opportunityScoringDefinition,
  "store-builder": storeBuilderDefinition,
  "marketing": marketingDefinition,
  "secretary": secretaryDefinition,
  "finance": financeDefinition,
};

export function getAgentDefinition(slug: string): AgentDefinition | undefined {
  return agentDefinitions[slug];
}

export function listAgentDefinitions(): AgentDefinition[] {
  return Object.values(agentDefinitions);
}
