// Mini-AI Registry Tests
import { describe, it, expect, beforeEach } from "vitest";
import {
  MiniAIRegistry,
  getMiniAIRegistry,
  resetMiniAIRegistry,
  type MiniAIDefinition,
} from "./index";

function createTestMiniAI(overrides: Partial<MiniAIDefinition> = {}): MiniAIDefinition {
  return {
    id: "test-mini-ai",
    name: "Test Mini-AI",
    description: "A test mini-AI",
    category: "testing",
    type: "classifier",
    executionMode: "deterministic",
    inputSchema: {},
    outputSchema: {},
    modelRequirements: {
      complexity: "simple",
    },
    enabled: true,
    version: "1.0.0",
    tags: ["test"],
    ...overrides,
  };
}

describe("MiniAIRegistry", () => {
  let registry: MiniAIRegistry;

  beforeEach(() => {
    registry = new MiniAIRegistry();
  });

  describe("registration", () => {
    it("registers a mini-AI definition", () => {
      const def = createTestMiniAI();
      registry.register(def);
      expect(registry.has("test-mini-ai")).toBe(true);
      expect(registry.get("test-mini-ai")).toBe(def);
    });

    it("overwrites existing registration with same id", () => {
      const def1 = createTestMiniAI({ name: "Version 1" });
      const def2 = createTestMiniAI({ name: "Version 2" });
      registry.register(def1);
      registry.register(def2);
      expect(registry.get("test-mini-ai")?.name).toBe("Version 2");
    });

    it("registers multiple definitions at once", () => {
      const defs = [
        createTestMiniAI({ id: "a", name: "A" }),
        createTestMiniAI({ id: "b", name: "B" }),
        createTestMiniAI({ id: "c", name: "C" }),
      ];
      registry.registerAll(defs);
      expect(registry.count()).toBe(3);
    });

    it("unregisters a mini-AI", () => {
      registry.register(createTestMiniAI());
      const result = registry.unregister("test-mini-ai");
      expect(result).toBe(true);
      expect(registry.has("test-mini-ai")).toBe(false);
    });

    it("returns false when unregistering non-existent", () => {
      expect(registry.unregister("nonexistent")).toBe(false);
    });
  });

  describe("retrieval", () => {
    it("returns undefined for non-existent id", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("getOrThrow throws for non-existent id", () => {
      expect(() => registry.getOrThrow("nonexistent")).toThrow("Mini-AI not found: nonexistent");
    });

    it("getOrThrow returns definition when found", () => {
      const def = createTestMiniAI();
      registry.register(def);
      expect(registry.getOrThrow("test-mini-ai")).toBe(def);
    });

    it("lists all registered definitions", () => {
      registry.register(createTestMiniAI({ id: "a" }));
      registry.register(createTestMiniAI({ id: "b" }));
      expect(registry.list()).toHaveLength(2);
    });

    it("lists only enabled definitions", () => {
      registry.register(createTestMiniAI({ id: "a", enabled: true }));
      registry.register(createTestMiniAI({ id: "b", enabled: false }));
      expect(registry.listEnabled()).toHaveLength(1);
      expect(registry.listEnabled()[0].id).toBe("a");
    });
  });

  describe("queries", () => {
    beforeEach(() => {
      registry.register(createTestMiniAI({
        id: "researcher",
        type: "researcher",
        category: "research",
        tags: ["product", "supplier"],
        modelRequirements: { complexity: "moderate" },
      }));
      registry.register(createTestMiniAI({
        id: "classifier",
        type: "classifier",
        category: "validation",
        tags: ["product"],
        modelRequirements: { complexity: "simple" },
      }));
      registry.register(createTestMiniAI({
        id: "critic",
        type: "critic",
        category: "validation",
        tags: ["quality"],
        enabled: false,
        modelRequirements: { complexity: "complex" },
      }));
    });

    it("filters by type", () => {
      expect(registry.listByType("researcher")).toHaveLength(1);
      expect(registry.listByType("classifier")).toHaveLength(1);
      expect(registry.listByType("critic")).toHaveLength(1);
    });

    it("filters by category", () => {
      expect(registry.listByCategory("research")).toHaveLength(1);
      expect(registry.listByCategory("validation")).toHaveLength(2);
    });

    it("filters by tags (ANY match)", () => {
      expect(registry.listByTags(["product"])).toHaveLength(2);
      expect(registry.listByTags(["supplier"])).toHaveLength(1);
      expect(registry.listByTags(["quality"])).toHaveLength(1);
      expect(registry.listByTags(["nonexistent"])).toHaveLength(0);
    });

    it("advanced query filters by multiple options", () => {
      const results = registry.query({ type: "classifier", enabled: true });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("classifier");
    });

    it("advanced query filters by complexity", () => {
      const results = registry.query({ complexity: "complex" });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("critic");
    });

    it("gets unique categories", () => {
      const categories = registry.getCategories();
      expect(categories).toContain("research");
      expect(categories).toContain("validation");
      expect(categories.length).toBe(2);
    });

    it("gets unique tags", () => {
      const tags = registry.getTags();
      expect(tags).toContain("product");
      expect(tags).toContain("supplier");
      expect(tags).toContain("quality");
      expect(tags.length).toBe(3);
    });
  });

  describe("counts", () => {
    it("returns correct count", () => {
      expect(registry.count()).toBe(0);
      registry.register(createTestMiniAI({ id: "a" }));
      registry.register(createTestMiniAI({ id: "b" }));
      expect(registry.count()).toBe(2);
    });

    it("returns correct enabled count", () => {
      registry.register(createTestMiniAI({ id: "a", enabled: true }));
      registry.register(createTestMiniAI({ id: "b", enabled: false }));
      expect(registry.enabledCount()).toBe(1);
    });
  });

  describe("modification", () => {
    it("enables a mini-AI", () => {
      registry.register(createTestMiniAI({ enabled: false }));
      expect(registry.enable("test-mini-ai")).toBe(true);
      expect(registry.get("test-mini-ai")?.enabled).toBe(true);
    });

    it("disables a mini-AI", () => {
      registry.register(createTestMiniAI({ enabled: true }));
      expect(registry.disable("test-mini-ai")).toBe(true);
      expect(registry.get("test-mini-ai")?.enabled).toBe(false);
    });

    it("enable/disable returns false for non-existent", () => {
      expect(registry.enable("nonexistent")).toBe(false);
      expect(registry.disable("nonexistent")).toBe(false);
    });

    it("clears all registrations", () => {
      registry.register(createTestMiniAI({ id: "a" }));
      registry.register(createTestMiniAI({ id: "b" }));
      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });

  describe("singleton", () => {
    beforeEach(() => {
      resetMiniAIRegistry();
    });

    it("returns the same instance", () => {
      const r1 = getMiniAIRegistry();
      const r2 = getMiniAIRegistry();
      expect(r1).toBe(r2);
    });

    it("reset creates a new instance", () => {
      const r1 = getMiniAIRegistry();
      r1.register(createTestMiniAI());
      resetMiniAIRegistry();
      const r2 = getMiniAIRegistry();
      expect(r2.count()).toBe(0);
      expect(r1).not.toBe(r2);
    });
  });
});
