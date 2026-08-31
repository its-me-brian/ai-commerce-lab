// Agent Registry
// Central registry of all available agents AND agent definitions.
// - Agents: runtime implementations (BaseAgent classes)
// - Definitions: identity, mission, personality, expertise, rules, skills
// - Hierarchy: parent/child relationships, department filtering

import type { BaseAgent } from "./agent";
import type { AgentMetadata, AgentType } from "./types";
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

  // --- Hierarchy queries ---

  /**
   * Get the parent agent of a given agent.
   */
  getParent(agentId: string): AgentMetadata | undefined {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.metadata.parentAgentId) return undefined;
    return this.agents.get(agent.metadata.parentAgentId)?.metadata;
  }

  /**
   * Get all direct children of a given agent.
   */
  getChildren(agentId: string): AgentMetadata[] {
    return this.list().filter((m) => m.parentAgentId === agentId);
  }

  /**
   * Get all descendants of a given agent (recursive).
   */
  getDescendants(agentId: string): AgentMetadata[] {
    const descendants: AgentMetadata[] = [];
    const children = this.getChildren(agentId);
    for (const child of children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child.id));
    }
    return descendants;
  }

  /**
   * Get the full chain from an agent up to the root (CEO).
   */
  getChain(agentId: string): AgentMetadata[] {
    const chain: AgentMetadata[] = [];
    let current = this.agents.get(agentId);
    while (current) {
      chain.push(current.metadata);
      const parentId = current.metadata.parentAgentId;
      current = parentId ? this.agents.get(parentId) : undefined;
    }
    return chain;
  }

  /**
   * Get all agents of a specific type.
   */
  listByType(agentType: AgentType): AgentMetadata[] {
    return this.list().filter((m) => m.agentType === agentType);
  }

  /**
   * Get all agents in a specific department.
   */
  listByDepartment(department: string): AgentMetadata[] {
    return this.list().filter((m) => m.department === department);
  }

  /**
   * Get all agents scoped to a workspace (or global if workspaceId is null).
   */
  listByWorkspace(workspaceId: string | null): AgentMetadata[] {
    if (workspaceId === null) {
      return this.list().filter((m) => !m.workspaceId);
    }
    return this.list().filter((m) => !m.workspaceId || m.workspaceId === workspaceId);
  }

  /**
   * Get the root agent (CEO) — the one with no parent.
   */
  getRoot(): AgentMetadata | undefined {
    return this.list().find((m) => !m.parentAgentId);
  }

  /**
   * Build a tree structure from the flat registry.
   * Returns the root node with nested children.
   */
  getTree(): (AgentMetadata & { children: AgentMetadata[] }) | undefined {
    const root = this.getRoot();
    if (!root) return undefined;

    const buildNode = (agent: AgentMetadata): AgentMetadata & { children: AgentMetadata[] } => {
      const children = this.getChildren(agent.id);
      return {
        ...agent,
        children: children.map(buildNode),
      };
    };

    return buildNode(root);
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
