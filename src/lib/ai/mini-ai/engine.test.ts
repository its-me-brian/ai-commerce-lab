// Mini-AI Engine Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MiniAIEngine,
  getMiniAIEngine,
  resetMiniAIEngine,
  registerDeterministicImpl,
  registerPromptBuilder,
  clearDeterministicImpls,
  clearPromptBuilders,
} from "./engine";
import { getMiniAIRegistry, resetMiniAIRegistry } from "./registry";
import type { MiniAIDefinition } from "./types";

// Mock the router to avoid actual LLM calls
vi.mock("../router", () => ({
  getRouter: () => ({
    generate: vi.fn().mockResolvedValue({
      result: {
        content: '{"result": "mocked"}',
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
    engine = getMiniAIEngine();
    registry = getMiniAIRegistry();
  });

  describe("deterministic execution", () => {
    it("executes a deterministic mini-AI", async () => {
      const def = createTestDefinition();
      registry.register(def);

      registerDeterministicImpl("test-mini-ai", async (input) => ({
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
