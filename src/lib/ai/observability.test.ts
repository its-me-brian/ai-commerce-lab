// Observability System Tests
import { describe, it, expect, beforeEach } from "vitest";
import {
  StructuredLogger,
  ExecutionTracer,
  MetricsCollector,
  resetObservability,
} from "./observability";

describe("Observability", () => {
  beforeEach(() => {
    resetObservability();
  });

  // ============================================
  // STRUCTURED LOGGER
  // ============================================

  describe("StructuredLogger", () => {
    let logger: StructuredLogger;

    beforeEach(() => {
      logger = new StructuredLogger(100);
    });

    it("logs structured entries", () => {
      const entry = logger.log({
        severity: "info",
        component: "test",
        message: "hello world",
        context: { key: "value" },
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.severity).toBe("info");
      expect(entry.component).toBe("test");
      expect(entry.message).toBe("hello world");
      expect(entry.context).toEqual({ key: "value" });
    });

    it("convenience methods work", () => {
      logger.info("comp", "info msg", { a: 1 });
      logger.warn("comp", "warn msg");
      logger.error("comp", "error msg");
      logger.debug("comp", "debug msg");

      const entries = logger.getRecent();
      expect(entries).toHaveLength(4);
      expect(entries.map((e) => e.severity)).toEqual(["info", "warn", "error", "debug"]);
    });

    it("tracks traceId", () => {
      logger.info("comp", "msg", {}, "trace-123");
      const entries = logger.getByTrace("trace-123");
      expect(entries).toHaveLength(1);
      expect(entries[0].traceId).toBe("trace-123");
    });

    it("filters by severity", () => {
      logger.info("comp", "info");
      logger.warn("comp", "warn");
      logger.error("comp", "error");
      logger.info("comp", "info2");

      expect(logger.getBySeverity("info")).toHaveLength(2);
      expect(logger.getBySeverity("warn")).toHaveLength(1);
      expect(logger.getBySeverity("error")).toHaveLength(1);
    });

    it("filters by component", () => {
      logger.info("agent", "msg1");
      logger.info("mini-ai", "msg2");
      logger.info("agent", "msg3");

      expect(logger.getByComponent("agent")).toHaveLength(2);
      expect(logger.getByComponent("mini-ai")).toHaveLength(1);
    });

    it("trims old entries", () => {
      const smallLogger = new StructuredLogger(5);
      for (let i = 0; i < 10; i++) {
        smallLogger.info("comp", `msg-${i}`);
      }

      expect(smallLogger.getRecent(100)).toHaveLength(5);
      // Most recent should be msg-9
      expect(smallLogger.getRecent(1)[0].message).toBe("msg-9");
    });

    it("clears entries", () => {
      logger.info("comp", "msg");
      logger.clear();
      expect(logger.getRecent()).toHaveLength(0);
    });

    it("operation logs duration and success", () => {
      const entry = logger.operation("comp", "test-op", () => {
        return 42;
      });

      expect(entry.success).toBe(true);
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("operation logs failure", () => {
      expect(() => {
        logger.operation("comp", "test-op", () => {
          throw new Error("fail");
        });
      }).toThrow("fail");
    });
  });

  // ============================================
  // EXECUTION TRACER
  // ============================================

  describe("ExecutionTracer", () => {
    let tracer: ExecutionTracer;

    beforeEach(() => {
      tracer = new ExecutionTracer();
    });

    it("creates a trace with root span", () => {
      const traceId = tracer.startTrace("orchestrator:execute");

      const trace = tracer.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace!.operation).toBe("orchestrator:execute");
      expect(trace!.parentSpanId).toBeNull();
      expect(trace!.traceId).toBe(traceId);
    });

    it("creates child spans", () => {
      const traceId = tracer.startTrace("orchestrator:execute");
      const rootSpan = tracer.getTrace(traceId)!;

      const childId = tracer.startSpan(traceId, rootSpan.spanId, "agent:researcher", "agent");
      tracer.endSpan(childId, true);

      expect(rootSpan.children).toHaveLength(1);
      expect(rootSpan.children[0].operation).toBe("agent:researcher");
      expect(rootSpan.children[0].componentType).toBe("agent");
    });

    it("ends spans with duration", () => {
      const traceId = tracer.startTrace("test");
      const rootSpan = tracer.getTrace(traceId)!;

      tracer.endSpan(rootSpan.spanId, true);

      expect(rootSpan.endTime).toBeGreaterThan(0);
      expect(rootSpan.durationMs).toBeGreaterThanOrEqual(0);
      expect(rootSpan.success).toBe(true);
    });

    it("ends spans with error", () => {
      const traceId = tracer.startTrace("test");
      const rootSpan = tracer.getTrace(traceId)!;

      tracer.endSpan(rootSpan.spanId, false, "something went wrong");

      expect(rootSpan.success).toBe(false);
      expect(rootSpan.error).toBe("something went wrong");
    });

    it("sets attributes on active spans", () => {
      const traceId = tracer.startTrace("test");
      const rootSpan = tracer.getTrace(traceId)!;

      tracer.setAttributes(rootSpan.spanId, { model: "gpt-4", tokens: 100 });

      expect(rootSpan.attributes.model).toBe("gpt-4");
      expect(rootSpan.attributes.tokens).toBe(100);
    });

    it("tracks nested spans (multi-level)", () => {
      const traceId = tracer.startTrace("orchestrator");
      const root = tracer.getTrace(traceId)!;

      const agentId = tracer.startSpan(traceId, root.spanId, "agent:researcher", "agent");
      const miniAIId = tracer.startSpan(traceId, agentId, "mini-ai:classifier", "mini-ai");
      const toolId = tracer.startSpan(traceId, miniAIId, "tool:search", "tool");

      tracer.endSpan(toolId, true);
      tracer.endSpan(miniAIId, true);
      tracer.endSpan(agentId, true);
      tracer.endSpan(root.spanId, true);

      // Verify tree structure
      expect(root.children).toHaveLength(1);
      expect(root.children[0].children).toHaveLength(1);
      expect(root.children[0].children[0].children).toHaveLength(1);
    });

    it("flattens spans depth-first", () => {
      const traceId = tracer.startTrace("root");
      const root = tracer.getTrace(traceId)!;

      const child1 = tracer.startSpan(traceId, root.spanId, "child1", "agent");
      const child2 = tracer.startSpan(traceId, root.spanId, "child2", "mini-ai");
      tracer.endSpan(child1, true);
      tracer.endSpan(child2, true);
      tracer.endSpan(root.spanId, true);

      const flat = tracer.flattenSpans(traceId);
      expect(flat).toHaveLength(3);
      expect(flat[0].operation).toBe("root");
      expect(flat[1].operation).toBe("child1");
      expect(flat[2].operation).toBe("child2");
    });

    it("gets trace duration", () => {
      const traceId = tracer.startTrace("test");
      const root = tracer.getTrace(traceId)!;
      tracer.endSpan(root.spanId, true);

      expect(tracer.getTraceDuration(traceId)).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 for unknown trace duration", () => {
      expect(tracer.getTraceDuration("nonexistent")).toBe(0);
    });

    it("returns empty for unknown trace flatten", () => {
      expect(tracer.flattenSpans("nonexistent")).toEqual([]);
    });

    it("clears all traces", () => {
      tracer.startTrace("a");
      tracer.startTrace("b");
      tracer.clear();
      expect(tracer.getAllTraces()).toHaveLength(0);
    });
  });

  // ============================================
  // METRICS COLLECTOR
  // ============================================

  describe("MetricsCollector", () => {
    let metrics: MetricsCollector;

    beforeEach(() => {
      metrics = new MetricsCollector();
    });

    it("records metric points", () => {
      metrics.record("test.metric", 42, { env: "test" });

      const points = metrics.getPoints("test.metric");
      expect(points).toHaveLength(1);
      expect(points[0].value).toBe(42);
      expect(points[0].tags.env).toBe("test");
    });

    it("increments counters", () => {
      metrics.increment("agent.count");
      metrics.increment("agent.count");
      metrics.increment("agent.count", 3);

      const points = metrics.getPoints("agent.count");
      expect(points).toHaveLength(3);
      expect(points.reduce((s, p) => s + p.value, 0)).toBe(5);
    });

    it("records timing metrics", () => {
      metrics.timing("agent.latency", 150);
      metrics.timing("agent.latency", 200);

      const summary = metrics.getSummary("agent.latency");
      expect(summary).toBeDefined();
      expect(summary!.count).toBe(2);
      expect(summary!.average).toBe(175);
      expect(summary!.min).toBe(150);
      expect(summary!.max).toBe(200);
    });

    it("computes percentile statistics", () => {
      // Add 100 points: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        metrics.timing("latency", i);
      }

      const summary = metrics.getSummary("latency");
      expect(summary).toBeDefined();
      expect(summary!.p50).toBe(50);
      expect(summary!.p95).toBe(95);
      expect(summary!.p99).toBe(99);
    });

    it("filters points by tag", () => {
      metrics.record("test", 1, { env: "prod" });
      metrics.record("test", 2, { env: "test" });
      metrics.record("test", 3, { env: "prod" });

      const prodPoints = metrics.getPointsByTag("test", "env", "prod");
      expect(prodPoints).toHaveLength(2);
      expect(prodPoints.every((p) => p.tags.env === "prod")).toBe(true);
    });

    it("returns undefined for unknown metric summary", () => {
      expect(metrics.getSummary("nonexistent")).toBeUndefined();
    });

    it("returns empty for unknown metric points", () => {
      expect(metrics.getPoints("nonexistent")).toEqual([]);
    });

    it("lists metric names", () => {
      metrics.record("a", 1);
      metrics.record("b", 2);
      metrics.record("a", 3);

      const names = metrics.getMetricNames();
      expect(names).toContain("a");
      expect(names).toContain("b");
    });

    it("getCounters sums .count metrics", () => {
      metrics.increment("agent.count");
      metrics.increment("agent.count");
      metrics.increment("workflow.count");

      const counters = metrics.getCounters();
      expect(counters["agent.count"]).toBe(2);
      expect(counters["workflow.count"]).toBe(1);
    });

    it("trims old points", () => {
      const smallMetrics = new MetricsCollector();
      // Override maxPointsPerMetric is private, but constructor uses default 1000
      // Just test that it doesn't crash with many points
      for (let i = 0; i < 2000; i++) {
        smallMetrics.record("test", i);
      }

      const points = smallMetrics.getPoints("test");
      expect(points.length).toBeLessThanOrEqual(1000);
    });

    it("clears all metrics", () => {
      metrics.record("a", 1);
      metrics.record("b", 2);
      metrics.clear();
      expect(metrics.getMetricNames()).toHaveLength(0);
    });
  });

  // ============================================
  // INTEGRATION
  // ============================================

  describe("integration", () => {
    it("tracer + logger + metrics work together", () => {
      const tracer = new ExecutionTracer();
      const logger = new StructuredLogger();
      const metrics = new MetricsCollector();

      // Simulate an agent execution
      const traceId = tracer.startTrace("agent:researcher:execute");
      const root = tracer.getTrace(traceId)!;

      logger.info("agent:researcher", "Starting execution", { traceId }, traceId);

      const childId = tracer.startSpan(traceId, root.spanId, "mini-ai:classifier", "mini-ai");
      logger.debug("mini-ai:classifier", "Classifying input", { traceId }, traceId);

      // Simulate work
      metrics.increment("agent.execution.count", 1, { agent: "researcher" });
      metrics.timing("agent.execution.duration", 150, { agent: "researcher" });

      tracer.endSpan(childId, true);
      tracer.endSpan(root.spanId, true);

      logger.info("agent:researcher", "Execution complete", { durationMs: root.durationMs }, traceId);

      // Verify
      expect(tracer.getTrace(traceId)).toBeDefined();
      expect(logger.getByTrace(traceId)).toHaveLength(3);
      expect(metrics.getSummary("agent.execution.duration")).toBeDefined();
    });
  });
});
