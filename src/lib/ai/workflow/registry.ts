// Workflow Registry
// Stores and retrieves workflow definitions.
//
// F5: Dual-layer persistence — in-memory cache + Supabase DB.
//   - Read path: check cache first, fall back to DB
//   - Write path: write to DB, then update cache
//   - On startup: load all from DB into cache

import { logger } from "../../logging";
import { supabase } from "../../database/supabase";
import type { WorkflowDefinition, WorkflowQueryOptions } from "./types";

/**
 * Workflow Registry — central store for workflow definitions.
 * F5: Now backed by Supabase with in-memory cache.
 */
export class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private loaded = false;

  /**
   * Load all workflows from DB into cache.
   * Called once on first access if not already loaded.
   */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.loadFromDB();
  }

  /**
   * Load all workflow definitions from Supabase into cache.
   * Merges with existing cache entries (DB entries overwrite cache on conflict).
   */
  async loadFromDB(): Promise<void> {
    if (this.loaded) return;

    try {
      const { data, error } = await supabase
        .from("workflow_definitions")
        .select("*");

      if (error) {
        logger.warn("Failed to load workflows from DB:", { error: error.message });
        this.loaded = true; // Mark as loaded even on error to avoid retries
        return;
      }

      // Merge: DB entries overwrite cache, but don't clear cache-only entries
      for (const row of (data || [])) {
        const def = this.rowToDefinition(row);
        this.workflows.set(def.id, def);
      }
      this.loaded = true;
    } catch (err) {
      logger.warn("Workflow DB load failed, using cache only:", { error: err instanceof Error ? err.message : String(err) });
      this.loaded = true;
    }
  }

  /**
   * Register a workflow definition.
   * F5: Writes to DB and cache.
   */
  async register(workflow: WorkflowDefinition): Promise<void> {
    // Write to cache immediately
    this.workflows.set(workflow.id, workflow);

    // Write to DB
    try {
      await supabase
        .from("workflow_definitions")
        .upsert(this.definitionToRow(workflow), { onConflict: "id" });
    } catch (err) {
      logger.warn(`Failed to persist workflow ${workflow.id} to DB:`, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Register multiple workflow definitions at once.
   */
  async registerAll(workflows: WorkflowDefinition[]): Promise<void> {
    for (const workflow of workflows) {
      await this.register(workflow);
    }
  }

  /**
   * Get a workflow definition by ID.
   */
  async get(id: string): Promise<WorkflowDefinition | undefined> {
    return this.workflows.get(id);
  }

  /**
   * Check if a workflow exists.
   */
  async has(id: string): Promise<boolean> {
    return this.workflows.has(id);
  }

  /**
   * Unregister a workflow.
   */
  async unregister(id: string): Promise<boolean> {
    this.workflows.delete(id);
    try {
      await supabase
        .from("workflow_definitions")
        .delete()
        .eq("id", id);
    } catch (err) {
      logger.warn(`Failed to delete workflow ${id} from DB:`, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  /**
   * List all registered workflows.
   */
  async list(): Promise<WorkflowDefinition[]> {
    await this.ensureLoaded();
    return Array.from(this.workflows.values());
  }

  /**
   * List all enabled workflows.
   */
  async listEnabled(): Promise<WorkflowDefinition[]> {
    const all = await this.list();
    return all.filter((w) => w.enabled !== false);
  }

  /**
   * Query workflows by options.
   */
  async query(options: WorkflowQueryOptions): Promise<WorkflowDefinition[]> {
    let results = await this.list();

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
    this.loaded = false;
  }

  // ============================================
  // ROW CONVERSION HELPERS
  // ============================================

  private rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) || "",
      version: (row.version as string) || "1.0.0",
      enabled: row.enabled as boolean,
      nodes: (row.nodes as WorkflowDefinition["nodes"]) || [],
      entryNodes: (row.entry_nodes as string[]) || undefined,
      tags: (row.tags as string[]) || [],
    };
  }

  private definitionToRow(def: WorkflowDefinition): Record<string, unknown> {
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      version: def.version,
      enabled: def.enabled ?? true,
      nodes: def.nodes || [],
      entry_nodes: def.entryNodes || null,
      tags: def.tags || [],
      updated_at: new Date().toISOString(),
    };
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
