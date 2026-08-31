// Multi-Agent Orchestrator Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MultiAgentOrchestrator } from "./multi-agent-orchestrator";

// Mock Supabase
const mockFrom = vi.fn();
vi.mock("../database/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock AgentEngine
const mockExecuteTask = vi.fn();
vi.mock("../agents/core/engine", () => ({
  AgentEngine: vi.fn().mockImplementation(function() {
    return { executeTask: mockExecuteTask };
  }),
}));

// Mock bootstrap
vi.mock("./bootstrap", () => ({
  bootstrap: vi.fn().mockResolvedValue(undefined),
  getAgentRegistry: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({ isEnabled: () => true }),
    has: vi.fn().mockReturnValue(true),
  }),
}));

describe("MultiAgentOrchestrator", () => {
  let orchestrator: MultiAgentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new MultiAgentOrchestrator();
  });

  it("should create an instance", () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator).toBeInstanceOf(MultiAgentOrchestrator);
  });

  describe("execute", () => {
    it("should execute sequential tasks in order", async () => {
      const callOrder: string[] = [];

      mockExecuteTask.mockImplementation(async (agentId: string) => {
        callOrder.push(agentId);
        return {
          taskId: `task-${agentId}`,
          result: {
            success: true,
            output: `Result from ${agentId}`,
            structuredData: { agent: agentId },
            reasoningSummary: `Summary from ${agentId}`,
            errors: [],
            metadata: {
              providerUsed: "test",
              modelUsed: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 100,
              cached: false,
            },
          },
        };
      });

      const result = await orchestrator.execute({
        sequential: [
          { agentId: "agent-a", input: { test: true } },
          { agentId: "agent-b", input: { test: true } },
        ],
      });

      expect(result.success).toBe(true);
      expect(callOrder).toEqual(["agent-a", "agent-b"]);
      expect(result.results).toHaveLength(2);
    });

    it("should execute parallel tasks concurrently", async () => {
      const startTimes: Record<string, number> = {};

      mockExecuteTask.mockImplementation(async (agentId: string) => {
        startTimes[agentId] = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          taskId: `task-${agentId}`,
          result: {
            success: true,
            output: `Result from ${agentId}`,
            structuredData: { agent: agentId },
            reasoningSummary: `Summary from ${agentId}`,
            errors: [],
            metadata: {
              providerUsed: "test",
              modelUsed: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 10,
              cached: false,
            },
          },
        };
      });

      const result = await orchestrator.execute({
        parallel: [
          { agentId: "agent-a", input: { test: true } },
          { agentId: "agent-b", input: { test: true } },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);

      // Both should start at roughly the same time
      const times = Object.values(startTimes);
      expect(Math.abs(times[0] - times[1])).toBeLessThan(20);
    });

    it("should handle agent errors gracefully", async () => {
      mockExecuteTask.mockImplementation(async (agentId: string) => {
        if (agentId === "failing-agent") {
          throw new Error("Agent execution failed");
        }
        return {
          taskId: `task-${agentId}`,
          result: {
            success: true,
            output: "Success",
            structuredData: {},
            reasoningSummary: "",
            errors: [],
            metadata: {
              providerUsed: "test",
              modelUsed: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 100,
              cached: false,
            },
          },
        };
      });

      const result = await orchestrator.execute({
        sequential: [
          { agentId: "failing-agent", input: {} },
          { agentId: "good-agent", input: {} },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("failing-agent");
    });

    it("should aggregate token counts", async () => {
      mockExecuteTask.mockImplementation(async (agentId: string) => ({
        taskId: `task-${agentId}`,
        result: {
          success: true,
          output: "Success",
          structuredData: {},
          reasoningSummary: "",
          errors: [],
          metadata: {
            providerUsed: "test",
            modelUsed: "test-model",
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 100,
            cached: false,
          },
        },
      }));

      const result = await orchestrator.execute({
        parallel: [
          { agentId: "agent-a", input: {} },
          { agentId: "agent-b", input: {} },
        ],
      });

      expect(result.totalInputTokens).toBe(200);
      expect(result.totalOutputTokens).toBe(100);
    });
  });

  describe("executeChain", () => {
    it("should pass results from one agent to the next", async () => {
      const inputs: Record<string, unknown>[] = [];

      mockExecuteTask.mockImplementation(async (agentId: string, input: Record<string, unknown>) => {
        inputs.push({ agentId, input: { ...input } });
        return {
          taskId: `task-${agentId}`,
          result: {
            success: true,
            output: `Result from ${agentId}`,
            structuredData: { data: `${agentId}-output` },
            reasoningSummary: "",
            errors: [],
            metadata: {
              providerUsed: "test",
              modelUsed: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 100,
              cached: false,
            },
          },
        };
      });

      const result = await orchestrator.executeChain(
        [
          { agentId: "agent-a", input: {} },
          { agentId: "agent-b", input: {} },
        ],
        { initialData: true }
      );

      expect(result.success).toBe(true);
      expect(inputs).toHaveLength(2);

      // Second agent should receive first agent's result
      expect(inputs[1].input).toHaveProperty("agent-aResult");
    });

    it("should stop chain on failure", async () => {
      const callOrder: string[] = [];

      mockExecuteTask.mockImplementation(async (agentId: string) => {
        callOrder.push(agentId);
        if (agentId === "failing-agent") {
          throw new Error("Chain stopped");
        }
        return {
          taskId: `task-${agentId}`,
          result: {
            success: true,
            output: "Success",
            structuredData: {},
            reasoningSummary: "",
            errors: [],
            metadata: {
              providerUsed: "test",
              modelUsed: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 100,
              cached: false,
            },
          },
        };
      });

      const result = await orchestrator.executeChain(
        [
          { agentId: "agent-a", input: {} },
          { agentId: "failing-agent", input: {} },
          { agentId: "agent-c", input: {} },
        ],
        {}
      );

      expect(result.success).toBe(false);
      expect(callOrder).toEqual(["agent-a", "failing-agent"]);
      expect(result.results).toHaveLength(1); // Only agent-a completed
    });
  });

  describe("getAgentResult", () => {
    it("should find result for specific agent", async () => {
      mockExecuteTask.mockImplementation(async (agentId: string) => ({
        taskId: `task-${agentId}`,
        result: {
          success: true,
          output: "Success",
          structuredData: { agent: agentId },
          reasoningSummary: "",
          errors: [],
          metadata: {
            providerUsed: "test",
            modelUsed: "test-model",
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 100,
            cached: false,
          },
        },
      }));

      const result = await orchestrator.execute({
        parallel: [
          { agentId: "market-research", input: {} },
          { agentId: "supplier-research", input: {} },
        ],
      });

      const marketResult = orchestrator.getAgentResult(result, "market-research");
      expect(marketResult).toBeDefined();
      expect(marketResult?.agentId).toBe("market-research");
    });

    it("should return undefined for non-existent agent", async () => {
      mockExecuteTask.mockImplementation(async (agentId: string) => ({
        taskId: `task-${agentId}`,
        result: {
          success: true,
          output: "Success",
          structuredData: {},
          reasoningSummary: "",
          errors: [],
          metadata: {
            providerUsed: "test",
            modelUsed: "test-model",
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 100,
            cached: false,
          },
        },
      }));

      const result = await orchestrator.execute({
        parallel: [{ agentId: "agent-a", input: {} }],
      });

      const missing = orchestrator.getAgentResult(result, "non-existent");
      expect(missing).toBeUndefined();
    });
  });

  describe("getStructuredData", () => {
    it("should extract structured data from agent result", async () => {
      mockExecuteTask.mockImplementation(async (agentId: string) => ({
        taskId: `task-${agentId}`,
        result: {
          success: true,
          output: "Success",
          structuredData: { marketSize: "large", trends: [] },
          reasoningSummary: "",
          errors: [],
          metadata: {
            providerUsed: "test",
            modelUsed: "test-model",
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 100,
            cached: false,
          },
        },
      }));

      const result = await orchestrator.execute({
        parallel: [{ agentId: "market-research", input: {} }],
      });

      const data = orchestrator.getStructuredData<{ marketSize: string }>(
        result,
        "market-research"
      );
      expect(data).toBeDefined();
      expect(data?.marketSize).toBe("large");
    });
  });
});
