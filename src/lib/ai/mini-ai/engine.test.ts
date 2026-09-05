// Mini-AI Engine Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  MiniAIEngine,
  getMiniAIEngine,
  resetMiniAIEngine,
  registerDeterministicImpl,
  registerPromptBuilder,
  clearDeterministicImpls,
  clearPromptBuilders,
} from "./engine";
/* eslint-enable @typescript-eslint/no-unused-vars */
import { getMiniAIRegistry, resetMiniAIRegistry } from "./registry";
import type { MiniAIDefinition } from "./types";

// Mock the router to avoid actual LLM calls — uses config values dynamically
vi.mock("../router", () => ({
  getRouter: () => ({
    generate: vi.fn().mockImplementation((_config: { primaryProvider: string; primaryModel: string }) => {
      return Promise.resolve({
        result: {
          content: '{"result": "mocked"}',
          provider: _config.primaryProvider,
          model: _config.primaryModel,
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
          cached: false,
        },
        log: {},
      });
    }),
  }),
}));

// Mock the complexity router to verify it's called with correct args
const mockSelectModelByComplexity = vi.fn().mockResolvedValue({
  match: {
    model: {
      id: "gemini-3-flash",
      provider_id: "gemini",
      name: "Gemini 3 Flash",
      model_id: "gemini-3-flash",
      input_price: 0,
      output_price: 0,
      context_window: 8000,
      enabled: true,
      capabilities: ["json"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    score: 90,
    allCapabilitiesMatch: true,
    contextWindowMatch: true,
    costMatch: true,
    capabilityScore: 1,
  },
  complexity: "simple",
  estimatedCostDollars: 0,
  reasoning: "Selected gemini-3-flash for simple task",
  fallbacks: [],
});

vi.mock("../complexity-router", () => ({
  selectModelByComplexity: (...args: unknown[]) => mockSelectModelByComplexity(...args),
}));

function createTestDefinition(overrides: Partial<MiniAIDefinition> = {}): MiniAIDefinition {
  return {
    id: "test-mini-ai",
    name: "Test Mini-AI",
    description: "A test mini-AI",
    category: "testing",
    type: "classifier",
    executionMode: "deterministic",
    inputSchema: {},
    outputSchema: {},
    modelRequirements: { complexity: "simple" },
    enabled: true,
    version: "1.0.0",
    ...overrides,
  };
}

describe("MiniAIEngine", () => {
  let engine: MiniAIEngine;
  let registry: ReturnType<typeof getMiniAIRegistry>;

  beforeEach(() => {
    resetMiniAIEngine();
    resetMiniAIRegistry();
    clearDeterministicImpls();
    clearPromptBuilders();
    mockSelectModelByComplexity.mockClear();
    // Restore default mock return value
    mockSelectModelByComplexity.mockResolvedValue({
      match: {
        model: {
          id: "gemini-3-flash",
          provider_id: "gemini",
          name: "Gemini 3 Flash",
          model_id: "gemini-3-flash",
          input_price: 0,
          output_price: 0,
          context_window: 8000,
          enabled: true,
          capabilities: ["json"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        score: 90,
        allCapabilitiesMatch: true,
        contextWindowMatch: true,
        costMatch: true,
        capabilityScore: 1,
      },
      complexity: "simple",
      estimatedCostDollars: 0,
      reasoning: "Selected gemini-3-flash for simple task",
      fallbacks: [],
    });
    engine = getMiniAIEngine();
    registry = getMiniAIRegistry();
  });

  describe("deterministic execution", () => {
    it("executes a deterministic mini-AI", async () => {
      const def = createTestDefinition();
      registry.register(def);

      registerDeterministicImpl("test-mini-ai", async (_input) => ({  
        output: { classified: true, category: "test" },
        confidence: 0.95,
        reasoning: "Test input classified as test",
      }));

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(true);
      expect(result.output.classified).toBe(true);
      expect(result.output.category).toBe("test");
      expect(result.confidence).toBe(0.95);
      expect(result.reasoning).toBe("Test input classified as test");
      expect(result.metadata.executionMode).toBe("deterministic");
      expect(result.metadata.modelUsed).toBe("deterministic");
      expect(result.metadata.costDollars).toBe(0);
    });

    it("returns error when no implementation registered", async () => {
      const def = createTestDefinition();
      registry.register(def);

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("No deterministic implementation");
    });

    it("returns error when mini-AI not found", async () => {
      const result = await engine.execute("nonexistent", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("returns error when mini-AI is disabled", async () => {
      const def = createTestDefinition({ enabled: false });
      registry.register(def);

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("disabled");
    });

    it("returns error on empty input", async () => {
      const def = createTestDefinition();
      registry.register(def);

      registerDeterministicImpl("test-mini-ai", async () => ({
        output: { result: "ok" },
      }));

      const result = await engine.execute("test-mini-ai", {
        input: {},
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("empty");
    });

    it("captures implementation errors", async () => {
      const def = createTestDefinition();
      registry.register(def);

      registerDeterministicImpl("test-mini-ai", async () => {
        throw new Error("Implementation crashed");
      });

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Implementation crashed");
    });
  });

  describe("LLM execution with complexity routing", () => {
    it("calls selectModelByComplexity with definition's complexity", async () => {
      const def = createTestDefinition({
        executionMode: "llm",
        modelRequirements: { complexity: "moderate", responseFormat: "json" },
      });
      registry.register(def);

      await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(mockSelectModelByComplexity).toHaveBeenCalledWith("moderate", {
        complexity: "moderate",
        responseFormat: "json",
      });
    });

    it("defaults to 'simple' complexity when not specified", async () => {
      const def = createTestDefinition({
        executionMode: "llm",
        modelRequirements: {},
      });
      registry.register(def);

      await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(mockSelectModelByComplexity).toHaveBeenCalledWith("simple", {});
    });

    it("uses modelOverride and skips complexity routing", async () => {
      const def = createTestDefinition({
        executionMode: "llm",
        modelRequirements: { complexity: "complex" },
      });
      registry.register(def);

      await engine.execute("test-mini-ai", {
        input: { text: "hello" },
        modelOverride: "claude-sonnet-4",
        providerOverride: "anthropic",
      });

      expect(mockSelectModelByComplexity).not.toHaveBeenCalled();
    });

    it("falls back to defaults when complexity routing throws", async () => {
      mockSelectModelByComplexity.mockRejectedValueOnce(new Error("No model available"));

      const def = createTestDefinition({
        executionMode: "llm",
        modelRequirements: { complexity: "complex" },
      });
      registry.register(def);

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      // Should still succeed using fallback defaults
      expect(result.success).toBe(true);
      expect(result.metadata.providerUsed).toBe("gemini");
    });

    it("returns provider and model from complexity routing result", async () => {
      mockSelectModelByComplexity.mockResolvedValueOnce({
        match: {
          model: {
            id: "claude-3-5-haiku",
            provider_id: "anthropic",
            name: "Claude 3.5 Haiku",
            model_id: "claude-3-5-haiku",
            input_price: 0.8,
            output_price: 4.0,
            context_window: 8000,
            enabled: true,
            capabilities: ["json", "text"],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          score: 85,
          allCapabilitiesMatch: true,
          contextWindowMatch: true,
          costMatch: true,
          capabilityScore: 1,
        },
        complexity: "moderate",
        estimatedCostDollars: 0.005,
        reasoning: "Selected Claude 3.5 Haiku for moderate task",
        fallbacks: [],
      });

      const def = createTestDefinition({
        executionMode: "llm",
        modelRequirements: { complexity: "moderate" },
      });
      registry.register(def);

      const result = await engine.execute("test-mini-ai", {
        input: { text: "hello" },
      });

      expect(result.success).toBe(true);
      expect(result.metadata.modelUsed).toBe("claude-3-5-haiku");
      expect(result.metadata.providerUsed).toBe("anthropic");
    });
  });

  describe("chain execution", () => {
    it("executes a chain of mini-IAs", async () => {
      // Register two mini-IAs
      registry.register(createTestDefinition({
        id: "step-1",
        name: "Step 1",
      }));
      registry.register(createTestDefinition({
        id: "step-2",
        name: "Step 2",
      }));

      registerDeterministicImpl("step-1", async (input) => ({
        output: { extracted: true, value: input.text },
      }));

      registerDeterministicImpl("step-2", async (input) => ({
        output: { classified: true, input: input.extracted },
      }));

      const results = await engine.executeChain(
        [
          {
            miniAIId: "step-1",
            inputMapping: { text: "input.text" },
          },
          {
            miniAIId: "step-2",
            inputMapping: { extracted: "step[0].output.extracted" },
          },
        ],
        { text: "hello world" }
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].output.extracted).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[1].output.classified).toBe(true);
    });

    it("stops chain on failure", async () => {
      registry.register(createTestDefinition({ id: "step-1" }));
      registry.register(createTestDefinition({ id: "step-2" }));

      registerDeterministicImpl("step-1", async () => {
        throw new Error("Failed at step 1");
      });

      registerDeterministicImpl("step-2", async () => ({
        output: { shouldNotRun: true },
      }));

      const results = await engine.executeChain(
        [
          { miniAIId: "step-1", inputMapping: { text: "input.text" } },
          { miniAIId: "step-2", inputMapping: { text: "input.text" } },
        ],
        { text: "hello" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  describe("singleton", () => {
    it("returns the same instance", () => {
      const e1 = getMiniAIEngine();
      const e2 = getMiniAIEngine();
      expect(e1).toBe(e2);
    });

    it("reset creates a new instance", () => {
      const e1 = getMiniAIEngine();
      resetMiniAIEngine();
      const e2 = getMiniAIEngine();
      expect(e1).not.toBe(e2);
    });
  });
});
