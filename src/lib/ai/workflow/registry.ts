// Workflow Registry
// Stores and retrieves workflow definitions.
//
// Pattern: same as MiniAIRegistry and AgentRegistry.
// In-memory for now; DB persistence will be added in FASE 9+.

import type { WorkflowDefinition, WorkflowQueryOptions } from "./types";

/**
 * Workflow Registry — central store for workflow definitions.
 */
export class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  /**
   * Register a workflow definition.
   */
  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Register multiple workflow definitions at once.
   */
  registerAll(workflows: WorkflowDefinition[]): void {
    for (const workflow of workflows) {
      this.register(workflow);
    }
  }

  /**
   * Get a workflow definition by ID.
   */
  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  /**
   * Check if a workflow exists.
   */
  has(id: string): boolean {
    return this.workflows.has(id);
  }

  /**
   * Unregister a workflow.
   */
  unregister(id: string): boolean {
    return this.workflows.delete(id);
  }

  /**
   * List all registered workflows.
   */
  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * List all enabled workflows.
   */
  listEnabled(): WorkflowDefinition[] {
    return this.list().filter((w) => w.enabled !== false);
  }

  /**
   * Query workflows by options.
   */
  query(options: WorkflowQueryOptions): WorkflowDefinition[] {
    let results = this.list();

    if (options.enabled !== undefined) {
      results = results.filter((w) => w.enabled === options.enabled);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter((w) =>
        options.tags!.some((tag) => w.tags?.includes(tag))
      );
    }

    if (options.nameContains) {
      const search = options.nameContains.toLowerCase();
      results = results.filter((w) =>
        w.name.toLowerCase().includes(search) ||
        w.description.toLowerCase().includes(search)
      );
    }

    return results;
  }

  /**
   * Get the number of registered workflows.
   */
  get size(): number {
    return this.workflows.size;
  }

  /**
   * Clear all registered workflows (for testing).
   */
  clear(): void {
    this.workflows.clear();
  }
}

/**
 * Singleton instance.
 */
let registryInstance: WorkflowRegistry | null = null;

export function getWorkflowRegistry(): WorkflowRegistry {
  if (!registryInstance) {
    registryInstance = new WorkflowRegistry();
  }
  return registryInstance;
}

export function resetWorkflowRegistry(): void {
  registryInstance = null;
}
