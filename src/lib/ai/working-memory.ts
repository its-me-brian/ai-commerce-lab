// Working Memory
// Ephemeral, in-session key-value store shared across execution steps.
//
// This is NOT long-term memory (agent_memory table).
// This is scratch-pad memory that:
//   - Lives for the duration of a chain/workflow execution
//   - Accumulates data as steps complete
//   - Is readable by any step/node in the execution
//   - Supports nested keys via dot-notation
//   - Supports TTL (time-to-live) for transient data
//
// Think of it as a whiteboard that all agents/mini-IAs can read and write to.

/**
 * A single memory entry with metadata.
 */
export interface MemoryEntry {
  /** The stored value */
  value: unknown;

  /** Who wrote this entry (agent ID, mini-AI ID, step ID) */
  source: string;

  /** When it was written */
  timestamp: number;

  /** Optional TTL in ms (expires after this duration) */
  ttlMs?: number;

  /** Confidence in this memory (0-1, default 1) */
  confidence?: number;
}

/**
 * Working Memory — shared ephemeral state across execution steps.
 *
 * Usage:
 *   const memory = new WorkingMemory();
 *   memory.set("classifier.result", { category: "marketing" }, "classifier");
 *   memory.set("researcher.topics", ["ai", "ml"], "researcher");
 *
 *   // Later steps can read:
 *   const result = memory.get("classifier.result");
 *   // → { category: "marketing" }
 *
 *   // Get all data from a specific source:
 *   const classifierData = memory.getBySource("classifier");
 *
 *   // Get all data as a flat record:
 *   const all = memory.getAll();
 */
export class WorkingMemory {
  private store: Map<string, MemoryEntry> = new Map();
  private createdAt: number;

  constructor() {
    this.createdAt = Date.now();
  }

  /**
   * Store a value in working memory.
   *
   * @param key - Dot-notation key (e.g., "classifier.bestCategory")
   * @param value - The value to store
   * @param source - Who is storing this (agent/mini-AI/step ID)
   * @param options - Optional TTL and confidence
   */
  set(
    key: string,
    value: unknown,
    source: string,
    options?: { ttlMs?: number; confidence?: number }
  ): void {
    this.store.set(key, {
      value,
      source,
      timestamp: Date.now(),
      ttlMs: options?.ttlMs,
      confidence: options?.confidence ?? 1,
    });
  }

  /**
   * Retrieve a value from working memory.
   *
   * @param key - Dot-notation key
   * @returns The stored value, or undefined if not found or expired
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check TTL expiration
    if (entry.ttlMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttlMs) {
        this.store.delete(key);
        return undefined;
      }
    }

    return entry.value as T;
  }

  /**
   * Check if a key exists in working memory.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Delete all entries from a specific source.
   */
  deleteBySource(source: string): number {
    let count = 0;
    for (const [key, entry] of this.store) {
      if (entry.source === source) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get all entries from a specific source.
   */
  getBySource(source: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this.store) {
      if (entry.source === source) {
        result[key] = entry.value;
      }
    }
    return result;
  }

  /**
   * Get all stored data as a flat key-value record.
   * Expired entries are excluded.
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const now = Date.now();

    for (const [key, entry] of this.store) {
      // Skip expired
      if (entry.ttlMs !== undefined && now - entry.timestamp > entry.ttlMs) {
        this.store.delete(key);
        continue;
      }
      result[key] = entry.value;
    }

    return result;
  }

  /**
   * Get all entries with their metadata.
   */
  getAllEntries(): Map<string, MemoryEntry> {
    return new Map(this.store);
  }

  /**
   * Merge another working memory into this one.
   * Entries from the other memory overwrite existing entries with the same key.
   */
  merge(other: WorkingMemory): void {
    for (const [key, entry] of other.getAllEntries()) {
      this.store.set(key, entry);
    }
  }

  /**
   * Get the number of active (non-expired) entries.
   */
  get size(): number {
    let count = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (entry.ttlMs !== undefined && now - entry.timestamp > entry.ttlMs) {
        continue;
      }
      count++;
    }
    return count;
  }

  /**
   * Get the age of this memory in ms.
   */
  get age(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clean up expired entries.
   * Returns the number of entries removed.
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store) {
      if (entry.ttlMs !== undefined && now - entry.timestamp > entry.ttlMs) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Export memory as a serializable object (for persistence/debugging).
   */
  export(): Record<string, { value: unknown; source: string; timestamp: number; ttlMs?: number; confidence?: number }> {
    const result: Record<string, { value: unknown; source: string; timestamp: number; ttlMs?: number; confidence?: number }> = {};
    for (const [key, entry] of this.store) {
      result[key] = { ...entry };
    }
    return result;
  }

  /**
   * Import memory from a serialized object.
   */
  import(data: Record<string, { value: unknown; source: string; timestamp: number; ttlMs?: number; confidence?: number }>): void {
    for (const [key, entry] of Object.entries(data)) {
      this.store.set(key, entry);
    }
  }
}

/**
 * Get a new working memory instance for the current execution.
 * Each call returns a fresh, isolated instance — no shared singleton.
 * This prevents concurrent executions from leaking state to each other.
 */
export function getWorkingMemory(): WorkingMemory {
  return new WorkingMemory();
}

/**
 * Reset the current working memory (for testing or new execution).
 */
export function resetWorkingMemory(): WorkingMemory {
  return new WorkingMemory();
}

/**
 * Clear a working memory reference (no-op, kept for API compatibility).
 */
export function clearWorkingMemory(): void {
  // No-op: each getWorkingMemory() call creates a fresh instance
}
