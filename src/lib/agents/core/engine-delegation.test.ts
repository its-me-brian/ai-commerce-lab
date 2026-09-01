// Agent Engine — Mini-AI Delegation Tests
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentEngine } from "./engine";

// ============================================
// Mocks
// ============================================

// Mock Supabase
const mockFrom = vi.fn();

vi.mock("../../database/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function createChain(terminalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(terminalResult),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return chain;
}

// Mock MiniAIEngine
const mockMiniAIExecute = vi.fn();
vi.mock("../../ai/mini-ai/engine", () => ({
  getMiniAIEngine: () => ({
    execute: mockMiniAIExecute,
    executeChain: vi.fn(),
  }),
}));

// Mock logEvent
vi.mock("../../logging/event-logger", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock AgentRegistry
vi.mock("../../ai/bootstrap", () => ({
  getAgentRegistry: () => ({
    get: vi.fn().mockReturnValue({
      isEnabled: () => true,
      validateInput: () => [],
      execute: vi.fn(),
    }),
    getDefinition: vi.fn().mockReturnValue(null),
  }),
}));

// Mock Tool Registry
vi.mock("../../tools/bootstrap", () => ({
  getToolRegistry: () => ({
    list: () => [],
  }),
}));

// Mock Permission Checker
vi.mock("../../permissions/checker", () => ({
  getPermissionChecker: () => ({
    validateExecution: vi.fn().mockResolvedValue({ allowed: true, denied: [] }),
  }),
}));

// Mock Prompt Builder
vi.mock("./prompt-builder", () => ({
  getPromptBuilder: () => ({
    build: vi.fn().mockReturnValue({ systemPrompt: "test prompt" }),
  }),
}));

// Mock Workspace Service
vi.mock("../../workspaces/service", () => ({
  getWorkspaceService: () => ({
    buildCompanyContext: vi.fn().mockResolvedValue({}),
    formatContextForPrompt: vi.fn().mockReturnValue(""),
  }),
}));

// Mock Agent Memory Service
vi.mock("../../ai/agent-memory", () => ({
  getAgentMemoryService: () => ({
    getRecent: vi.fn().mockResolvedValue([]),
    store: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ============================================
// Tests
// ============================================

describe("AgentEngine — Mini-AI Delegation", () => {
  let engine: AgentEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AgentEngine();
  });

  describe("delegateToMiniAI", () => {
    it("calls miniAIEngine.execute with correct params", async () => {
      mockMiniAIExecute.mockResolvedValueOnce({
        success: true,
        output: { bestCategory: "electronics", confidence: 0.9 },
        errors: [],
        metadata: { miniAIId: "classifier", executionMode: "deterministic" },
      });

      const result = await engine.delegateToMiniAI("product-hunter", "classifier", {
        text: "Wireless headphones",
      });

      expect(mockMiniAIExecute).toHaveBeenCalledWith("classifier", {
        text: "Wireless headphones",
      });
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ bestCategory: "electronics", confidence: 0.9 });
    });

    it("propagates mini-AI errors without throwing", async () => {
      mockMiniAIExecute.mockResolvedValueOnce({
        success: false,
        output: null,
        errors: ["Mini-AI not found: nonexistent"],
        metadata: { miniAIId: "nonexistent", executionMode: "deterministic" },
      });

      const result = await engine.delegateToMiniAI("product-hunter", "nonexistent", {});

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Mini-AI not found: nonexistent");
    });
  });

  describe("delegateChainToMiniAI", () => {
    it("executes steps sequentially, chaining outputs", async () => {
      mockMiniAIExecute
        .mockResolvedValueOnce({
          success: true,
          output: { text: "Research results about wireless headphones" },
          errors: [],
          metadata: { miniAIId: "researcher" },
        })
        .mockResolvedValueOnce({
          success: true,
          output: { bestCategory: "electronics", confidence: 0.85 },
          errors: [],
          metadata: { miniAIId: "classifier" },
        });

      const results = await engine.delegateChainToMiniAI("product-hunter", [
        { miniAIId: "researcher", input: { query: "wireless headphones" } },
        { miniAIId: "classifier", input: { text: "Research results about wireless headphones" } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockMiniAIExecute).toHaveBeenCalledTimes(2);
    });

    it("returns empty array for empty steps", async () => {
      const results = await engine.delegateChainToMiniAI("product-hunter", []);

      expect(results).toHaveLength(0);
    });

    it("continues chain even if a step fails", async () => {
      mockMiniAIExecute
        .mockResolvedValueOnce({
          success: false,
          output: null,
          errors: ["Failed"],
          metadata: { miniAIId: "researcher" },
        })
        .mockResolvedValueOnce({
          success: true,
          output: { result: "ok" },
          errors: [],
          metadata: { miniAIId: "summarizer" },
        });

      const results = await engine.delegateChainToMiniAI("product-hunter", [
        { miniAIId: "researcher", input: { query: "test" } },
        { miniAIId: "summarizer", input: { text: "test" } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });
});
