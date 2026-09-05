import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// GET /api/events
// Query app events with optional filters
export const GET = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("type");
    const severity = searchParams.get("severity");
    const agentId = searchParams.get("agentId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("app_events")
      .select("*")
      .eq("workspace_id", auth.workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) query = query.eq("event_type", eventType);
    if (severity) query = query.eq("severity", severity);
    if (agentId) query = query.eq("agent_id", agentId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
    }

    // Get total count for pagination
    const { count } = await supabase
      .from("app_events")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId);

    return NextResponse.json({ success: true, events: data, total: count });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});

// POST /api/events
// Log a new event
export const POST = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { eventType, severity, source, agentId, message, metadata } = body as {
      eventType?: string;
      severity?: string;
      source?: string;
      agentId?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    };

    if (!eventType || !message) {
      return NextResponse.json(
        { success: false, error: "eventType and message are required" },
        { status: 400 }
      );
    }

    const validSeverities = ["debug", "info", "warning", "error", "critical"];
    const sev = validSeverities.includes(severity || "") ? severity : "info";

    const { data, error } = await supabase
      .from("app_events")
      .insert({
        event_type: eventType,
        severity: sev,
        source: source || null,
        agent_id: agentId || null,
        message,
        metadata: metadata || {},
        workspace_id: auth.workspaceId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
