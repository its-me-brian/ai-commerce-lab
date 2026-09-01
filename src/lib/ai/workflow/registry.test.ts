// Workflow Registry Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkflowRegistry, resetWorkflowRegistry } from "./registry";
import type { WorkflowDefinition } from "./types";

// Mock Supabase to avoid real DB calls
vi.mock("../../database/supabase", () => {
  function createMockChain() {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.delete = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    return chain;
  }
  return {
    supabase: {
      from: vi.fn().mockReturnValue(createMockChain()),
    },
  };
});

function makeWorkflow(id: string, overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id,
    name: `Workflow ${id}`,
    description: `Description for ${id}`,
    version: "1.0.0",
    nodes: [],
    enabled: true,
    ...overrides,
  };
}

describe("WorkflowRegistry", () => {
  let registry: WorkflowRegistry;

  beforeEach(() => {
    resetWorkflowRegistry();
    registry = new WorkflowRegistry();
  });

  describe("register / get / has", () => {
    it("registers and retrieves a workflow", async () => {
      const wf = makeWorkflow("test-1");
      await registry.register(wf);

      expect(await registry.has("test-1")).toBe(true);
      expect(await registry.get("test-1")).toEqual(wf);
    });

    it("returns undefined for unknown workflow", async () => {
      expect(await registry.get("unknown")).toBeUndefined();
      expect(await registry.has("unknown")).toBe(false);
    });

    it("overwrites existing workflow with same ID", async () => {
      const wf1 = makeWorkflow("test-1", { name: "Version 1" });
      const wf2 = makeWorkflow("test-1", { name: "Version 2" });

      await registry.register(wf1);
      await registry.register(wf2);

      expect((await registry.get("test-1"))?.name).toBe("Version 2");
    });
  });

  describe("registerAll", () => {
    it("registers multiple workflows at once", async () => {
      await registry.registerAll([
        makeWorkflow("wf-1"),
        makeWorkflow("wf-2"),
        makeWorkflow("wf-3"),
      ]);

      expect(registry.size).toBe(3);
    });
  });

  describe("unregister", () => {
    it("removes a workflow", async () => {
      await registry.register(makeWorkflow("test-1"));
      expect(await registry.unregister("test-1")).toBe(true);
      expect(await registry.has("test-1")).toBe(false);
    });

    it("returns true for unknown workflow (no-op)", async () => {
      expect(await registry.unregister("unknown")).toBe(true);
    });
  });

  describe("list", () => {
    it("lists all registered workflows", async () => {
      await registry.registerAll([
        makeWorkflow("wf-1"),
        makeWorkflow("wf-2"),
      ]);

      const list = await registry.list();
      expect(list).toHaveLength(2);
    });

    it("returns empty array when no workflows", async () => {
      expect(await registry.list()).toEqual([]);
    });
  });

  describe("listEnabled", () => {
    it("lists only enabled workflows", async () => {
      await registry.registerAll([
        makeWorkflow("wf-1", { enabled: true }),
        makeWorkflow("wf-2", { enabled: false }),
        makeWorkflow("wf-3", { enabled: true }),
      ]);

      const enabled = await registry.listEnabled();
      expect(enabled).toHaveLength(2);
      expect(enabled.map((w) => w.id)).toEqual(["wf-1", "wf-3"]);
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      await registry.registerAll([
        makeWorkflow("research", { tags: ["research", "ai"], name: "Research Workflow" }),
        makeWorkflow("marketing", { tags: ["marketing"], name: "Marketing Campaign" }),
        makeWorkflow("validation", { tags: ["validation"], enabled: false, name: "Validation Pipeline" }),
      ]);
    });

    it("filters by enabled", async () => {
      const result = await registry.query({ enabled: true });
      expect(result).toHaveLength(2);
    });

    it("filters by tags", async () => {
      const result = await registry.query({ tags: ["research"] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("research");
    });

    it("filters by name contains", async () => {
      const result = await registry.query({ nameContains: "campaign" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("marketing");
    });

    it("combines multiple filters", async () => {
      const result = await registry.query({ enabled: true, tags: ["ai"] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("research");
    });

    it("returns all when no filters", async () => {
      const result = await registry.query({});
      expect(result).toHaveLength(3);
    });
  });

  describe("size", () => {
    it("returns correct count", async () => {
      expect(registry.size).toBe(0);
      await registry.register(makeWorkflow("wf-1"));
      expect(registry.size).toBe(1);
      await registry.register(makeWorkflow("wf-2"));
      expect(registry.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all workflows", async () => {
      await registry.registerAll([makeWorkflow("a"), makeWorkflow("b")]);
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe("DB persistence", () => {
    it("ensureLoaded loads from DB on first access", async () => {
      const { supabase } = await import("../../database/supabase");
      const mockChain = {
        select: vi.fn().mockResolvedValue({
          data: [
            { id: "db-wf-1", name: "DB Workflow", description: "From DB", version: "1.0.0", enabled: true, nodes: [], entry_nodes: null, config: {}, tags: ["db"] },
          ],
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      };
      vi.mocked(supabase.from).mockReturnValueOnce(mockChain as never);

      const freshRegistry = new WorkflowRegistry();
      await freshRegistry.ensureLoaded();

      expect(freshRegistry.size).toBe(1);
      const wf = await freshRegistry.get("db-wf-1");
      expect(wf?.name).toBe("DB Workflow");
      expect(wf?.tags).toEqual(["db"]);
    });

    it("loadFromDB is idempotent", async () => {
      await registry.register(makeWorkflow("wf-1"));
      expect(registry.size).toBe(1);

      // First loadFromDB — loads empty from DB (default mock), doesn't clear cache
      await registry.loadFromDB();
      expect(registry.size).toBe(1);

      // Second loadFromDB — already loaded, no-op
      await registry.loadFromDB();
      expect(registry.size).toBe(1);
    });
  });
});
