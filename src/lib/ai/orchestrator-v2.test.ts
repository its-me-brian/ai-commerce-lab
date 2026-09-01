// Orchestrator v2 Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OrchestratorV2,
  getOrchestratorV2,
  resetOrchestratorV2,
} from "./orchestrator-v2";

// Mock the AgentEngine to avoid Supabase calls
vi.mock("../agents/core/engine", () => {
  return {
    AgentEngine: vi.fn().mockImplementation(function () {
      return {
        executeTask: vi.fn().mockResolvedValue({
          taskId: "mock-task",
          result: {
            success: true,
            output: "Mock agent output",
            structuredData: { mock: true },
            errors: [],
            metadata: {
              providerUsed: "gemini",
              modelUsed: "gemini-3-flash",
              inputTokens: 100,
              outputTokens: 50,
              durationMs: 1000,
              cached: false,
            },
          },
        }),
      };
    }),
  };
});

// Mock the MiniAIEngine
vi.mock("./mini-ai/engine", () => ({
  getMiniAIEngine: () => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: { result: "mock-mini-ai" },
      confidence: 0.8,
      errors: [],
      warnings: [],
      metadata: {
        miniAIId: "mock",
        modelUsed: "deterministic",
        providerUsed: "none",
        executionMode: "deterministic",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 100,
        costDollars: 0,
        usedFallback: false,
        cached: false,
      },
    }),
    executeChain: vi.fn().mockResolvedValue([
      {
        success: true,
        output: { result: "chain-step-1" },
        errors: [],
        warnings: [],
        metadata: {
          miniAIId: "step-1",
          modelUsed: "deterministic",
          providerUsed: "none",
          executionMode: "deterministic",
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 50,
          costDollars: 0,
          usedFallback: false,
          cached: false,
        },
      },
    ]),
  }),
}));

// Mock the complexity router
vi.mock("./complexity-router", () => ({
  selectModelByComplexity: vi.fn().mockResolvedValue({
    match: { model: { name: "mock-model" }, score: 100 },
    complexity: "simple",
    estimatedCostDollars: 0.001,
    reasoning: "Mock selection",
    fallbacks: [],
  }),
}));

// Mock the router for LLM intent classification
const mockRouterGenerate = vi.fn().mockResolvedValue({
  result: {
    content: "general",
    provider: "gemini",
    model: "gemini-3-flash",
    inputTokens: 20,
    outputTokens: 5,
    durationMs: 100,
    cached: false,
  },
  log: {},
});

vi.mock("./router", () => ({
  getRouter: () => ({
    generate: mockRouterGenerate,
  }),
}));

describe("OrchestratorV2", () => {
  let orchestrator: OrchestratorV2;

  beforeEach(() => {
    resetOrchestratorV2();
    orchestrator = getOrchestratorV2();
    mockRouterGenerate.mockClear();
    mockRouterGenerate.mockResolvedValue({
      result: {
        content: "general",
        provider: "gemini",
        model: "gemini-3-flash",
        inputTokens: 20,
        outputTokens: 5,
        durationMs: 100,
        cached: false,
      },
      log: {},
    });
  });

  describe("planning", () => {
    it("classifies product research intent", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "product_research", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      const plan = await orchestrator.plan("Find wireless earbuds to sell");

      expect(plan.intent).toBe("product_research");
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.confidence).toBeGreaterThan(0);
    });

    it("classifies marketing intent via LLM", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "marketing", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      const plan = await orchestrator.plan("Create a marketing campaign");
      expect(plan.intent).toBe("marketing");
    });

    it("classifies pricing intent via LLM", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "pricing", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      const plan = await orchestrator.plan("Calculate the price and margin");
      expect(plan.intent).toBe("pricing");
    });

    it("classifies supplier intent via LLM", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "supplier_research", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      const plan = await orchestrator.plan("Find suppliers for electronics");
      expect(plan.intent).toBe("supplier_research");
    });

    it("falls back to keyword classification when LLM fails", async () => {
      mockRouterGenerate.mockRejectedValueOnce(new Error("LLM unavailable"));

      const plan = await orchestrator.plan("Find wireless earbuds to sell");
      // Should still classify via keyword fallback
      expect(plan.intent).toBe("product_research");
    });

    it("falls back to keyword classification when LLM returns invalid intent", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "invalid_intent", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      const plan = await orchestrator.plan("Hello, how are you?");
      // "invalid_intent" not in valid list → falls to general via keyword
      expect(plan.intent).toBe("general");
    });

    it("uses LLM for classification (router called)", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: { content: "seo", provider: "gemini", model: "gemini-3-flash", inputTokens: 20, outputTokens: 5, durationMs: 100, cached: false },
        log: {},
      });

      await orchestrator.plan("Optimize my product SEO keywords");

      expect(mockRouterGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: "orchestrator:intent-classifier" }),
        expect.objectContaining({ prompt: "Optimize my product SEO keywords" })
      );
    });

    it("estimates cost and duration", async () => {
      const plan = await orchestrator.plan("Analyze this product");

      expect(plan.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(plan.estimatedDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("execution", () => {
    it("executes a plan successfully", async () => {
      const plan = await orchestrator.plan("Analyze this product");
      const result = await orchestrator.execute(plan);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.metadata.stepsExecuted).toBeGreaterThan(0);
    });

    it("tracks step results", async () => {
      const plan = await orchestrator.plan("Calculate pricing");
      const result = await orchestrator.execute(plan);

      expect(result.stepResults).toBeDefined();
      expect(Array.isArray(result.stepResults)).toBe(true);
    });

    it("calculates total cost and duration", async () => {
      const plan = await orchestrator.plan("Research products");
      const result = await orchestrator.execute(plan);

      expect(result.metadata.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("planAndExecute", () => {
    it("plans and executes in one call", async () => {
      const result = await orchestrator.planAndExecute("Find and analyze wireless earbuds");

      expect(result.success).toBe(true);
      expect(result.planId).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe("singleton", () => {
    it("returns the same instance", () => {
      const o1 = getOrchestratorV2();
      const o2 = getOrchestratorV2();
      expect(o1).toBe(o2);
    });

    it("reset creates a new instance", () => {
      const o1 = getOrchestratorV2();
      resetOrchestratorV2();
      const o2 = getOrchestratorV2();
      expect(o1).not.toBe(o2);
    });
  });
});
