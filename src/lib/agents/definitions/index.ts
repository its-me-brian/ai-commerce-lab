// Agent Definitions barrel
export { productHunterDefinition } from "./product-hunter";
export { storeBuilderDefinition } from "./store-builder";
export { marketingDefinition } from "./marketing";
export { secretaryDefinition } from "./secretary";
export { financeDefinition } from "./finance";
export { ceoDefinition } from "./ceo";

import type { AgentDefinition } from "../core/types-agent-definition";
import { productHunterDefinition } from "./product-hunter";
import { storeBuilderDefinition } from "./store-builder";
import { marketingDefinition } from "./marketing";
import { secretaryDefinition } from "./secretary";
import { financeDefinition } from "./finance";
import { ceoDefinition } from "./ceo";

/**
 * All agent definitions, indexed by slug.
 * This is the single source of truth for agent identities.
 */
export const agentDefinitions: Record<string, AgentDefinition> = {
  "product-hunter": productHunterDefinition,
  "store-builder": storeBuilderDefinition,
  "marketing": marketingDefinition,
  "secretary": secretaryDefinition,
  "finance": financeDefinition,
  "ceo": ceoDefinition,
};

export function getAgentDefinition(slug: string): AgentDefinition | undefined {
  return agentDefinitions[slug];
}

export function listAgentDefinitions(): AgentDefinition[] {
  return Object.values(agentDefinitions);
}
