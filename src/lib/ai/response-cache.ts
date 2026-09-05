// Response Cache
// Caches LLM responses by prompt fingerprint to avoid redundant calls.
//
// When the same system prompt + user message is sent, the cached response
// is returned instantly (zero token cost).
//
// Usage:
//   const cache = getResponseCache();
//   const cached = await cache.get(systemPrompt, userMessage);
//   if (cached) return cached; // Cache hit!
//   // Cache miss — call LLM
//   const result = await llm.generate(...);
//   await cache.set(systemPrompt, userMessage, result);

import { createHash } from "crypto";
import type { AIGenerateResult } from "./types";

interface CacheEntry {
  /** SHA-256 hash of the prompt fingerprint */
  key: string;
  /** Cached result */
  result: AIGenerateResult;
  /** When the entry was created */
  createdAt: number;
  /** Number of times this entry was accessed */
  hits: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 100;
    this.ttlMs = options?.ttlMs ?? 30 * 60 * 1000; // 30 minutes default
  }

  /**
   * Generate a cache key from prompt components.
   * Uses SHA-256 for consistent, collision-resistant hashing.
   * Includes workspaceId to prevent cross-tenant data leaks.
   */
  private generateKey(
    systemPrompt: string,
    userMessage: string,
    model?: string,
    workspaceId?: string
  ): string {
    const fingerprint = [
      workspaceId || "global",
      "---",
      systemPrompt,
      "---",
      userMessage,
      "---",
      model || "default",
    ].join("\n");

    return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
  }

  /**
   * Get a cached response if available and not expired.
   */
  get(
    systemPrompt: string,
    userMessage: string,
    model?: string,
    workspaceId?: string
  ): AIGenerateResult | null {
    const key = this.generateKey(systemPrompt, userMessage, model, workspaceId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Cache hit!
    entry.hits++;
    return entry.result;
  }

  /**
   * Store a response in the cache.
   */
  set(
    systemPrompt: string,
    userMessage: string,
    result: AIGenerateResult,
    model?: string,
    workspaceId?: string
  ): void {
    const key = this.generateKey(systemPrompt, userMessage, model, workspaceId);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      key,
      result,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  /**
   * Evict the oldest entry (LRU-like).
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    entries: number;
    totalHits: number;
    hitRate: number;
  } {
    let totalHits = 0;
    let totalAccesses = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalAccesses += entry.hits + 1; // +1 for the initial set
    }

    return {
      entries: this.cache.size,
      totalHits,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
    };
  }
}

// Singleton
let instance: ResponseCache | null = null;

export function getResponseCache(): ResponseCache {
  if (!instance) {
    instance = new ResponseCache();
  }
  return instance;
}

export function resetResponseCache(): void {
  instance = null;
}
