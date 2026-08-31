// DAG Executor Tests

import { describe, it, expect, vi } from "vitest";

// Mock supabase (needed because dag-executor imports task-engine → supabase)
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

import { detectCycles, topologicalSort } from "./dag-executor";

describe("DAG Executor", () => {
  describe("detectCycles", () => {
    it("should return null for no cycles", () => {
      const tasks = [
        { id: "a", depends_on: [] },
        { id: "b", depends_on: ["a"] },
        { id: "c", depends_on: ["a", "b"] },
      ];

      expect(detectCycles(tasks)).toBeNull();
    });

    it("should detect a simple cycle", () => {
      const tasks = [
        { id: "a", depends_on: ["b"] },
        { id: "b", depends_on: ["a"] },
      ];

      const cycle = detectCycles(tasks);
      expect(cycle).not.toBeNull();
      expect(cycle).toContain("a");
      expect(cycle).toContain("b");
    });

    it("should detect a longer cycle", () => {
      const tasks = [
        { id: "a", depends_on: ["c"] },
        { id: "b", depends_on: ["a"] },
        { id: "c", depends_on: ["b"] },
      ];

      const cycle = detectCycles(tasks);
      expect(cycle).not.toBeNull();
    });

    it("should handle independent tasks", () => {
      const tasks = [
        { id: "a", depends_on: [] },
        { id: "b", depends_on: [] },
        { id: "c", depends_on: [] },
      ];

      expect(detectCycles(tasks)).toBeNull();
    });

    it("should handle empty task list", () => {
      expect(detectCycles([])).toBeNull();
    });

    it("should handle linear dependencies", () => {
      const tasks = [
        { id: "a", depends_on: [] },
        { id: "b", depends_on: ["a"] },
        { id: "c", depends_on: ["b"] },
        { id: "d", depends_on: ["c"] },
      ];

      expect(detectCycles(tasks)).toBeNull();
    });
  });

  describe("topologicalSort", () => {
    it("should sort tasks with no dependencies", () => {
      const tasks = [
        { id: "a", depends_on: [] },
        { id: "b", depends_on: [] },
        { id: "c", depends_on: [] },
      ];

      const result = topologicalSort(tasks);
      expect(result).toHaveLength(3);
      expect(result).toContain("a");
      expect(result).toContain("b");
      expect(result).toContain("c");
    });

    it("should put dependencies before dependents", () => {
      const tasks = [
        { id: "c", depends_on: ["a", "b"] },
        { id: "a", depends_on: [] },
        { id: "b", depends_on: ["a"] },
      ];

      const result = topologicalSort(tasks);
      expect(result).not.toBeNull();

      const indexA = result!.indexOf("a");
      const indexB = result!.indexOf("b");
      const indexC = result!.indexOf("c");

      // a must come before b and c
      expect(indexA).toBeLessThan(indexB);
      expect(indexA).toBeLessThan(indexC);
      // b must come before c
      expect(indexB).toBeLessThan(indexC);
    });

    it("should return null for cycles", () => {
      const tasks = [
        { id: "a", depends_on: ["b"] },
        { id: "b", depends_on: ["a"] },
      ];

      expect(topologicalSort(tasks)).toBeNull();
    });

    it("should handle complex DAG", () => {
      const tasks = [
        { id: "task-1", depends_on: [] },
        { id: "task-2", depends_on: [] },
        { id: "task-3", depends_on: ["task-1", "task-2"] },
        { id: "task-4", depends_on: ["task-3"] },
        { id: "task-5", depends_on: ["task-3"] },
        { id: "task-6", depends_on: ["task-4", "task-5"] },
      ];

      const result = topologicalSort(tasks);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(6);

      // Verify ordering constraints
      const idx = (id: string) => result!.indexOf(id);
      expect(idx("task-1")).toBeLessThan(idx("task-3"));
      expect(idx("task-2")).toBeLessThan(idx("task-3"));
      expect(idx("task-3")).toBeLessThan(idx("task-4"));
      expect(idx("task-3")).toBeLessThan(idx("task-5"));
      expect(idx("task-4")).toBeLessThan(idx("task-6"));
      expect(idx("task-5")).toBeLessThan(idx("task-6"));
    });

    it("should handle empty task list", () => {
      expect(topologicalSort([])).toEqual([]);
    });

    it("should handle single task", () => {
      const tasks = [{ id: "a", depends_on: [] }];
      expect(topologicalSort(tasks)).toEqual(["a"]);
    });
  });
});
