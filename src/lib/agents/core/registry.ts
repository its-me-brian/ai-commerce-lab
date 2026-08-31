// Agent Registry
// Central registry of all available agents.
// New agents are registered here and become available to the system.

import type { BaseAgent } from "./agent";
import type { AgentMetadata } from "./types";

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

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
}
