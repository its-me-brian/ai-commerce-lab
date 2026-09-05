// Working Memory Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WorkingMemory,
  getWorkingMemory,
  resetWorkingMemory,
  clearWorkingMemory,
} from "./working-memory";

describe("WorkingMemory", () => {
  let memory: WorkingMemory;

  beforeEach(() => {
    memory = new WorkingMemory();
  });

  describe("basic operations", () => {
    it("stores and retrieves values", () => {
      memory.set("key1", "value1", "source1");
      expect(memory.get("key1")).toBe("value1");
    });

    it("stores nested values via dot-notation keys", () => {
      memory.set("classifier.bestCategory", "marketing", "classifier");
      memory.set("classifier.confidence", 0.85, "classifier");
      expect(memory.get("classifier.bestCategory")).toBe("marketing");
      expect(memory.get("classifier.confidence")).toBe(0.85);
    });

    it("returns undefined for missing keys", () => {
      expect(memory.get("nonexistent")).toBeUndefined();
    });

    it("overwrites existing keys", () => {
      memory.set("key1", "old", "src");
      memory.set("key1", "new", "src");
      expect(memory.get("key1")).toBe("new");
    });

    it("has() checks key existence", () => {
      memory.set("key1", "value1", "src");
      expect(memory.has("key1")).toBe(true);
      expect(memory.has("key2")).toBe(false);
    });

    it("delete() removes a key", () => {
      memory.set("key1", "value1", "src");
      expect(memory.delete("key1")).toBe(true);
      expect(memory.has("key1")).toBe(false);
      expect(memory.delete("key1")).toBe(false);
    });

    it("clear() removes all entries", () => {
      memory.set("a", 1, "src");
      memory.set("b", 2, "src");
      memory.clear();
      expect(memory.size).toBe(0);
    });
  });

  describe("source-based queries", () => {
    it("getBySource() returns all entries from a source", () => {
      memory.set("a", 1, "classifier");
      memory.set("b", 2, "classifier");
      memory.set("c", 3, "researcher");

      const classifierData = memory.getBySource("classifier");
      expect(classifierData).toEqual({ a: 1, b: 2 });
    });

    it("deleteBySource() removes all entries from a source", () => {
      memory.set("a", 1, "classifier");
      memory.set("b", 2, "classifier");
      memory.set("c", 3, "researcher");

      const deleted = memory.deleteBySource("classifier");
      expect(deleted).toBe(2);
      expect(memory.size).toBe(1);
    });

    it("getAll() returns all non-expired entries", () => {
      memory.set("a", 1, "src1");
      memory.set("b", 2, "src2");
      expect(memory.getAll()).toEqual({ a: 1, b: 2 });
    });
  });

  describe("TTL expiration", () => {
    it("expires entries after TTL", () => {
      memory.set("key1", "value1", "src", { ttlMs: 50 });
      expect(memory.get("key1")).toBe("value1");

      // Wait for expiration
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      expect(memory.get("key1")).toBeUndefined();
      vi.useRealTimers();
    });

    it("does not expire entries without TTL", () => {
      memory.set("key1", "value1", "src");
      expect(memory.get("key1")).toBe("value1");
    });

    it("cleanup() removes expired entries", () => {
      memory.set("a", 1, "src", { ttlMs: 50 });
      memory.set("b", 2, "src");

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      const cleaned = memory.cleanup();
      expect(cleaned).toBe(1);
      expect(memory.size).toBe(1);
      vi.useRealTimers();
    });
  });

  describe("merge", () => {
    it("merges another working memory", () => {
      memory.set("a", 1, "src1");

      const other = new WorkingMemory();
      other.set("b", 2, "src2");
      other.set("a", 100, "src1"); // Overwrite

      memory.merge(other);
      expect(memory.get("a")).toBe(100);
      expect(memory.get("b")).toBe(2);
    });
  });

  describe("size", () => {
    it("counts non-expired entries", () => {
      memory.set("a", 1, "src");
      memory.set("b", 2, "src", { ttlMs: 50 });
      expect(memory.size).toBe(2);

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      expect(memory.size).toBe(1);
      vi.useRealTimers();
    });
  });

  describe("export/import", () => {
    it("exports and imports memory state", () => {
      memory.set("a", { x: 1 }, "src1");
      memory.set("b", "text", "src2");

      const exported = memory.export();
      const newMemory = new WorkingMemory();
      newMemory.import(exported);

      expect(newMemory.get("a")).toEqual({ x: 1 });
      expect(newMemory.get("b")).toBe("text");
    });
  });

  describe("confidence", () => {
    it("stores confidence score", () => {
      memory.set("key1", "value1", "src", { confidence: 0.8 });
      const entry = memory.getAllEntries().get("key1");
      expect(entry?.confidence).toBe(0.8);
    });

    it("defaults confidence to 1", () => {
      memory.set("key1", "value1", "src");
      const entry = memory.getAllEntries().get("key1");
      expect(entry?.confidence).toBe(1);
    });
  });
});

describe("singleton", () => {
  beforeEach(() => {
    clearWorkingMemory();
  });

  it("getWorkingMemory() creates isolated instances (no shared singleton)", () => {
    const m1 = getWorkingMemory();
    m1.set("key", "value", "src");
    const m2 = getWorkingMemory();
    // m2 should be a fresh instance, NOT share state with m1
    expect(m2).not.toBe(m1);
    expect(m2.has("key")).toBe(false);
  });

  it("resetWorkingMemory() creates a fresh instance", () => {
    const m1 = getWorkingMemory();
    m1.set("key", "value", "src");
    const m2 = resetWorkingMemory();
    expect(m2.size).toBe(0);
    expect(m2).not.toBe(m1);
  });

  it("clearWorkingMemory() is a no-op (API compatibility)", () => {
    const m1 = getWorkingMemory();
    clearWorkingMemory();
    const m2 = getWorkingMemory();
    // Both are fresh instances — no shared state
    expect(m1).not.toBe(m2);
  });
});
