// Mini-AI Implementations Tests
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the router to avoid actual LLM calls
vi.mock("../../router", () => ({
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

import { getMiniAIRegistry, resetMiniAIRegistry } from "../registry";
import {
  getMiniAIEngine,
  resetMiniAIEngine,
  registerDeterministicImpl,
  clearDeterministicImpls,
} from "../engine";
import { bootstrapMiniAIs, builtinMiniAIDs } from "../bootstrap";

// Import individual deterministic implementations
import { researcherDeterministic } from "./researcher";
import { classifierDeterministic } from "./classifier";
import { extractorDeterministic } from "./extractor";
import { summarizerDeterministic } from "./summarizer";
import { criticDeterministic } from "./critic";
import { validatorDeterministic } from "./validator";

describe("Mini-AI Implementations", () => {
  beforeEach(() => {
    resetMiniAIRegistry();
    resetMiniAIEngine();
    clearDeterministicImpls();
  });

  describe("bootstrap", () => {
    it("registers all 6 built-in mini-IAs", () => {
      bootstrapMiniAIs();
      const registry = getMiniAIRegistry();
      expect(registry.count()).toBe(6);
      expect(registry.enabledCount()).toBe(6);
    });

    it("has correct number of built-in definitions", () => {
      expect(builtinMiniAIDs.length).toBe(6);
    });
  });

  describe("Researcher", () => {
    it("extracts keywords from topic", async () => {
      const result = await researcherDeterministic({
        topic: "wireless bluetooth earbuds for sports",
      });

      expect(result.output.topic).toBe("wireless bluetooth earbuds for sports");
      expect(result.output.findings).toBeDefined();
      expect(Array.isArray(result.output.findings)).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("handles empty input", async () => {
      const result = await researcherDeterministic({});
      expect(result.output.topic).toBe("unknown");
      // "unknown" is a valid keyword (not a stop word), so confidence is 0.4
      expect(result.confidence).toBe(0.4);
    });
  });

  describe("Classifier", () => {
    it("classifies text into categories", async () => {
      const result = await classifierDeterministic({
        text: "Wireless bluetooth earbuds with noise cancellation",
        categories: ["wireless", "clothing", "food", "furniture"],
      });

      expect(result.output.bestCategory).toBe("wireless");
      expect(result.output.confidence).toBeGreaterThan(0);
      expect(result.output.allCategories).toHaveLength(4);
    });

    it("handles no categories", async () => {
      const result = await classifierDeterministic({
        text: "some text",
        categories: [],
      });

      expect(result.output.bestCategory).toBe("unknown");
      expect(result.confidence).toBe(0);
    });
  });

  describe("Extractor", () => {
    it("extracts prices from text", async () => {
      const result = await extractorDeterministic({
        text: "The product costs €29.99 and has a shipping fee of $5.50",
        fields: ["price", "shipping"],
      });

      expect(result.output.extracted).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("handles empty text", async () => {
      const result = await extractorDeterministic({
        text: "",
        fields: ["price"],
      });

      expect(result.output.missingFields).toContain("price");
    });
  });

  describe("Summarizer", () => {
    it("extracts key sentences", async () => {
      const text = "First important sentence about the topic. Second sentence provides more detail. Third sentence is also relevant. Fourth sentence adds context. Fifth sentence concludes the discussion.";
      const result = await summarizerDeterministic({
        text,
        maxLength: 2,
      });

      expect(result.output.summary).toBeDefined();
      expect(result.output.keyPoints.length).toBeLessThanOrEqual(2);
      expect(result.output.compressionRatio).toBeLessThan(1);
    });

    it("handles empty text", async () => {
      const result = await summarizerDeterministic({ text: "" });
      expect(result.output.summary).toBe("");
      expect(result.confidence).toBe(0);
    });
  });

  describe("Critic", () => {
    it("evaluates response against criteria", async () => {
      const result = await criticDeterministic({
        response: "This is a well-structured response with clear formatting and detailed analysis of the topic.",
        criteria: ["clarity", "structure", "completeness"],
        threshold: 0.5,
      });

      expect(result.output.overallScore).toBeGreaterThan(0);
      expect(result.output.criteria).toHaveLength(3);
      expect(typeof result.output.passed).toBe("boolean");
    });

    it("handles empty response", async () => {
      const result = await criticDeterministic({
        response: "",
        criteria: ["clarity"],
      });

      expect(result.output.overallScore).toBe(0);
      expect(result.output.passed).toBe(false);
    });
  });

  describe("Validator", () => {
    it("validates data against rules", async () => {
      const result = await validatorDeterministic({
        data: { name: "Test Product", price: 29.99 },
        rules: ["required: name", "required: price", "required: description"],
      });

      expect(result.output.valid).toBe(false); // description is missing
      expect(result.output.violations.length).toBeGreaterThan(0);
      expect(result.output.checkedRules).toBe(3);
    });

    it("passes all rules", async () => {
      const result = await validatorDeterministic({
        data: { name: "Test", email: "test@example.com" },
        rules: ["required: name", "email format"],
      });

      expect(result.output.valid).toBe(true);
      expect(result.output.violations).toHaveLength(0);
    });
  });

  describe("Engine integration", () => {
    it("executes each mini-AI via engine", async () => {
      bootstrapMiniAIs();
      const engine = getMiniAIEngine();

      const tests = [
        { id: "researcher", input: { topic: "test topic" } },
        { id: "classifier", input: { text: "test text", categories: ["a", "b"] } },
        { id: "extractor", input: { text: "price is €10", fields: ["price"] } },
        { id: "summarizer", input: { text: "Sentence one. Sentence two. Sentence three." } },
        { id: "critic", input: { response: "good response", criteria: ["clarity"] } },
        { id: "validator", input: { data: { name: "test" }, rules: ["required: name"] } },
      ];

      for (const test of tests) {
        const result = await engine.execute(test.id, { input: test.input });
        if (!result.success) {
          console.error(`FAILED: ${test.id}`, result.errors);
        }
        expect(result.success).toBe(true);
        expect(result.metadata.miniAIId).toBe(test.id);
      }
    });
  });
});
