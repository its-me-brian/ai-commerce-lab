// Workflow Registry Tests
import { describe, it, expect, beforeEach } from "vitest";
import { WorkflowRegistry, resetWorkflowRegistry } from "./registry";
import type { WorkflowDefinition } from "./types";

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
    it("registers and retrieves a workflow", () => {
      const wf = makeWorkflow("test-1");
      registry.register(wf);

      expect(registry.has("test-1")).toBe(true);
      expect(registry.get("test-1")).toBe(wf);
    });

    it("returns undefined for unknown workflow", () => {
      expect(registry.get("unknown")).toBeUndefined();
      expect(registry.has("unknown")).toBe(false);
    });

    it("overwrites existing workflow with same ID", () => {
      const wf1 = makeWorkflow("test-1", { name: "Version 1" });
      const wf2 = makeWorkflow("test-1", { name: "Version 2" });

      registry.register(wf1);
      registry.register(wf2);

      expect(registry.get("test-1")?.name).toBe("Version 2");
    });
  });

  describe("registerAll", () => {
    it("registers multiple workflows at once", () => {
      registry.registerAll([
        makeWorkflow("wf-1"),
        makeWorkflow("wf-2"),
        makeWorkflow("wf-3"),
      ]);

      expect(registry.size).toBe(3);
    });
  });

  describe("unregister", () => {
    it("removes a workflow", () => {
      registry.register(makeWorkflow("test-1"));
      expect(registry.unregister("test-1")).toBe(true);
      expect(registry.has("test-1")).toBe(false);
    });

    it("returns false for unknown workflow", () => {
      expect(registry.unregister("unknown")).toBe(false);
    });
  });

  describe("list", () => {
    it("lists all registered workflows", () => {
      registry.registerAll([
        makeWorkflow("wf-1"),
        makeWorkflow("wf-2"),
      ]);

      const list = registry.list();
      expect(list).toHaveLength(2);
    });

    it("returns empty array when no workflows", () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe("listEnabled", () => {
    it("lists only enabled workflows", () => {
      registry.registerAll([
        makeWorkflow("wf-1", { enabled: true }),
        makeWorkflow("wf-2", { enabled: false }),
        makeWorkflow("wf-3", { enabled: true }),
      ]);

      const enabled = registry.listEnabled();
      expect(enabled).toHaveLength(2);
      expect(enabled.map((w) => w.id)).toEqual(["wf-1", "wf-3"]);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      registry.registerAll([
        makeWorkflow("research", { tags: ["research", "ai"], name: "Research Workflow" }),
        makeWorkflow("marketing", { tags: ["marketing"], name: "Marketing Campaign" }),
        makeWorkflow("validation", { tags: ["validation"], enabled: false, name: "Validation Pipeline" }),
      ]);
    });

    it("filters by enabled", () => {
      const result = registry.query({ enabled: true });
      expect(result).toHaveLength(2);
    });

    it("filters by tags", () => {
      const result = registry.query({ tags: ["research"] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("research");
    });

    it("filters by name contains", () => {
      const result = registry.query({ nameContains: "campaign" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("marketing");
    });

    it("combines multiple filters", () => {
      const result = registry.query({ enabled: true, tags: ["ai"] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("research");
    });

    it("returns all when no filters", () => {
      const result = registry.query({});
      expect(result).toHaveLength(3);
    });
  });

  describe("size", () => {
    it("returns correct count", () => {
      expect(registry.size).toBe(0);
      registry.register(makeWorkflow("wf-1"));
      expect(registry.size).toBe(1);
      registry.register(makeWorkflow("wf-2"));
      expect(registry.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all workflows", () => {
      registry.registerAll([makeWorkflow("a"), makeWorkflow("b")]);
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});
