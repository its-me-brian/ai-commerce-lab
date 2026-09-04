// Health Check API
// Aggregated system health: providers, models, database, workflows.
// No auth required — this is a monitoring endpoint.

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
      error: error?.message,
    };
    if (error) overallStatus = "degraded";
  } catch (e) {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: e instanceof Error ? e.message : "Unknown error",
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
      error: error?.message,
    };
    if (data) {
      checks.providers.details = `${data.length} enabled`;
    }
    if (error) overallStatus = "degraded";
  } catch (e) {
    checks.providers = {
      status: "error",
      latencyMs: Date.now() - provStart,
      error: e instanceof Error ? e.message : "Unknown error",
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
      error: error?.message,
    };
    if (data) {
      checks.models.details = `${data.length} enabled`;
    }
  } catch (e) {
    checks.models = {
      status: "error",
      latencyMs: Date.now() - modelStart,
      error: e instanceof Error ? e.message : "Unknown error",
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
      error: error?.message,
    };
    checks.agents.details = `${count || 0} running`;
  } catch (e) {
    checks.agents = {
      status: "error",
      latencyMs: Date.now() - agentStart,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}
