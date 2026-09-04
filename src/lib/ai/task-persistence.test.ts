// Task Persistence Tests
// FASE 28: Audit trail for task lifecycle events.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskPersistence, type TaskEvent } from "./task-persistence";

// Mock Supabase with a Proxy-based chain that resolves any method chain
const mockResolvedData = (data: unknown, error: unknown = null) =>
  Promise.resolve({ data, error });

function createMockQuery(returnData: unknown = null, returnError: unknown = null) {
  const result = { data: returnData, error: returnError };

  // Returns a Proxy that intercepts any method call and returns itself,
  // but when used with await (thenable), resolves to the result.
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable — when awaited, resolve with result
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      if (prop === " Symbol.toPrimitive") return undefined;
      // Any method call returns a new proxy (chainable)
      return () => new Proxy({}, handler);
    },
  };

  return new Proxy({}, handler);
}

vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => createMockQuery()),
  },
}));

// Mock TaskEngine
vi.mock("./task-engine", () => ({
  getTaskEngine: () => ({
    getById: vi.fn().mockResolvedValue({
      id: "task-1",
      agent_id: "agent-1",
      status: "running",
      task_type: "general",
      input: {},
      output: null,
      priority: 5,
      error: null,
      depends_on: [],
      parent_task_id: null,
      total_cost: 0,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
    }),
  }),
}));

describe("TaskPersistence", () => {
  let persistence: TaskPersistence;

  beforeEach(() => {
    vi.clearAllMocks();
    persistence = new TaskPersistence();
  });

  describe("recordEvent", () => {
    it("should record a task event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-1",
        task_id: "task-1",
        event_type: "created",
        from_status: null,
        to_status: "pending",
        message: "Task created",
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordEvent("task-1", "created", {
        toStatus: "pending",
        message: "Task created",
      });

      expect(event).toEqual(mockEvent);
      expect(supabase.from).toHaveBeenCalledWith("task_events");
    });
  });

  describe("recordStatusChange", () => {
    it("should record a status change event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-2",
        task_id: "task-1",
        event_type: "status_change",
        from_status: "pending",
        to_status: "running",
        message: "Status changed from pending to running",
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordStatusChange("task-1", "pending", "running");

      expect(event).toEqual(mockEvent);
    });
  });

  describe("recordProgress", () => {
    it("should record a progress update", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-3",
        task_id: "task-1",
        event_type: "progress_update",
        from_status: null,
        to_status: null,
        message: "50% — Searching suppliers",
        metadata: { progressPercent: 50, currentStep: "Searching suppliers" },
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordProgress("task-1", 50, "Searching suppliers");

      expect(event).toEqual(mockEvent);
    });
  });

  describe("recordError", () => {
    it("should record an error event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-4",
        task_id: "task-1",
        event_type: "error",
        from_status: null,
        to_status: null,
        message: "API timeout",
        metadata: { statusCode: 504 },
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordError("task-1", "API timeout", {
        statusCode: 504,
      });

      expect(event).toEqual(mockEvent);
    });
  });

  describe("recordDelegation", () => {
    it("should record a delegation event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-5",
        task_id: "task-1",
        event_type: "delegate",
        from_status: null,
        to_status: null,
        message: "Delegated from agent-1 to agent-2",
        metadata: { fromAgentId: "agent-1", toAgentId: "agent-2" },
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordDelegation(
        "task-1",
        "agent-1",
        "agent-2",
        "Specialized expertise needed"
      );

      expect(event).toEqual(mockEvent);
    });
  });

  describe("recordRetry", () => {
    it("should record a retry event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-6",
        task_id: "task-1",
        event_type: "retry",
        from_status: null,
        to_status: null,
        message: "Retry attempt #2",
        metadata: { attemptNumber: 2 },
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.recordRetry("task-1", 2, "Rate limited");

      expect(event).toEqual(mockEvent);
    });
  });

  describe("getEventsByTask", () => {
    it("should return events for a task", async () => {
      const mockEvents: TaskEvent[] = [
        {
          id: "evt-1",
          task_id: "task-1",
          event_type: "created",
          from_status: null,
          to_status: "pending",
          message: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvents)
      );

      const events = await persistence.getEventsByTask("task-1");

      expect(events).toEqual(mockEvents);
      expect(supabase.from).toHaveBeenCalledWith("task_events");
    });

    it("should return empty array on error", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "fail" })
      );

      const events = await persistence.getEventsByTask("task-1");

      expect(events).toEqual([]);
    });
  });

  describe("getEventsByType", () => {
    it("should filter events by type", async () => {
      const mockEvents: TaskEvent[] = [
        {
          id: "evt-1",
          task_id: "task-1",
          event_type: "error",
          from_status: null,
          to_status: null,
          message: "Error 1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvents)
      );

      const events = await persistence.getEventsByType("task-1", "error");

      expect(events).toEqual(mockEvents);
    });
  });

  describe("getLatestEvent", () => {
    it("should return the latest event", async () => {
      const mockEvent: TaskEvent = {
        id: "evt-latest",
        task_id: "task-1",
        event_type: "progress_update",
        from_status: null,
        to_status: null,
        message: "Latest",
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvent)
      );

      const event = await persistence.getLatestEvent("task-1");

      expect(event).toEqual(mockEvent);
    });
  });

  describe("getTaskProgress", () => {
    it("should calculate task progress from events", async () => {
      const mockEvents: TaskEvent[] = [
        {
          id: "evt-1",
          task_id: "task-1",
          event_type: "created",
          from_status: null,
          to_status: "pending",
          message: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "evt-2",
          task_id: "task-1",
          event_type: "progress_update",
          from_status: null,
          to_status: null,
          message: "50% — Searching",
          metadata: { progressPercent: 50, currentStep: "Searching" },
          created_at: new Date().toISOString(),
        },
      ];

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvents)
      );

      const progress = await persistence.getTaskProgress("task-1", "ws-test");

      expect(progress).toBeDefined();
      expect(progress?.taskId).toBe("task-1");
      expect(progress?.status).toBe("running");
      expect(progress?.progressPercent).toBe(50);
      expect(progress?.currentStep).toBe("Searching");
      expect(progress?.events.length).toBe(2);
    });
  });

  describe("getStats", () => {
    it("should calculate event statistics", async () => {
      const mockEvents: TaskEvent[] = [
        {
          id: "evt-1",
          task_id: "task-1",
          event_type: "created",
          from_status: null,
          to_status: "pending",
          message: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "evt-2",
          task_id: "task-1",
          event_type: "error",
          from_status: null,
          to_status: null,
          message: "Error",
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockEvents)
      );

      const stats = await persistence.getStats("ws-test");

      expect(stats.total).toBe(2);
      expect(stats.byType.created).toBe(1);
      expect(stats.byType.error).toBe(1);
      expect(stats.errorRate).toBe(0.5);
    });

    it("should return zero stats on error", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "fail" })
      );

      const stats = await persistence.getStats("ws-test");

      expect(stats.total).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });

  describe("cleanupOldEvents", () => {
    it("should delete old events and return count", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([{ id: "1" }, { id: "2" }])
      );

      const count = await persistence.cleanupOldEvents("ws-test", 30);

      expect(count).toBe(2);
    });

    it("should return 0 on error", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "fail" })
      );

      const count = await persistence.cleanupOldEvents("ws-test", 30);

      expect(count).toBe(0);
    });
  });
});
