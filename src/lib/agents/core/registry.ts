// Agent Registry
// Central registry of all available agents AND agent definitions.
// - Agents: runtime implementations (BaseAgent classes)
// - Definitions: identity, mission, personality, expertise, rules, skills

import type { BaseAgent } from "./agent";
import type { AgentMetadata } from "./types";
import type { AgentDefinition } from "./types-agent-definition";

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private definitions: Map<string, AgentDefinition> = new Map();

  // --- Agent (runtime) registration ---

  register(agent: BaseAgent): void {
    if (this.agents.has(agent.metadata.id)) {
      console.warn(
        `[AgentRegistry] Agent ${agent.metadata.id} already registered, overwriting`
      );
    }
    this.agents.set(agent.metadata.id, agent);
    console.log(
      `[AgentRegistry] Registered agent: ${agent.metadata.name} (${agent.metadata.id})`
    );
  }

  get(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  list(): AgentMetadata[] {
    return Array.from(this.agents.values()).map((agent) => agent.metadata);
  }

  listEnabled(): AgentMetadata[] {
    return this.list().filter((m) => m.enabled);
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  unregister(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      console.log(`[AgentRegistry] Unregistered agent: ${agentId}`);
    }
    return deleted;
  }

  // --- Agent Definition registration ---

  registerDefinition(definition: AgentDefinition): void {
    if (this.definitions.has(definition.slug)) {
      console.warn(
        `[AgentRegistry] Definition ${definition.slug} already registered, overwriting`
      );
    }
    this.definitions.set(definition.slug, definition);
    console.log(
      `[AgentRegistry] Registered definition: ${definition.identity.name} (${definition.slug})`
    );
  }

  getDefinition(slug: string): AgentDefinition | undefined {
    return this.definitions.get(slug);
  }

  listDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  listDefinitionsByStatus(status: AgentDefinition["status"]): AgentDefinition[] {
    return this.listDefinitions().filter((d) => d.status === status);
  }
}
