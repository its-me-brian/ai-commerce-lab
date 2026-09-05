// Observability System
// Structured logging, execution tracing, and metrics collection.
//
// Three components:
//   1. StructuredLogger — JSON-structured logs with context, replaces ad-hoc console.log
//   2. ExecutionTracer — tracks spans through agent/mini-AI/workflow execution chains
//   3. MetricsCollector — counts operations, durations, errors, aggregates over time
//
// This is NOT the same as the existing event-logger (fire-and-forget to Supabase)
// or the simple Logger class (in-memory text logs).
// This provides machine-parseable structured data for debugging and monitoring.

import { logger } from "../logging";

// ============================================
// STRUCTURED LOGGER
// ============================================

/**
 * Log severity levels.
 */
export type LogSeverity = "debug" | "info" | "warn" | "error" | "critical";

/**
 * Structured log entry.
 */
export interface StructuredLogEntry {
  /** Unique ID for this entry */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Severity */
  severity: LogSeverity;

  /** Component that produced this log (e.g., "agent-engine", "mini-ai:classifier") */
  component: string;

  /** Log message */
  message: string;

  /** Structured context data */
  context?: Record<string, unknown>;

  /** Trace ID to correlate with ExecutionTracer */
  traceId?: string;

  /** Duration in ms (for operation logs) */
  durationMs?: number;

  /** Whether the operation succeeded */
  success?: boolean;

  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
}

/**
 * Structured Logger — JSON-structured logs with context.
 */
export class StructuredLogger {
  private entries: StructuredLogEntry[] = [];
  private readonly maxEntries: number;
  private idCounter = 0;

  constructor(maxEntries: number = 5_000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a structured entry.
   */
  log(entry: Omit<StructuredLogEntry, "id" | "timestamp">): StructuredLogEntry {
    const full: StructuredLogEntry = {
      ...entry,
      id: `log-${++this.idCounter}`,
      timestamp: Date.now(),
    };

    this.entries.push(full);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console output for non-debug levels
    if (entry.severity !== "debug") {
      const prefix = `[${full.timestamp}] [${entry.severity.toUpperCase()}] [${entry.component}]`;
      const msg = `${prefix} ${entry.message}`;
      const ctx = entry.context ? JSON.stringify(entry.context) : "";
      switch (entry.severity) {
        case "error":
        case "critical":
          logger.error(msg, { error: String(ctx) });
          break;
        case "warn":
          logger.warn(msg, { detail: ctx });
          break;
        default:
          logger.info(msg, { detail: ctx });
      }
    }

    // Persist to Supabase (async, non-blocking)
    this.persistToSupabase(full).catch(() => {});

    return full;
  }

  /**
   * Persist a log entry to Supabase structured_logs table.
   * Non-blocking — failures are silently logged.
   */
  private async persistToSupabase(entry: StructuredLogEntry): Promise<void> {
    try {
      const { supabase } = await import("../database/supabase");
      await supabase.from("structured_logs").insert({
        id: entry.id,
        severity: entry.severity,
        component: entry.component,
        message: entry.message,
        context: entry.context ?? {},
        trace_id: entry.traceId ?? null,
        duration_ms: entry.durationMs ?? null,
        success: entry.success ?? null,
        workspace_id: entry.workspaceId ?? null,
        created_at: new Date(entry.timestamp).toISOString(),
      });
    } catch {
      // Silently fail — in-memory log still works
    }
  }

  /** Convenience: log info */
  info(component: string, message: string, context?: Record<string, unknown>, traceId?: string, workspaceId?: string): StructuredLogEntry {
    return this.log({ severity: "info", component, message, context, traceId, workspaceId });
  }

  /** Convenience: log warning */
  warn(component: string, message: string, context?: Record<string, unknown>, traceId?: string, workspaceId?: string): StructuredLogEntry {
    return this.log({ severity: "warn", component, message, context, traceId, workspaceId });
  }

  /** Convenience: log error */
  error(component: string, message: string, context?: Record<string, unknown>, traceId?: string, workspaceId?: string): StructuredLogEntry {
    return this.log({ severity: "error", component, message, context, traceId, workspaceId });
  }

  /** Convenience: log debug */
  debug(component: string, message: string, context?: Record<string, unknown>, traceId?: string, workspaceId?: string): StructuredLogEntry {
    return this.log({ severity: "debug", component, message, context, traceId, workspaceId });
  }

  /**
   * Log an operation with automatic duration tracking.
   * Returns the log entry on success.
   * Re-throws the original error on failure.
   */
  operation(
    component: string,
    message: string,
    fn: () => unknown,
    context?: Record<string, unknown>,
    workspaceId?: string
  ): StructuredLogEntry {
    const start = Date.now();
    let caughtError: unknown = null;
    let success = true;

    try {
      fn();
    } catch (err) {
      success = false;
      caughtError = err;
    } finally {
      const entry = this.log({
        severity: success ? "info" : "error",
        component,
        message,
        context: { ...context, result: success ? "success" : "error" },
        durationMs: Date.now() - start,
        success,
        workspaceId,
      });

      if (success) {
        return entry;
      }
    }

    // Re-throw original error after logging
    throw caughtError;
  }

  /**
   * Get recent entries.
   */
  getRecent(count: number = 50): StructuredLogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entries by severity.
   */
  getBySeverity(severity: LogSeverity): StructuredLogEntry[] {
    return this.entries.filter((e) => e.severity === severity);
  }

  /**
   * Get entries by component.
   */
  getByComponent(component: string): StructuredLogEntry[] {
    return this.entries.filter((e) => e.component === component);
  }

  /**
   * Get entries by trace ID.
   */
  getByTrace(traceId: string): StructuredLogEntry[] {
    return this.entries.filter((e) => e.traceId === traceId);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries = [];
  }
}

// ============================================
// EXECUTION TRACER
// ============================================

/**
 * A trace span represents a single unit of work within a trace.
 */
export interface TraceSpan {
  /** Span ID */
  spanId: string;

  /** Parent span ID (null for root) */
  parentSpanId: string | null;

  /** Trace ID (shared across all spans in a trace) */
  traceId: string;

  /** Operation name (e.g., "agent:researcher", "mini-ai:classifier") */
  operation: string;

  /** Component type */
  componentType: "agent" | "mini-ai" | "workflow" | "tool" | "system";

  /** Start time */
  startTime: number;

  /** End time (0 if still running) */
  endTime: number;

  /** Duration in ms (0 if still running) */
  durationMs: number;

  /** Whether the span completed successfully */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Span-level attributes */
  attributes: Record<string, unknown>;

  /** Children spans */
  children: TraceSpan[];

  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
}

/**
 * Execution Tracer — tracks spans through execution chains.
 */
export class ExecutionTracer {
  private traces: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private readonly maxTraces = 1_000;
  private traceCounter = 0;
  private spanCounter = 0;

  /**
   * Start a new trace. Returns the trace ID.
   */
  startTrace(rootOperation: string, attributes?: Record<string, unknown>, workspaceId?: string): string {
    const traceId = `trace-${++this.traceCounter}-${Date.now()}`;
    const spanId = `span-${++this.spanCounter}`;

    const rootSpan: TraceSpan = {
      spanId,
      parentSpanId: null,
      traceId,
      operation: rootOperation,
      componentType: "system",
      startTime: Date.now(),
      endTime: 0,
      durationMs: 0,
      success: true,
      attributes: attributes ?? {},
      children: [],
      workspaceId,
    };

    this.traces.set(traceId, rootSpan);
    this.activeSpans.set(spanId, rootSpan);

    // Trim old traces
    if (this.traces.size > this.maxTraces) {
      const oldest = this.traces.keys().next().value;
      if (oldest) this.traces.delete(oldest);
    }

    return traceId;
  }

  /**
   * Start a child span within a trace.
   */
  startSpan(
    traceId: string,
    parentSpanId: string,
    operation: string,
    componentType: TraceSpan["componentType"],
    attributes?: Record<string, unknown>,
    workspaceId?: string
  ): string {
    const spanId = `span-${++this.spanCounter}`;

    const span: TraceSpan = {
      spanId,
      parentSpanId,
      traceId,
      operation,
      componentType,
      startTime: Date.now(),
      endTime: 0,
      durationMs: 0,
      success: true,
      attributes: attributes ?? {},
      children: [],
      workspaceId,
    };

    // Attach to parent
    const parent = this.findSpan(traceId, parentSpanId);
    if (parent) {
      parent.children.push(span);
    }

    this.activeSpans.set(spanId, span);
    return spanId;
  }

  /**
   * End a span. Records duration and success.
   */
  endSpan(spanId: string, success: boolean = true, error?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.success = success;
    if (error) span.error = error;

    this.activeSpans.delete(spanId);

    // Persist to Supabase (async, non-blocking)
    this.persistSpan(span).catch(() => {});
  }

  /**
   * Persist a completed span to Supabase.
   */
  private async persistSpan(span: TraceSpan): Promise<void> {
    try {
      const { supabase } = await import("../database/supabase");

      // Persist the span
      await supabase.from("spans").insert({
        id: span.spanId,
        trace_id: span.traceId,
        parent_span_id: span.parentSpanId,
        operation: span.operation,
        component: span.componentType,
        status: span.success ? "completed" : "failed",
        started_at: new Date(span.startTime).toISOString(),
        completed_at: span.endTime ? new Date(span.endTime).toISOString() : null,
        duration_ms: span.durationMs || null,
        error: span.error ?? null,
        metadata: span.attributes ?? {},
        workspace_id: span.workspaceId ?? null,
      });

      // If this is the root span (no parent), also persist the trace
      if (!span.parentSpanId) {
        await supabase.from("traces").upsert({
          id: span.traceId,
          root_span_id: span.spanId,
          operation: span.operation,
          status: span.success ? "completed" : "failed",
          started_at: new Date(span.startTime).toISOString(),
          completed_at: span.endTime ? new Date(span.endTime).toISOString() : null,
          duration_ms: span.durationMs || null,
          metadata: span.attributes ?? {},
          workspace_id: span.workspaceId ?? null,
        });
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Add attributes to an active span.
   */
  setAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      Object.assign(span.attributes, attributes);
    }
  }

  /**
   * Get a complete trace by ID.
   */
  getTrace(traceId: string): TraceSpan | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces.
   */
  getAllTraces(): TraceSpan[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get recent traces.
   */
  getRecentTraces(count: number = 20): TraceSpan[] {
    return Array.from(this.traces.values()).slice(-count);
  }

  /**
   * Get trace duration (root span duration).
   */
  getTraceDuration(traceId: string): number {
    const trace = this.traces.get(traceId);
    return trace?.durationMs ?? 0;
  }

  /**
   * Flatten a trace tree into a list of spans (depth-first).
   */
  flattenSpans(traceId: string): TraceSpan[] {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    const result: TraceSpan[] = [];
    const walk = (span: TraceSpan) => {
      result.push(span);
      for (const child of span.children) {
        walk(child);
      }
    };
    walk(trace);
    return result;
  }

  /**
   * Clear all traces.
   */
  clear(): void {
    this.traces.clear();
    this.activeSpans.clear();
  }

  private findSpan(traceId: string, spanId: string): TraceSpan | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;

    const walk = (span: TraceSpan): TraceSpan | undefined => {
      if (span.spanId === spanId) return span;
      for (const child of span.children) {
        const found = walk(child);
        if (found) return found;
      }
      return undefined;
    };

    return walk(trace);
  }
}

// ============================================
// METRICS COLLECTOR
// ============================================

/**
 * A single metric data point.
 */
export interface MetricPoint {
  /** Metric name (e.g., "agent.execution.count", "mini-ai.latency.ms") */
  name: string;

  /** Metric value */
  value: number;

  /** Timestamp */
  timestamp: number;

  /** Tags for filtering/aggregation */
  tags: Record<string, string>;

  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
}

/**
 * Aggregated metric summary.
 */
export interface MetricSummary {
  /** Metric name */
  name: string;

  /** Number of data points */
  count: number;

  /** Sum of values */
  sum: number;

  /** Average value */
  average: number;

  /** Min value */
  min: number;

  /** Max value */
  max: number;

  /** P50 (median) */
  p50: number;

  /** P95 */
  p95: number;

  /** P99 */
  p99: number;

  /** Last value */
  last: number;
}

/**
 * Metrics Collector — counts operations, durations, errors.
 */
export class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private readonly maxPointsPerMetric = 1_000;

  /**
   * Record a metric point.
   */
  record(name: string, value: number, tags?: Record<string, string>, workspaceId?: string): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: Date.now(),
      tags: tags ?? {},
      workspaceId,
    };

    const existing = this.metrics.get(name) ?? [];
    existing.push(point);

    // Trim old points
    if (existing.length > this.maxPointsPerMetric) {
      const trimmed = existing.slice(-this.maxPointsPerMetric);
      this.metrics.set(name, trimmed);
    } else {
      this.metrics.set(name, existing);
    }

    // Persist to Supabase (async, non-blocking)
    this.persistToSupabase(point).catch(() => {});
  }

  /**
   * Persist a metric point to Supabase metrics table.
   */
  private async persistToSupabase(point: MetricPoint): Promise<void> {
    try {
      const { supabase } = await import("../database/supabase");
      await supabase.from("metrics").insert({
        name: point.name,
        value: point.value,
        tags: point.tags ?? {},
        workspace_id: point.workspaceId ?? null,
        created_at: new Date(point.timestamp).toISOString(),
      });
    } catch {
      // Silently fail
    }
  }

  /**
   * Increment a counter metric.
   */
  increment(name: string, amount: number = 1, tags?: Record<string, string>, workspaceId?: string): void {
    this.record(name, amount, tags, workspaceId);
  }

  /**
   * Record a timing/duration metric.
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>, workspaceId?: string): void {
    this.record(name, durationMs, tags, workspaceId);
  }

  /**
   * Get summary statistics for a metric.
   */
  getSummary(name: string): MetricSummary | undefined {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) return undefined;

    const values = points.map((p) => p.value).sort((a, b) => a - b);
    const sum = values.reduce((s, v) => s + v, 0);

    return {
      name,
      count: values.length,
      sum,
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      last: values[values.length - 1],
    };
  }

  /**
   * Get raw data points for a metric.
   */
  getPoints(name: string, count?: number): MetricPoint[] {
    const points = this.metrics.get(name) ?? [];
    return count ? points.slice(-count) : [...points];
  }

  /**
   * Get points filtered by tag.
   */
  getPointsByTag(name: string, tagKey: string, tagValue: string): MetricPoint[] {
    const points = this.metrics.get(name) ?? [];
    return points.filter((p) => p.tags[tagKey] === tagValue);
  }

  /**
   * Get all metric names.
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get counters for common patterns.
   */
  getCounters(): Record<string, number> {
    const counters: Record<string, number> = {};
    for (const [name, points] of this.metrics) {
      if (name.endsWith(".count")) {
        counters[name] = points.reduce((sum, p) => sum + p.value, 0);
      }
    }
    return counters;
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.metrics.clear();
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }
}

// ============================================
// SINGLETONS
// ============================================

let loggerInstance: StructuredLogger | null = null;
let tracerInstance: ExecutionTracer | null = null;
let metricsInstance: MetricsCollector | null = null;

export function getStructuredLogger(): StructuredLogger {
  if (!loggerInstance) loggerInstance = new StructuredLogger();
  return loggerInstance;
}

export function getExecutionTracer(): ExecutionTracer {
  if (!tracerInstance) tracerInstance = new ExecutionTracer();
  return tracerInstance;
}

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) metricsInstance = new MetricsCollector();
  return metricsInstance;
}

export function resetObservability(): void {
  loggerInstance = null;
  tracerInstance = null;
  metricsInstance = null;
}
