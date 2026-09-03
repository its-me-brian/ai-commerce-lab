// Mini-AI Enhanced Engine Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MiniAIEnhancedEngine, ENHANCEMENT_PROFILES } from "./mini-ai-enhanced-engine";
import { getMiniAIRegistry, resetMiniAIRegistry } from "./mini-ai/registry";
import { resetMiniAIEngine, clearDeterministicImpls } from "./mini-ai/engine";
import { bootstrapMiniAIs } from "./mini-ai/bootstrap";

// Mock AgentEngine
vi.mock("../agents/core/engine", () => ({
  AgentEngine: vi.fn().mockImplementation(function () {
    return {
      executeTask: vi.fn().mockResolvedValue({
        taskId: "mock-task",
        result: {
          success: true,
          output: "Mock agent output",
          structuredData: { recommendation: "APPROVE", score: 85 },
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
}));

// Mock the router to avoid actual LLM calls
vi.mock("./router", () => ({
  getRouter: () => ({
    generate: vi.fn().mockResolvedValue({
      result: {
        content: JSON.stringify({
          bestCategory: "product",
          confidence: 0.9,
          allCategories: [
            { category: "product", score: 0.9 },
            { category: "marketing", score: 0.3 },
          ],
          reasoning: "Mock classification",
        }),
        provider: "gemini",
        model: "gemini-3-flash",
        inputTokens: 100,
        outputTokens: 50,
        durationMs: 200,
        cached: false,
      },
      log: {},
    }),
  }),
}));

describe("MiniAIEnhancedEngine", () => {
  let engine: MiniAIEnhancedEngine;

  beforeEach(() => {
    resetMiniAIRegistry();
    resetMiniAIEngine();
    clearDeterministicImpls();
    bootstrapMiniAIs();
    engine = new MiniAIEnhancedEngine();
  });

  describe("enhanced execution", () => {
    it("executes agent without enhancement", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test" }, {
        agentId: "product-hunter",
      });

      expect(result.agentResult.success).toBe(true);
      expect(result.preProcessingResults).toHaveLength(0);
      expect(result.postProcessingResults).toHaveLength(0);
    });

    it("executes with pre-processing", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test product" }, {
        agentId: "product-hunter",
        preProcessing: ["classifier"],
        stopOnPreFailure: false,
      });

      expect(result.agentResult.success).toBe(true);
      expect(result.preProcessingResults.length).toBeGreaterThan(0);
      expect(result.preProcessingSuccess).toBe(true);
    });

    it("executes with post-processing", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test" }, {
        agentId: "product-hunter",
        postProcessing: ["validator"],
      });

      expect(result.agentResult.success).toBe(true);
      expect(result.postProcessingResults.length).toBeGreaterThan(0);
    });

    it("executes with both pre and post processing", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test product" }, {
        agentId: "product-hunter",
        preProcessing: ["classifier"],
        postProcessing: ["validator"],
      });

      expect(result.agentResult.success).toBe(true);
      expect(result.preProcessingResults.length).toBeGreaterThan(0);
      expect(result.postProcessingResults.length).toBeGreaterThan(0);
    });

    it("tracks mini-AI cost", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test" }, {
        agentId: "product-hunter",
        postProcessing: ["validator"],
      });

      expect(result.miniAICost).toBeGreaterThanOrEqual(0);
    });

    it("extracts quality score from critic", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test" }, {
        agentId: "product-hunter",
        postProcessing: ["critic"],
      });

      // Critic runs in deterministic mode, so it should produce a score
      expect(result.qualityScore).toBeDefined();
    });

    it("extracts validation result from validator", async () => {
      const result = await engine.executeEnhanced("product-hunter", { text: "test" }, {
        agentId: "product-hunter",
        postProcessing: ["validator"],
      });

      expect(result.validationResult).toBeDefined();
    });
  });

  describe("profiles", () => {
    it("has predefined profiles", () => {
      expect(Object.keys(ENHANCEMENT_PROFILES)).toHaveLength(3);
      expect(ENHANCEMENT_PROFILES["full-validation"]).toBeDefined();
      expect(ENHANCEMENT_PROFILES["research-only"]).toBeDefined();
      expect(ENHANCEMENT_PROFILES["extract-and-validate"]).toBeDefined();
    });

    it("getProfiles returns all profiles", () => {
      const profiles = engine.getProfiles();
      expect(Object.keys(profiles)).toHaveLength(3);
    });
  });

  describe("available mini-IAs", () => {
    it("lists available mini-IAs", () => {
      const available = engine.getAvailableMiniAIs();
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((m) => m.enabled)).toBe(true);
    });
  });
});
