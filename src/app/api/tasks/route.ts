import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// GET /api/tasks
// List tasks with optional filters
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("agent_tasks")
      .select("*, agents(name)")
      .eq("workspace_id", auth.workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) query = query.eq("agent_id", agentId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
    }

    // Get total count
    let countQuery = supabase
      .from("agent_tasks")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId);

    if (agentId) countQuery = countQuery.eq("agent_id", agentId);
    if (status) countQuery = countQuery.eq("status", status);

    const { count } = await countQuery;

    return NextResponse.json({ success: true, tasks: data, total: count });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
