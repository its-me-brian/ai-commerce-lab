// Health Check API
// Aggregated system health: providers, models, database, workflows.
// No auth required — this is a monitoring endpoint.
// Error messages are sanitized to prevent leaking internal details.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

interface HealthCheck {
  status: "healthy" | "degraded" | "down";
  timestamp: string;
  checks: Record<string, {
    status: "ok" | "error";
    latencyMs?: number;
    error?: string;
    details?: string;
  }>;
}

/** Sanitize error message — never expose Supabase internals, connection strings, or stack traces. */
function sanitizeError(msg: string): string {
  if (/relation .* does not exist/i.test(msg)) return "Table not found";
  if (/permission denied/i.test(msg)) return "Permission denied";
  if (/connection refused/i.test(msg)) return "Connection failed";
  if (/timeout/i.test(msg)) return "Request timed out";
  if (/ECONNREFUSED/i.test(msg)) return "Connection failed";
  if (/invalid input/i.test(msg)) return "Invalid query";
  return "Internal error";
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const checks: HealthCheck["checks"] = {};
  let overallStatus: HealthCheck["status"] = "healthy";

  // 1. Database check
  const dbStart = Date.now();
  try {
    const { error } = await supabase.from("ai_providers").select("id").limit(1);
    checks.database = {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - dbStart,
      error: error ? sanitizeError(error.message) : undefined,
    };
    if (error) overallStatus = "degraded";
  } catch {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: "Connection failed",
    };
    overallStatus = "down";
  }

  // 2. Providers check
  const provStart = Date.now();
  try {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("id, enabled")
      .eq("enabled", true);
    checks.providers = {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - provStart,
      error: error ? sanitizeError(error.message) : undefined,
    };
    if (data) {
      checks.providers.details = `${data.length} enabled`;
    }
    if (error) overallStatus = "degraded";
  } catch {
    checks.providers = {
      status: "error",
      latencyMs: Date.now() - provStart,
      error: "Connection failed",
    };
  }

  // 3. Models check
  const modelStart = Date.now();
  try {
    const { data, error } = await supabase
      .from("ai_models")
      .select("id, enabled")
      .eq("enabled", true);
    checks.models = {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - modelStart,
      error: error ? sanitizeError(error.message) : undefined,
    };
    if (data) {
      checks.models.details = `${data.length} enabled`;
    }
  } catch {
    checks.models = {
      status: "error",
      latencyMs: Date.now() - modelStart,
      error: "Connection failed",
    };
  }

  // 4. Agents check — no workspace filter: system-wide running task count for health monitoring
  const agentStart = Date.now();
  try {
    const { count, error } = await supabase
      .from("agent_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");
    checks.agents = {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - agentStart,
      error: error ? sanitizeError(error.message) : undefined,
    };
    checks.agents.details = `${count || 0} running`;
  } catch {
    checks.agents = {
      status: "error",
      latencyMs: Date.now() - agentStart,
      error: "Connection failed",
    };
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}
