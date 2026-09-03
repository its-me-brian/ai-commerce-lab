import { NextRequest, NextResponse } from "next/server";
import { getStructuredLogger, getExecutionTracer, getMetricsCollector } from "@/lib/ai/observability";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

// GET /api/ai/observability
// Query logs, traces, and metrics
// Falls back to Supabase when in-memory data is empty (cold start)
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
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

        // Fallback to Supabase if in-memory is empty
        if (entries.length === 0) {
          try {
            const { supabase } = await import("@/lib/database/supabase");

            let query = supabase
              .from("structured_logs")
              .select("*")
              .eq("workspace_id", auth.workspaceId)
              .order("created_at", { ascending: false })
              .limit(count);

            if (severity) query = query.eq("severity", severity);
            if (component) query = query.eq("component", component);
            if (traceId) query = query.eq("trace_id", traceId);

            const { data, error } = await query;
            if (!error && data) {
              entries = data.map((row: Record<string, unknown>) => ({
                id: row.id,
                severity: row.severity,
                component: row.component,
                message: row.message,
                context: row.context,
                traceId: row.trace_id,
                durationMs: row.duration_ms,
                success: row.success,
                timestamp: new Date(row.created_at as string).getTime(),
              }));
            }
          } catch {
            // Supabase unavailable, return empty
          }
        }

        return NextResponse.json({ success: true, logs: entries });
      }

      case "traces": {
        const tracer = getExecutionTracer();
        const traceId = searchParams.get("traceId");

        if (traceId) {
          const trace = tracer.getTrace(traceId);
          const flat = tracer.flattenSpans(traceId);

          // Fallback to Supabase if in-memory is empty
          if (!trace && flat.length === 0) {
            try {
              const { supabase } = await import("@/lib/database/supabase");

              const { data: traceData } = await supabase
                .from("traces")
                .select("*")
                .eq("id", traceId)
                .eq("workspace_id", auth.workspaceId)
                .single();

              const { data: spansData } = await supabase
                .from("spans")
                .select("*")
                .eq("trace_id", traceId)
                .eq("workspace_id", auth.workspaceId)
                .order("started_at", { ascending: true });

              if (traceData) {
                return NextResponse.json({
                  success: true,
                  trace: traceData,
                  spans: spansData ?? [],
                });
              }
            } catch {
              // Supabase unavailable
            }
          }

          return NextResponse.json({ success: true, trace, spans: flat });
        }

        let traces = tracer.getRecentTraces(count);

        // Fallback to Supabase if in-memory is empty
        if (traces.length === 0) {
          try {
            const { supabase } = await import("@/lib/database/supabase");

            const { data, error } = await supabase
              .from("traces")
              .select("*")
              .eq("workspace_id", auth.workspaceId)
              .order("started_at", { ascending: false })
              .limit(count);

            if (!error && data) {
              // Return raw Supabase data (different shape than in-memory TraceSpan)
              return NextResponse.json({ success: true, traces: data, source: "supabase" });
            }
          } catch {
            // Supabase unavailable
          }
        }

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

        // Fallback to Supabase if in-memory is empty
        if (summaries.length === 0) {
          try {
            const { supabase } = await import("@/lib/database/supabase");

            const { data, error } = await supabase
              .from("metrics")
              .select("name")
              .eq("workspace_id", auth.workspaceId)
              .order("created_at", { ascending: false })
              .limit(count);

            if (!error && data) {
              const uniqueNames = [...new Set(data.map((r: Record<string, unknown>) => r.name as string))];
              return NextResponse.json({ success: true, metrics: uniqueNames.map((n) => ({ name: n })) });
            }
          } catch {
            // Supabase unavailable
          }
        }

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
