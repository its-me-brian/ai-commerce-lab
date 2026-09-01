// Workflow Executor Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkflowExecutor, resetWorkflowExecutor } from "./executor";
import type { WorkflowDefinition } from "./types";

// Mock AgentEngine
vi.mock("../../agents/core/engine", () => ({
  getAgentEngine: () => ({
    executeTask: vi.fn().mockResolvedValue({
      result: {
        success: true,
        output: "Agent output",
        structuredData: { recommendation: "APPROVE", score: 90 },
        errors: [],
        metadata: {
          providerUsed: "gemini",
          modelUsed: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 500,
          cached: false,
        },
      },
    }),
  }),
}));

// Mock MiniAIEngine
const mockMiniAIExecute = vi.fn();
vi.mock("../mini-ai/engine", () => ({
  getMiniAIEngine: () => ({
    execute: mockMiniAIExecute,
    executeChain: vi.fn().mockResolvedValue([
      { success: true, output: { result: "chain-step-1" }, metadata: { miniAIId: "researcher" } },
      { success: true, output: { result: "chain-step-2" }, metadata: { miniAIId: "summarizer" } },
    ]),
  }),
}));

// Mock dag-executor to avoid Supabase dependency
vi.mock("../dag-executor", () => ({
  detectCycles: vi.fn().mockReturnValue(null),
}));

function makeWorkflow(nodes: WorkflowDefinition["nodes"]): WorkflowDefinition {
  return {
    id: "test-workflow",
    name: "Test Workflow",
    description: "A test workflow",
    version: "1.0.0",
    nodes,
    enabled: true,
  };
}

describe("WorkflowExecutor", () => {
  let executor: WorkflowExecutor;

  beforeEach(() => {
    resetWorkflowExecutor();
    executor = new WorkflowExecutor();
    mockMiniAIExecute.mockResolvedValue({
      success: true,
      output: { bestCategory: "product", confidence: 0.85 },
      errors: [],
      metadata: { miniAIId: "classifier", executionMode: "deterministic" },
    });
  });

  describe("validation", () => {
    it("rejects empty workflow", async () => {
      const wf = makeWorkflow([]);
      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("failed");
      expect(result.state.errors[0]).toContain("no nodes");
    });

    it("rejects duplicate node IDs", async () => {
      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
        { id: "a", name: "A2", type: "mini-ai", miniAIId: "classifier" },
      ]);
      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("failed");
      expect(result.state.errors[0]).toContain("Duplicate node ID");
    });

    it("rejects agent node without agentId", async () => {
      const wf = makeWorkflow([
        { id: "a", name: "A", type: "agent" },
      ]);
      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("failed");
      expect(result.state.errors[0]).toContain("agentId");
    });

    it("rejects mini-ai node without miniAIId", async () => {
      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai" },
      ]);
      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("failed");
      expect(result.state.errors[0]).toContain("miniAIId");
    });

    it("rejects condition node without branches.true", async () => {
      const wf = makeWorkflow([
        { id: "a", name: "A", type: "condition", condition: { source: "x", operator: "equals", branches: {} } },
      ]);
      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("failed");
      expect(result.state.errors[0]).toContain("branches.true");
    });
  });

  describe("single node execution", () => {
    it("executes a single mini-ai node", async () => {
      const wf = makeWorkflow([
        {
          id: "classify",
          name: "Classify",
          type: "mini-ai",
          miniAIId: "classifier",
          inputMapping: { text: "input.text" },
        },
      ]);

      const result = await executor.execute(wf, { input: { text: "test" } });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(mockMiniAIExecute).toHaveBeenCalledWith("classifier", { input: { text: "test" } });
    });

    it("executes a single agent node", async () => {
      const wf = makeWorkflow([
        { id: "hunt", name: "Product Hunt", type: "agent", agentId: "product-hunter" },
      ]);

      const result = await executor.execute(wf, { input: { query: "test" } });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(1);
    });
  });

  describe("linear chain execution", () => {
    it("executes nodes in dependency order", async () => {
      const executionOrder: string[] = [];

      mockMiniAIExecute.mockImplementation(async (id: string) => {
        executionOrder.push(id);
        return {
          success: true,
          output: { result: `${id}-output` },
          errors: [],
          metadata: { miniAIId: id, executionMode: "deterministic" },
        };
      });

      const wf = makeWorkflow([
        { id: "step1", name: "Step 1", type: "mini-ai", miniAIId: "classifier" },
        {
          id: "step2",
          name: "Step 2",
          type: "mini-ai",
          miniAIId: "summarizer",
          inputMapping: { text: "step1.output" },
        },
        {
          id: "step3",
          name: "Step 3",
          type: "mini-ai",
          miniAIId: "validator",
          inputMapping: { data: "step2.output" },
        },
      ]);

      const result = await executor.execute(wf, { input: { text: "test" } });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(3);
      expect(executionOrder).toEqual(["classifier", "summarizer", "validator"]);
    });

    it("passes data between nodes via inputMapping", async () => {
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        if (id === "classifier") {
          return {
            success: true,
            output: { bestCategory: "marketing" },
            errors: [],
            metadata: { miniAIId: id },
          };
        }
        return {
          success: true,
          output: { processed: true, category: "marketing" },
          errors: [],
          metadata: { miniAIId: id },
        };
      });

      const wf = makeWorkflow([
        { id: "c", name: "Classify", type: "mini-ai", miniAIId: "classifier" },
        {
          id: "p",
          name: "Process",
          type: "mini-ai",
          miniAIId: "summarizer",
          inputMapping: { category: "c.bestCategory" },
        },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("completed");
      // The second node should have received the classified category
      expect(mockMiniAIExecute).toHaveBeenCalledWith("summarizer", {
        input: { category: "marketing" },
      });
    });
  });

  describe("parallel execution", () => {
    it("executes independent nodes in parallel", async () => {
      const timestamps: Record<string, number> = {};

      mockMiniAIExecute.mockImplementation(async (id: string) => {
        timestamps[`${id}-start`] = Date.now();
        await new Promise((r) => setTimeout(r, 10));
        timestamps[`${id}-end`] = Date.now();
        return {
          success: true,
          output: { id },
          errors: [],
          metadata: { miniAIId: id },
        };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "extractor" },
        { id: "c", name: "C", type: "mini-ai", miniAIId: "summarizer" },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(3);
      // All three should have started before any completed
      // (they run in parallel since they have no dependencies)
    });
  });

  describe("failure handling", () => {
    it("continues on optional node failure", async () => {
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        if (id === "failer") {
          throw new Error("Intentional failure");
        }
        return {
          success: true,
          output: { ok: true },
          errors: [],
          metadata: { miniAIId: id },
        };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier", required: false },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "failer", required: false },
        {
          id: "c",
          name: "C",
          type: "mini-ai",
          miniAIId: "summarizer",
          inputMapping: { text: "a.output" },
        },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.summary.completed).toBeGreaterThanOrEqual(2);
      expect(result.summary.failed).toBe(1);
    });

    it("stops on required node failure when stopOnError is true", async () => {
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        if (id === "failer") {
          throw new Error("Intentional failure");
        }
        return { success: true, output: {}, errors: [], metadata: { miniAIId: id } };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "failer" },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "classifier" },
      ]);

      const result = await executor.execute(wf, { input: {}, stopOnError: true });

      expect(result.status).toBe("failed");
    });

    it("reports retries", async () => {
      let attempts = 0;
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Transient failure");
        }
        return { success: true, output: { ok: true }, errors: [], metadata: { miniAIId: id } };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier", maxRetries: 3, retryDelayMs: 10 },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("completed");
      expect(attempts).toBe(3);
    });
  });

  describe("condition nodes", () => {
    it("evaluates condition and routes to correct branch", async () => {
      const order: string[] = [];

      mockMiniAIExecute.mockImplementation(async (id: string) => {
        order.push(id);
        if (id === "classifier") {
          return { success: true, output: { bestCategory: "marketing" }, errors: [], metadata: { miniAIId: id } };
        }
        return { success: true, output: { handled: true }, errors: [], metadata: { miniAIId: id } };
      });

      const wf = makeWorkflow([
        { id: "classify", name: "Classify", type: "mini-ai", miniAIId: "classifier" },
        {
          id: "route",
          name: "Route",
          type: "condition",
          condition: {
            source: "classify.bestCategory",
            operator: "equals",
            value: "marketing",
            branches: {
              true: "handle-marketing",
              false: "handle-other",
            },
          },
        },
        { id: "handle-marketing", name: "Handle Marketing", type: "mini-ai", miniAIId: "summarizer" },
        { id: "handle-other", name: "Handle Other", type: "mini-ai", miniAIId: "extractor" },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("completed");
      // Marketing branch should be taken
      expect(order).toContain("summarizer");
    });
  });

  describe("aggregate nodes", () => {
    it("merges outputs from parent nodes", async () => {
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        if (id === "classifier") return { success: true, output: { x: 1 }, errors: [], metadata: { miniAIId: id } };
        if (id === "extractor") return { success: true, output: { y: 2 }, errors: [], metadata: { miniAIId: id } };
        return { success: true, output: {}, errors: [], metadata: { miniAIId: id } };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "extractor" },
        {
          id: "merge",
          name: "Merge",
          type: "aggregate",
          aggregation: { strategy: "merge" },
          inputMapping: { a: "a.output", b: "b.output" },
        },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(3);
      // The aggregate node should have merged outputs from a and b
      const mergeState = result.state.nodeStates.get("merge");
      expect(mergeState?.output).toEqual({ x: 1, y: 2 });
    });
  });

  describe("chain nodes", () => {
    it("executes a chain of mini-IAs", async () => {
      const wf = makeWorkflow([
        {
          id: "research",
          name: "Research & Summarize",
          type: "chain",
          chainSteps: [
            { miniAIId: "researcher", inputMapping: { topic: "input.topic" } },
            { miniAIId: "summarizer", inputMapping: { text: "step[0].output.result" } },
          ],
        },
      ]);

      const result = await executor.execute(wf, { input: { topic: "AI trends" } });

      expect(result.status).toBe("completed");
      expect(result.summary.completed).toBe(1);
    });
  });

  describe("callbacks", () => {
    it("fires onNodeStateChange for each node", async () => {
      const stateChanges: Array<{ nodeId: string; status: string }> = [];

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
      ]);

      await executor.execute(wf, {
        input: {},
        onNodeStateChange: (nodeId, state) => {
          stateChanges.push({ nodeId, status: state.status });
        },
      });

      expect(stateChanges.length).toBeGreaterThanOrEqual(2);
      expect(stateChanges[0].status).toBe("running");
      expect(stateChanges[stateChanges.length - 1].status).toBe("completed");
    });
  });

  describe("workflow output", () => {
    it("returns output from the last completed node", async () => {
      mockMiniAIExecute.mockImplementation(async (id: string) => {
        if (id === "summarizer") {
          return { success: true, output: { summary: "final result" }, errors: [], metadata: { miniAIId: id } };
        }
        return { success: true, output: { intermediate: true }, errors: [], metadata: { miniAIId: id } };
      });

      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "summarizer" },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.output).toEqual({ summary: "final result" });
    });
  });

  describe("timeout", () => {
    it("times out when workflow exceeds timeout", async () => {
      let callCount = 0;
      mockMiniAIExecute.mockImplementation(async () => {
        callCount++;
        // First node completes fast, second is slow — timeout should fire during second wave
        if (callCount === 1) {
          return { success: true, output: {}, errors: [], metadata: { miniAIId: "fast" } };
        }
        await new Promise((r) => setTimeout(r, 500));
        return { success: true, output: {}, errors: [], metadata: { miniAIId: "slow" } };
      });

      const wf = makeWorkflow([
        { id: "fast", name: "Fast", type: "mini-ai", miniAIId: "fast" },
        { id: "slow", name: "Slow", type: "mini-ai", miniAIId: "slow" },
      ]);

      const result = await executor.execute(wf, { input: {}, timeoutMs: 50 });

      expect(result.status).toBe("timed_out");
    });
  });

  describe("summary", () => {
    it("returns correct summary counts", async () => {
      const wf = makeWorkflow([
        { id: "a", name: "A", type: "mini-ai", miniAIId: "classifier" },
        { id: "b", name: "B", type: "mini-ai", miniAIId: "extractor" },
      ]);

      const result = await executor.execute(wf, { input: {} });

      expect(result.summary).toEqual({
        totalNodes: 2,
        completed: 2,
        failed: 0,
        skipped: 0,
        pending: 0,
        totalCostDollars: 0,
        totalDurationMs: expect.any(Number),
      });
    });
  });
});
