// Agent Delegation Tests

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockGetAgent, mockCreate, mockListByAgent } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
  mockCreate: vi.fn(),
  mockListByAgent: vi.fn(),
}));

vi.mock("./bootstrap", () => ({
  bootstrap: vi.fn().mockResolvedValue(undefined),
  getAgentRegistry: vi.fn().mockReturnValue({
    get: mockGetAgent,
  }),
}));

vi.mock("./task-engine", () => ({
  getTaskEngine: vi.fn().mockReturnValue({
    create: mockCreate,
    listByAgent: mockListByAgent,
  }),
}));

import { delegateTask, getDelegatedTasks, hasPendingDelegations } from "./delegation";

describe("Agent Delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgent.mockImplementation((id: string) => {
      if (id === "agent-a" || id === "agent-b") {
        return { id, name: `Agent ${id}` };
      }
      return null;
    });
  });

  describe("delegateTask", () => {
    it("should create a task assigned to target agent", async () => {
      mockCreate.mockResolvedValue({
        id: "task-del-1",
        agent_id: "agent-b",
        status: "pending",
        input: { _delegatedBy: "agent-a", query: "find products" },
      });

      const result = await delegateTask({
        fromAgentId: "agent-a",
        toAgentId: "agent-b",
        taskType: "research",
        input: { query: "find products" },
      });

      expect(result.task.id).toBe("task-del-1");
      expect(result.message).toContain("agent-a");
      expect(result.message).toContain("agent-b");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: "agent-b",
          task_type: "research",
          input: expect.objectContaining({
            query: "find products",
            _delegatedBy: "agent-a",
          }),
        }),
        ""
      );
    });

    it("should throw for unknown source agent", async () => {
      await expect(
        delegateTask({
          fromAgentId: "unknown",
          toAgentId: "agent-b",
          taskType: "research",
          input: {},
        })
      ).rejects.toThrow("Source agent not found");
    });

    it("should throw for unknown target agent", async () => {
      await expect(
        delegateTask({
          fromAgentId: "agent-a",
          toAgentId: "unknown",
          taskType: "research",
          input: {},
        })
      ).rejects.toThrow("Target agent not found");
    });

    it("should include priority in task creation", async () => {
      mockCreate.mockResolvedValue({
        id: "task-priority",
        agent_id: "agent-b",
        status: "pending",
        input: {},
      });

      await delegateTask({
        fromAgentId: "agent-a",
        toAgentId: "agent-b",
        taskType: "urgent",
        input: {},
        priority: 1,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 1 }),
        ""
      );
    });

    it("should include dependencies in task creation", async () => {
      mockCreate.mockResolvedValue({
        id: "task-deps",
        agent_id: "agent-b",
        status: "pending",
        input: {},
      });

      await delegateTask({
        fromAgentId: "agent-a",
        toAgentId: "agent-b",
        taskType: "research",
        input: {},
        dependsOn: ["task-1", "task-2"],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ depends_on: ["task-1", "task-2"] }),
        ""
      );
    });
  });

  describe("getDelegatedTasks", () => {
    it("should filter tasks with _delegatedBy field", async () => {
      mockListByAgent.mockResolvedValue([
        {
          id: "task-1",
          agent_id: "agent-b",
          input: { _delegatedBy: "agent-a", query: "test" },
          status: "pending",
        },
        {
          id: "task-2",
          agent_id: "agent-b",
          input: { query: "direct task" },
          status: "pending",
        },
      ]);

      const tasks = await getDelegatedTasks("agent-b", "ws-test");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("task-1");
    });
  });

  describe("hasPendingDelegations", () => {
    it("should return true when there are pending delegations", async () => {
      mockListByAgent.mockResolvedValue([
        {
          id: "task-1",
          agent_id: "agent-b",
          input: { _delegatedBy: "agent-a" },
          status: "pending",
        },
      ]);

      expect(await hasPendingDelegations("agent-b", "ws-test")).toBe(true);
    });

    it("should return false when no pending delegations", async () => {
      mockListByAgent.mockResolvedValue([
        {
          id: "task-1",
          agent_id: "agent-b",
          input: { _delegatedBy: "agent-a" },
          status: "completed",
        },
      ]);

      expect(await hasPendingDelegations("agent-b", "ws-test")).toBe(false);
    });
  });
});
