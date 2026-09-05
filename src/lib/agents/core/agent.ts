// Base Agent Interface
// Every agent must implement this interface.
// Agents do NOT know about specific AI providers.

import type { AgentMetadata, AgentContext, AgentResult } from "./types";

export abstract class BaseAgent {
  abstract readonly metadata: AgentMetadata;

  abstract execute(context: AgentContext): Promise<AgentResult>;

 
  validateInput(_input: Record<string, unknown>): string[] {
    // Default: no validation errors
    // Override in specific agents
    return [];
  }

  getCapabilities(): string[] {
    return this.metadata.capabilities;
  }

  isEnabled(): boolean {
    return this.metadata.enabled && this.metadata.status === "ready";
  }
}
