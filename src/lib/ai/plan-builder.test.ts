// Plan Builder Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlanBuilder, getPlanBuilder, resetPlanBuilder } from "./plan-builder";

// Mock the router for LLM calls
const mockRouterGenerate = vi.fn();

vi.mock("./router", () => ({
  getRouter: () => ({
    generate: mockRouterGenerate,
  }),
}));

// Mock the registries
vi.mock("./bootstrap", () => ({
  getAgentRegistry: () => ({
    listDefinitions: () => [
      { id: "ceo", role: "general task handler", capabilities: ["general"] },
      { id: "marketing", role: "marketing content", capabilities: ["marketing"] },
      { id: "finance", role: "financial analysis", capabilities: ["pricing"] },
    ],
  }),
}));

vi.mock("./mini-ai/registry", () => ({
  getMiniAIRegistry: () => ({
    listEnabled: () => [
      { id: "researcher", type: "researcher", description: "Research a topic", modelRequirements: { complexity: "moderate" } },
      { id: "classifier", type: "classifier", description: "Classify input", modelRequirements: { complexity: "simple" } },
      { id: "summarizer", type: "summarizer", description: "Summarize text", modelRequirements: { complexity: "simple" } },
      { id: "critic", type: "critic", description: "Evaluate quality", modelRequirements: { complexity: "simple" } },
    ],
  }),
}));

describe("PlanBuilder", () => {
  let builder: PlanBuilder;

  beforeEach(() => {
    resetPlanBuilder();
    builder = getPlanBuilder();
    mockRouterGenerate.mockClear();
  });

  describe("LLM-based plan generation", () => {
    it("generates a plan from LLM response", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: {
          content: JSON.stringify({
            steps: [
              { id: "research", type: "mini-ai", miniAIId: "researcher", complexity: "moderate", description: "Research the product" },
              { id: "classify", type: "mini-ai", miniAIId: "classifier", complexity: "simple", description: "Classify findings" },
            ],
            reasoning: "Research then classify for product analysis",
          }),
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });

      const result = await builder.buildPlan("Find wireless earbuds to sell", "product_research");

      expect(result.source).toBe("llm");
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].miniAIId).toBe("researcher");
      expect(result.steps[1].miniAIId).toBe("classifier");
      expect(result.reasoning).toContain("Research then classify");
    });

    it("handles LLM response wrapped in markdown code block", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: {
          content: "```json\n" + JSON.stringify({
            steps: [
              { id: "step-1", type: "agent", agentId: "marketing", complexity: "complex", description: "Generate content" },
            ],
            reasoning: "Marketing content generation",
          }) + "\n```",
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });

      const result = await builder.buildPlan("Create ad copy", "marketing");

      expect(result.source).toBe("llm");
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].agentId).toBe("marketing");
    });

    it("validates agent IDs against registry", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: {
          content: JSON.stringify({
            steps: [
              { id: "valid", type: "agent", agentId: "marketing", complexity: "simple", description: "Valid agent" },
              { id: "invalid", type: "agent", agentId: "nonexistent-agent", complexity: "simple", description: "Invalid agent" },
            ],
            reasoning: "Test validation",
          }),
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });

      const result = await builder.buildPlan("Test validation", "general");

      // Invalid agent should be filtered out
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].agentId).toBe("marketing");
    });

    it("validates mini-AI IDs against registry", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: {
          content: JSON.stringify({
            steps: [
              { id: "valid", type: "mini-ai", miniAIId: "researcher", complexity: "simple", description: "Valid mini-AI" },
              { id: "invalid", type: "mini-ai", miniAIId: "nonexistent-mini-ai", complexity: "simple", description: "Invalid mini-AI" },
            ],
            reasoning: "Test mini-AI validation",
          }),
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });

      const result = await builder.buildPlan("Test validation", "analysis");

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].miniAIId).toBe("researcher");
    });

    it("throws when all steps are invalid", async () => {
      mockRouterGenerate.mockResolvedValueOnce({
        result: {
          content: JSON.stringify({
            steps: [
              { id: "bad", type: "agent", agentId: "fake-agent", complexity: "simple", description: "Invalid" },
            ],
            reasoning: "All invalid",
          }),
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });

      // Should fall back to static plan
      const result = await builder.buildPlan("Test", "general");
      expect(result.source).toBe("fallback");
    });
  });

  describe("static fallback", () => {
    it("falls back to static plan when LLM fails", async () => {
      mockRouterGenerate.mockRejectedValueOnce(new Error("LLM unavailable"));

      const result = await builder.buildPlan("Find products", "product_research");

      expect(result.source).toBe("fallback");
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain("LLM");
    });

    it("falls back for unknown intent", async () => {
      mockRouterGenerate.mockRejectedValueOnce(new Error("LLM error"));

      const result = await builder.buildPlan("Do something random", "unknown_intent");

      expect(result.source).toBe("fallback");
      // Should use general fallback
      expect(result.steps[0].agentId).toBe("ceo");
    });

    it("returns correct static plan for each intent", async () => {
      mockRouterGenerate.mockRejectedValue(new Error("fail"));

      const marketing = await builder.buildPlan("Create campaign", "marketing");
      expect(marketing.steps[0].agentId).toBe("marketing");

      const pricing = await builder.buildPlan("Calculate margins", "pricing");
      expect(pricing.steps[0].agentId).toBe("finance");

      const supplier = await builder.buildPlan("Find suppliers", "supplier_research");
      expect(supplier.steps[0].agentId).toBe("supplier-research");
    });
  });

  describe("singleton", () => {
    it("returns the same instance", () => {
      const b1 = getPlanBuilder();
      const b2 = getPlanBuilder();
      expect(b1).toBe(b2);
    });

    it("reset creates a new instance", () => {
      const b1 = getPlanBuilder();
      resetPlanBuilder();
      const b2 = getPlanBuilder();
      expect(b1).not.toBe(b2);
    });
  });
});
