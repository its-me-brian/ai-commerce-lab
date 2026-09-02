import { NextRequest, NextResponse } from "next/server";
import { getStructuredLogger, getExecutionTracer, getMetricsCollector } from "@/lib/ai/observability";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/ai/observability
// Query logs, traces, and metrics
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource") || "logs";
    const count = parseInt(searchParams.get("count") || "50");

    switch (resource) {
      case "logs": {
        const logger = getStructuredLogger();
        const severity = searchParams.get("severity") as "debug" | "info" | "warn" | "error" | "critical" | null;
        const component = searchParams.get("component");
        const traceId = searchParams.get("traceId");

        let entries;
        if (traceId) {
          entries = logger.getByTrace(traceId);
        } else if (severity) {
          entries = logger.getBySeverity(severity);
        } else if (component) {
          entries = logger.getByComponent(component);
        } else {
          entries = logger.getRecent(count);
        }

        return NextResponse.json({ success: true, logs: entries });
      }

      case "traces": {
        const tracer = getExecutionTracer();
        const traceId = searchParams.get("traceId");

        if (traceId) {
          const trace = tracer.getTrace(traceId);
          const flat = tracer.flattenSpans(traceId);
          return NextResponse.json({ success: true, trace, spans: flat });
        }

        const traces = tracer.getRecentTraces(count);
        return NextResponse.json({ success: true, traces });
      }

      case "metrics": {
        const metrics = getMetricsCollector();
        const metricName = searchParams.get("name");

        if (metricName) {
          const summary = metrics.getSummary(metricName);
          const points = metrics.getPoints(metricName, count);
          return NextResponse.json({ success: true, summary, points });
        }

        const names = metrics.getMetricNames();
        const summaries = names.map((n) => metrics.getSummary(n)).filter(Boolean);
        return NextResponse.json({ success: true, metrics: summaries });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown resource: ${resource}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
