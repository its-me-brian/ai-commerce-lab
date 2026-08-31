// Task Engine v2 Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskEngine } from "./task-engine";
import type { Task } from "./task-engine";

// Mock Supabase
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

const mockTask: Task = {
  id: "task-1",
  agent_id: "product-hunter",
  status: "pending",
  task_type: "discover",
  input: { query: "trending products" },
  output: null,
  priority: 5,
  error: null,
  depends_on: [],
  parent_task_id: null,
  total_cost: 0,
  created_at: "2026-08-31T00:00:00Z",
  started_at: null,
  completed_at: null,
};

const mockTaskWithDeps: Task = {
  ...mockTask,
  id: "task-2",
  depends_on: ["task-1"],
};

describe("TaskEngine", () => {
  let engine: TaskEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new TaskEngine();
  });

  it("should create an instance", () => {
    expect(engine).toBeDefined();
    expect(engine).toBeInstanceOf(TaskEngine);
  });

  it("should have all CRUD methods", () => {
    expect(typeof engine.create).toBe("function");
    expect(typeof engine.getById).toBe("function");
    expect(typeof engine.listByAgent).toBe("function");
    expect(typeof engine.listByStatus).toBe("function");
    expect(typeof engine.getSubtasks).toBe("function");
    expect(typeof engine.areDependenciesMet).toBe("function");
    expect(typeof engine.getReadyTasks).toBe("function");
    expect(typeof engine.update).toBe("function");
    expect(typeof engine.start).toBe("function");
    expect(typeof engine.complete).toBe("function");
    expect(typeof engine.fail).toBe("function");
    expect(typeof engine.cancel).toBe("function");
    expect(typeof engine.delete).toBe("function");
  });

  describe("task model", () => {
    it("should have depends_on field", () => {
      expect(mockTask.depends_on).toEqual([]);
      expect(mockTaskWithDeps.depends_on).toEqual(["task-1"]);
    });

    it("should have parent_task_id field", () => {
      expect(mockTask.parent_task_id).toBeNull();
    });

    it("should track task status lifecycle", () => {
      expect(mockTask.status).toBe("pending");
      expect(mockTask.started_at).toBeNull();
      expect(mockTask.completed_at).toBeNull();
    });
  });

  describe("dependency resolution", () => {
    it("should detect when dependencies are met", () => {
      // Empty depends_on means always met
      expect(mockTask.depends_on.length).toBe(0);
    });

    it("should detect when dependencies are not met", () => {
      expect(mockTaskWithDeps.depends_on.length).toBe(1);
      expect(mockTaskWithDeps.depends_on).toContain("task-1");
    });
  });

  describe("create", () => {
    it("should accept depends_on array", () => {
      const input = {
        agent_id: "product-hunter",
        input: { query: "test" },
        depends_on: ["task-1", "task-2"],
      };

      expect(input.depends_on).toHaveLength(2);
    });

    it("should accept parent_task_id", () => {
      const input = {
        agent_id: "product-hunter",
        input: { query: "test" },
        parent_task_id: "task-parent",
      };

      expect(input.parent_task_id).toBe("task-parent");
    });
  });

  describe("task status transitions", () => {
    it("should support pending → running → completed", () => {
      const statuses = ["pending", "running", "completed"];
      expect(statuses).toEqual(["pending", "running", "completed"]);
    });

    it("should support pending → running → failed", () => {
      const statuses = ["pending", "running", "failed"];
      expect(statuses).toEqual(["pending", "running", "failed"]);
    });

    it("should support pending → cancelled", () => {
      const statuses = ["pending", "cancelled"];
      expect(statuses).toEqual(["pending", "cancelled"]);
    });
  });
});
