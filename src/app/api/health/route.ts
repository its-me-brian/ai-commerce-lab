// Health Check Endpoint
// PHASE 8: Provides /api/health for load balancers, k8s probes, uptime monitors.
// Returns system status with optional detailed breakdown.

import { NextRequest, NextResponse } from "next/server";
import { getMetricsCollector } from "@/lib/ai/observability";
import { getResponseCache } from "@/lib/ai/response-cache";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    aiProviders: CheckResult;
    cache: CheckResult;
  };
}

interface CheckResult {
  status: "ok" | "degraded" | "error";
  latencyMs?: number;
  message?: string;
}

/**
 * GET /api/health
 * Basic health check for load balancers and monitoring.
 * Returns 200 if healthy, 503 if unhealthy.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: HealthStatus["checks"] = {
    database: { status: "ok" },
    aiProviders: { status: "ok" },
    cache: { status: "ok" },
  };

  // Check database
  try {
    const dbStart = Date.now();
    const { supabase } = await import("@/lib/database/supabase");
    const { error } = await supabase.from("agents").select("id").limit(1);
    checks.database.latencyMs = Date.now() - dbStart;

    if (error) {
      checks.database.status = "error";
      checks.database.message = error.message;
    }
  } catch (err) {
    checks.database.status = "error";
    checks.database.message = err instanceof Error ? err.message : "Unknown error";
  }

  // Check AI providers (just verify router is initialized)
  try {
    const { getRouter } = await import("@/lib/ai/router");
    const router = getRouter();
    const logs = router.getExecutionLogs();
    checks.aiProviders.status = logs.length > 0 ? "ok" : "ok"; // Router exists = ok
  } catch (err) {
    checks.aiProviders.status = "error";
    checks.aiProviders.message = err instanceof Error ? err.message : "Unknown error";
  }

  // Check cache
  try {
    const cache = getResponseCache();
    const stats = cache.getStats();
    checks.cache.status = "ok";
    checks.cache.message = `Hit rate: ${(stats.hitRate * 100).toFixed(1)}%, Entries: ${stats.entries}`;
  } catch (err) {
    checks.cache.status = "error";
    checks.cache.message = err instanceof Error ? err.message : "Unknown error";
  }

  // Determine overall status
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyError = Object.values(checks).some((c) => c.status === "error");

  const status: HealthStatus["status"] = allOk ? "healthy" : anyError ? "unhealthy" : "degraded";

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "unknown",
    checks,
  };

  return NextResponse.json(response, {
    status: status === "unhealthy" ? 503 : 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
