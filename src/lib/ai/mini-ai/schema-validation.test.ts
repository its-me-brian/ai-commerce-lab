// Zod Schema Enforcement Tests
// F10: Tests for runtime input/output validation using Zod schemas.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import {
  MiniAIEngine,
  getMiniAIEngine,
  resetMiniAIEngine,
  registerDeterministicImpl,
  clearDeterministicImpls,
} from "./engine";
import { getMiniAIRegistry, resetMiniAIRegistry } from "./registry";
import type { MiniAIDefinition } from "./types";

// Mock the router to avoid LLM calls
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

// Mock complexity router
vi.mock("../complexity-router", () => ({
  selectModelByComplexity: vi.fn().mockResolvedValue({
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
    reasoning: "Mock",
    fallbacks: [],
  }),
}));

// ============================================
// TEST DEFINITIONS
// ============================================

const StrictInputSchema = z.object({
  name: z.string().min(1, "name is required"),
  count: z.number().positive("count must be positive"),
});

const StrictOutputSchema = z.object({
  result: z.string(),
  total: z.number(),
});

function createDefinition(overrides: Partial<MiniAIDefinition> = {}): MiniAIDefinition {
  return {
    id: "test-zod",
    name: "Test Zod",
    description: "Test mini-AI with Zod schemas",
    category: "test",
    type: "custom",
    executionMode: "deterministic",
    inputSchema: StrictInputSchema,
    outputSchema: StrictOutputSchema,
    modelRequirements: { complexity: "simple" },
    enabled: true,
    version: "1.0.0",
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe("F10: Zod Schema Enforcement", () => {
  let engine: MiniAIEngine;
  let registry: ReturnType<typeof getMiniAIRegistry>;

  beforeEach(() => {
    resetMiniAIEngine();
    resetMiniAIRegistry();
    clearDeterministicImpls();
    engine = getMiniAIEngine();
    registry = getMiniAIRegistry();
  });

  describe("input validation with Zod", () => {
    it("accepts valid input matching Zod schema", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async (input) => ({
        output: { result: `Hello ${input.name}`, total: input.count as number },
      }));

      const result = await engine.execute("test-zod", {
        input: { name: "Alice", count: 5 },
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe("Hello Alice");
    });

    it("rejects input missing required field", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { result: "ok", total: 0 },
      }));

      const result = await engine.execute("test-zod", {
        input: { count: 5 }, // missing "name"
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("name");
    });

    it("rejects input with wrong type", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { result: "ok", total: 0 },
      }));

      const result = await engine.execute("test-zod", {
        input: { name: "Alice", count: "not a number" },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("count");
    });

    it("rejects empty input", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { result: "ok", total: 0 },
      }));

      const result = await engine.execute("test-zod", {
        input: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe("output validation with Zod", () => {
    it("accepts valid output matching Zod schema", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async (input) => ({
        output: { result: `Hello ${input.name}`, total: input.count as number },
      }));

      const result = await engine.execute("test-zod", {
        input: { name: "Bob", count: 3 },
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe("Hello Bob");
    });

    it("rejects output missing required field", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { result: "ok" }, // missing "total"
      }));

      const result = await engine.execute("test-zod", {
        input: { name: "Charlie", count: 1 },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Output validation failed");
    });

    it("rejects output with wrong type", async () => {
      const def = createDefinition();
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { result: 123, total: "not a number" }, // wrong types
      }));

      const result = await engine.execute("test-zod", {
        input: { name: "Dave", count: 1 },
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Output validation failed");
    });
  });

  describe("backward compatibility with plain object schemas", () => {
    it("skips validation when schema is a plain object (no .parse)", async () => {
      const def = createDefinition({
        inputSchema: { text: "string" }, // plain object, not Zod
        outputSchema: { result: "string" },
      });
      registry.register(def);

      registerDeterministicImpl("test-zod", async () => ({
        output: { anything: "goes" },
      }));

      const result = await engine.execute("test-zod", {
        input: { text: "hello" },
      });

      // Should succeed — no Zod validation, just basic non-empty check
      expect(result.success).toBe(true);
    });
  });

  describe("schema definitions from implementations", () => {
    it("classifier has valid Zod input schema", async () => {
      const { ClassifierInputSchema } = await import("./implementations/classifier");

      // Valid input
      expect(() => ClassifierInputSchema.parse({
        text: "wireless earbuds",
        categories: ["electronics", "audio"],
      })).not.toThrow();

      // Missing text
      expect(() => ClassifierInputSchema.parse({
        categories: ["electronics"],
      })).toThrow();

      // Empty categories
      expect(() => ClassifierInputSchema.parse({
        text: "test",
        categories: [],
      })).toThrow();
    });

    it("researcher has valid Zod input schema", async () => {
      const { ResearcherInputSchema } = await import("./implementations/researcher");

      expect(() => ResearcherInputSchema.parse({
        topic: "wireless earbuds market",
      })).not.toThrow();

      expect(() => ResearcherInputSchema.parse({
        topic: "",
      })).toThrow();
    });

    it("critic has valid Zod output schema", async () => {
      const { CriticOutputSchema } = await import("./implementations/critic");

      // Valid output
      expect(() => CriticOutputSchema.parse({
        overallScore: 0.85,
        criteria: [{ name: "clarity", score: 0.9, feedback: "Good" }],
        strengths: ["Clear writing"],
        weaknesses: [],
        suggestions: ["Add more detail"],
        passThreshold: 0.7,
        passed: true,
      })).not.toThrow();

      // Invalid — score out of range
      expect(() => CriticOutputSchema.parse({
        overallScore: 1.5,
        criteria: [],
        strengths: [],
        weaknesses: [],
        suggestions: [],
        passThreshold: 0.7,
        passed: true,
      })).toThrow();
    });
  });
});
