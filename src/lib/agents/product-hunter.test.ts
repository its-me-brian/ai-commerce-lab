import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductHunterAgent } from "./product-hunter";
import type { AgentContext } from "./core/types";

// ============================================
// Mocks
// ============================================

const mockRouterGenerate = vi.fn();

vi.mock("../ai/router", () => ({
  getRouter: () => ({
    generate: mockRouterGenerate,
  }),
}));

const mockToolExecute = vi.fn();
const mockToolRegistry = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn(() => []),
  has: vi.fn(),
  execute: mockToolExecute,
  getToolDescriptions: vi.fn(() => []),
};

vi.mock("../tools/bootstrap", () => ({
  getToolRegistry: () => mockToolRegistry,
}));

// Mock multi-agent orchestrator (FASE 20)
const mockOrchestratorExecute = vi.fn();
const mockOrchestratorExecuteChain = vi.fn();
const mockOrchestratorGetStructuredData = vi.fn();

vi.mock("../ai/multi-agent-orchestrator", () => ({
  getMultiAgentOrchestrator: () => ({
    execute: mockOrchestratorExecute,
    executeChain: mockOrchestratorExecuteChain,
    getStructuredData: mockOrchestratorGetStructuredData,
    getAgentResult: vi.fn(),
  }),
}));

// ============================================
// Helpers
// ============================================

function makeContext(
  input: Record<string, unknown>,
  overrides?: Partial<AgentContext>
): AgentContext {
  return {
    taskId: "test-task-id",
    taskType: "product_analysis",
    input,
    configuration: {
      agentId: "product-hunter",
      primaryProvider: "gemini",
      primaryModel: "gemini-3-flash",
      temperature: 0.2,
      maxTokens: 4096,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
    },
    tools: ["calculate_margin", "search_products"],
    ...overrides,
  };
}

const ANALYSIS_RESPONSE = {
  score: 85,
  estimatedMargin: 42.5,
  recommendedPrice: 49.99,
  demandScore: 78,
  competitionScore: 65,
  supplierScore: 80,
  riskScore: 30,
  recommendation: "APPROVE",
  explanation: "Good opportunity with solid margins.",
  category: "electronics",
  targetMarket: ["Germany", "France"],
};

// ============================================
// Tests
// ============================================

describe("ProductHunterAgent", () => {
  let agent: ProductHunterAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ProductHunterAgent();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(agent.metadata.id).toBe("product-hunter");
    });

    it("should be enabled", () => {
      expect(agent.metadata.enabled).toBe(true);
    });

    it("should have expected capabilities", () => {
      expect(agent.metadata.capabilities).toContain("product_analysis");
      expect(agent.metadata.capabilities).toContain("product_discovery");
    });
  });

  describe("validateInput", () => {
    it("should require product name in analyze mode", () => {
      const errors = agent.validateInput({ supplierPrice: 10 });
      expect(errors).toContain("Product name is required");
    });

    it("should require supplier price in analyze mode", () => {
      const errors = agent.validateInput({ name: "Test Product" });
      expect(errors).toContain("Supplier price is required and must be a number");
    });

    it("should pass with valid analyze input", () => {
      const errors = agent.validateInput({
        name: "Test Product",
        supplierPrice: 10,
      });
      expect(errors).toHaveLength(0);
    });

    it("should require query in discover mode", () => {
      const errors = agent.validateInput({ mode: "discover" });
      expect(errors).toContain("Search query is required for discover mode");
    });

    it("should pass with valid discover input", () => {
      const errors = agent.validateInput({
        mode: "discover",
        query: "fitness products",
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("execute — analyze mode", () => {
    it("should call router.generate with correct config", async () => {
      mockRouterGenerate.mockResolvedValue({
        result: {
          content: JSON.stringify(ANALYSIS_RESPONSE),
          structuredData: ANALYSIS_RESPONSE,
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
          cached: false,
        },
        log: {
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
        },
      });

      mockToolExecute.mockResolvedValue({
        success: true,
        output: {
          profit: 21.24,
          marginPercent: 42.49,
          roiPercent: 73.31,
          isViable: true,
        },
      });

      const context = makeContext({
        name: "LED Portable Lamp",
        supplierPrice: 12.4,
        shippingCost: 3.2,
        estimatedSalePrice: 49.9,
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.structuredData).toBeDefined();
      expect(mockRouterGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "product-hunter",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
        }),
        expect.objectContaining({
          responseFormat: "json",
        })
      );
    });

    it("should validate margin with calculate_margin tool", async () => {
      mockRouterGenerate.mockResolvedValue({
        result: {
          content: JSON.stringify(ANALYSIS_RESPONSE),
          structuredData: ANALYSIS_RESPONSE,
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
          cached: false,
        },
        log: {
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
        },
      });

      mockToolExecute.mockResolvedValue({
        success: true,
        output: {
          profit: 21.24,
          marginPercent: 42.49,
          roiPercent: 73.31,
          isViable: true,
        },
      });

      const context = makeContext({
        name: "LED Portable Lamp",
        supplierPrice: 12.4,
        shippingCost: 3.2,
      });

      await agent.execute(context);

      expect(mockToolExecute).toHaveBeenCalledWith(
        "calculate_margin",
        expect.objectContaining({
          costPrice: 12.4,
          sellingPrice: 49.99,
          shippingCost: 3.2,
        })
      );
    });

    it("should throw on invalid AI response", async () => {
      mockRouterGenerate.mockResolvedValue({
        result: {
          content: "not valid json",
          structuredData: null,
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 800,
          cached: false,
        },
        log: {
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 800,
        },
      });

      const context = makeContext({
        name: "Test Product",
        supplierPrice: 10,
      });

      await expect(agent.execute(context)).rejects.toThrow(
        "Failed to parse AI response"
      );
    });

    it("should include metadata from router log", async () => {
      mockRouterGenerate.mockResolvedValue({
        result: {
          content: JSON.stringify(ANALYSIS_RESPONSE),
          structuredData: ANALYSIS_RESPONSE,
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
          cached: false,
        },
        log: {
          provider: "gemini",
          model: "gemini-3-flash",
          inputTokens: 150,
          outputTokens: 80,
          durationMs: 1200,
        },
      });

      mockToolExecute.mockResolvedValue({
        success: true,
        output: { profit: 21, marginPercent: 42, roiPercent: 73, isViable: true },
      });

      const context = makeContext({
        name: "Test",
        supplierPrice: 10,
      });

      const result = await agent.execute(context);

      expect(result.metadata.providerUsed).toBe("gemini");
      expect(result.metadata.modelUsed).toBe("gemini-3-flash");
      expect(result.metadata.inputTokens).toBe(150);
      expect(result.metadata.outputTokens).toBe(80);
    });
  });

  describe("execute — discover mode", () => {
    it("should search products and delegate to specialist agents", async () => {
      // Mock search_products tool
      mockToolExecute.mockResolvedValueOnce({
        success: true,
        output: {
          products: [
            {
              id: "1",
              name: "Fitness Band",
              price: 8.5,
              currency: "USD",
              source: "dummyjson",
              imageUrl: "http://example.com/img.jpg",
              category: "fitness",
              rating: 4.2,
            },
          ],
          totalCount: 1,
          source: "dummyjson",
        },
      });

      // Mock orchestrator.execute for parallel (market + supplier research)
      mockOrchestratorExecute.mockResolvedValueOnce({
        results: [
          { agentId: "market-research", result: { structuredData: { demand: { score: 75 } } } },
          { agentId: "supplier-research", result: { structuredData: { bestOption: "AliExpress" } } },
        ],
        success: true,
        errors: [],
        totalInputTokens: 200,
        totalOutputTokens: 100,
      });

      // Mock orchestrator.executeChain for opportunity scoring
      mockOrchestratorExecuteChain.mockResolvedValueOnce({
        results: [
          { agentId: "opportunity-scoring", result: { structuredData: { overallScore: 72, decision: "GO" } } },
        ],
        success: true,
        errors: [],
        totalInputTokens: 150,
        totalOutputTokens: 80,
      });

      // Mock getStructuredData
      mockOrchestratorGetStructuredData
        .mockReturnValueOnce({ demand: { score: 75 } }) // market-research
        .mockReturnValueOnce({ bestOption: "AliExpress" }) // supplier-research
        .mockReturnValueOnce({ overallScore: 72, decision: "GO" }); // opportunity-scoring

      const context = makeContext(
        { mode: "discover", query: "fitness products" },
        { taskType: "research" }
      );

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.structuredData).toBeDefined();
      // Should have called search_products first
      expect(mockToolExecute).toHaveBeenCalledWith(
        "search_products",
        expect.objectContaining({ query: "fitness products" })
      );
      // Should have called orchestrator for multi-agent analysis
      expect(mockOrchestratorExecute).toHaveBeenCalled();
      expect(mockOrchestratorExecuteChain).toHaveBeenCalled();
    });

    it("should return empty results when no products found", async () => {
      mockToolExecute.mockResolvedValue({
        success: true,
        output: {
          products: [],
          totalCount: 0,
          source: "dummyjson",
        },
      });

      const context = makeContext(
        { mode: "discover", query: "nonexistent xyz" },
        { taskType: "research" }
      );

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.structuredData).toEqual({
        opportunities: [],
        totalFound: 0,
      });
    });

    it("should throw when search fails", async () => {
      mockToolExecute.mockResolvedValue({
        success: false,
        error: "API rate limit exceeded",
      });

      const context = makeContext(
        { mode: "discover", query: "fitness" },
        { taskType: "research" }
      );

      await expect(agent.execute(context)).rejects.toThrow(
        "Product search failed: API rate limit exceeded"
      );
    });
  });
});
