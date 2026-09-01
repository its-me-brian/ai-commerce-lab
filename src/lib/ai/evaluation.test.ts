// Evaluation Engine Tests
import { describe, it, expect, beforeEach } from "vitest";
import { EvaluationEngine, DEFAULT_THRESHOLDS, resetEvaluationEngine } from "./evaluation";
import type { ExecutionEvaluation } from "./evaluation";

describe("EvaluationEngine", () => {
  let engine: EvaluationEngine;

  beforeEach(() => {
    resetEvaluationEngine();
    engine = new EvaluationEngine();
  });

  describe("evaluateMiniAI", () => {
    it("evaluates a successful execution with good output", () => {
      const result = engine.evaluateMiniAI(
        { text: "test" },
        { bestCategory: "marketing", confidence: 0.85, allCategories: [] },
        { durationMs: 100, costDollars: 0, success: true, retries: 0 }
      );

      expect(result.overallScore).toBeGreaterThan(0.5);
      expect(result.passed).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.metrics.success).toBe(true);
    });

    it("penalizes failed execution", () => {
      const result = engine.evaluateMiniAI(
        { text: "test" },
        {},
        { durationMs: 100, costDollars: 0, success: false, retries: 0 }
      );

      expect(result.overallScore).toBeLessThan(0.5);
      expect(result.passed).toBe(false);
    });

    it("penalizes empty output", () => {
      const result = engine.evaluateMiniAI(
        { text: "test" },
        {},
        { durationMs: 100, costDollars: 0, success: true, retries: 0 }
      );

      const completenessSignal = result.signals.find((s) => s.name === "output_completeness");
      expect(completenessSignal?.score).toBeLessThan(0.5);
    });

    it("penalizes slow execution", () => {
      const fast = engine.evaluateMiniAI(
        { text: "test" },
        { data: 1 },
        { durationMs: 50, costDollars: 0, success: true, retries: 0 }
      );

      const slow = engine.evaluateMiniAI(
        { text: "test" },
        { data: 1 },
        { durationMs: 10000, costDollars: 0, success: true, retries: 0 }
      );

      const fastSpeed = fast.signals.find((s) => s.name === "execution_speed");
      const slowSpeed = slow.signals.find((s) => s.name === "execution_speed");
      expect(fastSpeed?.score).toBeGreaterThan(slowSpeed?.score ?? 0);
    });

    it("penalizes retries", () => {
      const noRetry = engine.evaluateMiniAI(
        { text: "test" },
        { data: 1 },
        { durationMs: 100, costDollars: 0, success: true, retries: 0 }
      );

      const withRetry = engine.evaluateMiniAI(
        { text: "test" },
        { data: 1 },
        { durationMs: 100, costDollars: 0, success: true, retries: 2 }
      );

      const noRetrySignal = noRetry.signals.find((s) => s.name === "retry_free");
      const withRetrySignal = withRetry.signals.find((s) => s.name === "retry_free");
      expect(noRetrySignal?.score).toBeGreaterThan(withRetrySignal?.score ?? 0);
    });

    it("respects quality thresholds", () => {
      // Mock data scores ~0.925 (good completeness, fast, free, success, no retries)
      // Threshold of 0.95 exceeds that → should fail
      const result = engine.evaluateMiniAI(
        { text: "test" },
        { data: 1 },
        { durationMs: 100, costDollars: 0, success: true, retries: 0 },
        { minScore: 0.95 }
      );

      expect(result.passed).toBe(false);
    });

    it("uses default thresholds by complexity", () => {
      expect(DEFAULT_THRESHOLDS.trivial.minScore).toBe(0.3);
      expect(DEFAULT_THRESHOLDS.simple.minScore).toBe(0.5);
      expect(DEFAULT_THRESHOLDS.moderate.minScore).toBe(0.6);
      expect(DEFAULT_THRESHOLDS.complex.minScore).toBe(0.7);
    });
  });

  describe("evaluateWorkflow", () => {
    it("evaluates a workflow with all successful nodes", () => {
      const nodeEvals: ExecutionEvaluation[] = [
        engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 }),
        engine.evaluateMiniAI({}, { b: 2 }, { durationMs: 150, costDollars: 0, success: true, retries: 0 }),
      ];

      const result = engine.evaluateWorkflow(nodeEvals, 250, 0);

      expect(result.overallScore).toBeGreaterThan(0.5);
      expect(result.passed).toBe(true);
      expect(result.metrics.success).toBe(true);
    });

    it("penalizes workflow with failed nodes", () => {
      const nodeEvals: ExecutionEvaluation[] = [
        engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 }),
        engine.evaluateMiniAI({}, {}, { durationMs: 100, costDollars: 0, success: false, retries: 0 }),
      ];

      const result = engine.evaluateWorkflow(nodeEvals, 200, 0);

      expect(result.metrics.success).toBe(false);
    });

    it("handles empty evaluation list", () => {
      const result = engine.evaluateWorkflow([], 0, 0);

      expect(result.overallScore).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe("aggregation", () => {
    it("tracks evaluation history", () => {
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { b: 2 }, { durationMs: 200, costDollars: 0, success: true, retries: 0 });

      const recent = engine.getRecent();
      expect(recent).toHaveLength(2);
    });

    it("computes aggregated metrics", () => {
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { b: 2 }, { durationMs: 300, costDollars: 0.01, success: true, retries: 1 });

      const agg = engine.getAggregated();

      expect(agg.totalExecutions).toBe(2);
      expect(agg.averageScore).toBeGreaterThan(0);
      expect(agg.avgMetrics.successRate).toBe(1);
      expect(agg.avgMetrics.retryRate).toBe(0.5);
    });

    it("computes score distribution", () => {
      // Create evaluations with varying scores
      engine.evaluateMiniAI({}, { a: 1, b: 2, c: 3 }, { durationMs: 50, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, {}, { durationMs: 100, costDollars: 0, success: false, retries: 0 });

      const agg = engine.getAggregated();
      expect(agg.scoreDistribution.excellent + agg.scoreDistribution.good + agg.scoreDistribution.fair + agg.scoreDistribution.poor).toBe(2);
    });

    it("computes per-signal averages", () => {
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 200, costDollars: 0, success: true, retries: 0 });

      const agg = engine.getAggregated();
      expect(agg.signalAverages["success"]).toBe(1);
      expect(agg.signalAverages["output_completeness"]).toBeGreaterThan(0);
    });

    it("detects trend", () => {
      // All same → stable
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });

      const agg = engine.getAggregated();
      expect(agg.trend).toBe("stable");
    });

    it("returns zeroed metrics when empty", () => {
      const agg = engine.getAggregated();
      expect(agg.totalExecutions).toBe(0);
      expect(agg.averageScore).toBe(0);
      expect(agg.avgMetrics.successRate).toBe(0);
    });
  });

  describe("clear", () => {
    it("clears evaluation history", () => {
      engine.evaluateMiniAI({}, { a: 1 }, { durationMs: 100, costDollars: 0, success: true, retries: 0 });
      engine.clear();
      expect(engine.getRecent()).toHaveLength(0);
    });
  });
});
