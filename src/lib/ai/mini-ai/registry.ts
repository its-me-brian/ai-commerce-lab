// Mini-AI Registry
// Central registry for mini-AI definitions.
// Follows the same pattern as AgentRegistry and ToolRegistry.
//
// Mini-IAs are registered at bootstrap time and queried at execution time.
// The registry supports filtering by type, category, tags, and complexity.

import type {
  MiniAIDefinition,
  MiniAIType,
  MiniAIQueryOptions,
} from "./types";

/**
 * Singleton registry instance.
 */
let registryInstance: MiniAIRegistry | null = null;

export class MiniAIRegistry {
  private definitions: Map<string, MiniAIDefinition> = new Map();

  // ============================================
  // REGISTRATION
  // ============================================

  /**
   * Register a mini-AI definition.
   * Overwrites if already exists (by id).
   */
  register(definition: MiniAIDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Register multiple mini-AI definitions at once.
   */
  registerAll(definitions: MiniAIDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  /**
   * Unregister a mini-AI by id.
   */
  unregister(id: string): boolean {
    return this.definitions.delete(id);
  }

  // ============================================
  // RETRIEVAL
  // ============================================

  /**
   * Get a mini-AI definition by id.
   */
  get(id: string): MiniAIDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Get a mini-AI definition or throw if not found.
   */
  getOrThrow(id: string): MiniAIDefinition {
    const def = this.definitions.get(id);
    if (!def) {
      throw new Error(`Mini-AI not found: ${id}`);
    }
    return def;
  }

  /**
   * List all registered mini-AI definitions.
   */
  list(): MiniAIDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * List all enabled mini-AI definitions.
   */
  listEnabled(): MiniAIDefinition[] {
    return this.list().filter((d) => d.enabled);
  }

  /**
   * Check if a mini-AI is registered.
   */
  has(id: string): boolean {
    return this.definitions.has(id);
  }

  // ============================================
  // QUERIES
  // ============================================

  /**
   * List mini-IAs by type.
   */
  listByType(type: MiniAIType): MiniAIDefinition[] {
    return this.list().filter((d) => d.type === type);
  }

  /**
   * List mini-IAs by category.
   */
  listByCategory(category: string): MiniAIDefinition[] {
    return this.list().filter((d) => d.category === category);
  }

  /**
   * List mini-IAs by tags (ANY tag must match).
   */
  listByTags(tags: string[]): MiniAIDefinition[] {
    return this.list().filter(
      (d) => d.tags && d.tags.some((t) => tags.includes(t))
    );
  }

  /**
   * Advanced query with multiple filters.
   */
  query(options: MiniAIQueryOptions): MiniAIDefinition[] {
    return this.list().filter((d) => {
      if (options.type && d.type !== options.type) return false;
      if (options.category && d.category !== options.category) return false;
      if (options.enabled !== undefined && d.enabled !== options.enabled) return false;
      if (options.tags && options.tags.length > 0) {
        if (!d.tags || !d.tags.some((t) => options.tags!.includes(t))) return false;
      }
      if (options.complexity && d.modelRequirements.complexity !== options.complexity) return false;
      return true;
    });
  }

  /**
   * Get all unique categories.
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const def of this.definitions.values()) {
      categories.add(def.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all unique tags.
   */
  getTags(): string[] {
    const tags = new Set<string>();
    for (const def of this.definitions.values()) {
      if (def.tags) {
        for (const tag of def.tags) {
          tags.add(tag);
        }
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get count of registered mini-IAs.
   */
  count(): number {
    return this.definitions.size;
  }

  /**
   * Get count of enabled mini-IAs.
   */
  enabledCount(): number {
    return this.listEnabled().length;
  }

  // ============================================
  // MODIFICATION
  // ============================================

  /**
   * Enable a mini-AI by id.
   */
  enable(id: string): boolean {
    const def = this.definitions.get(id);
    if (!def) return false;
    def.enabled = true;
    return true;
  }

  /**
   * Disable a mini-AI by id.
   */
  disable(id: string): boolean {
    const def = this.definitions.get(id);
    if (!def) return false;
    def.enabled = false;
    return true;
  }

  /**
   * Clear all registrations (for testing).
   */
  clear(): void {
    this.definitions.clear();
  }
}

/**
 * Get or create the singleton MiniAIRegistry.
 */
export function getMiniAIRegistry(): MiniAIRegistry {
  if (!registryInstance) {
    registryInstance = new MiniAIRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetMiniAIRegistry(): void {
  registryInstance = null;
}
